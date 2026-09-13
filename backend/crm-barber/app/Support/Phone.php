<?php

namespace App\Support;

/**
 * Normalização de telefone BR para um formato canônico: só dígitos, com DDI 55
 * (ex.: "(11) 98765-4321" -> "5511987654321"). É o formato que a Evolution API
 * espera e o que garante dedupe de cliente por telefone.
 */
class Phone
{
    public static function normalizeBr(string $raw): string
    {
        $d = preg_replace('/\D/', '', $raw) ?? '';

        if ($d === '') {
            return '';
        }

        // tira zeros à esquerda (DDD antigo tipo "011")
        $d = ltrim($d, '0');

        // já veio com DDI 55 + DDD + número (12 ou 13 dígitos)
        if (str_starts_with($d, '55') && (strlen($d) === 12 || strlen($d) === 13)) {
            return $d;
        }

        // DDD + número (10 fixo / 11 celular) -> prefixa 55
        if (strlen($d) === 10 || strlen($d) === 11) {
            return '55'.$d;
        }

        // qualquer outra coisa: devolve os dígitos como estão
        return $d;
    }
}
