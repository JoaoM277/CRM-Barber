<?php

namespace App\Http\Controllers;

use App\Models\Plan;
use App\Models\Subscription;
use App\Services\Asaas\AsaasException;
use App\Services\Billing\SubscriptionService;
use App\Support\Audit;
use App\Support\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;

class BillingController extends Controller
{
    public function __construct(protected SubscriptionService $billing) {}

    /** GET /planos — público (landing page e tela de assinatura). */
    public function plans(): JsonResponse
    {
        return response()->json(Plan::active()->get()->map->toPublicArray()->values());
    }

    /** GET /assinatura — situação atual, planos e faturas da barbearia logada. */
    public function show(TenantContext $tenant): JsonResponse
    {
        $sub = $this->subscription($tenant);

        return response()->json([
            'assinatura' => $sub?->toPanelArray(),
            'planos' => Plan::active()->get()->map->toPublicArray()->values(),
            'faturas' => $sub
                ? $sub->payments()->latest('due_date')->limit(12)->get()->map->toPanelArray()->values()
                : [],
        ]);
    }

    /** POST /assinatura — assina ou troca de plano/forma de pagamento. */
    public function subscribe(Request $request, TenantContext $tenant): JsonResponse
    {
        $data = $request->validate([
            'plano' => ['required', 'string', Rule::exists('plans', 'slug')->where('active', true)],
            'forma_pagamento' => ['required', Rule::in(SubscriptionService::BILLING_TYPES)],
            'cpf_cnpj' => ['nullable', 'string', 'regex:/^\D*(\d\D*){11}$|^\D*(\d\D*){14}$/'],
            'telefone' => ['nullable', 'string', 'max:20'],
        ], [
            'cpf_cnpj.regex' => 'Informe um CPF (11 dígitos) ou CNPJ (14 dígitos).',
        ]);

        $sub = $this->subscription($tenant) ?? $this->billing->startTrial($tenant->barbershop());
        $plan = Plan::where('slug', $data['plano'])->firstOrFail();
        $cpfCnpj = isset($data['cpf_cnpj']) ? preg_replace('/\D/', '', $data['cpf_cnpj']) : null;

        try {
            [$sub, $invoiceUrl] = $this->billing->subscribe(
                $sub, $plan, $data['forma_pagamento'], $request->user(), $cpfCnpj, $data['telefone'] ?? null
            );
        } catch (AsaasException $e) {
            Log::error('Asaas: falha ao assinar', ['barbershop' => $tenant->id(), 'erro' => $e->getMessage()]);

            return response()->json(['code' => 'gateway_error', 'message' => $e->userMessage()], 422);
        }

        Audit::log('assinatura.assinar', $sub, "Plano {$plan->name} via {$data['forma_pagamento']}");

        return response()->json([
            'message' => 'Assinatura atualizada.',
            'assinatura' => $sub->load('plan')->toPanelArray(),
            'link_pagamento' => $invoiceUrl,
        ]);
    }

    /** DELETE /assinatura — cancela a renovação (acesso segue até o fim do período). */
    public function cancel(TenantContext $tenant): JsonResponse
    {
        $sub = $this->subscription($tenant);

        if (! $sub || $sub->status === Subscription::STATUS_CANCELED) {
            return response()->json(['message' => 'Não há assinatura ativa para cancelar.'], 422);
        }

        try {
            $sub = $this->billing->cancel($sub);
        } catch (AsaasException $e) {
            Log::error('Asaas: falha ao cancelar', ['barbershop' => $tenant->id(), 'erro' => $e->getMessage()]);

            return response()->json(['code' => 'gateway_error', 'message' => $e->userMessage()], 422);
        }

        Audit::log('assinatura.cancelar', $sub, 'Renovação cancelada');

        return response()->json([
            'message' => 'Assinatura cancelada. O acesso continua até o fim do período atual.',
            'assinatura' => $sub->load('plan')->toPanelArray(),
        ]);
    }

    private function subscription(TenantContext $tenant): ?Subscription
    {
        return Subscription::with('plan')->where('barbershop_id', $tenant->id())->first();
    }
}
