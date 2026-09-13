<?php

namespace Database\Seeders;

use App\Models\Barbershop;
use App\Support\TenantContext;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     *
     * Multi-tenant: cria as barbearias + usuários primeiro, depois popula os
     * dados de cada barbearia (das 2 primeiras) com o TenantContext setado —
     * os seeders escopados leem o id de lá.
     */
    public function run(): void
    {
        $this->call([
            BarbershopSeeder::class,
            UserSeeder::class,
        ]);

        $tenant = app(TenantContext::class);
        $slugsSeed = ['alpha-barber', 'king-barber'];

        foreach (Barbershop::whereIn('slug', $slugsSeed)->orderBy('id')->get() as $bs) {
            $tenant->set($bs);

            $this->call([
                OperationTimeSeeder::class,
                ServiceSeeder::class,
                WorkerSeeder::class,
                ClientSeeder::class,
                ScheduleSeeder::class,
                AvisoSeeder::class,
            ]);
        }

        $tenant->forget();
    }
}
