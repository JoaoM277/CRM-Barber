<?php

namespace App\Support;

use App\Models\Barbershop;
use App\Models\Client;
use App\Models\Schedule;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Quem conta como "sumido" para a reativação:
 *  - a última visita (agendamento não cancelado) foi há pelo menos N dias,
 *    e há no máximo 1 ano (contato muito antigo não recebe);
 *  - não tem horário marcado para frente (a última data já ficou para trás);
 *  - ainda não recebeu a reativação deste sumiço (envio anterior à última visita
 *    não conta), não pediu para sair e não foi anonimizado.
 */
class Reativacao
{
    public static function sumidos(Barbershop $bs, ?Carbon $hoje = null): Builder
    {
        $hoje ??= now();

        $ultimas = DB::table('schedules')
            ->select('client_id', DB::raw('MAX(date) as ultima_visita'))
            ->where('barbershop_id', $bs->id)
            ->where('status', '!=', Schedule::STATUS_CANCELADO)
            ->groupBy('client_id');

        return Client::withoutGlobalScopes()
            ->joinSub($ultimas, 'u', 'u.client_id', '=', 'clients.id')
            ->where('clients.barbershop_id', $bs->id)
            ->whereNull('clients.deleted_at')
            ->whereNull('clients.reativacao_bloqueada_em')
            ->where('clients.phone', 'not like', 'anonimo-%')
            ->where('u.ultima_visita', '<=', $hoje->copy()->subDays(max(1, (int) $bs->reativacao_dias))->toDateString())
            ->where('u.ultima_visita', '>=', $hoje->copy()->subYear()->toDateString())
            ->where(fn ($q) => $q->whereNull('clients.reativacao_enviada_em')->orWhereColumn('clients.reativacao_enviada_em', '<', 'u.ultima_visita'))
            ->select('clients.*', 'u.ultima_visita');
    }

    /** Números dos últimos 30 dias: quantos receberam e quantos marcaram depois disso. */
    public static function resultados(Barbershop $bs): array
    {
        $desde = now()->subDays(30);

        $enviados = Client::withoutGlobalScopes()
            ->where('barbershop_id', $bs->id)
            ->where('reativacao_enviada_em', '>=', $desde);

        $voltaram = (clone $enviados)->whereExists(fn ($q) => $q->from('schedules')
            ->whereColumn('schedules.client_id', 'clients.id')
            ->where('schedules.status', '!=', Schedule::STATUS_CANCELADO)
            ->whereColumn('schedules.created_at', '>', 'clients.reativacao_enviada_em'));

        return [
            'enviados_30d' => $enviados->count(),
            'voltaram_30d' => $voltaram->count(),
            'sumidos_agora' => self::sumidos($bs)->count(),
        ];
    }
}
