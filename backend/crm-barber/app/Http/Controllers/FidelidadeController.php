<?php

namespace App\Http\Controllers;

use App\Models\Client;
use App\Models\Schedule;
use App\Support\Audit;
use App\Support\Fidelidade;
use App\Support\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Fidelidade (cartão de selos): configuração e resgate do prêmio. */
class FidelidadeController extends Controller
{
    public function __construct(protected TenantContext $tenant) {}

    /** GET /fidelidade */
    public function show(): JsonResponse
    {
        return response()->json($this->estado());
    }

    /** PUT /fidelidade (admin) {ativa?, meta?, premio?} */
    public function update(Request $request): JsonResponse
    {
        $bs = $this->tenant->barbershop();
        abort_unless($bs, 404);

        $data = $request->validate([
            'ativa' => 'sometimes|boolean',
            'meta' => 'sometimes|integer|min:2|max:50',
            'premio' => 'sometimes|nullable|string|max:120',
        ]);

        $campos = [];
        if (isset($data['meta'])) {
            $campos['fidelidade_meta'] = $data['meta'];
        }
        if (array_key_exists('premio', $data)) {
            $campos['fidelidade_premio'] = trim((string) $data['premio']) ?: null;
        }

        if (array_key_exists('ativa', $data)) {
            $premio = array_key_exists('fidelidade_premio', $campos) ? $campos['fidelidade_premio'] : $bs->fidelidade_premio;
            if ($data['ativa'] && ! $premio) {
                return response()->json(['message' => 'Diga qual é o prêmio antes de ligar a fidelidade.', 'errors' => ['premio' => ['Informe o prêmio.']]], 422);
            }
            $campos['fidelidade_ativa'] = $data['ativa'];
            // os selos contam a partir do dia em que o programa é ligado pela 1ª vez
            if ($data['ativa'] && ! $bs->fidelidade_desde) {
                $campos['fidelidade_desde'] = now()->toDateString();
            }
        }

        $bs->update($campos);

        return response()->json(['message' => 'Fidelidade salva.'] + $this->estado());
    }

    /** POST /clientes/{client}/fidelidade/resgatar {agendamento_id?} */
    public function resgatar(Request $request, Client $client): JsonResponse
    {
        $bs = $this->tenant->barbershop();
        abort_unless(Fidelidade::ativa($bs), 422, 'A fidelidade está desligada.');

        $data = $request->validate([
            'agendamento_id' => ['nullable', 'integer', Rule::exists('schedules', 'id')->where('barbershop_id', $bs->id)->where('client_id', $client->id)],
        ]);

        $resgate = Fidelidade::resgatar($bs, $client->id, $data['agendamento_id'] ?? null, $request->user()?->id);
        if (! $resgate) {
            return response()->json(['message' => 'Este cliente ainda não juntou os selos do prêmio.'], 422);
        }
        Audit::log('fidelidade.resgate', $client, "Prêmio da fidelidade entregue: {$resgate->premio}");

        return response()->json([
            'message' => 'Prêmio registrado.',
            'fidelidade' => Fidelidade::resumo($bs, $client->id),
        ]);
    }

    private function estado(): array
    {
        $bs = $this->tenant->barbershop();
        abort_unless($bs, 404);

        return [
            'ativa' => (bool) $bs->fidelidade_ativa,
            'meta' => (int) $bs->fidelidade_meta,
            'premio' => $bs->fidelidade_premio,
            'desde' => $bs->fidelidade_desde?->toDateString(),
            // quantos clientes estão com o prêmio liberado agora
            'premios_disponiveis' => Fidelidade::ativa($bs)
                ? collect(Fidelidade::selos($bs, Schedule::query()->where('status', Schedule::STATUS_CONCLUIDO)->distinct()->pluck('client_id')->all()))
                    ->filter(fn ($n) => $n >= $bs->fidelidade_meta)->count()
                : 0,
        ];
    }
}
