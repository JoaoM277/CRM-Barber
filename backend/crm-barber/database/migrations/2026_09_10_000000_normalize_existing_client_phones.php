<?php

use App\Support\Phone;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Normaliza os telefones de clientes já existentes para o formato canônico
     * (dígitos + DDI 55), pra bater com o que o cadastro passa a gravar.
     * Em caso de colisão com a unique [barbershop_id, phone], mantém o telefone
     * como está (raro; um humano resolve depois).
     */
    public function up(): void
    {
        DB::table('clients')->orderBy('id')->lazyById()->each(function ($row) {
            $novo = Phone::normalizeBr((string) $row->phone);

            if ($novo === '' || $novo === $row->phone) {
                return;
            }

            $colide = DB::table('clients')
                ->where('barbershop_id', $row->barbershop_id)
                ->where('phone', $novo)
                ->where('id', '!=', $row->id)
                ->exists();

            if (! $colide) {
                DB::table('clients')->where('id', $row->id)->update(['phone' => $novo]);
            }
        });
    }

    public function down(): void
    {
        // sem rollback: não dá pra reverter a normalização com segurança
    }
};
