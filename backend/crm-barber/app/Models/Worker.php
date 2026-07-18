<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Worker extends Model
{
    /** @use HasFactory<\Database\Factories\WorkerFactory> */
    use HasFactory;

    protected $fillable = [
        'name',
        'phone',
        'photo',
        'speciality',
        'active'
    ];

    public function schedules() {
        return $this->hasMany(Schedule::class);
    }
}
