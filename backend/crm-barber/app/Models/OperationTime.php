<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class OperationTime extends Model
{
    /** @use HasFactory<\Database\Factories\OperationTimeFactory> */
    use HasFactory;

    protected $table = 'operation_times';

    protected $fillable = [
        'day_of_week',
        'start_time',
        'waiting_start',
        'waiting_end',
        'end_time'
    ];

}