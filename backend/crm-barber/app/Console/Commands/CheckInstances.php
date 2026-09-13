<?php

namespace App\Console\Commands;

use App\Models\Instance;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class CheckInstances extends Command
{
    protected $signature = 'instances:check';

    protected $description = 'Verifica no provedor o estado de cada instância de WhatsApp e atualiza o status local; alerta quando uma cai.';

    public function handle(): int
    {
        $baseUrl = rtrim((string) config('services.messages.url'), '/');
        $instances = Instance::query()->get();

        if ($instances->isEmpty()) {
            $this->info('Nenhuma instância cadastrada.');

            return self::SUCCESS;
        }

        foreach ($instances as $instance) {
            $anterior = $instance->status;

            try {
                $res = Http::timeout(15)->post("{$baseUrl}/instance/verify", ['name' => $instance->name]);
                $novo = $res->successful()
                    ? Instance::mapEvolutionState(data_get($res->json(), 'status'))
                    : Instance::STATUS_ERRO;
            } catch (\Throwable $e) {
                $novo = Instance::STATUS_ERRO;
            }

            $instance->status = $novo;
            if ($novo === Instance::STATUS_CONECTADO) {
                $instance->last_connected_at = now();
            }
            $instance->save();

            $this->line("[{$instance->name}] {$anterior} -> {$novo}");

            // alerta na transição de conectado -> qualquer coisa que não seja conectado
            if ($anterior === Instance::STATUS_CONECTADO && $novo !== Instance::STATUS_CONECTADO) {
                Log::error('Instância de WhatsApp caiu — confirmações não serão enviadas', [
                    'instance' => $instance->name,
                    'barbershop_id' => $instance->barbershop_id,
                    'novo_status' => $novo,
                ]);
            }
        }

        return self::SUCCESS;
    }
}
