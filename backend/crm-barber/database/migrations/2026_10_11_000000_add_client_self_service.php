<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * O cliente cancela/remarca pelo próprio link (sem login):
 * - schedules.token_cliente: chave secreta do link "meu horário"
 * - barbershops.alterar_pelo_link: a barbearia permite (padrão sim)
 * - barbershops.antecedencia_alteracao_horas: até quantas horas antes ainda pode
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('schedules', function (Blueprint $table) {
            $table->string('token_cliente', 40)->nullable()->unique()->after('status');
        });

        Schema::table('barbershops', function (Blueprint $table) {
            $table->boolean('alterar_pelo_link')->default(true)->after('cancelar_pelo_lembrete');
            $table->unsignedTinyInteger('antecedencia_alteracao_horas')->default(2)->after('alterar_pelo_link');
        });

        // horários futuros em aberto ganham link também
        DB::table('schedules')
            ->whereNull('token_cliente')
            ->where('date', '>=', now()->toDateString())
            ->whereIn('status', ['pendente', 'confirmado'])
            ->orderBy('id')
            ->pluck('id')
            ->each(fn ($id) => DB::table('schedules')->where('id', $id)->update(['token_cliente' => Str::random(40)]));
    }

    public function down(): void
    {
        Schema::table('schedules', function (Blueprint $table) {
            $table->dropUnique(['token_cliente']);
            $table->dropColumn('token_cliente');
        });
        Schema::table('barbershops', function (Blueprint $table) {
            $table->dropColumn(['alterar_pelo_link', 'antecedencia_alteracao_horas']);
        });
    }
};
