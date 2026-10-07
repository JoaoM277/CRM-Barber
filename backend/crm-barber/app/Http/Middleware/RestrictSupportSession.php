<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Sessão de suporte (super admin dentro do painel de uma barbearia): pode ver
 * e operar o dia a dia para ajudar o cliente, mas não mexe em credenciais nem
 * no dinheiro da barbearia — isso só o próprio dono faz.
 */
class RestrictSupportSession
{
    private const BLOCKED = [
        'users.update-password',
        'assinatura.subscribe',
        'assinatura.cancel',
        'usuarios.store',
        'usuarios.update',
        'usuarios.delete',
    ];

    public function handle(Request $request, Closure $next): Response
    {
        if ($request->user()?->isSupportSession() && $request->routeIs(...self::BLOCKED)) {
            return response()->json([
                'code' => 'support_restricted',
                'message' => 'Ação indisponível no acesso de suporte: só o dono da barbearia pode fazer isso.',
            ], 403);
        }

        return $next($request);
    }
}
