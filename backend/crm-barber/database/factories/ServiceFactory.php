<?php

namespace Database\Factories;

use App\Models\Barbershop;
use App\Models\Service;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Service>
 */
class ServiceFactory extends Factory
{
    public function definition(): array
    {
        return [
            'barbershop_id' => Barbershop::factory(),
            'name' => fake()->randomElement(['Corte Masculino', 'Barba', 'Corte + Barba', 'Sobrancelha', 'Pezinho']),
            'description' => fake()->sentence(),
            'duration_time' => fake()->randomElement([20, 30, 45, 60]),
            'price' => fake()->randomFloat(2, 20, 120),
            'active' => true,
        ];
    }
}
