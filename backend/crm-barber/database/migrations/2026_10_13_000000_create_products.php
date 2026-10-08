<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Produtos vendidos no atendimento (pomada, shampoo, bebida...):
 * - products: cadastro, estoque e % de comissão do profissional
 * - schedule_product: o que saiu em cada atendimento (preço e comissão congelados)
 * - stock_movements: histórico do estoque (venda, estorno, entrada, ajuste)
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->foreignId('barbershop_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('description', 500)->nullable();
            $table->decimal('price', 10, 2);
            $table->decimal('cost', 10, 2)->nullable();
            $table->integer('stock')->default(0);
            $table->unsignedInteger('stock_min')->nullable();
            $table->decimal('commission_percent', 5, 2)->default(0);
            $table->boolean('active')->default(true);
            $table->timestamps();
            $table->softDeletes();
            $table->index(['barbershop_id', 'active']);
        });

        Schema::create('schedule_product', function (Blueprint $table) {
            $table->id();
            $table->foreignId('schedule_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete(); // o app só apaga produto com soft delete
            $table->unsignedSmallInteger('quantity');
            $table->decimal('price', 10, 2);            // preço unitário na hora da venda
            $table->decimal('commission_value', 10, 2); // comissão total da linha
            $table->timestamps();
            $table->unique(['schedule_id', 'product_id']);
        });

        Schema::create('stock_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('barbershop_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete(); // o app só apaga produto com soft delete
            $table->integer('quantity');                 // + entra, - sai
            $table->string('reason', 20);                // venda | estorno | entrada | ajuste
            $table->foreignId('schedule_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('note', 255)->nullable();
            $table->timestamp('created_at')->nullable();
            $table->index(['product_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_movements');
        Schema::dropIfExists('schedule_product');
        Schema::dropIfExists('products');
    }
};
