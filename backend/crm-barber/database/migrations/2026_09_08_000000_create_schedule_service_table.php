<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Pivô de agendamento <-> serviços. Um agendamento pode ter N serviços.
     * `schedules.service_id` continua existindo como serviço "primário"
     * (compatibilidade com telas/relatórios antigos); esta tabela guarda a
     * lista completa + o snapshot de preço/comissão de cada serviço.
     */
    public function up(): void
    {
        Schema::create('schedule_service', function (Blueprint $table) {
            $table->id();
            $table->foreignId('schedule_id')->constrained('schedules')->cascadeOnDelete();
            $table->foreignId('service_id')->constrained('services');
            $table->decimal('price', 10, 2)->default(0);
            $table->decimal('commission_value', 10, 2)->default(0);
            $table->timestamps();

            $table->unique(['schedule_id', 'service_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('schedule_service');
    }
};
