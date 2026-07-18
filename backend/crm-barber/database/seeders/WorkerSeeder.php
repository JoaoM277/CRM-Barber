<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Worker;

class WorkerSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $workers = [

            [
                'name' => 'Carlos Souza',
                'phone' => '71981111111',
                'photo' => 'workers/carlos-souza.jpg',
                'speciality' => 'Corte Masculino',
                'active' => true,
            ],

            [
                'name' => 'Rafael Lima',
                'phone' => '71982222222',
                'photo' => 'workers/rafael-lima.jpg',
                'speciality' => 'Barba',
                'active' => true,
            ],

            [
                'name' => 'Felipe Oliveira',
                'phone' => '71983333333',
                'photo' => 'workers/felipe-oliveira.jpg',
                'speciality' => 'Fade',
                'active' => true,
            ],

            [
                'name' => 'Bruno Ferreira',
                'phone' => '71984444444',
                'photo' => 'workers/bruno-ferreira.jpg',
                'speciality' => 'Navalhado',
                'active' => true,
            ],

            [
                'name' => 'Gabriel Martins',
                'phone' => '71985555555',
                'photo' => 'workers/gabriel-martins.jpg',
                'speciality' => 'Corte Infantil',
                'active' => true,
            ],

            [
                'name' => 'Diego Santos',
                'phone' => '71986666666',
                'photo' => 'workers/diego-santos.jpg',
                'speciality' => 'Pigmentação',
                'active' => true,
            ],

            [
                'name' => 'Lucas Almeida',
                'phone' => '71987777777',
                'photo' => 'workers/lucas-almeida.jpg',
                'speciality' => 'Barba Premium',
                'active' => true,
            ],

            [
                'name' => 'Matheus Costa',
                'phone' => '71988888888',
                'photo' => 'workers/matheus-costa.jpg',
                'speciality' => 'Degradê',
                'active' => true,
            ],

            [
                'name' => 'Henrique Rocha',
                'phone' => '71989999999',
                'photo' => 'workers/henrique-rocha.jpg',
                'speciality' => 'Tesoura',
                'active' => false,
            ],

            [
                'name' => 'João Pedro',
                'phone' => '71980000000',
                'photo' => 'workers/joao-pedro.jpg',
                'speciality' => 'Corte Social',
                'active' => true,
            ],

        ];

        foreach ($workers as $worker) {
            Worker::create($worker);
        }
    }
}