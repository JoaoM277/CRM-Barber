<?php

namespace Database\Seeders;

use App\Models\OperationTime;
use App\Support\TenantContext;
use Illuminate\Database\Seeder;

class OperationTimeSeeder extends Seeder
{
    /**
     * Grade de horário da barbearia do TenantContext.
     */
    public function run(): void
    {
        $bsId = app(TenantContext::class)->id();

        // dia => [start, end, waiting_start, waiting_end]  (1=Seg ... 6=Sáb)
        $semana = [
            1 => ['08:00', '19:00', '12:00', '13:00'],
            2 => ['08:00', '19:00', '12:00', '13:00'],
            3 => ['08:00', '19:00', '12:00', '13:00'],
            4 => ['08:00', '19:00', '12:00', '13:00'],
            5 => ['08:00', '20:00', '12:00', '13:00'],
            6 => ['08:00', '16:00', '12:00', '12:30'],
        ];

        foreach ($semana as $dow => [$start, $end, $ws, $we]) {
            OperationTime::withoutGlobalScope('tenant')->updateOrCreate(
                ['barbershop_id' => $bsId, 'day_of_week' => $dow],
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
        OperationTime::withoutGlobalScope('tenant')->updateOrCreate(
            ['barbershop_id' => $bsId, 'day_of_week' => 0],
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
