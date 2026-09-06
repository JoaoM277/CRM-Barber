<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('instances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('barbershop_id')->nullable()->constrained('barbershops')->nullOnDelete();
            $table->string('name')->unique();
            $table->string('status')->default('desconectado'); // desconectado | conectando | conectado | erro
            $table->string('phone_number', 20)->nullable();
            $table->timestamp('last_connected_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('instances');
    }
};
