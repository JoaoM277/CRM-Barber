<?php

namespace Tests\Feature;

use App\Models\Client;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ClientTest extends TestCase
{
    use RefreshDatabase;

    public function test_clients_index_returns_empty_list_when_no_clients(): void
    {
        $response = $this->getJson('/clients');

        $response->assertOk()
            ->assertExactJson([]);
    }

    public function test_clients_index_returns_all_clients(): void
    {
        $clients = Client::factory()->count(3)->create();

        $response = $this->getJson('/clients');

        $response->assertOk()
            ->assertJsonCount(3)
            ->assertJsonFragment([
                'id' => $clients[0]->id,
                'name' => $clients[0]->name,
                'email' => $clients[0]->email,
            ]);
    }

    public function test_client_model_persists_fillable_attributes(): void
    {
        $client = Client::create([
            'name' => 'João Silva',
            'phone' => '11999998888',
            'email' => 'joao@example.com',
            'birth_date' => '1990-05-15',
            'observation' => 'Cliente VIP',
        ]);

        $this->assertDatabaseHas('clients', [
            'id' => $client->id,
            'name' => 'João Silva',
            'phone' => '11999998888',
            'email' => 'joao@example.com',
            'birth_date' => '1990-05-15',
            'observation' => 'Cliente VIP',
        ]);
    }
}
