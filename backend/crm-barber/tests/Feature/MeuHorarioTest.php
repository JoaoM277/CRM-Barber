<?php

namespace Tests\Feature;

use App\Jobs\SendAppointmentWhatsapp;
use App\Models\Barbershop;
use App\Models\OperationTime;
use App\Models\Schedule;
use App\Models\Service;
use App\Models\User;
use App\Models\Worker;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** O cliente vê, cancela e remarca o próprio horário pelo link (sem login). */
class MeuHorarioTest extends TestCase
{
    use RefreshDatabase;

    private Barbershop $bs;

    private Worker $worker;

    protected function setUp(): void
    {
        parent::setUp();
        Bus::fake();
        Carbon::setTestNow('2026-10-08 11:00:00');

        $this->bs = Barbershop::factory()->create(['slug' => 'loja']);
        $this->worker = Worker::factory()->create(['barbershop_id' => $this->bs->id, 'active' => true]);
        Service::factory()->create(['barbershop_id' => $this->bs->id, 'active' => true, 'duration_time' => 45, 'price' => 50, 'name' => 'Corte']);

        foreach (range(0, 6) as $dow) {
            OperationTime::factory()->create([
                'barbershop_id' => $this->bs->id, 'day_of_week' => $dow, 'active' => true,
                'start_time' => '08:00:00', 'end_time' => '20:00:00', 'waiting_start' => null, 'waiting_end' => null,
            ]);
        }
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    /** Agenda pela página pública e devolve o token do link do cliente. */
    private function agendar(string $data = '2026-10-10', string $hora = '10:00', string $fone = '(11) 98765-4321'): string
    {
        $link = $this->postJson('/api/b/loja/agendamentos', [
            'clienteNome' => 'João da Silva',
            'clienteTelefone' => $fone,
            'barbeiroId' => $this->worker->id,
            'servicosIds' => [Service::withoutGlobalScopes()->value('id')],
            'dataAgendamento' => $data,
            'horario' => $hora,
        ])->assertCreated()->json('link_cliente');

        $this->assertStringContainsString('?b=loja&h=', $link);

        return substr($link, strpos($link, '&h=') + 3);
    }

    private function agendamento(string $token): Schedule
    {
        return Schedule::withoutGlobalScopes()->where('token_cliente', $token)->firstOrFail();
    }

    public function test_cliente_ve_o_horario_sem_dados_sensiveis(): void
    {
        $token = $this->agendar();

        $r = $this->getJson("/api/b/loja/meu-horario/{$token}")->assertOk()
            ->assertJsonPath('date', '2026-10-10')
            ->assertJsonPath('start_time', '10:00')
            ->assertJsonPath('duracao', 45)
            ->assertJsonPath('cliente', 'João')
            ->assertJsonPath('servicos.0', 'Corte')
            ->assertJsonPath('pode_alterar', true);

        $this->assertStringNotContainsString('98765', $r->getContent());
        $this->assertArrayNotHasKey('token_cliente', $this->agendamento($token)->toArray());
    }

    public function test_link_invalido_ou_de_outra_barbearia_da_404(): void
    {
        $token = $this->agendar();
        Barbershop::factory()->create(['slug' => 'outra']);

        $this->getJson('/api/b/outra/meu-horario/'.$token)->assertNotFound();
        $this->getJson('/api/b/loja/meu-horario/'.str_repeat('a', 40))->assertNotFound();
        $this->getJson('/api/b/loja/meu-horario/curto')->assertNotFound();
    }

    public function test_cliente_cancela_pelo_link(): void
    {
        $token = $this->agendar();

        $this->postJson("/api/b/loja/meu-horario/{$token}/cancelar")->assertOk()
            ->assertJsonPath('horario.status', Schedule::STATUS_CANCELADO)
            ->assertJsonPath('horario.pode_alterar', false);

        $this->assertDatabaseHas('audit_logs', ['action' => 'agendamento.cancelado_cliente']);

        // de novo: já está cancelado
        $this->postJson("/api/b/loja/meu-horario/{$token}/cancelar")->assertStatus(422)->assertJsonPath('code', 'alteracao_bloqueada');
    }

    public function test_cliente_remarca_e_recebe_a_confirmacao(): void
    {
        $token = $this->agendar();
        $this->agendamento($token)->forceFill(['lembrete_24h_em' => now()])->save();

        $this->postJson("/api/b/loja/meu-horario/{$token}/remarcar", ['dataAgendamento' => '2026-10-11', 'horario' => '15:30'])
            ->assertOk()
            ->assertJsonPath('horario.date', '2026-10-11')
            ->assertJsonPath('horario.start_time', '15:30')
            ->assertJsonPath('horario.end_time', '16:15');

        $s = $this->agendamento($token);
        $this->assertNull($s->lembrete_24h_em, 'novo horário recebe os lembretes de novo');
        Bus::assertDispatched(SendAppointmentWhatsapp::class, fn ($j) => $j->trigger === SendAppointmentWhatsapp::REMARCADO && $j->scheduleId === $s->id);
    }

    public function test_remarcar_para_horario_ocupado_ou_fora_do_expediente_e_recusado(): void
    {
        $token = $this->agendar();
        $this->agendar('2026-10-11', '15:00', '11955550000');

        $this->postJson("/api/b/loja/meu-horario/{$token}/remarcar", ['dataAgendamento' => '2026-10-11', 'horario' => '15:30'])
            ->assertStatus(422)->assertJsonValidationErrors('horario');
        $this->postJson("/api/b/loja/meu-horario/{$token}/remarcar", ['dataAgendamento' => '2026-10-11', 'horario' => '19:30'])
            ->assertStatus(422)->assertJsonValidationErrors('horario');

        // dá para "remarcar" sobrepondo o próprio horário (ex.: 15 min depois)
        $this->postJson("/api/b/loja/meu-horario/{$token}/remarcar", ['dataAgendamento' => '2026-10-10', 'horario' => '10:15'])->assertOk();
    }

    public function test_respeita_a_antecedencia_e_a_opcao_da_barbearia(): void
    {
        $token = $this->agendar('2026-10-09', '10:00'); // faltam 23h

        $this->bs->update(['antecedencia_alteracao_horas' => 24]);
        $this->getJson("/api/b/loja/meu-horario/{$token}")->assertJsonPath('pode_alterar', false);
        $this->postJson("/api/b/loja/meu-horario/{$token}/cancelar")->assertStatus(422);

        // com 2h de antecedência ainda pode, mas não para daqui a 1h
        $this->bs->update(['antecedencia_alteracao_horas' => 2]);
        $this->postJson("/api/b/loja/meu-horario/{$token}/remarcar", ['dataAgendamento' => '2026-10-08', 'horario' => '12:00'])
            ->assertStatus(422)->assertJsonValidationErrors('horario');

        $this->bs->update(['alterar_pelo_link' => false]);
        $this->postJson("/api/b/loja/meu-horario/{$token}/cancelar")->assertStatus(422)->assertJsonPath('code', 'alteracao_bloqueada');

        $this->assertSame(Schedule::STATUS_PENDENTE, $this->agendamento($token)->status);
    }

    public function test_confirmacao_no_whatsapp_leva_o_link_do_cliente(): void
    {
        $token = $this->agendar();
        Http::fake(['*' => Http::response(['status' => 'dispatched'])]);

        (new SendAppointmentWhatsapp($this->agendamento($token)->id))->handle();

        Http::assertSent(fn ($req) => str_ends_with((string) $req['manage_link'], "?b=loja&h={$token}"));
    }

    public function test_dono_configura_pelo_painel(): void
    {
        Sanctum::actingAs(User::factory()->admin()->create(['barbershop_id' => $this->bs->id]));

        $this->putJson('/api/barbearia/alteracao-pelo-cliente', ['antecedencia_alteracao_horas' => 6])
            ->assertOk()
            ->assertJsonPath('alteracao.antecedencia_alteracao_horas', 6)
            ->assertJsonPath('alteracao.alterar_pelo_link', true);

        $this->putJson('/api/barbearia/alteracao-pelo-cliente', ['antecedencia_alteracao_horas' => 100])->assertStatus(422);
    }
}
