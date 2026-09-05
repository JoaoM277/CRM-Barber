<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * schedules.status deixa de ser boolean e passa a guardar o estado
     * do agendamento: pendente | confirmado | cancelado.
     */
    public function up(): void
    {
        Schema::table('schedules', function (Blueprint $table) {
            $table->string('status', 20)->default('pendente')->change();
        });

        // boolean vira string "1"/"0" ao trocar o tipo — normaliza os valores existentes
        DB::table('schedules')->where('status', '1')->update(['status' => 'pendente']);
        DB::table('schedules')->where('status', '0')->update(['status' => 'cancelado']);
    }

    public function down(): void
    {
        DB::table('schedules')->whereIn('status', ['pendente', 'confirmado'])->update(['status' => '1']);
        DB::table('schedules')->where('status', 'cancelado')->update(['status' => '0']);

        Schema::table('schedules', function (Blueprint $table) {
            $table->boolean('status')->default(true)->change();
        });
    }
};
