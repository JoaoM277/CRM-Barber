<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Service extends Model
{
    /** @use HasFactory<\Database\Factories\ServiceFactory> */
    use BelongsToTenant, HasFactory, SoftDeletes;

    protected $fillable = [
        'barbershop_id',
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
