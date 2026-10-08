<?php

namespace App\Jobs;

use App\Jobs\Concerns\EnviaWhatsapp;
use App\Models\WaitlistEntry;
use App\Support\Phone;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Throwable;

/** "Abriu vaga no dia que você queria" — com o link para marcar. */
class SendWaitlistWhatsapp implements ShouldQueue
{
    use Dispatchable, EnviaWhatsapp, InteractsWithQueue, Queueable, SerializesModels;

    public const GATILHO = 'LISTA_ESPERA';

    public int $tries = 10;

    public int $maxExceptions = 3;

    public int $backoff = 20;

    public function __construct(public int $entryId, public string $hora) {}

    public function handle(): void
    {
        $e = WaitlistEntry::withoutGlobalScopes()->with(['client', 'barbershop'])->find($this->entryId);
        // já marcou ou saiu da lista enquanto o aviso estava na fila
        if (! $e || $e->status !== WaitlistEntry::AVISADO || ! $e->client || $e->client->deleted_at || ! $e->barbershop) {
            return;
        }

        if (! $this->podeEnviar($e->barbershop_id)) {
            return;
        }

        $this->enviarMensagem($e->barbershop_id, [
            'phone' => Phone::normalizeBr((string) $e->client->phone),
            'name' => strtok((string) $e->client->name, ' ') ?: $e->client->name,
            'trigger' => self::GATILHO,
            'client_id' => $e->client_id,
            'barbershop' => $e->barbershop->name,
            'date' => $e->date->toDateString(),
            'time' => $this->hora,
            'link' => rtrim(config('app.frontend_url'), '/').'/?b='.$e->barbershop->slug.'&d='.$e->date->toDateString(),
        ], ['waitlist_id' => $e->id]);
    }

    public function failed(Throwable $ex): void
    {
        Log::error('SendWaitlistWhatsapp falhou definitivamente', ['waitlist_id' => $this->entryId, 'erro' => $ex->getMessage()]);
    }
}
