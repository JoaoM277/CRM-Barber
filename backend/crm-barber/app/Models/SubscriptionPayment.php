<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** Espelho local de uma cobrança do Asaas, atualizado pelos webhooks. */
class SubscriptionPayment extends Model
{
    protected $fillable = [
        'subscription_id',
        'asaas_payment_id',
        'value_cents',
        'status',
        'billing_type',
        'due_date',
        'paid_at',
        'invoice_url',
    ];

    protected $casts = [
        'value_cents' => 'integer',
        'due_date' => 'date',
        'paid_at' => 'datetime',
    ];

    public function subscription()
    {
        return $this->belongsTo(Subscription::class);
    }

    public function toPanelArray(): array
    {
        return [
            'id' => $this->asaas_payment_id,
            'valor' => $this->value_cents / 100,
            'status' => $this->status,
            'forma_pagamento' => $this->billing_type,
            'vencimento' => $this->due_date?->toDateString(),
            'pago_em' => $this->paid_at?->toIso8601String(),
            'link' => $this->invoice_url,
        ];
    }
}
