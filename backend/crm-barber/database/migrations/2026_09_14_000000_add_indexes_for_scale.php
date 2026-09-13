<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * `schedules` é filtrado por (worker_id, date) na trava de horário e na
     * agenda, e por (barbershop_id, status, date) no faturamento — tudo sem
     * índice até aqui (full scan). Também indexa status isolado (listas de
     * "concluído"/"pendente") e services.active/workers.active (filtro do
     * site público).
     */
    public function up(): void
    {
        Schema::table('schedules', function (Blueprint $table) {
            $table->index(['worker_id', 'date']);
            $table->index(['barbershop_id', 'date', 'status']);
            $table->index('status');
        });

        Schema::table('services', function (Blueprint $table) {
            $table->index(['barbershop_id', 'active']);
        });

        Schema::table('workers', function (Blueprint $table) {
            $table->index(['barbershop_id', 'active']);
        });
    }

    public function down(): void
    {
        Schema::table('workers', function (Blueprint $table) {
            $table->dropIndex(['barbershop_id', 'active']);
        });

        Schema::table('services', function (Blueprint $table) {
            $table->dropIndex(['barbershop_id', 'active']);
        });

        Schema::table('schedules', function (Blueprint $table) {
            $table->dropIndex(['worker_id', 'date']);
            $table->dropIndex(['barbershop_id', 'date', 'status']);
            $table->dropIndex(['status']);
        });
    }
};
