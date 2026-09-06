<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * services.duration_time passa de TIME para inteiro em MINUTOS,
     * que é o que o front-end envia e consome.
     */
    public function up(): void
    {
        // Valores legados estavam em coluna TIME e não convertem direto para minutos;
        // como é base de teste (re-seed cobre), zera antes de trocar o tipo.
        DB::table('services')->update(['duration_time' => null]);

        Schema::table('services', function (Blueprint $table) {
            $table->unsignedSmallInteger('duration_time')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('services', function (Blueprint $table) {
            $table->time('duration_time')->nullable()->change();
        });
    }
};
