<?php

namespace App\Jobs;

use App\Models\Instance;
use App\Models\Schedule;
use App\Support\Phone;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

class SendAppointmentWhatsapp implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public int $backoff = 30;

    public function __construct(public int $scheduleId) {}

    public function handle(): void
    {
        $schedule = Schedule::with(['client', 'worker', 'service', 'services'])->find($this->scheduleId);

        if (! $schedule || ! $schedule->client) {
            return;
        }

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
            'trigger' => 'AGENDAMENTO',
            'date' => \Illuminate\Support\Carbon::parse($schedule->date)->format('Y-m-d'),
            'time' => substr((string) $schedule->start_time, 0, 5),
            'barber' => $schedule->worker?->name,
            'services' => $servicos,
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
