<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Instance extends Model
{
    public const STATUS_DESCONECTADO = 'desconectado';

    public const STATUS_CONECTANDO = 'conectando';

    public const STATUS_CONECTADO = 'conectado';

    public const STATUS_ERRO = 'erro';

    protected $fillable = [
        'barbershop_id',
        'name',
        'status',
        'phone_number',
        'last_connected_at',
    ];

    protected $casts = [
        'last_connected_at' => 'datetime',
    ];

    public function barbershop()
    {
        return $this->belongsTo(Barbershop::class);
    }

    /**
     * Traduz o "state" da Evolution API para o status local.
     */
    public static function mapEvolutionState(?string $state): string
    {
        return match ($state) {
            'open' => self::STATUS_CONECTADO,
            'connecting' => self::STATUS_CONECTANDO,
            'close', 'closed', 'refused' => self::STATUS_DESCONECTADO,
            default => self::STATUS_ERRO,
        };
    }
}
