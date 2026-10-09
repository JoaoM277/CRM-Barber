<?php

namespace App\Support;

use App\Models\Barbershop;
use App\Models\Schedule;
use Illuminate\Database\Eloquent\Builder;

/**
 * Avaliações dos clientes dentro da Vellis.
 *
 * Público na página de agendamento: nota 4 ou 5 COM comentário e não
 * escondida pelo dono. A média conta todas as notas não escondidas.
 * O nome do cliente aparece abreviado ("João S.").
 */
class Avaliacoes
{
    public const NOTA_PUBLICA = 4;

    /** Todas as notas dadas (base para a média). */
    public static function notas(Barbershop $bs): Builder
    {
        return Schedule::withoutGlobalScopes()
            ->where('barbershop_id', $bs->id)
            ->whereNotNull('avaliacao_nota')
            ->where('avaliacao_oculta', false);
    }

    /** Só as que aparecem para os clientes. */
    public static function publicas(Barbershop $bs): Builder
    {
        return self::notas($bs)
            ->where('avaliacao_nota', '>=', self::NOTA_PUBLICA)
            ->whereNotNull('avaliacao_comentario')
            ->where('avaliacao_comentario', '!=', '');
    }

    public static function ehPublica(Schedule $s): bool
    {
        return $s->avaliacao_nota >= self::NOTA_PUBLICA && trim((string) $s->avaliacao_comentario) !== '' && ! $s->avaliacao_oculta;
    }

    /** {media, total} ou null se ainda não há nota. */
    public static function resumo(Barbershop $bs): ?array
    {
        $r = self::notas($bs)->selectRaw('COUNT(*) as total, AVG(avaliacao_nota) as media')->first();
        if (! $r || ! (int) $r->total) {
            return null;
        }

        return ['media' => round((float) $r->media, 1), 'total' => (int) $r->total];
    }

    /** "João da Silva" → "João S." (LGPD: nada de nome completo em página pública). */
    public static function nomeCurto(?string $nome): string
    {
        $partes = preg_split('/\s+/', trim((string) $nome)) ?: [];
        if (! $partes || $partes[0] === '') {
            return 'Cliente';
        }
        $ultimo = count($partes) > 1 ? ' '.mb_strtoupper(mb_substr(end($partes), 0, 1)).'.' : '';

        return $partes[0].$ultimo;
    }
}
