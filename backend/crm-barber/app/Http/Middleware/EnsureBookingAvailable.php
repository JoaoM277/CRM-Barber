<?php

namespace App\Http\Middleware;

use App\Support\TenantContext;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Agendamento público: recusa novos agendamentos quando a assinatura da
 * barbearia não os aceita mais (ver Subscription::acceptsPublicBookings).
 * Roda depois do middleware 'tenant'.
 */
class EnsureBookingAvailable
{
    public function __construct(protected TenantContext $tenant) {}

    public function handle(Request $request, Closure $next): Response
    {
        $sub = $this->tenant->barbershop()?->subscription;

        if ($sub && ! $sub->acceptsPublicBookings()) {
            return response()->json([
                'code' => 'booking_unavailable',
                'message' => 'O agendamento online desta barbearia está indisponível no momento. Entre em contato diretamente com a barbearia.',
            ], 403);
        }

        return $next($request);
    }
}
