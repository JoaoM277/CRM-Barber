<?php

namespace Database\Factories;

use App\Models\Barbershop;
use App\Models\Product;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Product>
 */
class ProductFactory extends Factory
{
    public function definition(): array
    {
        return [
            'barbershop_id' => Barbershop::factory(),
            'name' => fake()->randomElement(['Pomada', 'Óleo para barba', 'Shampoo', 'Cera', 'Balm']).' '.fake()->word(),
            'price' => 35,
            'cost' => 15,
            'stock' => 10,
            'stock_min' => 2,
            'commission_percent' => 10,
            'active' => true,
        ];
    }
}
