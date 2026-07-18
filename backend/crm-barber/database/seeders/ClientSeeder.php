<?php

namespace Database\Seeders;

use App\Models\Client;
use Illuminate\Database\Seeder;

class ClientSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $clients = [
            [
                'name' => 'João Silva',
                'phone' => '71991111111',
                'email' => 'joao.silva@example.com',
                'birth_date' => '1995-03-15',
                'observation' => 'Cliente desde 2023.'
            ],
            [
                'name' => 'Maria Oliveira',
                'phone' => '71992222222',
                'email' => 'maria.oliveira@example.com',
                'birth_date' => '1998-07-22',
                'observation' => 'Prefere atendimento pela manhã.'
            ],
            [
                'name' => 'Pedro Santos',
                'phone' => '71993333333',
                'email' => 'pedro.santos@example.com',
                'birth_date' => '1992-11-05',
                'observation' => 'Sempre agenda barba e cabelo.'
            ],
            [
                'name' => 'Lucas Ferreira',
                'phone' => '71994444444',
                'email' => 'lucas.ferreira@example.com',
                'birth_date' => '1999-01-30',
                'observation' => 'Cliente VIP.'
            ],
            [
                'name' => 'Ana Souza',
                'phone' => '71995555555',
                'email' => 'ana.souza@example.com',
                'birth_date' => '2001-06-10',
                'observation' => 'Prefere contato por WhatsApp.'
            ],
            [
                'name' => 'Carlos Lima',
                'phone' => '71996666666',
                'email' => 'carlos.lima@example.com',
                'birth_date' => '1988-09-18',
                'observation' => 'Corte social.'
            ],
            [
                'name' => 'Fernanda Costa',
                'phone' => '71997777777',
                'email' => 'fernanda.costa@example.com',
                'birth_date' => '1997-02-25',
                'observation' => 'Indicação de outro cliente.'
            ],
            [
                'name' => 'Rafael Almeida',
                'phone' => '71998888888',
                'email' => 'rafael.almeida@example.com',
                'birth_date' => '1994-12-01',
                'observation' => 'Sempre chega no horário.'
            ],
            [
                'name' => 'Juliana Rocha',
                'phone' => '71999999999',
                'email' => 'juliana.rocha@example.com',
                'birth_date' => '2000-05-14',
                'observation' => 'Prefere corte degradê.'
            ],
            [
                'name' => 'Gabriel Martins',
                'phone' => '71888888888',
                'email' => 'gabriel.martins@example.com',
                'birth_date' => '1996-08-27',
                'observation' => 'Cliente frequente.'
            ],
        ];

        foreach ($clients as $client) {
            Client::create($client);
        }
    }
}