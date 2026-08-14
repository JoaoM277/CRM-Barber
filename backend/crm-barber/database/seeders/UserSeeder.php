<?php

namespace Database\Seeders;

use App\Models\Barbershop;
use App\Models\User;
use Illuminate\Database\Seeder;

class UserSeeder extends Seeder
{
    /**
     * Usuários de teste para login.
     * Senha padrão de todos: 123456
     */
    public function run(): void
    {
        $alphaBarber = Barbershop::where('slug', 'alpha-barber')->first();
        $kingBarber = Barbershop::where('slug', 'king-barber')->first();

        $users = [
            [
                'barbershop_id' => $alphaBarber?->id,
                'name' => 'Carlos Admin',
                'email' => 'admin@alphabarber.test',
                'password' => '123456',
                'role' => User::ROLE_ADMIN,
            ],
            [
                'barbershop_id' => $kingBarber?->id,
                'name' => 'Ricardo Admin',
                'email' => 'admin@kingbarber.test',
                'password' => '123456',
                'role' => User::ROLE_ADMIN,
            ],
            [
                'barbershop_id' => null,
                'name' => 'Ana Cliente',
                'email' => 'cliente@test.com',
                'password' => '123456',
                'role' => User::ROLE_USER,
            ],
            [
                'barbershop_id' => null,
                'name' => 'João Cliente',
                'email' => 'joao.cliente@test.com',
                'password' => '123456',
                'role' => User::ROLE_USER,
            ],
        ];

        foreach ($users as $user) {
            User::updateOrCreate(
                ['email' => $user['email']],
                $user
            );
        }
    }
}
