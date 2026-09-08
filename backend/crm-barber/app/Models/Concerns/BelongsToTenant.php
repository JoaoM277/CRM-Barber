<?php

namespace App\Models\Concerns;

use App\Models\Barbershop;
use App\Support\TenantContext;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/**
 * Escopa o model pela barbearia do request (TenantContext).
 *
 * - Global scope: quando há tenant no contexto, toda query ganha
 *   WHERE barbershop_id = <tenant>.
 * - creating: preenche barbershop_id automaticamente se não veio setado.
 *
 * Sem tenant no contexto (jobs, tinker, testes que não setam) o escopo fica
 * inativo — nesses casos a responsabilidade de filtrar é de quem chama.
 */
trait BelongsToTenant
{
    public static function bootBelongsToTenant(): void
    {
        $tenant = app(TenantContext::class);

        static::addGlobalScope('tenant', function (Builder $builder) use ($tenant) {
            if ($tenant->has()) {
                $builder->where(
                    $builder->getModel()->getTable().'.barbershop_id',
                    $tenant->id(),
                );
            }
        });

        static::creating(function (Model $model) use ($tenant) {
            if (empty($model->barbershop_id) && $tenant->has()) {
                $model->barbershop_id = $tenant->id();
            }
        });
    }

    public function barbershop()
    {
        return $this->belongsTo(Barbershop::class);
    }

    /** Query sem o escopo de tenant (uso deliberado: relatórios cross-tenant, jobs). */
    public function scopeWithoutTenantScope(Builder $query): Builder
    {
        return $query->withoutGlobalScope('tenant');
    }
}
