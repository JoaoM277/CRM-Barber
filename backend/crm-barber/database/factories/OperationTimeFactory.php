<?php

namespace Database\Factories;

use App\Models\Barbershop;
use App\Models\OperationTime;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<OperationTime>
 */
class OperationTimeFactory extends Factory
{
    public function definition(): array
    {
        return [
            'barbershop_id' => Barbershop::factory(),
            'day_of_week' => fake()->numberBetween(1, 6),
            'active' => true,
            'start_time' => '08:00:00',
            'end_time' => '20:00:00',
            'waiting_start' => null,
            'waiting_end' => null,
        ];
    }
}
