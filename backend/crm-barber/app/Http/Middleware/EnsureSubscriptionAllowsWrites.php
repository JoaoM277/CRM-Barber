<?php

namespace App\Http\Middleware;

use App\Support\TenantContext;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Painel em MODO LEITURA quando a assinatura não dá mais acesso total
 * (trial vencido, atraso além da carência, cancelada vencida): leituras
 * passam, escritas recebem 402. Rotas de assinatura, logout e troca de senha
 * ficam sempre liberadas — é por elas que a barbearia regulariza.
 *
 * Barbearia sem registro de assinatura (só acontece em dados de teste/legado;
 * a migration e o cadastro criam o trial) não é bloqueada.
 */
class EnsureSubscriptionAllowsWrites
{
    private const ALWAYS_ALLOWED = [
        'assinatura.*',
        'users.logout',
        'users.update-password',
    ];

    public function __construct(protected TenantContext $tenant) {}

    public function handle(Request $request, Closure $next): Response
    {
        if ($request->isMethodSafe() || $request->routeIs(...self::ALWAYS_ALLOWED)) {
            return $next($request);
        }

        $sub = $this->tenant->barbershop()?->subscription;

        if ($sub && ! $sub->hasFullAccess()) {
            return response()->json([
                'code' => 'subscription_inactive',
                'message' => 'Sua assinatura não está ativa. O painel está em modo leitura — regularize em "Assinatura" para voltar a fazer alterações.',
            ], 402);
        }

        return $next($request);
    }
}
