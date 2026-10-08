<?php

namespace App\Support;

use App\Models\Barbershop;
use App\Models\LoyaltyRedemption;
use App\Models\Schedule;
use Illuminate\Support\Facades\DB;

/**
 * Cartão de selos: selos = atendimentos concluídos desde que o programa foi
 * ligado − selos já trocados por prêmios. Prêmio disponível = selos ≥ meta.
 */
class Fidelidade
{
    public static function ativa(?Barbershop $bs): bool
    {
        return (bool) ($bs?->fidelidade_ativa && $bs->fidelidade_desde && $bs->fidelidade_meta > 0);
    }

    /**
     * Selos de vários clientes de uma vez: [client_id => selos].
     *
     * @param  array<int>  $clientIds
     */
    public static function selos(Barbershop $bs, array $clientIds): array
    {
        if (! self::ativa($bs) || ! $clientIds) {
            return [];
        }

        $ganhos = DB::table('schedules')
            ->where('barbershop_id', $bs->id)
            ->whereIn('client_id', $clientIds)
            ->where('status', Schedule::STATUS_CONCLUIDO)
            ->where('date', '>=', $bs->fidelidade_desde->toDateString())
            ->groupBy('client_id')
            ->selectRaw('client_id, COUNT(*) as n')
            ->pluck('n', 'client_id');

        $usados = DB::table('loyalty_redemptions')
            ->where('barbershop_id', $bs->id)
            ->whereIn('client_id', $clientIds)
            ->groupBy('client_id')
            ->selectRaw('client_id, SUM(selos) as n')
            ->pluck('n', 'client_id');

        $saldo = [];
        foreach ($clientIds as $id) {
            $saldo[$id] = max(0, (int) ($ganhos[$id] ?? 0) - (int) ($usados[$id] ?? 0));
        }

        return $saldo;
    }

    /** Resumo para telas: null quando o programa está desligado. */
    public static function resumo(Barbershop $bs, int $clientId, ?int $selos = null): ?array
    {
        if (! self::ativa($bs)) {
            return null;
        }
        $selos ??= self::selos($bs, [$clientId])[$clientId] ?? 0;

        return [
            'selos' => $selos,
            'meta' => (int) $bs->fidelidade_meta,
            'premio' => $bs->fidelidade_premio,
            'premio_disponivel' => $selos >= $bs->fidelidade_meta,
        ];
    }

    /** Entrega o prêmio (consome uma meta de selos). Null se ainda não tem selos suficientes. */
    public static function resgatar(Barbershop $bs, int $clientId, ?int $scheduleId, ?int $userId): ?LoyaltyRedemption
    {
        return DB::transaction(function () use ($bs, $clientId, $scheduleId, $userId) {
            // serializa resgates do mesmo cliente (dois cliques não dão dois prêmios)
            DB::table('clients')->where('id', $clientId)->lockForUpdate()->first();

            if ((self::selos($bs, [$clientId])[$clientId] ?? 0) < $bs->fidelidade_meta) {
                return null;
            }

            return LoyaltyRedemption::create([
                'barbershop_id' => $bs->id,
                'client_id' => $clientId,
                'schedule_id' => $scheduleId,
                'selos' => (int) $bs->fidelidade_meta,
                'premio' => $bs->fidelidade_premio,
                'user_id' => $userId,
            ]);
        });
    }
}
