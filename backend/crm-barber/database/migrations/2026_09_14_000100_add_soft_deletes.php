<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Excluir serviço/profissional/cliente virava hard delete e órfã o
     * histórico (agendamentos/faturamento apontando pra uma linha que não
     * existe mais). Agora é soft delete — o registro some das listas mas o
     * histórico continua íntegro.
     */
    public function up(): void
    {
        Schema::table('services', fn (Blueprint $t) => $t->softDeletes());
        Schema::table('workers', fn (Blueprint $t) => $t->softDeletes());
        Schema::table('clients', fn (Blueprint $t) => $t->softDeletes());
    }

    public function down(): void
    {
        Schema::table('clients', fn (Blueprint $t) => $t->dropSoftDeletes());
        Schema::table('workers', fn (Blueprint $t) => $t->dropSoftDeletes());
        Schema::table('services', fn (Blueprint $t) => $t->dropSoftDeletes());
    }
};
