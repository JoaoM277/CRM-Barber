<?php

namespace App\Http\Controllers;

use App\Models\BillingEvent;
use App\Services\Billing\SubscriptionService;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * POST /webhooks/asaas
 *
 * Autenticado pelo header `asaas-access-token` (o token configurado no
 * webhook do Asaas = ASAAS_WEBHOOK_TOKEN). Cada evento é gravado antes de ser
 * processado; evento repetido é ignorado (o Asaas reenvia em caso de falha).
 *
 * Falha no processamento NÃO devolve erro ao Asaas: ele pausa a fila de
 * webhooks depois de erros seguidos. O erro fica em billing_events.error e o
 * evento pode ser reprocessado com `php artisan billing:reprocess`.
 */
class AsaasWebhookController extends Controller
{
    public function __invoke(Request $request, SubscriptionService $billing): JsonResponse
    {
        $expected = (string) config('billing.asaas.webhook_token');

        if ($expected === '' || ! hash_equals($expected, (string) $request->header('asaas-access-token'))) {
            return response()->json(['message' => 'Token inválido.'], 401);
        }

        $payload = $request->json()->all();
        $type = (string) ($payload['event'] ?? '');

        if ($type === '') {
            return response()->json(['message' => 'Evento sem tipo.'], 422);
        }

        $eventId = (string) ($payload['id'] ?? hash('sha256', $request->getContent()));

        try {
            $event = BillingEvent::create([
                'provider' => 'asaas',
                'event_id' => $eventId,
                'event' => $type,
                'payload' => $payload,
            ]);
        } catch (UniqueConstraintViolationException) {
            return response()->json(['message' => 'Evento já recebido.']);
        }

        try {
            $billing->handleEvent($event);
        } catch (\Throwable $e) {
            $event->update(['error' => $e->getMessage()]);
            Log::error('Asaas webhook: falha ao processar', ['event_id' => $eventId, 'erro' => $e->getMessage()]);
        }

        return response()->json(['message' => 'ok']);
    }
}
