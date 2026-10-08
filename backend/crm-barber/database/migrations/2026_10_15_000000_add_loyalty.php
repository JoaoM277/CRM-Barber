<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Fidelidade (cartão de selos): cada atendimento concluído vale um selo;
 * ao juntar a meta (ex.: 10), o cliente ganha o prêmio (ex.: 1 corte grátis).
 * Conta a partir de quando a barbearia liga o programa (fidelidade_desde).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('barbershops', function (Blueprint $table) {
            $table->boolean('fidelidade_ativa')->default(false)->after('google_review_url');
            $table->unsignedTinyInteger('fidelidade_meta')->default(10)->after('fidelidade_ativa');
            $table->string('fidelidade_premio', 120)->nullable()->after('fidelidade_meta');
            $table->date('fidelidade_desde')->nullable()->after('fidelidade_premio');
        });

        Schema::create('loyalty_redemptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('barbershop_id')->constrained()->cascadeOnDelete();
            $table->foreignId('client_id')->constrained()->cascadeOnDelete();
            $table->foreignId('schedule_id')->nullable()->constrained()->nullOnDelete();
            $table->unsignedSmallInteger('selos');
            $table->string('premio', 120)->nullable();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamp('created_at')->nullable();
            $table->index(['barbershop_id', 'client_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('loyalty_redemptions');
        Schema::table('barbershops', function (Blueprint $table) {
            $table->dropColumn(['fidelidade_ativa', 'fidelidade_meta', 'fidelidade_premio', 'fidelidade_desde']);
        });
    }
};
