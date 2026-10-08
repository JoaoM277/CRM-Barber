<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Reativação de clientes sumidos: X dias sem visita → um WhatsApp com o link
 * de agendamento. Desligada por padrão (mensagem de iniciativa da barbearia).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('barbershops', function (Blueprint $table) {
            $table->boolean('reativacao_whatsapp')->default(false)->after('antecedencia_alteracao_horas');
            $table->unsignedSmallInteger('reativacao_dias')->default(45)->after('reativacao_whatsapp');
        });

        Schema::table('clients', function (Blueprint $table) {
            // última mensagem de reativação (uma por "sumiço")
            $table->timestamp('reativacao_enviada_em')->nullable();
            // o cliente respondeu SAIR: não recebe mais
            $table->timestamp('reativacao_bloqueada_em')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('barbershops', function (Blueprint $table) {
            $table->dropColumn(['reativacao_whatsapp', 'reativacao_dias']);
        });
        Schema::table('clients', function (Blueprint $table) {
            $table->dropColumn(['reativacao_enviada_em', 'reativacao_bloqueada_em']);
        });
    }
};
