<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Barbeiro solo x equipe:
 * - barbershops.modelo_equipe: "solo" (o dono atende sozinho e fica com o
 *   resultado) ou "equipe" (o sistema de comissões de sempre)
 * - workers.phone passa a ser opcional (o dono solo nem sempre informa)
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('barbershops', function (Blueprint $table) {
            $table->string('modelo_equipe', 10)->default('equipe')->after('name');
        });

        Schema::table('workers', function (Blueprint $table) {
            $table->string('phone', 20)->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('barbershops', fn (Blueprint $t) => $t->dropColumn('modelo_equipe'));
    }
};
