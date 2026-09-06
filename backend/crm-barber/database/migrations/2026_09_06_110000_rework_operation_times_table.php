<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * operation_times passa a ser 1 linha por dia da semana:
     * day_of_week 0 (domingo) .. 6 (sábado), com flag active e almoço opcional.
     */
    public function up(): void
    {
        // day_of_week era coluna 'date' com dados de teste — limpa antes de trocar o tipo
        DB::table('operation_times')->delete();

        Schema::table('operation_times', function (Blueprint $table) {
            $table->unsignedTinyInteger('day_of_week')->change();
            $table->boolean('active')->default(true)->after('day_of_week');
            $table->time('waiting_start')->nullable()->change();
            $table->time('waiting_end')->nullable()->change();
            $table->unique('day_of_week');
        });
    }

    public function down(): void
    {
        Schema::table('operation_times', function (Blueprint $table) {
            $table->dropUnique(['day_of_week']);
            $table->dropColumn('active');
            $table->date('day_of_week')->change();
            $table->time('waiting_start')->nullable(false)->change();
            $table->time('waiting_end')->nullable(false)->change();
        });
    }
};
