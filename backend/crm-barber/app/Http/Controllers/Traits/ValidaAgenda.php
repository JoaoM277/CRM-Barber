<?php

namespace App\Http\Controllers\Traits;

use App\Models\OperationTime;
use App\Models\Schedule;
use App\Models\Service;
use Carbon\Carbon;
use Illuminate\Validation\ValidationException;

/**
 * Regras de horário compartilhadas entre o painel (ScheduleController) e o
 * cliente remarcando pelo link (MeuHorarioController).
 */
trait ValidaAgenda
{
    /**
     * Duração de um serviço em minutos; usa 30 min como padrão.
     */
    protected function serviceDurationMinutes(?Service $service): int
    {
        return ($service && $service->duration_time > 0) ? (int) $service->duration_time : 30;
    }

    /**
     * Duração total do agendamento = soma dos serviços (fallback 30 min).
     */
    protected function scheduleDurationMinutes(Schedule $schedule): int
    {
        $servicos = $schedule->servicosResolvidos();

        if ($servicos->isEmpty()) {
            return 30;
        }

        return max(1, (int) $servicos->sum(fn (Service $s) => $this->serviceDurationMinutes($s)));
    }

    /**
     * Trava de horário: rejeita agendamento no passado ou que sobreponha
     * outro agendamento não-cancelado do mesmo profissional.
     */
    protected function assertHorarioLivre(int $workerId, string $date, string $start, string $end, ?int $ignoreId = null): void
    {
        if (Carbon::parse("{$date} ".substr($start, 0, 5))->isPast()) {
            throw ValidationException::withMessages([
                'horario' => ['Não é possível agendar em um horário que já passou.'],
            ]);
        }

        $conflito = Schedule::query()
            ->where('worker_id', $workerId)
            ->whereDate('date', $date)
            ->where('status', '!=', Schedule::STATUS_CANCELADO)
            ->where('start_time', '<', $end)
            ->where('end_time', '>', $start)
            ->when($ignoreId, fn ($q) => $q->where('id', '!=', $ignoreId))
            ->exists();

        if ($conflito) {
            throw ValidationException::withMessages([
                'horario' => ['Este profissional já tem um agendamento nesse horário.'],
            ]);
        }
    }

    /**
     * Valida o slot contra o horário de funcionamento (grade por dia da semana).
     */
    protected function assertDentroDoExpediente(string $date, string $start, string $end): void
    {
        $dow = Carbon::parse($date)->dayOfWeek; // 0 = domingo ... 6 = sábado
        $op = OperationTime::where('day_of_week', $dow)->first();

        if (! $op || ! $op->active) {
            throw ValidationException::withMessages([
                'horario' => ['A barbearia não abre neste dia da semana.'],
            ]);
        }

        $s = substr($start, 0, 5);
        $e = substr($end, 0, 5);
        $abre = substr((string) $op->start_time, 0, 5);
        $fecha = substr((string) $op->end_time, 0, 5);

        if ($s < $abre || $e > $fecha) {
            throw ValidationException::withMessages([
                'horario' => ["Fora do horário de funcionamento ({$abre} às {$fecha})."],
            ]);
        }

        if ($op->waiting_start && $op->waiting_end) {
            $ws = substr((string) $op->waiting_start, 0, 5);
            $we = substr((string) $op->waiting_end, 0, 5);
            if ($s < $we && $e > $ws) {
                throw ValidationException::withMessages([
                    'horario' => ["Esse horário cai no intervalo da barbearia ({$ws} às {$we})."],
                ]);
            }
        }
    }
}
