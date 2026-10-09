<?php

namespace App\Console\Commands;

use App\Jobs\SendAppointmentWhatsapp;
use App\Models\Schedule;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

/**
 * Mensagem de apoio para quem faltou (todo dia às 10h): só para faltas
 * automáticas de antes de hoje que o dono não reverteu. Sai uma vez.
 * (no dia seguinte, e não na hora: dá tempo de o dono corrigir quem veio)
 */
class SendNoShowSupport extends Command
{
    protected $signature = 'agenda:apoio {--agora= : simula o horário atual (testes), formato Y-m-d H:i}';

    protected $description = 'Manda a mensagem de apoio para as faltas automáticas do dia anterior';

    public function handle(): int
    {
        $agora = $this->option('agora') ? Carbon::parse($this->option('agora')) : now();

        $faltas = Schedule::withoutGlobalScopes()
            ->where('status', Schedule::STATUS_FALTA)
            ->where('cancelado_por', Schedule::POR_SISTEMA)
            ->whereNull('apoio_enviado_em')
            ->where('falta_em', '<', $agora->copy()->startOfDay())
            ->where('falta_em', '>', $agora->copy()->subDays(Schedule::DIAS_PARA_REVERTER))
            ->pluck('id');

        $n = 0;
        foreach ($faltas as $id) {
            $marcou = Schedule::withoutGlobalScopes()->whereKey($id)->whereNull('apoio_enviado_em')->update(['apoio_enviado_em' => $agora]);
            if ($marcou) {
                SendAppointmentWhatsapp::dispatch($id, SendAppointmentWhatsapp::APOIO_FALTA);
                $n++;
            }
        }
        $this->info("Mensagens de apoio: {$n}.");

        return self::SUCCESS;
    }
}
