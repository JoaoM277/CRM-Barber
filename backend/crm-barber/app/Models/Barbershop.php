<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Barbershop extends Model
{
    use HasFactory;
    // use SoftDeletes;

    protected $fillable = [
        'name',
        'slug',
        'phone',
        'email',
        'zip_code',
        'street',
        'number',
        'complement',
        'neighborhood',
        'city',
        'state',
        'logo',
        'opening_time',
        'closing_time',
        'whatsapp',
        'instagram',
        'website',
        'timezone',
        'subscription_plan',
        'subscription_ends_at',
        'active',
    ];

    protected $casts = [
        'opening_time' => 'datetime:H:i',
        'closing_time' => 'datetime:H:i',
        'subscription_ends_at' => 'date',
        'active' => 'boolean',
    ];
}
