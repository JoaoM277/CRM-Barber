<?php

namespace App\Http\Controllers;

use App\Jobs\SendAppointmentWhatsapp;
use App\Models\Client;
use App\Models\Instance;
use App\Models\Schedule;
use App\Support\Audit;
use App\Support\Phone;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * POST /webhooks/evolution/{token}
 *
 * Mensagens recebidas no WhatsApp da barbearia (evento MESSAGES_UPSERT da
 * Evolution). Só interessa a resposta ao lembrete: "1" confirma e "2" cancela
 * o próximo horário do cliente. Qualquer outra mensagem é ignorada.
 * Sempre responde 200 para a Evolution não ficar reenviando.
 */
class EvolutionWebhookController extends Controller
{
    private const CONFIRMA = ['1', 'sim', 's', 'confirmo', 'confirmar', 'confirmado', 'ok', 'certo', 'vou'];

    private const CANCELA = ['2', 'nao', 'n', 'cancelar', 'cancela', 'cancelo', 'cancelado', 'desmarcar', 'nao vou'];

    /** Não quer mais receber os convites de reativação. */
    private const SAIR = ['sair', 'parar', 'pare', 'stop', 'descadastrar', 'nao quero mais'];

    public function __invoke(Request $request, string $token): JsonResponse
    {
        $esperado = (string) config('services.evolution.webhook_token');
        if ($esperado === '' || ! hash_equals($esperado, $token)) {
            return response()->json(['message' => 'Token inválido.'], 401);
        }

        $dados = $request->input('data', []);
        if (data_get($dados, 'key.fromMe') || ! is_string($request->input('instance'))) {
            return $this->ok('ignorado');
        }

        $texto = (string) (data_get($dados, 'message.conversation') ?? data_get($dados, 'message.extendedTextMessage.text'));
        $acao = $this->interpretar($texto);
        $nota = $this->nota($texto);
        // texto livre também interessa: pode ser o comentário de uma avaliação baixa
        if (trim($texto) === '') {
            return $this->ok('ignorado');
        }

        $instancia = Instance::where('name', $request->input('instance'))->first();
        $telefones = $this->telefones($dados);
        if (! $instancia || ! $telefones) {
            return $this->ok('ignorado');
        }

        $cliente = Client::withoutGlobalScopes()->whereNull('deleted_at')
            ->where('barbershop_id', $instancia->barbershop_id)
            ->whereIn('phone', $telefones)
            ->first();
        if (! $cliente) {
            return $this->ok('ignorado');
        }

        if ($acao === 'sair') {
            $cliente->forceFill(['reativacao_bloqueada_em' => now()])->save();
            Audit::logFor($instancia->barbershop_id, 'cliente.reativacao_bloqueada', $cliente, 'Cliente pediu para não receber convites de reativação');

            return $this->ok('sair');
        }

        // o próximo horário dele que recebeu lembrete e ainda está em aberto
        $agendamento = Schedule::withoutGlobalScopes()
            ->where('barbershop_id', $instancia->barbershop_id)
            ->where('client_id', $cliente->id)
            ->whereIn('status', [Schedule::STATUS_PENDENTE, Schedule::STATUS_CONFIRMADO])
            ->where(fn ($q) => $q->whereNotNull('lembrete_24h_em')->orWhereNotNull('lembrete_2h_em'))
            ->where('date', '>=', now()->toDateString())
            ->orderBy('date')->orderBy('start_time')
            ->get()
            ->first(fn (Schedule $s) => now()->lessThan(\Illuminate\Support\Carbon::parse(substr((string) $s->date, 0, 10).' '.substr((string) $s->start_time, 0, 5))));

        // avaliação pedida nas últimas 48h e ainda sem nota
        $avaliacao = Schedule::withoutGlobalScopes()
            ->where('barbershop_id', $instancia->barbershop_id)
            ->where('client_id', $cliente->id)
            ->where('avaliacao_pedida_em', '>=', now()->subHours(48))
            ->whereNull('avaliacao_nota')
            ->latest('avaliacao_pedida_em')
            ->first();

        // "1" e "2" também respondem ao lembrete: vale a pergunta enviada por último
        if ($nota && $avaliacao) {
            $lembreteEm = $agendamento ? max($agendamento->lembrete_24h_em, $agendamento->lembrete_2h_em) : null;
            if (! $lembreteEm || $avaliacao->avaliacao_pedida_em->greaterThanOrEqualTo($lembreteEm)) {
                return $this->registrarNota($avaliacao, $nota);
            }
        }

        if (! $acao) {
            return $nota ? $this->ok('ignorado') : $this->comentario($instancia->barbershop_id, $cliente->id, $texto);
        }

        if (! $agendamento) {
            return $this->ok('sem agendamento');
        }

        if ($acao === 'confirmar') {
            if ($agendamento->status === Schedule::STATUS_CONFIRMADO) {
                return $this->ok('já confirmado');
            }
            $agendamento->update(['status' => Schedule::STATUS_CONFIRMADO, 'resposta_cliente_em' => now()]);
            Audit::logFor($instancia->barbershop_id, 'agendamento.confirmado_cliente', $agendamento, 'Cliente confirmou pelo WhatsApp');
            SendAppointmentWhatsapp::dispatch($agendamento->id, SendAppointmentWhatsapp::RESPOSTA_CONFIRMADO);
        } else {
            // a barbearia pode desligar o cancelamento pelo lembrete (aí o "2" é ignorado)
            if (! \App\Models\Barbershop::whereKey($instancia->barbershop_id)->value('cancelar_pelo_lembrete')) {
                return $this->ok('cancelamento pelo lembrete desligado');
            }
            $agendamento->update(['status' => Schedule::STATUS_CANCELADO, 'resposta_cliente_em' => now()]);
            \App\Support\ComandaProdutos::devolverTudo($agendamento);
            \App\Support\ListaEspera::vagaAberta($agendamento);
            Audit::logFor($instancia->barbershop_id, 'agendamento.cancelado_cliente', $agendamento, 'Cliente cancelou pelo WhatsApp');
            SendAppointmentWhatsapp::dispatch($agendamento->id, SendAppointmentWhatsapp::RESPOSTA_CANCELADO);
        }

        return $this->ok($acao);
    }

