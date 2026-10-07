<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Str;

/**
 * Cria (ou redefine a senha de) um administrador da plataforma — o acesso ao
 * painel universal. A senha é gerada e mostrada uma única vez.
 *
 *   php artisan plataforma:admin voce@empresa.com --name="Seu Nome"
 */
class CreatePlatformAdmin extends Command
{
    protected $signature = 'plataforma:admin {email} {--name=Administrador}';

    protected $description = 'Cria um administrador da plataforma (painel universal) ou redefine a senha dele';

    public function handle(): int
    {
        $email = strtolower(trim($this->argument('email')));

        if (! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $this->error('E-mail inválido.');

            return self::FAILURE;
        }

        $existing = User::where('email', $email)->first();

        if ($existing && ! $existing->isSuperAdmin()) {
            $this->error('Esse e-mail já pertence a um usuário de barbearia. Use outro e-mail para a plataforma.');

            return self::FAILURE;
        }

        $password = Str::password(20, symbols: false);

        $user = User::updateOrCreate(['email' => $email], [
            'name' => $existing?->name ?? $this->option('name'),
            'password' => $password,
            'role' => User::ROLE_SUPER_ADMIN,
            'barbershop_id' => null,
        ]);

        // senha nova derruba as sessões antigas
        $user->tokens()->delete();

        $this->info(($existing ? 'Senha redefinida' : 'Administrador criado').": {$email}");
        $this->line("Senha: {$password}");
        $this->warn('Guarde a senha agora — ela não é exibida de novo.');

        return self::SUCCESS;
    }
}
