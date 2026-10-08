<?php

namespace App\Console\Commands;

use App\Jobs\SendReactivationWhatsapp;
use App\Models\Barbershop;
use App\Models\Client;
use App\Support\Reativacao;
use Illuminate\Console\Command;

/**
 * Reativação de clientes sumidos (1x por dia, de manhã): quem está há X dias
 * sem visita recebe um convite para voltar. Só barbearias que ligaram a opção;
 * no máximo POR_DIA mensagens por barbearia (as mais recentes primeiro, que
 * têm mais chance de voltar) para não queimar o número com envio em massa.
 */
class SendReactivations extends Command
{
    protected $signature = 'reativacao:enviar';

    protected $description = 'Convida no WhatsApp os clientes que sumiram há X dias';

    public const POR_DIA = 30;

    public function handle(): int
    {
        $total = 0;

        Barbershop::where('active', true)->where('reativacao_whatsapp', true)->each(function (Barbershop $bs) use (&$total) {
            $clientes = Reativacao::sumidos($bs)->orderByDesc('u.ultima_visita')->limit(self::POR_DIA)->pluck('clients.id');

            foreach ($clientes as $id) {
                // marca antes de enfileirar: rodar de novo não duplica
                $marcou = Client::withoutGlobalScopes()->whereKey($id)->update(['reativacao_enviada_em' => now()]);
                if ($marcou) {
                    SendReactivationWhatsapp::dispatch($id);
                    $total++;
                }
            }
        });

        $this->info("Reativação: {$total} convite(s) na fila.");

        return self::SUCCESS;
    }
}
