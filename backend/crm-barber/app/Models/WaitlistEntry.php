<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

/** Pedido de "me avise se abrir vaga" num dia lotado. */
class WaitlistEntry extends Model
{
    use BelongsToTenant;

    public const AGUARDANDO = 'aguardando';

    public const AVISADO = 'avisado';

    public const AGENDOU = 'agendou';

    public const REMOVIDO = 'removido';

    protected $fillable = ['barbershop_id', 'client_id', 'date', 'worker_id', 'service_ids', 'status', 'avisado_em'];

    protected $casts = [
        'date' => 'date',
        'service_ids' => 'array',
        'avisado_em' => 'datetime',
    ];

    public function client()
    {
        return $this->belongsTo(Client::class)->withTrashed();
    }

    public function worker()
    {
        return $this->belongsTo(Worker::class)->withTrashed();
    }
}
