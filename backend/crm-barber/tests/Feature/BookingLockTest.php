<?php

namespace Tests\Feature;

use App\Models\Barbershop;
use App\Models\Client;
use App\Models\OperationTime;
use App\Models\Service;
use App\Models\Worker;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class BookingLockTest extends TestCase
{
    use RefreshDatabase;

    private Barbershop $bs;

    private Worker $worker;

    private Service $service;

    protected function setUp(): void
    {
        parent::setUp();

        $this->bs = Barbershop::factory()->create(['slug' => 'loja']);
        $this->worker = Worker::factory()->create(['barbershop_id' => $this->bs->id, 'active' => true]);
        $this->service = Service::factory()->create([
            'barbershop_id' => $this->bs->id, 'active' => true, 'duration_time' => 30, 'price' => 40,
        ]);

        foreach (range(0, 6) as $dow) {
            OperationTime::factory()->create([
                'barbershop_id' => $this->bs->id,
                'day_of_week' => $dow,
                'active' => true,
                'start_time' => '08:00:00',
                'end_time' => '20:00:00',
                'waiting_start' => null,
                'waiting_end' => null,
            ]);
        }
    }

    private function payload(array $over = []): array
    {
        return array_merge([
            'clienteNome' => 'Cliente Teste',
            'clienteTelefone' => '(11) 98765-4321',
            'barbeiroId' => $this->worker->id,
            'servicosIds' => [$this->service->id],
            'dataAgendamento' => Carbon::tomorrow()->toDateString(),
            'horario' => '10:00',
        ], $over);
    }

    public function test_agenda_e_normaliza_telefone(): void
    {
        $this->postJson('/api/b/loja/agendamentos', $this->payload())
            ->assertCreated();

        $this->assertDatabaseHas('clients', [
            'barbershop_id' => $this->bs->id,
            'phone' => '5511987654321',
        ]);
    }

    public function test_segundo_agendamento_no_mesmo_slot_e_rejeitado(): void
    {
        $this->postJson('/api/b/loja/agendamentos', $this->payload())->assertCreated();

        $this->postJson('/api/b/loja/agendamentos', $this->payload([
            'clienteTelefone' => '11955550000',
            'horario' => '10:15', // sobrepõe 10:00-10:30
        ]))->assertStatus(422)->assertJsonValidationErrors('horario');
    }

    public function test_slot_adjacente_e_permitido(): void
    {
        $this->postJson('/api/b/loja/agendamentos', $this->payload())->assertCreated();

        $this->postJson('/api/b/loja/agendamentos', $this->payload([
            'clienteTelefone' => '11955550001',
            'horario' => '10:30',
        ]))->assertCreated();
    }

    public function test_horario_no_passado_e_rejeitado(): void
    {
        $this->postJson('/api/b/loja/agendamentos', $this->payload([
            'dataAgendamento' => Carbon::yesterday()->toDateString(),
            'horario' => '10:00',
        ]))->assertStatus(422)->assertJsonValidationErrors('horario');
    }

    public function test_fora_do_expediente_e_rejeitado(): void
    {
        $this->postJson('/api/b/loja/agendamentos', $this->payload([
            'horario' => '21:00',
        ]))->assertStatus(422)->assertJsonValidationErrors('horario');
    }

    public function test_timezone_da_app_e_brt(): void
    {
        $this->assertSame('America/Sao_Paulo', config('app.timezone'));
    }
}
