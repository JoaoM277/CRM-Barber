<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class Payout extends Model
{
    use BelongsToTenant;

    public const STATUS_PENDENTE = 'pendente';

    public const STATUS_PAGO = 'pago';

    protected $fillable = [
        'barbershop_id',
        'worker_id',
        'periodo_inicio',
        'periodo_fim',
        'atendimentos',
        'total_bruto',
        'total_comissao',
        'total_fixo',
        'valor_pago',
        'status',
        'pago_em',
        'observacao',
    ];

    protected $casts = [
        'periodo_inicio' => 'date',
        'periodo_fim' => 'date',
        'pago_em' => 'datetime',
        'total_bruto' => 'decimal:2',
        'total_comissao' => 'decimal:2',
        'total_fixo' => 'decimal:2',
        'valor_pago' => 'decimal:2',
    ];

    public function worker()
    {
        return $this->belongsTo(Worker::class);
    }
}
