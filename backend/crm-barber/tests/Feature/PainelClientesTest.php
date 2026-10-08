<?php

namespace Tests\Feature;

use App\Models\Barbershop;
use App\Models\Client;
use App\Models\Schedule;
use App\Models\Service;
use App\Models\User;
use App\Models\Worker;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PainelClientesTest extends TestCase
{
    use RefreshDatabase;

    public function test_lista_traz_historico_e_busca_por_nome_ou_telefone(): void
    {
        $bs = Barbershop::factory()->create();
        Sanctum::actingAs(User::factory()->admin()->create(['barbershop_id' => $bs->id]));
        $worker = Worker::factory()->create(['barbershop_id' => $bs->id]);
        $service = Service::factory()->create(['barbershop_id' => $bs->id]);
        $ana = Client::factory()->create(['barbershop_id' => $bs->id, 'name' => 'Ana Souza', 'phone' => '5511999990001']);
        Client::factory()->create(['barbershop_id' => $bs->id, 'name' => 'Bruno Lima', 'phone' => '5511999990002']);

        $base = ['barbershop_id' => $bs->id, 'client_id' => $ana->id, 'worker_id' => $worker->id, 'service_id' => $service->id, 'start_time' => '10:00:00', 'end_time' => '10:30:00'];
        Schedule::factory()->create($base + ['date' => '2026-08-01', 'status' => Schedule::STATUS_CONCLUIDO, 'price' => 40]);
        Schedule::factory()->create($base + ['date' => '2026-09-01', 'status' => Schedule::STATUS_CONCLUIDO, 'price' => 60]);
        Schedule::factory()->create($base + ['date' => '2026-09-15', 'status' => Schedule::STATUS_CANCELADO, 'price' => 99]);

        $lista = $this->getJson('/api/clientes')->assertOk()->json();
        $linhaAna = collect($lista)->firstWhere('id', $ana->id);
        $this->assertSame(2, $linhaAna['visitas']);
        $this->assertSame('2026-09-01', substr($linhaAna['ultima_visita'], 0, 10));
        $this->assertEquals(100, $linhaAna['total_gasto']);

        $this->getJson('/api/clientes?busca=souza')->assertOk()->assertJsonCount(1)->assertJsonPath('0.name', 'Ana Souza');
        $this->getJson('/api/clientes?busca=90002')->assertOk()->assertJsonCount(1)->assertJsonPath('0.name', 'Bruno Lima');

        $this->getJson("/api/clientes/{$ana->id}")->assertOk()->assertJsonCount(3, 'historico')->assertJsonPath('historico.0.date', '2026-09-15');
    }
}
