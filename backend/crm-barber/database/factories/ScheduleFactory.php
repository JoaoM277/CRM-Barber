<?php

namespace Database\Factories;

use App\Models\Barbershop;
use App\Models\Client;
use App\Models\Schedule;
use App\Models\Service;
use App\Models\Worker;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Schedule>
 *
 * Para agendamento coerente entre tenants, passe barbershop_id/client_id/
 * worker_id/service_id explicitamente no teste.
 */
class ScheduleFactory extends Factory
{
    public function definition(): array
    {
        return [
            'barbershop_id' => Barbershop::factory(),
            'client_id' => Client::factory(),
            'worker_id' => Worker::factory(),
            'service_id' => Service::factory(),
            'price' => 40,
            'commission_value' => 12,
            'date' => now()->addDay()->toDateString(),
            'start_time' => '10:00:00',
            'end_time' => '10:30:00',
            'status' => Schedule::STATUS_PENDENTE,
            'observation' => null,
        ];
    }

    public function concluido(): static
    {
        return $this->state(fn () => ['status' => Schedule::STATUS_CONCLUIDO]);
    }
}
