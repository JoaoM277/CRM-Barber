<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

class Plan extends Model
{
    public const FEATURE_WHATSAPP = 'whatsapp';

    public const FEATURE_FINANCEIRO = 'financeiro';

    protected $fillable = [
        'slug',
        'name',
        'price_cents',
        'max_workers',
        'features',
        'active',
        'sort',
    ];

    protected $casts = [
        'price_cents' => 'integer',
        'max_workers' => 'integer',
        'features' => 'array',
        'active' => 'boolean',
    ];

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('active', true)->orderBy('sort');
    }

    public function hasFeature(string $feature): bool
    {
        return in_array($feature, $this->features ?? [], true);
    }

    public function price(): float
    {
        return $this->price_cents / 100;
    }

    public function toPublicArray(): array
    {
        return [
            'slug' => $this->slug,
            'nome' => $this->name,
            'preco' => $this->price(),
            'max_profissionais' => $this->max_workers,
            'recursos' => $this->features ?? [],
        ];
    }
}
