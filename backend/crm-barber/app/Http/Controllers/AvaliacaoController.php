<?php

namespace App\Http\Controllers;

use App\Support\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Avaliação pós-atendimento: liga/desliga e link de avaliação do Google. */
class AvaliacaoController extends Controller
{
    public function __construct(protected TenantContext $tenant) {}

    /** GET /whatsapp/avaliacao */
    public function show(): JsonResponse
    {
        return response()->json($this->estado());
    }

    /** PUT /whatsapp/avaliacao {ativo?, google_review_url?} */
    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'ativo' => 'sometimes|boolean',
            'google_review_url' => ['sometimes', 'nullable', 'url:https', 'max:500'],
        ]);

        $bs = $this->tenant->barbershop();
        abort_unless($bs, 404);

        $campos = [];
        if (array_key_exists('ativo', $data)) {
            $campos['avaliacao_whatsapp'] = $data['ativo'];
        }
        if (array_key_exists('google_review_url', $data)) {
            $campos['google_review_url'] = $data['google_review_url'] ?: null;
        }
        $bs->update($campos);

        return response()->json(['message' => 'Avaliação salva.'] + $this->estado());
    }

    private function estado(): array
    {
        $bs = $this->tenant->barbershop();
        abort_unless($bs, 404);

        return ['ativo' => (bool) $bs->avaliacao_whatsapp, 'google_review_url' => $bs->google_review_url];
    }
}
