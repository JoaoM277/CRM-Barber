<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('barbershops', function (Blueprint $table) {
            $table->id();
             // Dados principais
            $table->string('name');
            $table->string('slug')->unique();

            // Contato
            $table->string('phone', 20)->nullable();
            $table->string('email')->unique()->nullable();
            $table->string('whatsapp', 20)->nullable();
            $table->string('instagram')->nullable();
            $table->string('website')->nullable();

            // Endereço
            $table->string('zip_code', 10)->nullable();
            $table->string('street')->nullable();
            $table->string('number', 20)->nullable();
            $table->string('complement')->nullable();
            $table->string('neighborhood')->nullable();
            $table->string('city')->nullable();
            $table->string('state', 2)->nullable();

            // Branding
            $table->string('logo_path')->nullable();

            // Horário de funcionamento
            $table->time('opening_time')->nullable();
            $table->time('closing_time')->nullable();

            $table->string('timezone')->default('America/Sao_Paulo');

            $table->string('subscription_plan')->default('free');
            // free, basic, premium

            $table->date('subscription_ends_at')->nullable();

            // Status
            $table->boolean('active')->default(true);
            $table->timestamps();
            // $table->softDeletes();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('barbershops');
    }
};
