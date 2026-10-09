<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use App\Support\Imagem;
use Illuminate\Database\Eloquent\Model;

/** Foto da galeria de trabalhos (página de agendamento). */
class BarbershopPhoto extends Model
{
    use BelongsToTenant;

    protected $fillable = ['barbershop_id', 'path', 'legenda', 'ordem'];

    protected $casts = ['ordem' => 'integer'];

    protected $appends = ['url'];

    protected $hidden = ['path', 'barbershop_id'];

    public function getUrlAttribute(): string
    {
        return Imagem::url($this->path);
    }
}
