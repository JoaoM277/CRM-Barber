<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Painel universal: só o dono da plataforma (role super_admin), e nunca por token de suporte. */
class SuperAdminMiddleware
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user || ! $user->isSuperAdmin() || $user->isSupportSession()) {
            return response()->json(['message' => 'Acesso restrito à administração da plataforma.'], 403);
        }

        return $next($request);
    }
}
