<?php

namespace App\Console\Commands;

use App\Jobs\SendAppointmentWhatsapp;
use App\Models\Barbershop;
use App\Models\Schedule;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

/**
 * Pedido de avaliação pós-atendimento (roda a cada 10 min pelo scheduler).
 *
 *  - Atendimentos concluídos de hoje ou ontem, 1h depois do fim do horário.
 *  - Só entre 8h e 21h; um pedido por atendimento.
 *  - No máximo um pedido por cliente a cada 30 dias (cliente semanal não
 *    recebe toda semana).
 *  - Só barbearias com a opção ligada (o job ainda confere plano e número).
 */
class SendReviewRequests extends Command
{
    protected $signature = 'avaliacoes:enviar {--agora= : simula o horário atual (testes), formato Y-m-d H:i}';

    protected $description = 'Pede no WhatsApp a nota do atendimento concluído';

    public const ESPERA_MINUTOS = 60;

    public const INTERVALO_DIAS = 30;

    public function handle(): int
    {
        $agora = $this->option('agora') ? Carbon::parse($this->option('agora')) : now();

        if ($agora->hour < SendReminders::HORA_INICIO || $agora->hour >= SendReminders::HORA_FIM) {
            return self::SUCCESS;
        }

        $barbearias = Barbershop::where('active', true)->where('avaliacao_whatsapp', true)->pluck('id');

        $candidatos = Schedule::withoutGlobalScopes()
            ->whereIn('barbershop_id', $barbearias)
            ->where('status', Schedule::STATUS_CONCLUIDO)
            ->whereNull('avaliacao_pedida_em')
            ->whereBetween('date', [$agora->copy()->subDay()->toDateString(), $agora->toDateString()])
            ->get();

        $enviados = 0;
        foreach ($candidatos as $s) {
            $fim = Carbon::parse(substr((string) $s->date, 0, 10).' '.substr((string) $s->end_time, 0, 5));
            if ($agora->lessThan($fim->addMinutes(self::ESPERA_MINUTOS))) {
                continue;
            }

            $recente = Schedule::withoutGlobalScopes()
                ->where('barbershop_id', $s->barbershop_id)
                ->where('client_id', $s->client_id)
                ->where('avaliacao_pedida_em', '>=', $agora->copy()->subDays(self::INTERVALO_DIAS))
                ->exists();

            // marca mesmo quando pula: este atendimento não volta a ser candidato
            $atualizou = Schedule::withoutGlobalScopes()->whereKey($s->id)->whereNull('avaliacao_pedida_em')
                ->update(['avaliacao_pedida_em' => $recente ? $agora->copy()->subYears(10) : $agora]);

            if ($atualizou && ! $recente) {
                SendAppointmentWhatsapp::dispatch($s->id, SendAppointmentWhatsapp::AVALIACAO_PEDIDO);
                $enviados++;
            }
        }

        $this->info("Avaliações: {$enviados} pedido(s).");

        return self::SUCCESS;
    }
}
