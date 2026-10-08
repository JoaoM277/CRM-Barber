<?php

namespace App\Support;

use App\Models\Instance;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/** Liga o webhook de mensagens recebidas (respostas aos lembretes) numa instância da Evolution. */
class WhatsappWebhook
{
    public static function url(): ?string
    {
        $token = (string) config('services.evolution.webhook_token');

        return $token === '' ? null : rtrim(config('app.url'), '/').'/api/webhooks/evolution/'.$token;
    }

    public static function configurar(Instance $instancia): bool
    {
        $url = self::url();
        if (! $url) {
            return false; // sem EVOLUTION_WEBHOOK_TOKEN: lembretes saem, só não recebem resposta
        }

        try {
            $res = Http::timeout(15)->post(rtrim(config('services.messages.url'), '/').'/instance/webhook', [
                'name' => $instancia->name,
                'url' => $url,
            ]);

            return $res->successful();
        } catch (\Throwable $e) {
            Log::warning('Não foi possível configurar o webhook da instância', ['instancia' => $instancia->name, 'erro' => $e->getMessage()]);

            return false;
        }
    }
}
