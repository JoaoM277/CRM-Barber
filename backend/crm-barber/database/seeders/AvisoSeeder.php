<?php

namespace Database\Seeders;

use App\Models\Aviso;
use Illuminate\Database\Seeder;

class AvisoSeeder extends Seeder
{
    public function run(): void
    {
        Aviso::updateOrCreate(
            ['id' => 1],
            [
                'titulo' => 'Bem-vindo!',
                'mensagem' => 'Agende seu horário com antecedência e garanta seu atendimento.',
                'ativo' => false,
            ],
        );
    }
}
