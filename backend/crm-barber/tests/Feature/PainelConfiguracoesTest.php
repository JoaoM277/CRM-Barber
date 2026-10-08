<?php

namespace Tests\Feature;

use App\Models\Barbershop;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PainelConfiguracoesTest extends TestCase
{
    use RefreshDatabase;

    public function test_dono_nao_mexe_em_plano_validade_nem_ativacao_da_conta(): void
    {
        $bs = Barbershop::factory()->create(['slug' => 'minha-loja', 'subscription_plan' => 'free', 'active' => true]);
        Sanctum::actingAs(User::factory()->admin()->create(['barbershop_id' => $bs->id]));

        $this->putJson("/api/barbearias/{$bs->id}", [
            'name' => 'Minha Loja', 'slug' => 'minha-loja', 'city' => 'Recife',
            'subscription_plan' => 'premium', 'subscription_ends_at' => '2099-01-01', 'active' => false,
        ])->assertOk();

        $bs->refresh();
        $this->assertSame('Recife', $bs->city);
        $this->assertSame('free', $bs->subscription_plan);
        $this->assertNull($bs->subscription_ends_at);
        $this->assertTrue($bs->active);
    }

    public function test_link_de_agendamento_so_aceita_formato_de_url(): void
    {
        $bs = Barbershop::factory()->create(['slug' => 'minha-loja']);
        Sanctum::actingAs(User::factory()->admin()->create(['barbershop_id' => $bs->id]));

        $this->putJson("/api/barbearias/{$bs->id}", ['name' => 'X', 'slug' => 'Minha Loja!'])
            ->assertStatus(422)->assertJsonValidationErrors('slug');
        $this->putJson("/api/barbearias/{$bs->id}", ['name' => 'X', 'slug' => 'barbearia-do-ze'])->assertOk();
    }
}
