<?php

namespace App\Support;

use App\Models\AuditLog;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;

/**
 * Auditoria leve das ações do painel. Chame no ponto onde a ação já foi
 * confirmada (depois do ->save()/->delete()), nunca antes — se a operação
 * falhar não queremos um log de algo que não aconteceu.
 */
class Audit
{
    public static function log(string $action, ?Model $subject = null, ?string $description = null): void
    {
        $tenant = app(TenantContext::class);
        $barbershopId = $tenant->id() ?? Auth::user()?->barbershop_id;

        if (! $barbershopId) {
            return; // sem tenant conhecido, não força log incompleto
        }

        AuditLog::withoutGlobalScope('tenant')->create([
            'barbershop_id' => $barbershopId,
            'user_id' => Auth::id(),
            'action' => $action,
            'subject_type' => $subject ? $subject::class : null,
            'subject_id' => $subject?->getKey(),
            'description' => $description,
            'created_at' => now(),
        ]);
    }
}
