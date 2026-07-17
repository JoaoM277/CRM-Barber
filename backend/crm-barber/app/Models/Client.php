<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Client extends Model
{
    /** @use HasFactory<\Database\Factories\ClientFactory> */
    use HasFactory;

    

    protected $fillable = [
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
