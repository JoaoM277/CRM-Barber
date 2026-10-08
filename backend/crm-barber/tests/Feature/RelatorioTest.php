<?php

namespace Tests\Feature;

use App\Models\Barbershop;
use App\Models\Client;
use App\Models\OperationTime;
use App\Models\Schedule;
use App\Models\User;
use App\Models\Worker;
use App\Support\Audit;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** Relatórios: clientes novos/recorrentes, retorno, ocupação e cancelamentos. */
class RelatorioTest extends TestCase
{
    use RefreshDatabase;

    private Barbershop $bs;

    private Worker $ana;

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow('2026-10-08 12:00:00'); // quinta-feira

        $this->bs = Barbershop::factory()->create();
        $this->ana = Worker::factory()->create(['barbershop_id' => $this->bs->id, 'active' => true, 'name' => 'Ana']);
        Worker::factory()->create(['barbershop_id' => $this->bs->id, 'active' => true, 'name' => 'Bruno']);

        // seg a sex 9h-18h com almoço 12h-13h (8h); sábado 9h-13h (4h); domingo fechado
        foreach (range(0, 6) as $dow) {
            OperationTime::factory()->create([
                'barbershop_id' => $this->bs->id, 'day_of_week' => $dow, 'active' => $dow !== 0,
                'start_time' => '09:00:00', 'end_time' => $dow === 6 ? '13:00:00' : '18:00:00',
                'waiting_start' => $dow === 6 ? null : '12:00:00', 'waiting_end' => $dow === 6 ? null : '13:00:00',
            ]);
        }

        Sanctum::actingAs(User::factory()->admin()->create(['barbershop_id' => $this->bs->id]));
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function visita(Client $c, string $data, string $ini = '10:00', string $fim = '11:00', string $status = Schedule::STATUS_CONCLUIDO): Schedule
    {
        return Schedule::factory()->create([
            'barbershop_id' => $this->bs->id, 'client_id' => $c->id, 'worker_id' => $this->ana->id,
            'date' => $data, 'start_time' => "$ini:00", 'end_time' => "$fim:00", 'status' => $status,
        ]);
    }

    private function cliente(): Client
    {
        return Client::factory()->create(['barbershop_id' => $this->bs->id]);
    }

    public function test_indicadores_do_periodo(): void
    {
        $antigo = $this->cliente();
        $this->visita($antigo, '2026-09-01');
        $this->visita($antigo, '2026-10-05');                                         // seg, 1h

        $novo = $this->cliente();
        $this->visita($novo, '2026-10-06', '10:00', '12:00', Schedule::STATUS_PENDENTE); // ter, 2h (não marcado como concluído)

        $cancelado = $this->visita($this->cliente(), '2026-10-07', status: Schedule::STATUS_CANCELADO);
        Audit::logFor($this->bs->id, 'agendamento.cancelado_cliente', $cancelado, 'Cliente cancelou pelo link');

        // coorte de retorno: 1ª visita entre 240 e 60 dias atrás
        $voltou = $this->cliente();
        $this->visita($voltou, '2026-05-01');
        $this->visita($voltou, '2026-06-10');                                         // 40 dias depois
        $this->visita($this->cliente(), '2026-06-01');                                // não voltou

        $r = $this->getJson('/api/relatorios?inicio=2026-10-05&fim=2026-10-11')->assertOk();

        $r->assertJsonPath('clientes.atendidos', 2)
            ->assertJsonPath('clientes.novos', 1)
            ->assertJsonPath('clientes.recorrentes', 1)
            ->assertJsonPath('agenda.total', 3)
            ->assertJsonPath('agenda.cancelados', 1)
            ->assertJsonPath('agenda.cancelados_pelo_cliente', 1)
            ->assertJsonPath('retorno.coorte', 2)
            ->assertJsonPath('retorno.voltaram', 1)
            ->assertJsonPath('retorno.taxa', 0.5)
            ->assertJsonPath('retorno.intervalo_medio_dias', 37); // (34 + 40) / 2

        // disponível por profissional: 5 × 8h + 4h = 44h; Ana ocupou 3h
        $ana = collect($r->json('ocupacao.por_profissional'))->firstWhere('profissional', 'Ana');
        $this->assertSame(44, (int) $ana['horas_disponiveis']);
        $this->assertEquals(3, $ana['horas_ocupadas']);
        $this->assertEqualsWithDelta(180 / 2640, $ana['ocupacao'], 0.0001);
        $this->assertEqualsWithDelta(180 / 5280, $r->json('ocupacao.geral'), 0.0001);

        $dias = collect($r->json('ocupacao.por_dia_semana'))->keyBy('dia');
        $this->assertFalse($dias[0]['aberto']);                              // domingo fechado
        $this->assertEqualsWithDelta(60 / 960, $dias[1]['ocupacao'], 0.0001); // segunda: 1h de 2 × 8h
    }

    public function test_sem_dados_nao_quebra(): void
    {
        $this->getJson('/api/relatorios')->assertOk()
            ->assertJsonPath('clientes.atendidos', 0)
            ->assertJsonPath('retorno.taxa', null)
            ->assertJsonPath('agenda.taxa_cancelamento', 0);
    }

    public function test_so_admin_ve(): void
    {
        Sanctum::actingAs(User::factory()->create(['barbershop_id' => $this->bs->id, 'role' => 'user']));

        $this->getJson('/api/relatorios')->assertForbidden();
    }
}
