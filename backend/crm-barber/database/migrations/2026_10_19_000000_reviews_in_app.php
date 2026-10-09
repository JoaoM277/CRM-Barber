<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Avaliações dentro da Vellis (em vez de mandar para o Google):
 * - schedules: o dono pode esconder uma avaliação e responder publicamente
 * - barbershops.avaliacao_google: enviar também o link do Google às notas
 *   altas (opção, desligada por padrão)
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('schedules', function (Blueprint $table) {
            $table->boolean('avaliacao_oculta')->default(false);
            $table->string('avaliacao_resposta', 500)->nullable();
            $table->timestamp('avaliacao_respondida_em')->nullable();
        });

        Schema::table('barbershops', function (Blueprint $table) {
            $table->boolean('avaliacao_google')->default(false)->after('google_review_url');
        });
    }

    public function down(): void
    {
        Schema::table('schedules', fn (Blueprint $t) => $t->dropColumn(['avaliacao_oculta', 'avaliacao_resposta', 'avaliacao_respondida_em']));
        Schema::table('barbershops', fn (Blueprint $t) => $t->dropColumn('avaliacao_google'));
    }
};
