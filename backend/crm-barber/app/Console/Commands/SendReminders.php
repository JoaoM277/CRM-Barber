<?php

namespace App\Console\Commands;

use App\Jobs\SendAppointmentWhatsapp;
use App\Models\Barbershop;
use App\Models\Schedule;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

/**
 * Lembretes automáticos no WhatsApp (roda a cada 5 min pelo scheduler).
 *
 *  - 24h antes: para quem marcou com pelo menos 6h de antecedência e ainda
 *    falta mais de 3h (pede "1 confirma / 2 cancela" se ainda está pendente).
 *  - 2h antes: para quem marcou com pelo menos 2h30 de antecedência.
 *  - Só entre 8h e 21h (não acorda ninguém); cada lembrete sai uma vez.
 *  - Só barbearias ativas com os lembretes ligados (o job ainda confere o
 *    plano e o número conectado).
 */
class SendReminders extends Command
{
    protected $signature = 'lembretes:enviar {--agora= : simula o horário atual (testes), formato Y-m-d H:i}';

    protected $description = 'Envia os lembretes de 24h e 2h antes dos agendamentos';

    public const HORA_INICIO = 8;

    public const HORA_FIM = 21;

    public function handle(): int
    {
        $agora = $this->option('agora') ? Carbon::parse($this->option('agora')) : now();

        if ($agora->hour < self::HORA_INICIO || $agora->hour >= self::HORA_FIM) {
            $this->info('Fora do horário de envio de lembretes.');

            return self::SUCCESS;
        }

        $barbearias = Barbershop::where('active', true)->where('lembretes_whatsapp', true)->pluck('id');

        $candidatos = Schedule::withoutGlobalScopes()
            ->whereIn('barbershop_id', $barbearias)
            ->whereIn('status', [Schedule::STATUS_PENDENTE, Schedule::STATUS_CONFIRMADO])
            ->whereBetween('date', [$agora->toDateString(), $agora->copy()->addDay()->toDateString()])
            ->where(fn ($q) => $q->whereNull('lembrete_24h_em')->orWhereNull('lembrete_2h_em'))
            ->get();

        $enviados = ['24h' => 0, '2h' => 0];

        foreach ($candidatos as $s) {
            $inicio = Carbon::parse(substr((string) $s->date, 0, 10).' '.substr((string) $s->start_time, 0, 5));
            $faltam = $agora->diffInMinutes($inicio, false); // negativo = já passou
            $antecedencia = $s->created_at ? $s->created_at->diffInMinutes($inicio, false) : PHP_INT_MAX;

            if ($faltam <= 0) {
                continue;
            }

            if (! $s->lembrete_2h_em && $faltam <= 120 && $antecedencia >= 150) {
                $this->disparar($s, 'lembrete_2h_em', SendAppointmentWhatsapp::LEMBRETE_2H, $agora);
                $enviados['2h']++;
            } elseif (! $s->lembrete_24h_em && $faltam > 180 && $faltam <= 1440 && $antecedencia >= 360) {
                $this->disparar($s, 'lembrete_24h_em', SendAppointmentWhatsapp::LEMBRETE_24H, $agora);
                $enviados['24h']++;
            }
        }

        $this->info("Lembretes: {$enviados['24h']} de 24h, {$enviados['2h']} de 2h.");

        return self::SUCCESS;
    }

    private function disparar(Schedule $s, string $coluna, string $gatilho, Carbon $agora): void
    {
        // marca antes de enfileirar: se o scheduler rodar de novo, não duplica
        $atualizou = Schedule::withoutGlobalScopes()->whereKey($s->id)->whereNull($coluna)->update([$coluna => $agora]);

        if ($atualizou) {
            SendAppointmentWhatsapp::dispatch($s->id, $gatilho);
        }
    }
}
