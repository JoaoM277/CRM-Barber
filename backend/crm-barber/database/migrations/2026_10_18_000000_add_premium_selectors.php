<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Modelos de seletor (como o cliente escolhe serviços e profissionais):
 * o Pro tem 5 modelos; o Premium ganha o recurso "seletores_premium" com os 10.
 */
return new class extends Migration
{
    public function up(): void
    {
        $this->ajustar(fn (array $f, string $slug) => $slug === 'premium' && ! in_array('seletores_premium', $f, true) ? [...$f, 'seletores_premium'] : $f);
    }

    public function down(): void
    {
        $this->ajustar(fn (array $f) => array_values(array_diff($f, ['seletores_premium'])));
    }

    private function ajustar(callable $f): void
    {
        DB::table('plans')->get(['id', 'slug', 'features'])->each(function ($p) use ($f) {
            $atual = json_decode($p->features ?? '[]', true) ?: [];
            DB::table('plans')->where('id', $p->id)->update(['features' => json_encode($f($atual, $p->slug))]);
        });
    }
};
