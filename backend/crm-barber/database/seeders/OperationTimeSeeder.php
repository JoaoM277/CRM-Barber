<?php

namespace Database\Seeders;

use App\Models\OperationTime;
use Illuminate\Database\Seeder;

class OperationTimeSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $operationTimes = [

            [
                'day_of_week' => '2026-07-20', // Segunda
                'start_time' => '08:00:00',
                'end_time' => '18:00:00',
                'waiting_start' => '12:00:00',
                'waiting_end' => '13:00:00',
            ],

            [
                'day_of_week' => '2026-07-21', // Terça
                'start_time' => '08:00:00',
                'end_time' => '18:00:00',
                'waiting_start' => '12:00:00',
                'waiting_end' => '13:00:00',
            ],

            [
                'day_of_week' => '2026-07-22', // Quarta
                'start_time' => '08:00:00',
                'end_time' => '18:00:00',
                'waiting_start' => '12:00:00',
                'waiting_end' => '13:00:00',
            ],

            [
                'day_of_week' => '2026-07-23', // Quinta
                'start_time' => '08:00:00',
                'end_time' => '18:00:00',
                'waiting_start' => '12:00:00',
                'waiting_end' => '13:00:00',
            ],

            [
                'day_of_week' => '2026-07-24', // Sexta
                'start_time' => '08:00:00',
                'end_time' => '19:00:00',
                'waiting_start' => '12:00:00',
                'waiting_end' => '13:00:00',
            ],

            [
                'day_of_week' => '2026-07-25', // Sábado
                'start_time' => '08:00:00',
                'end_time' => '16:00:00',
                'waiting_start' => '12:00:00',
                'waiting_end' => '12:30:00',
            ],

            [
                'day_of_week' => '2026-07-26', // Domingo
                'start_time' => '00:00:00',
                'end_time' => '00:00:00',
                'waiting_start' => '00:00:00',
                'waiting_end' => '00:00:00',
            ],

        ];

        foreach ($operationTimes as $operationTime) {
            OperationTime::create($operationTime);
        }
    }
}