<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Service extends Model
{
    /** @use HasFactory<\Database\Factories\ServiceFactory> */
    use HasFactory;

    protected $fillable = [
        'name',
        'description',
        'duration_time',
        'price',
        'active'
    ];

    public function schedules() {
        return $this->hasMany(Schedule::class);
    }
}
