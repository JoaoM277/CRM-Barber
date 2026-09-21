<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Segunda cor de marca, usada nos detalhes/gradientes da página pública
     * ao lado de accent_color. Default igual ao de accent_color para não
     * mudar a aparência de barbearias já cadastradas até o admin escolher outra.
     */
    public function up(): void
    {
        Schema::table('barbershops', function (Blueprint $table) {
            $table->string('secondary_color', 9)->default('#C89B3C')->after('accent_color');
        });
    }

    public function down(): void
    {
        Schema::table('barbershops', function (Blueprint $table) {
            $table->dropColumn('secondary_color');
        });
    }
};
