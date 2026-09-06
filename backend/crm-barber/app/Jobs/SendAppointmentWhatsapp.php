<?php

namespace App\Jobs;

use App\Models\Instance;
use App\Models\Schedule;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class SendAppointmentWhatsapp implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public int $backoff = 30;

    public function __construct(public int $scheduleId) {}

    public function handle(): void
    {
        $schedule = Schedule::with(['client', 'worker'])->find($this->scheduleId);

        if (! $schedule || ! $schedule->client) {
            return;
        }

        $phone = preg_replace('/\D/', '', (string) $schedule->client->phone);
        if (! str_starts_with($phone, '55')) {
            $phone = '55'.$phone;
        }

        $url = rtrim(config('services.messages.url'), '/');

        // Instância da Evolution a usar: a conectada da barbearia do agendamento,
        // senão a mais recente conectada (cenário 1 barbearia). Sem instância,
        // o Node cai no provider de fallback (Infobip).
        $barbershopId = optional($schedule->worker)->barbershop_id
            ?? optional($schedule->client)->barbershop_id;

        $instanceName = Instance::query()
            ->where('status', Instance::STATUS_CONECTADO)
            ->when($barbershopId, fn ($q) => $q->where('barbershop_id', $barbershopId))
            ->latest('last_connected_at')
            ->value('name');

        $payload = [
            'phone' => $phone,
            'name' => $schedule->client->name,
            'trigger' => 'AGENDAMENTO',
            'date' => \Illuminate\Support\Carbon::parse($schedule->date)->format('Y-m-d'),
            'time' => substr((string) $schedule->start_time, 0, 5),
            'barber' => $schedule->worker?->name,
        ];

        if ($instanceName) {
            $payload['instance'] = $instanceName;
        }

        $response = Http::timeout(15)->post("{$url}/message", $payload);

        if ($response->failed()) {
            Log::warning('Serviço de mensagens respondeu com erro', [
                'schedule_id' => $this->scheduleId,
                'status' => $response->status(),
                'body' => $response->body(),
            ]);
        }
    }
}
