<?php

namespace Database\Factories;

use App\Models\Client;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Client>
 */
class ClientFactory extends Factory
{
    protected $model = Client::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => fake()->name(),
            'phone' => fake()->numerify('###########'),
            'email' => fake()->unique()->safeEmail(),
            'birth_date' => fake()->optional()->date(),
            'observation' => fake()->optional()->sentence(),
        ];
    }
}
