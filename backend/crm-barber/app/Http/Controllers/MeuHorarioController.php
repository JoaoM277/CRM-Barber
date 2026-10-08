<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Traits\ValidaAgenda;
use App\Jobs\SendAppointmentWhatsapp;
use App\Models\Schedule;
use App\Support\Audit;
use App\Support\ComandaProdutos;
use App\Support\Fidelidade;
use App\Support\ListaEspera;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * "Meu horário": o cliente abre o link que recebeu (WhatsApp / tela de
 * sucesso) e vê, cancela ou remarca o próprio horário, sem login.
 * O token secreto no link identifica o agendamento; a barbearia vem do slug
 * (middleware tenant), então um token de outra barbearia dá 404.
 */
class MeuHorarioController extends Controller
{
    use ValidaAgenda;

    /** GET /b/{slug}/meu-horario/{token} */
    public function show(string $barbershop, string $token): JsonResponse
    {
        return response()->json($this->resumo($this->agendamento($token)));
    }

    /** POST /b/{slug}/meu-horario/{token}/cancelar */
    public function cancelar(string $barbershop, string $token): JsonResponse
    {
        $s = $this->agendamento($token);
        $this->exigirAlteravel($s);

        $s->update(['status' => Schedule::STATUS_CANCELADO, 'resposta_cliente_em' => now()]);
        ComandaProdutos::devolverTudo($s);
        ListaEspera::vagaAberta($s);
        Audit::logFor($s->barbershop_id, 'agendamento.cancelado_cliente', $s, 'Cliente cancelou pelo link');

        return response()->json(['message' => 'Horário cancelado.', 'horario' => $this->resumo($s->fresh())]);
    }

    /** POST /b/{slug}/meu-horario/{token}/remarcar {dataAgendamento, horario, barbeiroId?} */
    public function remarcar(Request $request, string $barbershop, string $token): JsonResponse
    {
        $s = $this->agendamento($token);
        $this->exigirAlteravel($s);

        $data = $request->validate([
            'dataAgendamento' => 'required|date',
            'horario' => ['required', 'regex:/^\d{2}:\d{2}$/'],
            'barbeiroId' => ['sometimes', 'integer', Rule::exists('workers', 'id')->where('barbershop_id', $s->barbershop_id)->where('active', true)->whereNull('deleted_at')],
        ]);

        $workerId = (int) ($data['barbeiroId'] ?? $s->worker_id);
        $dateStr = Carbon::parse($data['dataAgendamento'])->format('Y-m-d');
        $startStr = $data['horario'].':00';
        $endStr = Carbon::parse($startStr)->addMinutes($this->scheduleDurationMinutes($s))->format('H:i:s');

        // a nova data também precisa respeitar a antecedência mínima
        $horas = (int) $s->barbershop->antecedencia_alteracao_horas;
        if (Carbon::parse("{$dateStr} {$data['horario']}")->lessThan(now()->addHours($horas))) {
            throw ValidationException::withMessages([
                'horario' => [$horas ? "Escolha um horário com pelo menos {$horas}h de antecedência." : 'Esse horário já passou.'],
            ]);
        }

        $this->assertDentroDoExpediente($dateStr, $startStr, $endStr);

        $horarioAntigo = $s->replicate();

        DB::transaction(function () use ($s, $workerId, $dateStr, $startStr, $endStr) {
            // mesma trava do agendamento novo: serializa disputas pelo slot
            Schedule::where('worker_id', $workerId)->whereDate('date', $dateStr)->lockForUpdate()->get();
            $this->assertHorarioLivre($workerId, $dateStr, $startStr, $endStr, $s->id);

            $s->update([
                'worker_id' => $workerId,
                'date' => $dateStr,
                'start_time' => $startStr,
                'end_time' => $endStr,
                // novo horário = lembretes de novo
                'lembrete_24h_em' => null,
                'lembrete_2h_em' => null,
                'resposta_cliente_em' => now(),
            ]);
        });

        // o horário antigo vagou; e se ele estava na lista de espera do novo dia, sai dela
        ListaEspera::vagaAberta($horarioAntigo);
        ListaEspera::agendou($s->barbershop_id, $s->client_id, $dateStr);

        Audit::logFor($s->barbershop_id, 'agendamento.remarcado_cliente', $s, "Cliente remarcou pelo link para {$dateStr} {$data['horario']}");

        try {
            Bus::dispatch(new SendAppointmentWhatsapp($s->id, SendAppointmentWhatsapp::REMARCADO));
        } catch (\Throwable $e) {
            Log::warning('Falha ao enfileirar confirmação da remarcação: '.$e->getMessage());
        }

        return response()->json(['message' => 'Horário remarcado.', 'horario' => $this->resumo($s->fresh())]);
    }

    private function agendamento(string $token): Schedule
    {
        abort_unless(strlen($token) === 40 && ctype_alnum($token), 404, 'Link inválido.');

        return Schedule::with(['worker', 'service', 'services', 'barbershop', 'client'])
            ->where('token_cliente', $token)
            ->firstOr(fn () => abort(404, 'Não encontramos este horário. Confira o link.'));
    }

    private function exigirAlteravel(Schedule $s): void
    {
        if ($motivo = $s->bloqueioAlteracaoCliente()) {
            abort(response()->json(['code' => 'alteracao_bloqueada', 'message' => $motivo], 422));
        }
    }

    /** Só o necessário para a tela do cliente (nada de telefone, valores internos etc.). */
    private function resumo(Schedule $s): array
    {
        $servicos = $s->servicosResolvidos();
        $motivo = $s->bloqueioAlteracaoCliente();

        return [
            'status' => $s->status,
            'date' => substr((string) $s->date, 0, 10),
            'start_time' => substr((string) $s->start_time, 0, 5),
            'end_time' => substr((string) $s->end_time, 0, 5),
            'duracao' => $this->scheduleDurationMinutes($s),
            'cliente' => strtok((string) $s->client?->name, ' ') ?: null,
            'profissional' => $s->worker ? ['id' => $s->worker->id, 'name' => $s->worker->name, 'photo' => $s->worker->photo] : null,
            'servicos' => $servicos->pluck('name')->values(),
            'valor' => (float) ($s->price ?? $servicos->sum(fn ($x) => (float) $x->price)),
            'pode_alterar' => $motivo === null,
            'motivo' => $motivo,
            'antecedencia_horas' => (int) $s->barbershop?->antecedencia_alteracao_horas,
            // cartão de selos do cliente (null com a fidelidade desligada)
            'fidelidade' => $s->barbershop && $s->client_id ? Fidelidade::resumo($s->barbershop, $s->client_id) : null,
        ];
    }
}
