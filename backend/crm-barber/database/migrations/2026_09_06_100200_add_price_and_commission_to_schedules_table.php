<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Snapshot do valor do serviço e da comissão no momento do agendamento,
     * para a folha de pagamento não mudar se o preço do serviço mudar depois.
     */
    public function up(): void
    {
        Schema::table('schedules', function (Blueprint $table) {
            $table->decimal('price', 10, 2)->nullable()->after('service_id');
            $table->decimal('commission_value', 10, 2)->nullable()->after('price');
        });
    }

    public function down(): void
    {
        Schema::table('schedules', function (Blueprint $table) {
            $table->dropColumn(['price', 'commission_value']);
        });
    }
};
