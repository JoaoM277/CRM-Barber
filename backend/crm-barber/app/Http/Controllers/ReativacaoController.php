<?php

namespace App\Http\Controllers;

use App\Console\Commands\SendReactivations;
use App\Support\Reativacao;
use App\Support\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Reativação de clientes sumidos: liga/desliga, quantos dias e resultados. */
class ReativacaoController extends Controller
{
    public function __construct(protected TenantContext $tenant) {}

    /** GET /whatsapp/reativacao */
    public function show(): JsonResponse
    {
        return response()->json($this->estado());
    }

    /** PUT /whatsapp/reativacao {ativo?, dias?} */
    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'ativo' => 'sometimes|boolean',
            'dias' => 'sometimes|integer|min:15|max:180',
        ]);

        $bs = $this->tenant->barbershop();
        abort_unless($bs, 404);
        $bs->update(array_filter([
            'reativacao_whatsapp' => $data['ativo'] ?? null,
            'reativacao_dias' => $data['dias'] ?? null,
        ], fn ($v) => $v !== null));

        return response()->json(['message' => 'Reativação salva.'] + $this->estado());
    }

    private function estado(): array
    {
        $bs = $this->tenant->barbershop();
        abort_unless($bs, 404);

        return [
            'ativo' => (bool) $bs->reativacao_whatsapp,
            'dias' => (int) $bs->reativacao_dias,
            'por_dia' => SendReactivations::POR_DIA,
        ] + Reativacao::resultados($bs);
    }
}
