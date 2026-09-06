<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class OperationTime extends Model
{
    /** @use HasFactory<\Database\Factories\OperationTimeFactory> */
    use HasFactory;

    protected $table = 'operation_times';

    /** 0 = Domingo ... 6 = Sábado (igual ao Carbon::dayOfWeek) */
    public const DIAS = [
        0 => 'Domingo',
        1 => 'Segunda',
        2 => 'Terça',
        3 => 'Quarta',
        4 => 'Quinta',
        5 => 'Sexta',
        6 => 'Sábado',
    ];

    protected $fillable = [
        'day_of_week',
        'active',
        'start_time',
        'waiting_start',
        'waiting_end',
        'end_time',
    ];

    protected $casts = [
        'active' => 'boolean',
    ];
}
