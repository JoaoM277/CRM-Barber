<?php

namespace App\Support;

use App\Jobs\SendWaitlistWhatsapp;
use App\Models\Barbershop;
use App\Models\Schedule;
use App\Models\WaitlistEntry;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Log;

/** Lista de espera: avisa quem está esperando quando um horário do dia vaga. */
class ListaEspera
{
    /** Quantas pessoas recebem o aviso a cada vaga (a primeira a marcar leva). */
    public const AVISOS_POR_VAGA = 3;

    /** Avisos só entre 7h e 22h (vaga aberta de madrugada fica para a próxima). */
    public const HORA_INICIO = 7;

    public const HORA_FIM = 22;

    /** Um horário foi cancelado: avisa os primeiros da lista daquele dia. */
    public static function vagaAberta(Schedule $s): void
    {
        $bs = $s->barbershop;
        if (! $bs?->lista_espera_ativa) {
            return;
        }
        $agora = now();
        $inicio = Carbon::parse(substr((string) $s->date, 0, 10).' '.substr((string) $s->start_time, 0, 5));
        if ($inicio->lessThanOrEqualTo($agora->copy()->addMinutes(30)) || $agora->hour < self::HORA_INICIO || $agora->hour >= self::HORA_FIM) {
            return;
        }

        $fila = WaitlistEntry::withoutGlobalScopes()
            ->where('barbershop_id', $s->barbershop_id)
            ->whereDate('date', $inicio->toDateString())
            ->where('status', WaitlistEntry::AGUARDANDO)
            ->where('client_id', '!=', $s->client_id)
            ->where(fn ($q) => $q->whereNull('worker_id')->orWhere('worker_id', $s->worker_id))
            ->orderBy('id')
            ->limit(self::AVISOS_POR_VAGA)
            ->get();

        foreach ($fila as $e) {
            $e->update(['status' => WaitlistEntry::AVISADO, 'avisado_em' => $agora]);
            try {
                Bus::dispatch(new SendWaitlistWhatsapp($e->id, substr((string) $s->start_time, 0, 5)));
            } catch (\Throwable $ex) {
                Log::warning('Falha ao enfileirar aviso da lista de espera: '.$ex->getMessage());
            }
        }
    }

    /** O cliente marcou horário no dia em que esperava: sai da lista. */
    public static function agendou(Barbershop|int $bs, int $clientId, string $data): void
    {
        WaitlistEntry::withoutGlobalScopes()
            ->where('barbershop_id', is_int($bs) ? $bs : $bs->id)
            ->where('client_id', $clientId)
            ->whereDate('date', $data)
            ->whereIn('status', [WaitlistEntry::AGUARDANDO, WaitlistEntry::AVISADO])
            ->update(['status' => WaitlistEntry::AGENDOU]);
    }
}
