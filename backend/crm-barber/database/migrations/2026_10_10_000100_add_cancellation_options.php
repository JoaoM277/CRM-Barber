<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Opções extras dos lembretes (valem com os lembretes ligados):
 * - aviso_cancelamento_whatsapp: avisa o cliente quando a barbearia cancela o horário
 * - cancelar_pelo_lembrete: o lembrete oferece "responda 2 para cancelar"
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('barbershops', function (Blueprint $table) {
            $table->boolean('aviso_cancelamento_whatsapp')->default(true)->after('lembretes_whatsapp');
            $table->boolean('cancelar_pelo_lembrete')->default(true)->after('aviso_cancelamento_whatsapp');
        });
    }

    public function down(): void
    {
        Schema::table('barbershops', function (Blueprint $table) {
            $table->dropColumn(['aviso_cancelamento_whatsapp', 'cancelar_pelo_lembrete']);
        });
    }
};
