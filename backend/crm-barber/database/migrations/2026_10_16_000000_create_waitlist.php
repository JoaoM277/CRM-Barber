<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Lista de espera: o cliente pede para ser avisado se abrir vaga num dia
 * lotado. Quando alguém cancela um horário daquele dia, os primeiros da
 * lista recebem o link no WhatsApp; quem marcar primeiro fica com a vaga.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('waitlist_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('barbershop_id')->constrained()->cascadeOnDelete();
            $table->foreignId('client_id')->constrained()->cascadeOnDelete();
            $table->date('date');
            $table->foreignId('worker_id')->nullable()->constrained()->nullOnDelete(); // preferência (null = qualquer um)
            $table->json('service_ids')->nullable();
            $table->string('status', 12)->default('aguardando'); // aguardando | avisado | agendou | removido
            $table->timestamp('avisado_em')->nullable();
            $table->timestamps();
            $table->index(['barbershop_id', 'date', 'status']);
        });

        Schema::table('barbershops', function (Blueprint $table) {
            $table->boolean('lista_espera_ativa')->default(true)->after('fidelidade_desde');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('waitlist_entries');
        Schema::table('barbershops', function (Blueprint $table) {
            $table->dropColumn('lista_espera_ativa');
        });
    }
};
