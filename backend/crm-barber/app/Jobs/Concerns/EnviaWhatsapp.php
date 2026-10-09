<?php

namespace App\Jobs\Concerns;

use App\Models\Instance;
use App\Models\Plan;
use App\Models\Subscription;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\RateLimiter;

/**
 * Envio pelo serviço de mensagens (Node → Evolution), comum aos jobs de WhatsApp:
 * confere o plano, segura o ritmo por barbearia, escolhe o número conectado e
 * relança o job se o envio falhar. Quem usa precisa de InteractsWithQueue.
 */
trait EnviaWhatsapp
{
    /**
     * Ritmo máximo de mensagens por barbearia (protege o número contra bloqueio
     * do WhatsApp por rajada). Acima disso o job volta para a fila e sai depois.
     */
    public const POR_MINUTO = 20;

    /** true = pode montar a mensagem; false = não envia (plano) ou foi adiado (ritmo). */
    protected function podeEnviar(int $barbershopId): bool
    {
        // WhatsApp automático é recurso de plano (sem assinatura registrada = legado, envia)
        $sub = Subscription::with('plan')->where('barbershop_id', $barbershopId)->first();
        if ($sub && ! $sub->hasFeature(Plan::FEATURE_WHATSAPP)) {
            return false;
        }

        $ritmo = 'whatsapp-envios:'.$barbershopId;
        if (RateLimiter::tooManyAttempts($ritmo, self::POR_MINUTO)) {
            $this->release(RateLimiter::availableIn($ritmo) + random_int(1, 15));

            return false;
        }
        RateLimiter::hit($ritmo, 60);

        return true;
    }

    /**
     * Manda o payload ao serviço de mensagens; lança exceção se não saiu (a fila tenta de novo).
     * Devolve "dispatched" (enviada) ou "held" (retida pelo horário, não saiu).
     */
    protected function enviarMensagem(int $barbershopId, array $payload, array $contexto = []): string
    {
        // Instância da Evolution a usar: a conectada da barbearia.
        // Sem instância conectada, o Node registra SEM_INSTANCIA e nada é enviado.
        $instanceName = Instance::query()
            ->where('barbershop_id', $barbershopId)
            ->where('status', Instance::STATUS_CONECTADO)
            ->latest('last_connected_at')
            ->value('name');

        if ($instanceName) {
            $payload['instance'] = $instanceName;
        }

        $url = rtrim(config('services.messages.url'), '/');
        $response = Http::timeout(15)->post("{$url}/message", $payload);

        // O Node responde 200 mesmo quando o envio falha (corpo status:"failed").
        // "dispatched" = enviado; "held" = lembrete retido por horário (ok, não é erro).
        $statusMsg = data_get($response->json(), 'status');
        $enviou = $response->successful() && in_array($statusMsg, ['dispatched', 'held'], true);

        if (! $enviou) {
            Log::warning('Mensagem de WhatsApp não saiu', $contexto + [
                'gatilho' => $payload['trigger'] ?? null,
                'http' => $response->status(),
                'body' => $response->body(),
            ]);

            // relança pra fila tentar de novo (até $tries); no fim cai em failed()
            throw new \RuntimeException('Message service não confirmou o envio ('.($statusMsg ?? 'HTTP '.$response->status()).')');
        }

        return (string) $statusMsg;
    }
}
