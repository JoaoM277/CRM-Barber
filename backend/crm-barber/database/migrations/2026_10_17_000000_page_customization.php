<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Personalização da página de agendamento (planos Pro e Premium):
 * - barbershops.pagina: estilo, fonte, modo, textura, capa e textos (JSON)
 * - barbershop_photos: galeria de trabalhos
 * - services: foto, destaque, categoria e ordem
 * - workers: bio curta e Instagram
 * - plans: recurso "personalizacao" onde já há "financeiro" (Pro/Premium)
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('barbershops', function (Blueprint $table) {
            $table->json('pagina')->nullable();
        });

        Schema::create('barbershop_photos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('barbershop_id')->constrained()->cascadeOnDelete();
            $table->string('path');
            $table->string('legenda', 120)->nullable();
            $table->unsignedSmallInteger('ordem')->default(0);
            $table->timestamps();
            $table->index(['barbershop_id', 'ordem']);
        });

        Schema::table('services', function (Blueprint $table) {
            $table->string('photo')->nullable();
            $table->string('destaque', 12)->nullable();   // mais_pedido | novo
            $table->string('categoria', 40)->nullable();
            $table->unsignedSmallInteger('ordem')->default(0);
        });

        Schema::table('workers', function (Blueprint $table) {
            $table->string('bio', 160)->nullable();
            $table->string('instagram', 60)->nullable();
        });

        DB::table('plans')->get(['id', 'features'])->each(function ($p) {
            $f = json_decode($p->features ?? '[]', true) ?: [];
            if (in_array('financeiro', $f, true) && ! in_array('personalizacao', $f, true)) {
                $f[] = 'personalizacao';
                DB::table('plans')->where('id', $p->id)->update(['features' => json_encode($f)]);
            }
        });
    }

    public function down(): void
    {
        DB::table('plans')->get(['id', 'features'])->each(function ($p) {
            $f = array_values(array_diff(json_decode($p->features ?? '[]', true) ?: [], ['personalizacao']));
            DB::table('plans')->where('id', $p->id)->update(['features' => json_encode($f)]);
        });
        Schema::table('workers', fn (Blueprint $t) => $t->dropColumn(['bio', 'instagram']));
        Schema::table('services', fn (Blueprint $t) => $t->dropColumn(['photo', 'destaque', 'categoria', 'ordem']));
        Schema::dropIfExists('barbershop_photos');
        Schema::table('barbershops', fn (Blueprint $t) => $t->dropColumn('pagina'));
    }
};
