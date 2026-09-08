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
        $schedule = Schedule::with(['client', 'worker', 'service', 'services'])->find($this->scheduleId);

        if (! $schedule || ! $schedule->client) {
            return;
        }

        $phone = preg_replace('/\D/', '', (string) $schedule->client->phone);
        if (! str_starts_with($phone, '55')) {
            $phone = '55'.$phone;
        }

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

        if ($response->failed()) {
            Log::warning('Serviço de mensagens respondeu com erro', [
                'schedule_id' => $this->scheduleId,
                'status' => $response->status(),
                'body' => $response->body(),
            ]);
        }
    }
}
