<?php

namespace App\Jobs;

use App\Jobs\Concerns\EnviaWhatsapp;
use App\Models\Schedule;
use App\Support\Phone;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Throwable;

class SendAppointmentWhatsapp implements ShouldQueue
{
    use Dispatchable, EnviaWhatsapp, InteractsWithQueue, Queueable, SerializesModels;

    // adiamentos pelo limite de ritmo contam como tentativa no Laravel; erros
    // de verdade (falha no envio) continuam limitados a 3 por $maxExceptions
    public int $tries = 25;

    public int $maxExceptions = 3;

    public int $backoff = 30;

    /** Gatilhos que o serviço de mensagens conhece (textos em messages-service/src/dictionary). */
    public const AGENDAMENTO = 'AGENDAMENTO';

    public const LEMBRETE_24H = 'LEMBRETE_24H';

    public const LEMBRETE_2H = 'LEMBRETE_2H';

    public const RESPOSTA_CONFIRMADO = 'RESPOSTA_CONFIRMADO';

    public const RESPOSTA_CANCELADO = 'RESPOSTA_CANCELADO';

    /** Aviso ao cliente de que a barbearia cancelou o horário. */
    public const CANCELAMENTO = 'CANCELAMENTO';

    /** Confirmação do novo horário quando o cliente remarca pelo link. */
    public const REMARCADO = 'REMARCADO';

    /** Avaliação pós-atendimento: o pedido e o agradecimento (nota alta / baixa). */
    public const AVALIACAO_PEDIDO = 'AVALIACAO_PEDIDO';

    public const AVALIACAO_ALTA = 'AVALIACAO_ALTA';

    public const AVALIACAO_BAIXA = 'AVALIACAO_BAIXA';

    /** Faltou (falta automática não revertida): mensagem de apoio no dia seguinte. */
    public const APOIO_FALTA = 'APOIO_FALTA';

    /** Fidelidade: o cliente completou o cartão de selos. */
    public const FIDELIDADE_PREMIO = 'FIDELIDADE_PREMIO';

    /** Mensagens que levam o link "meu horário" (cancelar/remarcar). */
    private const COM_LINK_DO_CLIENTE = [self::AGENDAMENTO, self::REMARCADO, self::LEMBRETE_24H];

    public function __construct(public int $scheduleId, public string $trigger = self::AGENDAMENTO) {}

    public function handle(): void
    {
        $schedule = Schedule::with(['client', 'worker', 'service', 'services', 'barbershop'])->find($this->scheduleId);

        if (! $schedule || ! $schedule->client) {
            return;
        }

        if (! $this->podeEnviar($schedule->barbershop_id)) {
            return;
        }

        $phone = Phone::normalizeBr((string) $schedule->client->phone);

        $servicos = $schedule->servicosResolvidos()->pluck('name')->filter()->values()->all();

        $payload = [
            'phone' => $phone,
            'name' => $schedule->client->name,
            'trigger' => $this->trigger,
            'date' => \Illuminate\Support\Carbon::parse($schedule->date)->format('Y-m-d'),
            'time' => substr((string) $schedule->start_time, 0, 5),
            'barber' => $schedule->worker?->name,
            'services' => $servicos,
            // o registro da mensagem fica no cliente certo (LGPD: exportar/apagar)
            'client_id' => $schedule->client_id,
            'barbershop' => $schedule->barbershop?->name,
            // lembrete pede "1 confirma / 2 cancela" só enquanto o cliente não confirmou
            'ask_reply' => str_starts_with($this->trigger, 'LEMBRETE') && $schedule->status === Schedule::STATUS_PENDENTE,
            // "2 para cancelar" só se a barbearia permite cancelar pelo lembrete
            'allow_cancel' => (bool) ($schedule->barbershop?->cancelar_pelo_lembrete ?? true),
            // link para agendar de novo (aviso de cancelamento, apoio à falta)
            'link' => $schedule->barbershop
                ? rtrim(config('app.frontend_url'), '/').'/?b='.$schedule->barbershop->slug
                : null,
            // fidelidade: meta e prêmio do cartão de selos
            'meta' => $this->trigger === self::FIDELIDADE_PREMIO ? (int) $schedule->barbershop?->fidelidade_meta : null,
            'premio' => $this->trigger === self::FIDELIDADE_PREMIO ? $schedule->barbershop?->fidelidade_premio : null,
            // avaliação no Google (agradecimento de nota alta)
            'review_link' => $this->trigger === self::AVALIACAO_ALTA && $schedule->barbershop?->avaliacao_google ? ($schedule->barbershop->google_review_url ?: null) : null,
            // link para o próprio cliente cancelar/remarcar, se ainda pode
            // (pendente: vai sempre, para o cliente poder confirmar presença)
            'manage_link' => in_array($this->trigger, self::COM_LINK_DO_CLIENTE, true)
                && ($schedule->bloqueioAlteracaoCliente() === null || ($schedule->status === Schedule::STATUS_PENDENTE && ! $schedule->inicio()->isPast()))
                ? $schedule->linkCliente()
                : null,
        ];

        $status = $this->enviarMensagem($schedule->barbershop_id, $payload, ['schedule_id' => $this->scheduleId]);

        // o cliente recebeu o "responda 1 para confirmar": a partir daqui, se não
        // confirmar, pode cair em falta automática (ver agenda:faltas)
        // (vale também a confirmação do agendamento com o link "confirmar presença")
        $pediuConfirmacao = $payload['ask_reply'] || ($this->trigger === self::AGENDAMENTO && $payload['manage_link'] && $schedule->status === Schedule::STATUS_PENDENTE);
        if ($pediuConfirmacao && $status === 'dispatched') {
            Schedule::withoutGlobalScopes()->whereKey($schedule->id)->whereNull('confirmacao_pedida_em')->update(['confirmacao_pedida_em' => now()]);
        }
    }

    /**
     * Chamado quando o job esgota as tentativas. Ponto único pra alertar
     * (log agora; plugar Sentry/e-mail pro dono depois).
     */
    public function failed(Throwable $e): void
    {
        Log::error('SendAppointmentWhatsapp falhou definitivamente — confirmação NÃO enviada', [
            'schedule_id' => $this->scheduleId,
            'erro' => $e->getMessage(),
        ]);
    }
}
