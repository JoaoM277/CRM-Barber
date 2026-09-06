<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ServiceTokenMiddleware
{
    /**
     * Autentica chamadas internas serviço-a-serviço (Node -> Laravel)
     * via header X-Service-Token comparado com services.messages.token.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $expected = config('services.messages.token');
        $provided = $request->header('X-Service-Token');

        if (! $expected || ! $provided || ! hash_equals($expected, $provided)) {
            return response()->json(['message' => 'Token de serviço inválido.'], 401);
        }

        return $next($request);
    }
}
