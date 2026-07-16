<?php

namespace Database\Seeders;

use App\Models\Schedule;
use Illuminate\Database\Seeder;

class ScheduleSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $schedules = [

            [
                'client_id' => 1,
                'worker_id' => 1,
                'service_id' => 1,
                'date' => '2026-07-20',
                'start_time' => '08:00:00',
                'end_time' => '08:30:00',
                'status' => true,
                'observation' => 'Primeiro horário do dia.',
            ],

            [
                'client_id' => 2,
                'worker_id' => 2,
                'service_id' => 2,
                'date' => '2026-07-20',
                'start_time' => '09:00:00',
                'end_time' => '09:20:00',
                'status' => true,
                'observation' => 'Cliente prefere navalha.',
            ],

            [
                'client_id' => 3,
                'worker_id' => 3,
                'service_id' => 3,
                'date' => '2026-07-20',
                'start_time' => '10:00:00',
                'end_time' => '10:50:00',
                'status' => true,
                'observation' => 'Pacote completo.',
            ],

            [
                'client_id' => 4,
                'worker_id' => 4,
                'service_id' => 4,
                'date' => '2026-07-21',
                'start_time' => '08:30:00',
                'end_time' => '09:10:00',
                'status' => true,
                'observation' => 'Pigmentação da barba.',
            ],

            [
                'client_id' => 5,
                'worker_id' => 5,
                'service_id' => 5,
                'date' => '2026-07-21',
                'start_time' => '10:00:00',
                'end_time' => '10:30:00',
                'status' => true,
                'observation' => 'Hidratação capilar.',
            ],

            [
                'client_id' => 6,
                'worker_id' => 6,
                'service_id' => 6,
                'date' => '2026-07-22',
                'start_time' => '09:00:00',
                'end_time' => '10:00:00',
                'status' => true,
                'observation' => 'Selagem completa.',
            ],

            [
                'client_id' => 7,
                'worker_id' => 7,
                'service_id' => 7,
                'date' => '2026-07-22',
                'start_time' => '11:00:00',
                'end_time' => '11:15:00',
                'status' => true,
                'observation' => 'Design de sobrancelha.',
            ],

            [
                'client_id' => 8,
                'worker_id' => 8,
                'service_id' => 8,
                'date' => '2026-07-23',
                'start_time' => '08:00:00',
                'end_time' => '08:25:00',
                'status' => true,
                'observation' => 'Corte infantil.',
            ],

            [
                'client_id' => 9,
                'worker_id' => 9,
                'service_id' => 10,
                'date' => '2026-07-23',
                'start_time' => '15:00:00',
                'end_time' => '15:15:00',
                'status' => false,
                'observation' => 'Cliente cancelou.',
            ],

            [
                'client_id' => 10,
                'worker_id' => 10,
                'service_id' => 1,
                'date' => '2026-07-24',
                'start_time' => '16:00:00',
                'end_time' => '16:30:00',
                'status' => true,
                'observation' => 'Cliente recorrente.',
            ],

        ];

        foreach ($schedules as $schedule) {
            Schedule::create($schedule);
        }
    }
}