    private function registrarNota(Schedule $s, int $nota): JsonResponse
    {
        $s->update(['avaliacao_nota' => $nota, 'avaliacao_em' => now()]);
        Audit::logFor($s->barbershop_id, 'agendamento.avaliado', $s, "Cliente deu nota {$nota} ao atendimento");
        SendAppointmentWhatsapp::dispatch($s->id, $nota >= 4 ? SendAppointmentWhatsapp::AVALIACAO_ALTA : SendAppointmentWhatsapp::AVALIACAO_BAIXA);

        return $this->ok('avaliacao');
    }

    /** Depois da nota, a próxima mensagem (em até 24h) vira o comentário. */
    private function comentario(int $barbershopId, int $clienteId, string $texto): JsonResponse
    {
        $s = Schedule::withoutGlobalScopes()
            ->where('barbershop_id', $barbershopId)
            ->where('client_id', $clienteId)
            ->whereNotNull('avaliacao_nota')
            ->where('avaliacao_em', '>=', now()->subHours(24))
            ->whereNull('avaliacao_comentario')
            ->latest('avaliacao_em')
            ->first();

        if (! $s) {
            return $this->ok('ignorado');
        }

        $s->update(['avaliacao_comentario' => Str::limit(trim($texto), 990)]);

        return $this->ok('comentario');
    }

    /** Nota de 1 a 5 ("5", "5 estrelas", "4/5", "nota 3"). */
    private function nota(string $texto): ?int
    {
        $t = trim(Str::lower(Str::ascii($texto)), " \t\n\r.!?*");

        return preg_match('/^(?:nota )?([1-5])(?: ?estrelas?| ?de 5| ?\/ ?5)?$/', $t, $m) ? (int) $m[1] : null;
    }

    private function interpretar(string $texto): ?string
    {
        $t = trim(Str::lower(Str::ascii($texto)), " \t\n\r.!?*");
        if ($t === '' || mb_strlen($t) > 30) {
            return null; // mensagem longa = conversa, não resposta ao lembrete
        }
        if (in_array($t, self::CONFIRMA, true)) {
            return 'confirmar';
        }
        if (in_array($t, self::CANCELA, true)) {
            return 'cancelar';
        }
        if (in_array($t, self::SAIR, true)) {
            return 'sair';
        }

        return null;
    }

    /**
     * Telefone de quem mandou, nas duas formas possíveis no Brasil (com e sem o
     * 9 extra: o WhatsApp às vezes identifica o número antigo de 8 dígitos).
     * Aceita o identificador novo (@lid) quando a Evolution manda o número junto.
     */
    private function telefones(array $dados): array
    {
        $jid = (string) data_get($dados, 'key.remoteJid', '');
        if (! str_ends_with($jid, '@s.whatsapp.net')) {
            $jid = (string) (data_get($dados, 'key.senderPn') ?? data_get($dados, 'key.remoteJidAlt') ?? '');
        }
        $digitos = preg_replace('/\D/', '', explode('@', $jid)[0]);
        if (strlen($digitos) < 12) {
            return [];
        }

        $base = Phone::normalizeBr($digitos);
        $variantes = [$base];
        if (strlen($base) === 12) {                    // 55 + DDD + 8 dígitos → com o 9
            $variantes[] = substr($base, 0, 4).'9'.substr($base, 4);
        } elseif (strlen($base) === 13 && $base[4] === '9') { // com o 9 → sem
            $variantes[] = substr($base, 0, 4).substr($base, 5);
        }

        return array_values(array_unique($variantes));
    }

    private function ok(string $resultado): JsonResponse
    {
        return response()->json(['resultado' => $resultado]);
    }
}
