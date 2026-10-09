<?php

namespace App\Support;

use App\Models\Barbershop;
use App\Models\BarbershopPhoto;
use App\Models\Plan;
use App\Models\Subscription;

/**
 * Personalização da página de agendamento (recurso "personalizacao", Pro/Premium).
 * Fica num JSON na barbearia; a página pública recebe só o que é seguro mostrar.
 */
class PaginaPersonalizada
{
    public const ESTILOS = ['moderno', 'classico', 'vintage', 'urbano', 'minimalista'];

    public const FONTES = ['figtree', 'bebas', 'playfair', 'oswald', 'dm-serif', 'archivo'];

    public const MODOS = ['auto', 'claro', 'escuro'];

    public const TEXTURAS = ['liso', 'couro', 'madeira', 'concreto'];

    public const MAX_FOTOS = 12;

    /** Como o cliente escolhe serviços e profissionais: 5 no Pro, os 10 no Premium. */
    public const SELETORES_PRO = ['lista', 'compacta', 'cards', 'dropdown', 'chips'];

    public const SELETORES_PREMIUM = ['carrossel', 'mosaico', 'cardapio', 'vitrine', 'sanfona'];

    public const PADRAO = [
        'estilo' => 'moderno',
        'fonte' => 'figtree',
        'modo' => 'auto',
        'textura' => 'liso',
        'capa_path' => null,
        'boas_vindas' => null,
        'sobre' => null,
        'mensagem_sucesso' => null,
        'mostrar_endereco' => true,
        'mostrar_horarios' => true,
        'seletor_servicos' => 'lista',
        'seletor_profissionais' => 'lista',
    ];

    /** O plano libera? (sem assinatura registrada = conta antiga, libera) */
    public static function liberada(?Barbershop $bs): bool
    {
        if (! $bs) {
            return false;
        }
        $sub = Subscription::with('plan')->where('barbershop_id', $bs->id)->first();

        return ! $sub || $sub->hasFeature(Plan::FEATURE_PERSONALIZACAO);
    }

    /** Modelos de seletor que o plano da barbearia libera. */
    public static function seletores(?Barbershop $bs): array
    {
        if (! self::liberada($bs)) {
            return ['lista'];
        }
        $sub = Subscription::with('plan')->where('barbershop_id', $bs->id)->first();
        $premium = ! $sub || $sub->hasFeature(Plan::FEATURE_SELETORES_PREMIUM);

        return $premium ? [...self::SELETORES_PRO, ...self::SELETORES_PREMIUM] : self::SELETORES_PRO;
    }

    /** Configuração completa (para o painel), com os padrões preenchidos. */
    public static function config(Barbershop $bs): array
    {
        return array_merge(self::PADRAO, array_intersect_key($bs->pagina ?? [], self::PADRAO));
    }

    /** O que a página pública recebe (null = plano sem personalização: visual padrão). */
    public static function publica(Barbershop $bs): ?array
    {
        if (! self::liberada($bs)) {
            return null;
        }
        $c = self::config($bs);
        $contato = self::contato($bs);
        // plano rebaixado: modelo que não é mais do plano volta para a lista
        $permitidos = self::seletores($bs);

        return [
            'estilo' => $c['estilo'],
            'fonte' => $c['fonte'],
            'modo' => $c['modo'],
            'textura' => $c['textura'],
            'capa_url' => $c['capa_path'] ? Imagem::url($c['capa_path']) : null,
            'boas_vindas' => $c['boas_vindas'],
            'sobre' => $c['sobre'],
            'mensagem_sucesso' => $c['mensagem_sucesso'],
            'endereco' => $c['mostrar_endereco'] ? $contato['endereco'] : null,
            'mapa_url' => $c['mostrar_endereco'] ? $contato['mapa_url'] : null,
            'mostrar_horarios' => (bool) $c['mostrar_horarios'],
            'seletor_servicos' => in_array($c['seletor_servicos'], $permitidos, true) ? $c['seletor_servicos'] : 'lista',
            'seletor_profissionais' => in_array($c['seletor_profissionais'], $permitidos, true) ? $c['seletor_profissionais'] : 'lista',
            'instagram' => $contato['instagram'],
            'whatsapp' => $contato['whatsapp'],
            'galeria' => BarbershopPhoto::withoutGlobalScopes()->where('barbershop_id', $bs->id)->orderBy('ordem')->orderBy('id')
                ->get()->map(fn ($f) => ['id' => $f->id, 'url' => $f->url, 'legenda' => $f->legenda])->values()->all(),
        ];
    }

    /** Endereço, mapa, Instagram e WhatsApp (vêm de Configurações > Barbearia). */
    public static function contato(Barbershop $bs): array
    {
        $endereco = collect([trim(($bs->street ?? '').' '.($bs->number ?? '')), $bs->neighborhood, $bs->city ? $bs->city.($bs->state ? ' - '.$bs->state : '') : null])
            ->map(fn ($p) => trim((string) $p))->filter()->implode(', ');
        $whats = $bs->whatsapp ? Phone::normalizeBr((string) $bs->whatsapp) : '';

        return [
            'endereco' => $endereco ?: null,
            'mapa_url' => $endereco ? 'https://www.google.com/maps/search/?api=1&query='.rawurlencode($bs->name.', '.$endereco) : null,
            'instagram' => self::instagram($bs->instagram),
            'whatsapp' => strlen($whats) >= 12 ? $whats : null,
        ];
    }

    /** "@alpha", "alpha" ou a URL do perfil → URL do perfil. */
    public static function instagram(?string $v): ?string
    {
        $v = trim((string) $v);
        if ($v === '') {
            return null;
        }
        if (preg_match('#instagram\.com/([A-Za-z0-9._]+)#', $v, $m)) {
            $v = $m[1];
        }
        $usuario = ltrim($v, '@');

        return preg_match('/^[A-Za-z0-9._]{1,30}$/', $usuario) ? 'https://instagram.com/'.$usuario : null;
    }
}
