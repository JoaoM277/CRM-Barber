<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Client extends Model
{
    /** @use HasFactory<\Database\Factories\ClientFactory> */
    use BelongsToTenant, HasFactory;

    protected $fillable = [
        'barbershop_id',
        'name',
        'phone',
        'email',
        'birth_date',
        'observation'
    ];

    public function schedules(){
        return $this->hasMany(Schedule::class);
    }
}
