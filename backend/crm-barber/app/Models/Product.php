<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

/** Produto vendido no atendimento, com estoque e % de comissão do profissional. */
class Product extends Model
{
    /** @use HasFactory<\Database\Factories\ProductFactory> */
    use BelongsToTenant, HasFactory, SoftDeletes;

    protected $fillable = [
        'barbershop_id',
        'name',
        'description',
        'price',
        'cost',
        'stock',
        'stock_min',
        'commission_percent',
        'active',
    ];

    protected $casts = [
        'price' => 'decimal:2',
        'cost' => 'decimal:2',
        'stock' => 'integer',
        'stock_min' => 'integer',
        'commission_percent' => 'decimal:2',
        'active' => 'boolean',
    ];

    protected $appends = ['estoque_baixo'];

    public function getEstoqueBaixoAttribute(): bool
    {
        return $this->stock_min !== null && $this->stock <= $this->stock_min;
    }

    /** Comissão do profissional sobre um valor vendido deste produto. */
    public function commissionOn(float $valor): float
    {
        return round($valor * (float) $this->commission_percent / 100, 2);
    }

    public function movements()
    {
        return $this->hasMany(StockMovement::class);
    }
}
