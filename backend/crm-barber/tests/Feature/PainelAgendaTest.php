<?php

namespace Tests\Feature;

use App\Models\Barbershop;
use App\Models\OperationTime;
use App\Models\Schedule;
use App\Models\Service;
use App\Models\User;
use App\Models\Worker;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** Agenda do painel novo: período, profissional, marcar pelo painel e trocar profissional. */
class PainelAgendaTest extends TestCase
{
    use RefreshDatabase;

    private Barbershop $bs;

    private Worker $rafael;

    private Worker $thiago;

    private Service $corte;

    protected function setUp(): void
    {
        parent::setUp();

        $this->bs = Barbershop::factory()->create(['slug' => 'loja']);
        $this->rafael = Worker::factory()->create(['barbershop_id' => $this->bs->id, 'active' => true]);
        $this->thiago = Worker::factory()->create(['barbershop_id' => $this->bs->id, 'active' => true]);
        $this->corte = Service::factory()->create(['barbershop_id' => $this->bs->id, 'active' => true, 'duration_time' => 30, 'price' => 40]);

        foreach (range(0, 6) as $dow) {
            OperationTime::factory()->create([
                'barbershop_id' => $this->bs->id, 'day_of_week' => $dow, 'active' => true,
                'start_time' => '08:00:00', 'end_time' => '20:00:00', 'waiting_start' => null, 'waiting_end' => null,
            ]);
        }

        Sanctum::actingAs(User::factory()->admin()->create(['barbershop_id' => $this->bs->id]));
    }

    private function marcar(array $over = [])
    {
        return $this->postJson('/api/agendamentos', array_merge([
            'clienteNome' => 'Cliente Balcão',
            'clienteTelefone' => '11988887777',
            'barbeiroId' => $this->rafael->id,
            'servicosIds' => [$this->corte->id],
            'dataAgendamento' => Carbon::tomorrow()->toDateString(),
            'horario' => '10:00',
        ], $over));
    }

    public function test_agendamento_pelo_painel_ja_nasce_confirmado_e_sem_limite_por_telefone(): void
    {
        $this->marcar()->assertCreated()->assertJsonPath('schedule.status', Schedule::STATUS_CONFIRMADO);

        // o limite público é 5/hora por telefone; pelo painel o dono marca quantos precisar
        foreach (['10:30', '11:00', '11:30', '12:00', '12:30'] as $h) {
            $this->marcar(['horario' => $h])->assertCreated();
        }
        $this->assertSame(6, Schedule::count());
    }

    public function test_lista_por_periodo_e_profissional(): void
    {
        $amanha = Carbon::tomorrow();
        $this->marcar(['dataAgendamento' => $amanha->toDateString()])->assertCreated();
        $this->marcar(['dataAgendamento' => $amanha->copy()->addDays(2)->toDateString(), 'barbeiroId' => $this->thiago->id])->assertCreated();
        $this->marcar(['dataAgendamento' => $amanha->copy()->addDays(10)->toDateString()])->assertCreated();

        $ini = $amanha->toDateString();
        $fim = $amanha->copy()->addDays(6)->toDateString();

        $this->getJson("/api/agendamentos?inicio={$ini}&fim={$fim}")->assertOk()->assertJsonCount(2, 'data');
        $this->getJson("/api/agendamentos?inicio={$ini}&fim={$fim}&profissional={$this->thiago->id}")->assertOk()->assertJsonCount(1, 'data');
    }

    public function test_trocar_profissional_respeita_conflito_do_novo_profissional(): void
    {
        $a = $this->marcar()->json('schedule.id');
        $this->marcar(['barbeiroId' => $this->thiago->id, 'clienteTelefone' => '11977776666'])->assertCreated();

        // Thiago já tem cliente às 10:00 → recusado
        $this->putJson("/api/agendamentos/{$a}", ['barbeiroId' => $this->thiago->id])->assertStatus(422);

        // às 15:00 com o Thiago → ok
        $this->putJson("/api/agendamentos/{$a}", ['barbeiroId' => $this->thiago->id, 'horario' => '15:00'])->assertOk();
        $s = Schedule::find($a);
        $this->assertSame($this->thiago->id, $s->worker_id);
        $this->assertSame('15:00:00', (string) $s->start_time);
    }

    public function test_nao_troca_para_profissional_de_outra_barbearia(): void
    {
        $a = $this->marcar()->json('schedule.id');
        $outro = Worker::factory()->create(['barbershop_id' => Barbershop::factory()->create()->id]);

        $this->putJson("/api/agendamentos/{$a}", ['barbeiroId' => $outro->id])->assertStatus(422);
    }
}
