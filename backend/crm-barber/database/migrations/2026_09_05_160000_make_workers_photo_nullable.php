<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * photo e speciality são dados opcionais do perfil do profissional.
     */
    public function up(): void
    {
        Schema::table('workers', function (Blueprint $table) {
            $table->text('photo')->nullable()->change();
            $table->string('speciality')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('workers', function (Blueprint $table) {
            $table->text('photo')->nullable(false)->change();
            $table->string('speciality')->nullable(false)->change();
        });
    }
};
