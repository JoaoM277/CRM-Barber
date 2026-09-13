<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use App\Support\Phone;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Client extends Model
{
    /** @use HasFactory<\Database\Factories\ClientFactory> */
    use BelongsToTenant, HasFactory, SoftDeletes;

    protected $fillable = [
        'barbershop_id',
        'name',
        'phone',
        'email',
        'birth_date',
        'observation'
    ];

    /** Telefone sempre gravado normalizado (só dígitos, DDI 55). */
    protected function phone(): Attribute
    {
        return Attribute::set(fn ($value) => $value === null ? null : Phone::normalizeBr((string) $value));
    }

    public function schedules(){
        return $this->hasMany(Schedule::class);
    }
}
