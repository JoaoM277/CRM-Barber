<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class Aviso extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'barbershop_id',
        'titulo',
        'mensagem',
        'ativo',
    ];

    protected $casts = [
        'ativo' => 'boolean',
    ];
}
