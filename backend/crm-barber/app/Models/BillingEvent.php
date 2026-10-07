<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** Webhook recebido do gateway (guardado antes de processar: idempotência + reprocesso). */
class BillingEvent extends Model
{
    protected $fillable = [
        'provider',
        'event_id',
        'event',
        'payload',
        'processed_at',
        'error',
    ];

    protected $casts = [
        'payload' => 'array',
        'processed_at' => 'datetime',
    ];
}
