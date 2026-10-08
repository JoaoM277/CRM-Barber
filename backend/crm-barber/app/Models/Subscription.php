<?php

namespace App\Models;

use App\Support\PlatformSettings;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * Assinatura do SaaS de uma barbearia (1 por barbearia).
 *
 * Regra de acesso ao painel (accessLevel):
 *  - trialing  → total até trial_ends_at
 *  - active    → total até current_period_ends_at + carência (rede de
 *                segurança caso o webhook de atraso não chegue)
 *  - past_due  → total durante a carência (past_due_since + grace_days)
 *  - canceled  → total até o fim do período já pago (ou do trial)
 *  Fora disso o painel fica SÓ LEITURA: dá para ver tudo e pagar, não para alterar.
 *
 * Site público (acceptsPublicBookings): aceita agendamento com acesso total
 * e também em atraso (past_due) mesmo depois da carência — o cliente final de
 * uma barbearia pagante não é punido pelo atraso dela. Trial vencido sem
 * pagamento e assinatura cancelada vencida param de aceitar agendamentos.
 */
class Subscription extends Model
{
    public const STATUS_TRIALING = 'trialing';

    public const STATUS_ACTIVE = 'active';

    public const STATUS_PAST_DUE = 'past_due';

    public const STATUS_CANCELED = 'canceled';

    public const ACCESS_FULL = 'full';

    public const ACCESS_READ_ONLY = 'read_only';

    protected $fillable = [
        'barbershop_id',
        'plan_id',
        'status',
        'trial_ends_at',
        'current_period_ends_at',
        'past_due_since',
        'canceled_at',
        'trial_ending_notice_sent_at',
        'trial_ended_notice_sent_at',
        'billing_type',
        'asaas_customer_id',
        'asaas_subscription_id',
    ];

    protected $casts = [
        'trial_ends_at' => 'datetime',
        'current_period_ends_at' => 'datetime',
        'past_due_since' => 'datetime',
        'canceled_at' => 'datetime',
        'trial_ending_notice_sent_at' => 'datetime',
        'trial_ended_notice_sent_at' => 'datetime',
    ];

    public function barbershop()
    {
        return $this->belongsTo(Barbershop::class);
    }

    public function plan()
    {
        return $this->belongsTo(Plan::class);
    }

    public function payments()
    {
        return $this->hasMany(SubscriptionPayment::class);
    }

    /** Até quando o acesso total vale, considerando o status atual. */
    public function accessEndsAt(): ?Carbon
    {
        $grace = PlatformSettings::graceDays();

        return match ($this->status) {
            self::STATUS_TRIALING => $this->trial_ends_at,
            self::STATUS_ACTIVE => $this->current_period_ends_at?->copy()->addDays($grace),
            // carência só para quem já pagou alguma vez; trial vencido sem pagar não ganha dias extras
            self::STATUS_PAST_DUE => $this->hasEverPaid()
                ? ($this->past_due_since ?? now())->copy()->addDays($grace)
                : $this->trial_ends_at,
            self::STATUS_CANCELED => $this->current_period_ends_at ?? $this->trial_ends_at,
            default => null,
        };
    }

    public function accessLevel(): string
    {
        $ends = $this->accessEndsAt();

        return $ends && now()->lessThanOrEqualTo($ends) ? self::ACCESS_FULL : self::ACCESS_READ_ONLY;
    }

    public function hasFullAccess(): bool
    {
        return $this->accessLevel() === self::ACCESS_FULL;
    }

    /** Já teve algum pagamento confirmado (o período pago só é preenchido por pagamento). */
    public function hasEverPaid(): bool
    {
        return $this->current_period_ends_at !== null;
    }

    public function acceptsPublicBookings(): bool
    {
        return $this->hasFullAccess()
            || ($this->status === self::STATUS_PAST_DUE && $this->hasEverPaid());
    }

    /** Em atraso mas ainda dentro da carência — o painel mostra o aviso. */
    public function isInGrace(): bool
    {
        return $this->status === self::STATUS_PAST_DUE && $this->hasFullAccess();
    }

    public function hasFeature(string $feature): bool
    {
        return (bool) $this->plan?->hasFeature($feature);
    }

    public function workerLimit(): ?int
    {
        return $this->plan?->max_workers;
    }

    public function toPanelArray(): array
    {
        return [
            'status' => $this->status,
            'acesso' => $this->accessLevel(),
            'em_carencia' => $this->isInGrace(),
            'aceita_agendamentos' => $this->acceptsPublicBookings(),
            'acesso_ate' => $this->accessEndsAt()?->toIso8601String(),
            'trial_termina_em' => $this->trial_ends_at?->toIso8601String(),
            'periodo_pago_ate' => $this->current_period_ends_at?->toIso8601String(),
            'cancelada_em' => $this->canceled_at?->toIso8601String(),
            'forma_pagamento' => $this->billing_type,
            'tem_assinatura_no_gateway' => (bool) $this->asaas_subscription_id,
            'plano' => $this->plan?->toPublicArray(),
        ];
    }
}
