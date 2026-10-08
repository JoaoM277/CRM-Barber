<?php

namespace Tests\Feature;

use App\Models\Barbershop;
use App\Models\Service;
use App\Models\User;
use App\Models\Worker;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** O que a página pública de agendamento pode (e não pode) ver. */
class PaginaPublicaTest extends TestCase
{
    use RefreshDatabase;

    public function test_profissionais_publicos_sem_dados_pessoais_nem_pagamento(): void
    {
        $bs = Barbershop::factory()->create(['slug' => 'loja']);
        Worker::factory()->create(['barbershop_id' => $bs->id, 'name' => 'Ativo', 'active' => true, 'pix_key' => 'chave-secreta', 'fixed_salary' => 2500]);
        Worker::factory()->create(['barbershop_id' => $bs->id, 'name' => 'Pausado', 'active' => false]);

        $r = $this->getJson('/api/b/loja/profissionais')->assertOk()->assertJsonCount(1)->assertJsonPath('0.name', 'Ativo');
        foreach (['phone', 'pix_key', 'fixed_salary', 'commission_percent', 'payment_type'] as $campo) {
            $this->assertArrayNotHasKey($campo, $r->json('0'));
        }
        $this->assertStringNotContainsString('chave-secreta', $r->getContent());

        // o painel continua recebendo o cadastro completo
        Sanctum::actingAs(User::factory()->admin()->create(['barbershop_id' => $bs->id]));
        $painel = $this->getJson('/api/profissionais')->assertOk()->assertJsonCount(2)->json();
        $this->assertSame('chave-secreta', collect($painel)->firstWhere('name', 'Ativo')['pix_key']);
    }

    public function test_servicos_publicos_so_os_ativos(): void
    {
        $bs = Barbershop::factory()->create(['slug' => 'loja']);
        Service::factory()->create(['barbershop_id' => $bs->id, 'name' => 'Corte', 'active' => true]);
        Service::factory()->create(['barbershop_id' => $bs->id, 'name' => 'Antigo', 'active' => false]);

        $this->getJson('/api/b/loja/servicos')->assertOk()->assertJsonCount(1)->assertJsonPath('0.name', 'Corte');
    }
}
