<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

/** Entrada/saída de estoque de um produto (o histórico explica o saldo). */
class StockMovement extends Model
{
    use BelongsToTenant;

    public const VENDA = 'venda';

    public const ESTORNO = 'estorno';

    public const ENTRADA = 'entrada';

    public const AJUSTE = 'ajuste';

    public const UPDATED_AT = null;

    protected $fillable = ['barbershop_id', 'product_id', 'quantity', 'reason', 'schedule_id', 'user_id', 'note'];

    protected $casts = ['quantity' => 'integer'];

    public function product()
    {
        return $this->belongsTo(Product::class)->withTrashed();
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
