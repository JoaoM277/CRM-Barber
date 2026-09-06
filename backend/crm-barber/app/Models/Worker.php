<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Worker extends Model
{
    /** @use HasFactory<\Database\Factories\WorkerFactory> */
    use HasFactory;

    public const PAYMENT_COMISSAO = 'comissao';

    public const PAYMENT_FIXO = 'fixo';

    public const PAYMENT_COMISSAO_MAIS_FIXO = 'comissao_mais_fixo';

    public const PAYMENT_TYPES = [
        self::PAYMENT_COMISSAO,
        self::PAYMENT_FIXO,
        self::PAYMENT_COMISSAO_MAIS_FIXO,
    ];

    protected $fillable = [
        'name',
        'phone',
        'photo',
        'speciality',
        'active',
        'payment_type',
        'commission_percent',
        'fixed_salary',
        'pix_key',
    ];

    protected $casts = [
        'active' => 'boolean',
        'commission_percent' => 'decimal:2',
        'fixed_salary' => 'decimal:2',
    ];

    public function schedules()
    {
        return $this->hasMany(Schedule::class);
    }

    public function payouts()
    {
        return $this->hasMany(Payout::class);
    }

    public function hasCommission(): bool
    {
        return in_array($this->payment_type, [self::PAYMENT_COMISSAO, self::PAYMENT_COMISSAO_MAIS_FIXO], true);
    }

    public function hasFixedSalary(): bool
    {
        return in_array($this->payment_type, [self::PAYMENT_FIXO, self::PAYMENT_COMISSAO_MAIS_FIXO], true);
    }

    /**
     * Comissão sobre um valor de serviço, conforme o tipo de pagamento.
     */
    public function commissionOn(float $price): float
    {
        if (! $this->hasCommission()) {
            return 0.0;
        }

        return round($price * ((float) $this->commission_percent / 100), 2);
    }
}
