<?php

namespace Database\Seeders;

use App\Models\OperationTime;
use Illuminate\Database\Seeder;

class OperationTimeSeeder extends Seeder
{
    public function run(): void
    {
        // dia => [start, end, waiting_start, waiting_end]
        $semana = [
            1 => ['08:00', '19:00', '12:00', '13:00'], // Segunda
            2 => ['08:00', '19:00', '12:00', '13:00'], // Terça
            3 => ['08:00', '19:00', '12:00', '13:00'], // Quarta
            4 => ['08:00', '19:00', '12:00', '13:00'], // Quinta
            5 => ['08:00', '20:00', '12:00', '13:00'], // Sexta
            6 => ['08:00', '16:00', '12:00', '12:30'], // Sábado
        ];

        foreach ($semana as $dow => [$start, $end, $ws, $we]) {
            OperationTime::updateOrCreate(
                ['day_of_week' => $dow],
                [
                    'active' => true,
                    'start_time' => $start,
                    'end_time' => $end,
                    'waiting_start' => $ws,
                    'waiting_end' => $we,
                ],
            );
        }

        // Domingo fechado
        OperationTime::updateOrCreate(
            ['day_of_week' => 0],
            [
                'active' => false,
                'start_time' => '00:00',
                'end_time' => '00:00',
                'waiting_start' => null,
                'waiting_end' => null,
            ],
        );
    }
}
