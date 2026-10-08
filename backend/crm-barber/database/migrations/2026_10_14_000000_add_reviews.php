<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Avaliação pós-atendimento: depois de concluído, o cliente recebe "de 1 a 5,
 * como foi?" no WhatsApp. Nota alta → link do Google; nota baixa → o cliente
 * pode contar o que houve (o comentário aparece para o dono).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('schedules', function (Blueprint $table) {
            $table->timestamp('avaliacao_pedida_em')->nullable();
            $table->unsignedTinyInteger('avaliacao_nota')->nullable();
            $table->timestamp('avaliacao_em')->nullable();
            $table->string('avaliacao_comentario', 1000)->nullable();
            $table->index(['barbershop_id', 'avaliacao_em']);
        });

        Schema::table('barbershops', function (Blueprint $table) {
            $table->boolean('avaliacao_whatsapp')->default(true)->after('reativacao_dias');
            $table->string('google_review_url', 500)->nullable()->after('avaliacao_whatsapp');
        });
    }

    public function down(): void
    {
        Schema::table('schedules', function (Blueprint $table) {
            $table->dropIndex(['barbershop_id', 'avaliacao_em']);
            $table->dropColumn(['avaliacao_pedida_em', 'avaliacao_nota', 'avaliacao_em', 'avaliacao_comentario']);
        });
        Schema::table('barbershops', function (Blueprint $table) {
            $table->dropColumn(['avaliacao_whatsapp', 'google_review_url']);
        });
    }
};
