<?php

namespace App\Support;

use App\Models\Schedule;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;

/**
 * Presença no atendimento: a confirmação vem do cliente; o dono só registra
 * se o atendimento aconteceu (concluído) ou não.
 *
 *  - Falta automática: 1h depois do início, quem recebeu o pedido de
 *    confirmação e não confirmou vira "falta" (cancelado pelo sistema).
 *    Agendamento com produto lançado nunca cai aqui (é prova de que veio).
 *  - Pode ser revertida pelo dono por 3 dias ("compareceu") ou marcada
 *    como "faltou mesmo".
 *  - Não registrado: dia anterior, ainda pendente/confirmado (ninguém concluiu).
 */
class Presenca
{
    public const MINUTOS_TOLERANCIA = 60;

    /** Marca as faltas automáticas. Devolve quantas. */
    public static function marcarFaltas(?Carbon $agora = null): int
    {
        $agora ??= now();
        $candidatos = Schedule::withoutGlobalScopes()
            ->where('status', Schedule::STATUS_PENDENTE)
            ->whereNotNull('confirmacao_pedida_em')
            ->whereBetween('date', [$agora->copy()->subDays(2)->toDateString(), $agora->toDateString()])
            ->whereDoesntHave('products')
            ->get();

        $n = 0;
        foreach ($candidatos as $s) {
            if ($agora->lessThan($s->inicio()->addMinutes(self::MINUTOS_TOLERANCIA))) {
                continue;
            }
            // condicional: se o cliente confirmou ou o dono concluiu nesse meio-tempo, não mexe
            $mudou = Schedule::withoutGlobalScopes()->whereKey($s->id)->where('status', Schedule::STATUS_PENDENTE)->update([
                'status' => Schedule::STATUS_FALTA,
                'cancelado_por' => Schedule::POR_SISTEMA,
                'falta_em' => $agora,
            ]);
            if ($mudou) {
                Audit::logFor($s->barbershop_id, 'agendamento.falta_automatica', $s, 'Não confirmou e não foi registrado: falta automática');
                $n++;
            }
        }

        return $n;
    }

    /** Atendimentos de dias anteriores que ninguém concluiu nem cancelou. */
    public static function naoRegistrados(): Builder
    {
        return Schedule::query()
            ->whereIn('status', [Schedule::STATUS_PENDENTE, Schedule::STATUS_CONFIRMADO])
            ->where('date', '<', now()->toDateString());
    }

    /** Faltas automáticas que o dono ainda pode reverter (até 3 dias). */
    public static function faltasParaRevisar(): Builder
    {
        return Schedule::query()
            ->where('status', Schedule::STATUS_FALTA)
            ->where('cancelado_por', Schedule::POR_SISTEMA)
            ->whereNull('falta_confirmada_em')
            ->where('falta_em', '>', now()->subDays(Schedule::DIAS_PARA_REVERTER));
    }
}
