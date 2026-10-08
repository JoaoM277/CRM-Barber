<?php

namespace App\Jobs;

use App\Jobs\Concerns\EnviaWhatsapp;
use App\Models\Client;
use App\Support\Phone;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Throwable;

/** "Faz tempo que você não aparece" — convite para voltar, com o link de agendamento. */
class SendReactivationWhatsapp implements ShouldQueue
{
    use Dispatchable, EnviaWhatsapp, InteractsWithQueue, Queueable, SerializesModels;

    public const GATILHO = 'REATIVACAO';

    public int $tries = 25;

    public int $maxExceptions = 3;

    public int $backoff = 30;

    public function __construct(public int $clientId) {}

    public function handle(): void
    {
        $cliente = Client::withoutGlobalScopes()->with('barbershop')->find($this->clientId);

        // pediu para sair (ou foi apagado) depois de entrar na fila: não envia
        if (! $cliente || $cliente->deleted_at || $cliente->reativacao_bloqueada_em || ! $cliente->barbershop?->reativacao_whatsapp) {
            return;
        }

        if (! $this->podeEnviar($cliente->barbershop_id)) {
            return;
        }

        $this->enviarMensagem($cliente->barbershop_id, [
            'phone' => Phone::normalizeBr((string) $cliente->phone),
            'name' => strtok((string) $cliente->name, ' ') ?: $cliente->name,
            'trigger' => self::GATILHO,
            'client_id' => $cliente->id,
            'barbershop' => $cliente->barbershop->name,
            'link' => rtrim(config('app.frontend_url'), '/').'/?b='.$cliente->barbershop->slug,
        ], ['client_id' => $cliente->id]);
    }

    public function failed(Throwable $e): void
    {
        Log::error('SendReactivationWhatsapp falhou definitivamente', ['client_id' => $this->clientId, 'erro' => $e->getMessage()]);
    }
}
