<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('workers', function (Blueprint $table) {
            // comissao | fixo | comissao_mais_fixo
            $table->string('payment_type')->default('comissao')->after('active');
            $table->decimal('commission_percent', 5, 2)->default(0)->after('payment_type');
            $table->decimal('fixed_salary', 10, 2)->default(0)->after('commission_percent');
            $table->string('pix_key')->nullable()->after('fixed_salary');
        });
    }

    public function down(): void
    {
        Schema::table('workers', function (Blueprint $table) {
            $table->dropColumn(['payment_type', 'commission_percent', 'fixed_salary', 'pix_key']);
        });
    }
};
