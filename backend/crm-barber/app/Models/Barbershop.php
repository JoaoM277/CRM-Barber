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
        'subtitle',
        'accent_color',
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
        'logo_path',
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

    public function users()
    {
        return $this->hasMany(User::class);
    }

    public function services()
    {
        return $this->hasMany(Service::class);
    }

    public function workers()
    {
        return $this->hasMany(Worker::class);
    }

    public function clients()
    {
        return $this->hasMany(Client::class);
    }

    public function schedules()
    {
        return $this->hasMany(Schedule::class);
    }

    public function operationTimes()
    {
        return $this->hasMany(OperationTime::class);
    }

    public function avisos()
    {
        return $this->hasMany(Aviso::class);
    }

    public function payouts()
    {
        return $this->hasMany(Payout::class);
    }

    public function instances()
    {
        return $this->hasMany(Instance::class);
    }
}
