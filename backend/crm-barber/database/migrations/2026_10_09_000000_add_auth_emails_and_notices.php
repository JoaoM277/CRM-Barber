<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Fase 2 — e-mails transacionais:
 * - password_reset_tokens: "esqueci minha senha" (password broker padrão do Laravel)
 * - users.terms_accepted_at: aceite dos Termos de Uso / Política de Privacidade no cadastro
 * - subscriptions.*_notice_sent_at: avisos de fim de trial enviados (não repetir)
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('password_reset_tokens', function (Blueprint $table) {
            $table->string('email')->primary();
            $table->string('token');
            $table->timestamp('created_at')->nullable();
        });

        Schema::table('users', function (Blueprint $table) {
            $table->timestamp('terms_accepted_at')->nullable()->after('role');
        });

        Schema::table('subscriptions', function (Blueprint $table) {
            $table->timestamp('trial_ending_notice_sent_at')->nullable()->after('canceled_at');
            $table->timestamp('trial_ended_notice_sent_at')->nullable()->after('trial_ending_notice_sent_at');
        });
    }

    public function down(): void
    {
        Schema::table('subscriptions', function (Blueprint $table) {
            $table->dropColumn(['trial_ending_notice_sent_at', 'trial_ended_notice_sent_at']);
        });
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('terms_accepted_at');
        });
        Schema::dropIfExists('password_reset_tokens');
    }
};
