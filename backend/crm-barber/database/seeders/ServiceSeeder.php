<?php

namespace Database\Seeders;

use App\Models\Service;
use Illuminate\Database\Seeder;

class ServiceSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $services = [

            [
                'name' => 'Corte Masculino',
                'description' => 'Corte tradicional ou moderno.',
                'duration_time' => '00:30:00',
                'price' => 35.00,
                'active' => true,
            ],

            [
                'name' => 'Barba',
                'description' => 'Modelagem completa da barba.',
                'duration_time' => '00:20:00',
                'price' => 25.00,
                'active' => true,
            ],

            [
                'name' => 'Corte + Barba',
                'description' => 'Pacote completo de corte e barba.',
                'duration_time' => '00:50:00',
                'price' => 55.00,
                'active' => true,
            ],

            [
                'name' => 'Pigmentação',
                'description' => 'Pigmentação da barba ou cabelo.',
                'duration_time' => '00:40:00',
                'price' => 60.00,
                'active' => true,
            ],

            [
                'name' => 'Hidratação',
                'description' => 'Tratamento para hidratação capilar.',
                'duration_time' => '00:30:00',
                'price' => 30.00,
                'active' => true,
            ],

            [
                'name' => 'Selagem',
                'description' => 'Selagem capilar masculina.',
                'duration_time' => '01:00:00',
                'price' => 90.00,
                'active' => true,
            ],

            [
                'name' => 'Sobrancelha',
                'description' => 'Design de sobrancelha.',
                'duration_time' => '00:15:00',
                'price' => 15.00,
                'active' => true,
            ],

            [
                'name' => 'Corte Infantil',
                'description' => 'Corte para crianças até 12 anos.',
                'duration_time' => '00:25:00',
                'price' => 30.00,
                'active' => true,
            ],

            [
                'name' => 'Platinado',
                'description' => 'Descoloração e tonalização dos cabelos.',
                'duration_time' => '02:00:00',
                'price' => 180.00,
                'active' => false,
            ],

            [
                'name' => 'Acabamento',
                'description' => 'Acerto rápido de cabelo ou barba.',
                'duration_time' => '00:15:00',
                'price' => 20.00,
                'active' => true,
            ],

        ];

        foreach ($services as $service) {
            Service::create($service);
        }
    }
}