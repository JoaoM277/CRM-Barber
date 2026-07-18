<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Schedule extends Model
{
    /** @use HasFactory<\Database\Factories\ScheduleFactory> */
    use HasFactory;

    // protected $table = 'schedules';

    protected $fillable = [
        'client_id',
        'worker_id',
        'service_id',
        'date',
        'start_time',
        'end_time',
        'status',
        'observation'
    ];

    public function client(){
        return $this->belongsTo(Client::class);
    }
    public function worker(){
        return $this->belongsTo(Worker::class);
    }
    public function service(){
        return $this->belongsTo(Service::class);
    }
}
