<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

/** Prêmio da fidelidade entregue ao cliente (consome "selos" do cartão). */
class LoyaltyRedemption extends Model
{
    use BelongsToTenant;

    public const UPDATED_AT = null;

    protected $fillable = ['barbershop_id', 'client_id', 'schedule_id', 'selos', 'premio', 'user_id'];

    protected $casts = ['selos' => 'integer'];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
