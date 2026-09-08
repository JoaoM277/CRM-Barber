<?php

namespace Database\Factories;

use App\Models\Barbershop;
use App\Models\Worker;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Worker>
 */
class WorkerFactory extends Factory
{
    public function definition(): array
    {
        return [
            'barbershop_id' => Barbershop::factory(),
            'name' => fake()->name(),
            'phone' => fake()->unique()->numerify('11#########'),
            'photo' => null,
            'speciality' => fake()->randomElement(['Cortes clássicos', 'Barba', 'Degradê', 'Coloração']),
            'active' => true,
            'payment_type' => Worker::PAYMENT_COMISSAO,
            'commission_percent' => 30,
            'fixed_salary' => 0,
            'pix_key' => null,
        ];
    }

    public function fixo(float $salary = 2000): static
    {
        return $this->state(fn () => [
            'payment_type' => Worker::PAYMENT_FIXO,
            'commission_percent' => 0,
            'fixed_salary' => $salary,
        ]);
    }
}
