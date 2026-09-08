<?php

namespace Database\Factories;

use App\Models\Barbershop;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Barbershop>
 */
class BarbershopFactory extends Factory
{
    public function definition(): array
    {
        $name = fake()->unique()->company();

        return [
            'name' => $name,
            'slug' => Str::slug($name).'-'.fake()->unique()->numberBetween(1, 99999),
            'subtitle' => 'BARBEARIA',
            'accent_color' => '#C89B3C',
            'phone' => fake()->numerify('(##) #####-####'),
            'city' => fake()->city(),
            'state' => 'SP',
            'timezone' => 'America/Sao_Paulo',
            'active' => true,
        ];
    }

    public function inactive(): static
    {
        return $this->state(fn () => ['active' => false]);
    }
}
