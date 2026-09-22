<?php

namespace App\Console\Commands;

use App\Support\TenantProvisioner;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Validator;

/**
 * Onboarding interno: só o dono da plataforma roda isso via SSH quando um
 * cliente novo fecha negócio. Não existe (de propósito) autocadastro público.
 */
class CreateTenant extends Command
{
    protected $signature = 'tenant:criar
        {--nome= : Nome do responsável/admin da barbearia}
        {--email= : E-mail de login do admin}
        {--senha= : Senha inicial (mín. 6 caracteres; o admin pode trocar depois)}
        {--barbearia= : Nome da barbearia}
        {--telefone= : Telefone da barbearia (opcional)}
        {--whatsapp= : WhatsApp da barbearia (opcional)}';

    protected $description = 'Cria uma barbearia nova + usuário admin vinculado (onboarding interno de cliente).';

    public function handle(TenantProvisioner $provisioner): int
    {
        $dados = [
            'name' => $this->option('nome') ?: $this->ask('Nome do responsável (dono/admin)'),
            'email' => $this->option('email') ?: $this->ask('E-mail de login'),
            'password' => $this->option('senha') ?: $this->secret('Senha inicial (mín. 6 caracteres)'),
            'barbershop_name' => $this->option('barbearia') ?: $this->ask('Nome da barbearia'),
            'barbershop_phone' => $this->option('telefone'),
            'barbershop_whatsapp' => $this->option('whatsapp'),
        ];

        $validator = Validator::make($dados, [
            'name' => 'required|string|max:255',
            'email' => 'required|email|max:255|unique:users,email',
            'password' => 'required|string|min:6',
            'barbershop_name' => 'required|string|max:255',
            'barbershop_phone' => 'nullable|string|max:20',
            'barbershop_whatsapp' => 'nullable|string|max:20',
        ]);

        if ($validator->fails()) {
            $this->error('Não deu pra criar:');
            foreach ($validator->errors()->all() as $erro) {
                $this->line("  - {$erro}");
            }

            return self::FAILURE;
        }

        $validado = $validator->validated();

        if (! $this->confirm("Confirma criar a barbearia \"{$validado['barbershop_name']}\" com admin {$validado['email']}?", true)) {
            $this->info('Cancelado.');

            return self::SUCCESS;
        }

        [$user, $barbershop] = $provisioner->create($validado);

        $frontendUrl = rtrim((string) config('app.frontend_url'), '/');
        $link = $frontendUrl ? "{$frontendUrl}/index.html?b={$barbershop->slug}" : "?b={$barbershop->slug}";

        $this->newLine();
        $this->info('Barbearia criada com sucesso!');
        $this->line("  Barbearia: {$barbershop->name} (slug: {$barbershop->slug})");
        $this->line("  Admin: {$user->name} <{$user->email}>");
        $this->line("  Link de agendamento: {$link}");
        if ($frontendUrl) {
            $this->line("  Painel: {$frontendUrl}/login.html");
        }

        return self::SUCCESS;
    }
}
