<?php

namespace Database\Seeders;

use App\Models\Aviso;
use App\Support\TenantContext;
use Illuminate\Database\Seeder;

class AvisoSeeder extends Seeder
{
    /**
     * Um aviso (inativo) por barbearia.
     */
    public function run(): void
    {
        $bsId = app(TenantContext::class)->id();

        Aviso::withoutGlobalScope('tenant')->updateOrCreate(
            ['barbershop_id' => $bsId],
            [
                'titulo' => 'Bem-vindo!',
                'mensagem' => 'Agende seu horário com antecedência e garanta seu atendimento.',
                'ativo' => false,
            ],
        );
    }
}
