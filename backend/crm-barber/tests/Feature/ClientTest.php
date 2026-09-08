<?php

namespace Tests\Feature;

use App\Models\Barbershop;
use App\Models\Client;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ClientTest extends TestCase
{
    use RefreshDatabase;

    private function actingAsAdminOf(Barbershop $bs): User
    {
        $admin = User::factory()->admin()->create(['barbershop_id' => $bs->id]);
        Sanctum::actingAs($admin);

        return $admin;
    }

    public function test_clientes_index_exige_autenticacao(): void
    {
        $this->getJson('/api/clientes')->assertUnauthorized();
    }

    public function test_clientes_index_devolve_apenas_clientes_da_barbearia(): void
    {
        $bs = Barbershop::factory()->create();
        $outra = Barbershop::factory()->create();

        Client::factory()->count(3)->create(['barbershop_id' => $bs->id]);
        Client::factory()->count(2)->create(['barbershop_id' => $outra->id]);

        $this->actingAsAdminOf($bs);

        $this->getJson('/api/clientes')
            ->assertOk()
            ->assertJsonCount(3);
    }

    public function test_client_persiste_atributos(): void
    {
        $bs = Barbershop::factory()->create();

        $client = Client::create([
            'barbershop_id' => $bs->id,
            'name' => 'João Silva',
            'phone' => '11999998888',
            'email' => 'joao@example.com',
            'birth_date' => '1990-05-15',
            'observation' => 'Cliente VIP',
        ]);

        $this->assertDatabaseHas('clients', [
            'id' => $client->id,
            'barbershop_id' => $bs->id,
            'name' => 'João Silva',
            'phone' => '11999998888',
        ]);
    }
}
