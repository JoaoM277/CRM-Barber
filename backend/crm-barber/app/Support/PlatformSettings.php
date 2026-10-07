<?php

namespace App\Support;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Configurações da plataforma (tabela platform_settings), com padrão vindo
 * de config/billing.php. Editadas pelo painel universal.
 */
class PlatformSettings
{
    private const CACHE_KEY = 'platform_settings';

    /** chave => regra de validação — só estas podem ser editadas */
    public const EDITABLE = [
        'trial_days' => 'integer|min:0|max:90',
        'grace_days' => 'integer|min:0|max:30',
        'trial_plan' => 'string|exists:plans,slug',
        'signup_open' => 'boolean',
    ];

    public static function defaults(): array
    {
        return [
            'trial_days' => (int) config('billing.trial_days'),
            'grace_days' => (int) config('billing.grace_days'),
            'trial_plan' => (string) config('billing.trial_plan'),
            'signup_open' => true,
        ];
    }

    public static function all(): array
    {
        $stored = Cache::rememberForever(self::CACHE_KEY, function () {
            // antes da migration rodar (deploy em andamento) vale só o padrão
            if (! Schema::hasTable('platform_settings')) {
                return [];
            }

            return DB::table('platform_settings')->pluck('value', 'key')
                ->map(fn ($v) => json_decode($v, true))
                ->all();
        });

        return array_merge(self::defaults(), array_intersect_key($stored, self::EDITABLE));
    }

    public static function get(string $key): mixed
    {
        return self::all()[$key] ?? null;
    }

    public static function set(array $values): void
    {
        foreach (array_intersect_key($values, self::EDITABLE) as $key => $value) {
            DB::table('platform_settings')->updateOrInsert(
                ['key' => $key],
                ['value' => json_encode($value), 'updated_at' => now(), 'created_at' => now()]
            );
        }

        Cache::forget(self::CACHE_KEY);
    }

    public static function trialDays(): int
    {
        return (int) self::get('trial_days');
    }

    public static function graceDays(): int
    {
        return (int) self::get('grace_days');
    }
}
