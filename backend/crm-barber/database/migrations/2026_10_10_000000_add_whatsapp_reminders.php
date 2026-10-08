<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Lembretes automáticos no WhatsApp (24h e 2h antes) e resposta do cliente
 * ("1" confirma, "2" cancela).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('schedules', function (Blueprint $table) {
            $table->timestamp('lembrete_24h_em')->nullable()->after('observation');
            $table->timestamp('lembrete_2h_em')->nullable()->after('lembrete_24h_em');
            $table->timestamp('resposta_cliente_em')->nullable()->after('lembrete_2h_em');
        });

        Schema::table('barbershops', function (Blueprint $table) {
            $table->boolean('lembretes_whatsapp')->default(true)->after('active');
        });
    }

    public function down(): void
    {
        Schema::table('schedules', function (Blueprint $table) {
            $table->dropColumn(['lembrete_24h_em', 'lembrete_2h_em', 'resposta_cliente_em']);
        });
        Schema::table('barbershops', function (Blueprint $table) {
            $table->dropColumn('lembretes_whatsapp');
        });
    }
};
