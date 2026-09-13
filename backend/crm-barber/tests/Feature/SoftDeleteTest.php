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

class SoftDeleteTest extends TestCase
{
    use RefreshDatabase;

    private function admin(Barbershop $bs): User
    {
        $admin = User::factory()->admin()->create(['barbershop_id' => $bs->id]);
        Sanctum::actingAs($admin);

        return $admin;
    }

    public function test_excluir_profissional_nao_apaga_agendamento_historico(): void
    {
        $bs = Barbershop::factory()->create();
        $worker = Worker::factory()->create(['barbershop_id' => $bs->id]);
        $service = Service::factory()->create(['barbershop_id' => $bs->id]);
        $client = Client::factory()->create(['barbershop_id' => $bs->id]);

        $schedule = Schedule::factory()->create([
            'barbershop_id' => $bs->id,
            'worker_id' => $worker->id,
            'service_id' => $service->id,
            'client_id' => $client->id,
        ]);

        $this->admin($bs);

        $this->deleteJson("/api/profissionais/{$worker->id}")->assertOk();

        // soft delete: some da listagem...
        $this->assertSoftDeleted('workers', ['id' => $worker->id]);

        // ...mas o agendamento antigo continua enxergando o profissional (histórico intacto)
        $schedule->refresh();
        $this->assertNotNull($schedule->worker);
        $this->assertSame($worker->id, $schedule->worker->id);
    }

    public function test_recriar_profissional_com_mesmo_telefone_restaura_em_vez_de_duplicar(): void
    {
        $bs = Barbershop::factory()->create();
        $worker = Worker::factory()->create(['barbershop_id' => $bs->id, 'phone' => '11977778888', 'name' => 'Antigo']);
        $this->admin($bs);

        $this->deleteJson("/api/profissionais/{$worker->id}")->assertOk();

        $this->postJson('/api/profissionais', [
            'name' => 'Novo Nome',
            'phone' => '11977778888',
            'active' => true,
        ])->assertCreated();

        $this->assertDatabaseCount('workers', 1);
        $restaurado = Worker::where('phone', '11977778888')->first();
        $this->assertNotNull($restaurado);
        $this->assertSame($worker->id, $restaurado->id);
        $this->assertSame('Novo Nome', $restaurado->name);
    }

    public function test_agendamento_publico_restaura_cliente_excluido_em_vez_de_falhar(): void
    {
        $bs = Barbershop::factory()->create(['slug' => 'loja-soft']);
        $worker = Worker::factory()->create(['barbershop_id' => $bs->id, 'active' => true]);
        $service = Service::factory()->create(['barbershop_id' => $bs->id, 'active' => true, 'duration_time' => 30]);
        \App\Models\OperationTime::factory()->create([
            'barbershop_id' => $bs->id,
            'day_of_week' => now()->addDay()->dayOfWeek,
            'active' => true,
            'start_time' => '08:00:00',
            'end_time' => '20:00:00',
        ]);

        $client = Client::factory()->create(['barbershop_id' => $bs->id, 'phone' => '11966665555']);
        $client->delete();
        $this->assertSoftDeleted('clients', ['id' => $client->id]);

        $resp = $this->postJson('/api/b/loja-soft/agendamentos', [
            'clienteNome' => 'Cliente Restaurado',
            'clienteTelefone' => '11966665555',
            'barbeiroId' => $worker->id,
            'servicosIds' => [$service->id],
            'dataAgendamento' => now()->addDay()->toDateString(),
            'horario' => '10:00',
        ]);

        $resp->assertCreated();
        $this->assertDatabaseCount('clients', 1); // restaurou, não duplicou
        $this->assertNotSoftDeleted('clients', ['id' => $client->id]);
    }
}
