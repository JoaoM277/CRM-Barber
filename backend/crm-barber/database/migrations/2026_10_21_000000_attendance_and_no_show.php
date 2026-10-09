<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Confirmação só do cliente, falta automática e pendências do dono:
 * - status novo "falta" (diferente de "cancelado")
 * - cancelado_por: cliente | barbearia | sistema
 * - confirmacao_pedida_em: o cliente recebeu o pedido de confirmação (só quem
 *   recebeu e não confirmou pode cair em falta automática). Nasce vazio para
 *   todos os agendamentos antigos: a regra só vale daqui para frente.
 * - falta_em / falta_confirmada_em: falta automática (revertível por 3 dias) e
 *   "faltou mesmo" marcado pelo dono
 * - apoio_enviado_em: mensagem de apoio do dia seguinte
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('schedules', function (Blueprint $table) {
            $table->string('cancelado_por', 10)->nullable()->after('status');
            $table->timestamp('confirmacao_pedida_em')->nullable();
            $table->timestamp('falta_em')->nullable();
            $table->timestamp('falta_confirmada_em')->nullable();
            $table->timestamp('apoio_enviado_em')->nullable();
            $table->index(['barbershop_id', 'status', 'date']);
        });
    }

    public function down(): void
    {
        Schema::table('schedules', function (Blueprint $table) {
            $table->dropIndex(['barbershop_id', 'status', 'date']);
            $table->dropColumn(['cancelado_por', 'confirmacao_pedida_em', 'falta_em', 'falta_confirmada_em', 'apoio_enviado_em']);
        });
    }
};
