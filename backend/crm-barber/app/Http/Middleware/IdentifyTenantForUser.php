<?php

namespace App\Http\Middleware;

use App\Support\TenantContext;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Rotas AUTENTICADAS (painel). A barbearia do tenant é a do usuário logado.
 * Roda depois de auth:sanctum. 403 se o usuário não estiver vinculado a uma
 * barbearia (não deveria acontecer — todo user nasce com barbershop_id).
 */
class IdentifyTenantForUser
{
    public function __construct(protected TenantContext $tenant) {}

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user || ! $user->barbershop_id) {
            abort(403, 'Usuário sem barbearia vinculada.');
        }

        $this->tenant->set($user->barbershop_id);

        return $next($request);
    }
}
