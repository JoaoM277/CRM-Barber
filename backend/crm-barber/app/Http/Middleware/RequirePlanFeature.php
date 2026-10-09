<?php

namespace App\Http\Middleware;

use App\Support\TenantContext;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Libera a rota só se o plano da barbearia tiver o recurso.
 * Uso: ->middleware('feature:financeiro')
 */
class RequirePlanFeature
{
    private const LABELS = [
        'whatsapp' => 'WhatsApp automático',
        'financeiro' => 'Financeiro e comissões',
        'personalizacao' => 'Personalização da página de agendamento',
    ];

    public function __construct(protected TenantContext $tenant) {}

    public function handle(Request $request, Closure $next, string $feature): Response
    {
        $sub = $this->tenant->barbershop()?->subscription;

        if ($sub && ! $sub->hasFeature($feature)) {
            $label = self::LABELS[$feature] ?? $feature;

            return response()->json([
                'code' => 'plan_feature',
                'feature' => $feature,
                'message' => "{$label} não está incluído no seu plano. Faça upgrade em \"Assinatura\".",
            ], 403);
        }

        return $next($request);
    }
}
