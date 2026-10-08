<?php

namespace App\Jobs;

use App\Models\Instance;
use App\Models\Plan;
use App\Models\Schedule;
use App\Models\Subscription;
use App\Support\Phone;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\RateLimiter;
use Throwable;

class SendAppointmentWhatsapp implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * Ritmo máximo de mensagens por barbearia (protege o número contra bloqueio
     * do WhatsApp por rajada). Acima disso o job volta para a fila e sai depois.
     */
    public const POR_MINUTO = 20;

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

    public function __construct(public int $scheduleId, public string $trigger = self::AGENDAMENTO) {}

    public function handle(): void
    {
        $schedule = Schedule::with(['client', 'worker', 'service', 'services', 'barbershop'])->find($this->scheduleId);

        if (! $schedule || ! $schedule->client) {
            return;
        }

        // WhatsApp automático é recurso de plano (sem assinatura registrada = legado, envia)
        $sub = Subscription::with('plan')->where('barbershop_id', $schedule->barbershop_id)->first();
        if ($sub && ! $sub->hasFeature(Plan::FEATURE_WHATSAPP)) {
            return;
        }

        $ritmo = 'whatsapp-envios:'.$schedule->barbershop_id;
        if (RateLimiter::tooManyAttempts($ritmo, self::POR_MINUTO)) {
            $this->release(RateLimiter::availableIn($ritmo) + random_int(1, 15));

            return;
        }
        RateLimiter::hit($ritmo, 60);

        $phone = Phone::normalizeBr((string) $schedule->client->phone);

        $url = rtrim(config('services.messages.url'), '/');

        // Instância da Evolution a usar: a conectada da barbearia do agendamento.
        // Sem instância conectada, o Node registra SEM_INSTANCIA e nada é enviado.
        $instanceName = Instance::query()
            ->where('barbershop_id', $schedule->barbershop_id)
            ->where('status', Instance::STATUS_CONECTADO)
            ->latest('last_connected_at')
            ->value('name');

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
        ];

        if ($instanceName) {
            $payload['instance'] = $instanceName;
        }

        $response = Http::timeout(15)->post("{$url}/message", $payload);

        // O Node responde 200 mesmo quando o envio falha (corpo status:"failed").
        // "dispatched" = enviado; "held" = lembrete retido por horário (ok, não é erro).
        $statusMsg = data_get($response->json(), 'status');
        $enviou = $response->successful() && in_array($statusMsg, ['dispatched', 'held'], true);

        if (! $enviou) {
            Log::warning('Confirmação de WhatsApp não saiu', [
                'schedule_id' => $this->scheduleId,
                'http' => $response->status(),
                'body' => $response->body(),
            ]);

            // relança pra fila tentar de novo (até $tries); no fim cai em failed()
            throw new \RuntimeException('Message service não confirmou o envio ('.($statusMsg ?? 'HTTP '.$response->status()).')');
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
