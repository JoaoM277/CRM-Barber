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
            // link para agendar de novo (aviso de cancelamento)
            'link' => $schedule->barbershop
                ? rtrim(config('app.frontend_url'), '/').'/?b='.$schedule->barbershop->slug
                : null,
            // link para o próprio cliente cancelar/remarcar, se ainda pode
            'manage_link' => in_array($this->trigger, self::COM_LINK_DO_CLIENTE, true) && $schedule->bloqueioAlteracaoCliente() === null
                ? $schedule->linkCliente()
                : null,
        ];

        $this->enviarMensagem($schedule->barbershop_id, $payload, ['schedule_id' => $this->scheduleId]);
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
