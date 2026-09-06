<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payouts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('worker_id')->constrained('workers')->cascadeOnDelete();
            $table->date('periodo_inicio');
            $table->date('periodo_fim');
            $table->unsignedInteger('atendimentos')->default(0);
            $table->decimal('total_bruto', 10, 2)->default(0);
            $table->decimal('total_comissao', 10, 2)->default(0);
            $table->decimal('total_fixo', 10, 2)->default(0);
            $table->decimal('valor_pago', 10, 2)->default(0);
            $table->string('status')->default('pago'); // pendente | pago
            $table->timestamp('pago_em')->nullable();
            $table->text('observacao')->nullable();
            $table->timestamps();

            $table->index(['worker_id', 'periodo_inicio', 'periodo_fim']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payouts');
    }
};
