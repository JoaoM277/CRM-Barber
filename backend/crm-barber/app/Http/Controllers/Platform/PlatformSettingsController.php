<?php

namespace App\Http\Controllers\Platform;

use App\Http\Controllers\Controller;
use App\Models\BillingEvent;
use App\Models\Plan;
use App\Services\Billing\SubscriptionService;
use App\Support\PlatformSettings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Configurações da plataforma, planos e saúde da integração de cobrança. */
class PlatformSettingsController extends Controller
{
    /** GET /plataforma/me — quem está logado no painel universal. */
    public function me(Request $request): JsonResponse
    {
        return response()->json($request->user()->only(['id', 'name', 'email', 'role']));
    }

    /** GET /plataforma/configuracoes */
    public function show(): JsonResponse
    {
        return response()->json([
            'configuracoes' => PlatformSettings::all(),
            'planos' => Plan::orderBy('sort')->get(),
            'gateway' => [
                'ambiente' => config('billing.asaas.env'),
                'chave_configurada' => (bool) config('billing.asaas.api_key'),
                'webhook_configurado' => (bool) config('billing.asaas.webhook_token'),
                'webhook_url' => rtrim(config('app.url'), '/').'/api/webhooks/asaas',
            ],
        ]);
    }

    /** PUT /plataforma/configuracoes */
    public function update(Request $request): JsonResponse
    {
        $rules = collect(PlatformSettings::EDITABLE)->map(fn ($r) => 'sometimes|'.$r)->all();
        $data = $request->validate($rules);

        PlatformSettings::set($data);

        return response()->json(['message' => 'Configurações salvas.', 'configuracoes' => PlatformSettings::all()]);
    }

    /**
     * PUT /plataforma/planos/{plan} — preço, limites e recursos.
     * Preço novo vale para assinaturas NOVAS; as existentes seguem com o valor
     * contratado no gateway até a barbearia trocar de plano.
     */
    public function updatePlan(Request $request, Plan $plan): JsonResponse
    {
        $data = $request->validate([
            'name' => 'sometimes|string|max:60',
            'price_cents' => 'sometimes|integer|min:0|max:10000000',
            'max_workers' => 'sometimes|nullable|integer|min:1|max:1000',
            'features' => 'sometimes|array',
            'features.*' => ['string', Rule::in([Plan::FEATURE_WHATSAPP, Plan::FEATURE_FINANCEIRO])],
            'active' => 'sometimes|boolean',
        ]);

        if (array_key_exists('features', $data)) {
            $data['features'] = array_values(array_unique($data['features']));
        }

        $plan->update($data);

        return response()->json(['message' => "Plano {$plan->name} atualizado.", 'plano' => $plan]);
    }

    /** GET /plataforma/cobranca/eventos?com_erro=1 — webhooks recebidos do gateway */
    public function billingEvents(Request $request): JsonResponse
    {
        $query = BillingEvent::latest('id');

        if ($request->boolean('com_erro')) {
            $query->whereNull('processed_at')->whereNotNull('error');
        }

        return response()->json(
            $query->limit(50)->get(['id', 'event_id', 'event', 'processed_at', 'error', 'created_at'])
        );
    }

    /** POST /plataforma/cobranca/eventos/{event}/reprocessar */
    public function reprocessEvent(BillingEvent $event, SubscriptionService $billing): JsonResponse
    {
        try {
            $billing->handleEvent($event);
        } catch (\Throwable $e) {
            $event->update(['error' => $e->getMessage()]);

            return response()->json(['message' => 'Falhou de novo: '.$e->getMessage()], 422);
        }

        return response()->json(['message' => 'Evento reprocessado.']);
    }
}
