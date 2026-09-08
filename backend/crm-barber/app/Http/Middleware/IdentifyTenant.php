<?php

namespace App\Http\Middleware;

use App\Models\Barbershop;
use App\Support\TenantContext;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Rotas PÚBLICAS (site de agendamento). Descobre a barbearia por, em ordem:
 *  1. parâmetro de rota {barbershop}   (ex.: /api/b/barbearia-x/servicos)
 *  2. header  X-Barbershop: <slug>
 *  3. query   ?barbershop=<slug>
 * 404 se não resolver para uma barbearia ativa.
 */
class IdentifyTenant
{
    public function __construct(protected TenantContext $tenant) {}

    public function handle(Request $request, Closure $next): Response
    {
        $slug = $request->route('barbershop')
            ?? $request->header('X-Barbershop')
            ?? $request->query('barbershop');

        $slug = is_string($slug) ? trim($slug) : null;

        $barbershop = $slug
            ? Barbershop::where('slug', $slug)->first()
            : null;

        if (! $barbershop || ! $barbershop->active) {
            abort(404, 'Barbearia não encontrada.');
        }

        $this->tenant->set($barbershop);

        return $next($request);
    }
}
