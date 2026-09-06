<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Identidade visual exibida na página pública de agendamento.
     */
    public function up(): void
    {
        Schema::table('barbershops', function (Blueprint $table) {
            $table->string('subtitle')->nullable()->after('name');
            $table->string('accent_color', 9)->default('#C89B3C')->after('logo_path');
        });
    }

    public function down(): void
    {
        Schema::table('barbershops', function (Blueprint $table) {
            $table->dropColumn(['subtitle', 'accent_color']);
        });
    }
};
