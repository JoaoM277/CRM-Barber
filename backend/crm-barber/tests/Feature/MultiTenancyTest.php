<?php

namespace Tests\Feature;

use App\Models\Barbershop;
use App\Models\Client;
use App\Models\OperationTime;
use App\Models\Schedule;
use App\Models\Service;
use App\Models\User;
use App\Models\Worker;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class MultiTenancyTest extends TestCase
{
    use RefreshDatabase;

    private Barbershop $lojaA;

    private Barbershop $lojaB;

    protected function setUp(): void
    {
        parent::setUp();

        $this->lojaA = Barbershop::factory()->create(['slug' => 'loja-a']);
        $this->lojaB = Barbershop::factory()->create(['slug' => 'loja-b']);

        Service::factory()->create(['barbershop_id' => $this->lojaA->id, 'name' => 'Corte A', 'active' => true]);
        Service::factory()->create(['barbershop_id' => $this->lojaB->id, 'name' => 'Corte B', 'active' => true]);

        Worker::factory()->create(['barbershop_id' => $this->lojaA->id, 'name' => 'Barbeiro A', 'active' => true]);
        Worker::factory()->create(['barbershop_id' => $this->lojaB->id, 'name' => 'Barbeiro B', 'active' => true]);
    }

    public function test_rota_publica_so_devolve_servicos_da_barbearia_do_slug(): void
    {
        $this->getJson('/api/b/loja-a/servicos')
            ->assertOk()
            ->assertJsonFragment(['name' => 'Corte A'])
            ->assertJsonMissing(['name' => 'Corte B']);

        $this->getJson('/api/b/loja-b/servicos')
            ->assertOk()
            ->assertJsonFragment(['name' => 'Corte B'])
            ->assertJsonMissing(['name' => 'Corte A']);
    }

    public function test_slug_desconhecido_da_404(): void
    {
        $this->getJson('/api/b/nao-existe/servicos')->assertNotFound();
    }

    public function test_barbearia_inativa_da_404(): void
    {
        $this->lojaA->update(['active' => false]);

        $this->getJson('/api/b/loja-a/servicos')->assertNotFound();
    }

    public function test_admin_so_enxerga_dados_da_propria_barbearia(): void
    {
        $adminA = User::factory()->admin()->create(['barbershop_id' => $this->lojaA->id]);
        Sanctum::actingAs($adminA);

        $this->getJson('/api/servicos')
            ->assertOk()
            ->assertJsonFragment(['name' => 'Corte A'])
            ->assertJsonMissing(['name' => 'Corte B']);
    }

    public function test_admin_nao_acessa_recurso_de_outra_barbearia_por_id(): void
    {
        $adminA = User::factory()->admin()->create(['barbershop_id' => $this->lojaA->id]);
        $servicoB = Service::where('barbershop_id', $this->lojaB->id)->first();

        Sanctum::actingAs($adminA);

        $this->getJson("/api/servicos/{$servicoB->id}")->assertNotFound();
    }

    public function test_agendamento_publico_nasce_na_barbearia_do_slug(): void
    {
        $bs = $this->lojaA;
        $service = Service::where('barbershop_id', $bs->id)->first();
        $worker = Worker::where('barbershop_id', $bs->id)->first();

        // grade de horário pra loja A (segunda a sábado 08-20)
        foreach (range(0, 6) as $dow) {
            OperationTime::factory()->create([
                'barbershop_id' => $bs->id,
                'day_of_week' => $dow,
                'active' => $dow !== 0,
                'start_time' => '08:00:00',
                'end_time' => '20:00:00',
                'waiting_start' => null,
                'waiting_end' => null,
            ]);
        }

        $data = now()->next(3)->toDateString(); // próxima quarta

        $resp = $this->postJson('/api/b/loja-a/agendamentos', [
            'clienteNome' => 'Fulano de Tal',
            'clienteTelefone' => '11988887777',
            'barbeiroId' => $worker->id,
            'servicosIds' => [$service->id],
            'dataAgendamento' => $data,
            'horario' => '10:00',
        ]);

        $resp->assertCreated();

        $schedule = Schedule::withoutGlobalScope('tenant')->latest('id')->first();
        $this->assertSame($bs->id, $schedule->barbershop_id);

        // o telefone é gravado normalizado (DDI 55)
        $client = Client::withoutGlobalScope('tenant')->where('phone', '5511988887777')->first();
        $this->assertNotNull($client);
        $this->assertSame($bs->id, $client->barbershop_id);
    }

    public function test_mesmo_telefone_de_cliente_pode_existir_em_barbearias_diferentes(): void
    {
        Client::factory()->create(['barbershop_id' => $this->lojaA->id, 'phone' => '11955554444']);
        Client::factory()->create(['barbershop_id' => $this->lojaB->id, 'phone' => '11955554444']);

        $this->assertDatabaseCount('clients', 2);
    }

    public function test_barbearias_index_so_devolve_a_do_usuario(): void
    {
        Sanctum::actingAs(User::factory()->admin()->create(['barbershop_id' => $this->lojaA->id]));

        $this->getJson('/api/barbearias')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonFragment(['slug' => 'loja-a'])
            ->assertJsonMissing(['slug' => 'loja-b']);
    }

    public function test_admin_nao_ve_agendamento_de_outra_barbearia_na_listagem(): void
    {
        $agA = Schedule::factory()->create([
            'barbershop_id' => $this->lojaA->id,
            'client_id' => Client::factory()->create(['barbershop_id' => $this->lojaA->id])->id,
            'worker_id' => Worker::where('barbershop_id', $this->lojaA->id)->first()->id,
            'service_id' => Service::where('barbershop_id', $this->lojaA->id)->first()->id,
        ]);
        $agB = Schedule::factory()->create([
            'barbershop_id' => $this->lojaB->id,
            'client_id' => Client::factory()->create(['barbershop_id' => $this->lojaB->id])->id,
            'worker_id' => Worker::where('barbershop_id', $this->lojaB->id)->first()->id,
            'service_id' => Service::where('barbershop_id', $this->lojaB->id)->first()->id,
        ]);

        Sanctum::actingAs(User::factory()->admin()->create(['barbershop_id' => $this->lojaA->id]));

        $resp = $this->getJson('/api/agendamentos')->assertOk();
        $ids = collect($resp->json('data'))->pluck('id');

        $this->assertTrue($ids->contains($agA->id));
        $this->assertFalse($ids->contains($agB->id));
    }
}
