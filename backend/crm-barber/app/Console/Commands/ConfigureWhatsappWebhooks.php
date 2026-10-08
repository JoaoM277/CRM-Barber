<?php

namespace App\Console\Commands;

use App\Models\Instance;
use App\Support\WhatsappWebhook;
use Illuminate\Console\Command;

/** Liga o webhook de respostas em todas as instâncias existentes (rodar uma vez após o deploy). */
class ConfigureWhatsappWebhooks extends Command
{
    protected $signature = 'whatsapp:webhooks';

    protected $description = 'Configura o webhook de respostas (lembretes) em todas as instâncias de WhatsApp';

    public function handle(): int
    {
        if (! WhatsappWebhook::url()) {
            $this->error('Defina EVOLUTION_WEBHOOK_TOKEN no .env primeiro.');

            return self::FAILURE;
        }

        foreach (Instance::all() as $i) {
            $this->line(sprintf('%-40s %s', $i->name, WhatsappWebhook::configurar($i) ? 'ok' : 'falhou'));
        }

        return self::SUCCESS;
    }
}
