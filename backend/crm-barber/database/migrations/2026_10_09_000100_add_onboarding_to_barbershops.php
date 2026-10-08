<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Guia de primeiros passos: guarda só o que não dá para deduzir dos dados
 * (horários conferidos, link divulgado, guia dispensado). O resto — serviços,
 * profissionais, WhatsApp, primeiro agendamento — é calculado na hora.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('barbershops', function (Blueprint $table) {
            $table->json('onboarding')->nullable()->after('active');
        });
    }

    public function down(): void
    {
        Schema::table('barbershops', function (Blueprint $table) {
            $table->dropColumn('onboarding');
        });
    }
};
