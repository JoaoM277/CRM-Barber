<?php

namespace Database\Seeders;

use App\Models\Client;
use App\Models\Schedule;
use App\Models\Service;
use App\Models\Worker;
use App\Support\TenantContext;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;

class ScheduleSeeder extends Seeder
{
    /**
     * Alguns agendamentos de exemplo para a barbearia do TenantContext,
     * resolvendo cliente/profissional/serviço dentro do próprio tenant.
     */
    public function run(): void
    {
        $bsId = app(TenantContext::class)->id();

        $clientes = Client::withoutGlobalScope('tenant')->where('barbershop_id', $bsId)->orderBy('id')->take(6)->get();
        $profissionais = Worker::withoutGlobalScope('tenant')->where('barbershop_id', $bsId)->where('active', true)->orderBy('id')->take(4)->get();
        $servicos = Service::withoutGlobalScope('tenant')->where('barbershop_id', $bsId)->where('active', true)->orderBy('id')->take(4)->get();

        if ($clientes->isEmpty() || $profissionais->isEmpty() || $servicos->isEmpty()) {
            return;
        }

        $base = Carbon::today()->addDay();

        for ($i = 0; $i < 6; $i++) {
            $cliente = $clientes[$i % $clientes->count()];
            $worker = $profissionais[$i % $profissionais->count()];
            $servico = $servicos[$i % $servicos->count()];

            $dur = (int) ($servico->duration_time ?: 30);
            $inicio = Carbon::parse('09:00')->addMinutes($i * 60);
            $fim = (clone $inicio)->addMinutes($dur);
            $data = (clone $base)->addDays(intdiv($i, 3));

            // pula domingo
            if ($data->dayOfWeek === 0) {
                $data->addDay();
            }

            $preco = (float) $servico->price;

            $schedule = Schedule::withoutGlobalScope('tenant')->updateOrCreate(
                [
                    'barbershop_id' => $bsId,
                    'worker_id' => $worker->id,
                    'date' => $data->toDateString(),
                    'start_time' => $inicio->format('H:i:s'),
                ],
                [
                    'client_id' => $cliente->id,
                    'service_id' => $servico->id,
                    'price' => $preco,
                    'commission_value' => $worker->commissionOn($preco),
                    'end_time' => $fim->format('H:i:s'),
                    'status' => $i === 5 ? Schedule::STATUS_CANCELADO : Schedule::STATUS_PENDENTE,
                    'observation' => 'Agendamento de exemplo.',
                ],
            );

            $schedule->services()->syncWithoutDetaching([
                $servico->id => [
                    'price' => $preco,
                    'commission_value' => $worker->commissionOn($preco),
                ],
            ]);
        }
    }
}
