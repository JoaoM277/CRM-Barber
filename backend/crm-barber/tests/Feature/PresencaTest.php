<?php

namespace Tests\Feature;

use App\Jobs\SendAppointmentWhatsapp;
use App\Models\Barbershop;
use App\Models\Client;
use App\Models\Product;
use App\Models\Schedule;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** Confirmação só do cliente, falta automática, apoio e pendências do dono. */
class PresencaTest extends TestCase
{
    use RefreshDatabase;

    private Barbershop $bs;

    private Client $cliente;

    protected function setUp(): void
    {
        parent::setUp();
        Bus::fake();
        Carbon::setTestNow('2026-10-08 12:00:00');
        $this->bs = Barbershop::factory()->create(['slug' => 'loja']);
        $this->cliente = Client::factory()->create(['barbershop_id' => $this->bs->id]);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function agendamento(array $over = []): Schedule
    {
        return Schedule::factory()->create(array_merge([
            'barbershop_id' => $this->bs->id, 'client_id' => $this->cliente->id,
            'date' => '2026-10-08', 'start_time' => '10:00:00', 'end_time' => '10:30:00', 'status' => Schedule::STATUS_PENDENTE,
        ], $over));
    }

    private function admin(): void
    {
        Sanctum::actingAs(User::factory()->admin()->create(['barbershop_id' => $this->bs->id]));
    }

    public function test_painel_nao_confirma_so_conclui_ou_cancela(): void
    {
        $this->admin();
        $a = $this->agendamento(['date' => '2026-10-09']);
        $b = $this->agendamento(['date' => '2026-10-09', 'start_time' => '11:00:00', 'end_time' => '11:30:00']);

        $this->putJson("/api/agendamentos/{$a->id}", ['status' => 'confirmado'])->assertStatus(422)->assertJsonValidationErrors('status');
        $this->putJson("/api/agendamentos/{$a->id}", ['status' => 'concluido'])->assertOk(); // pendente concluído vale como confirmado
        $this->putJson("/api/agendamentos/{$b->id}", ['status' => 'cancelado'])->assertOk();

        $this->assertSame(Schedule::STATUS_CONCLUIDO, $a->fresh()->status);
        $this->assertSame(Schedule::POR_BARBEARIA, $b->fresh()->cancelado_por);
    }

    public function test_falta_automatica_so_para_quem_recebeu_o_pedido(): void
    {
        $lembrado = $this->agendamento(['confirmacao_pedida_em' => now()->subDay()]);
        $semPedido = $this->agendamento(['start_time' => '09:00:00', 'end_time' => '09:30:00']);
        $confirmado = $this->agendamento(['status' => Schedule::STATUS_CONFIRMADO, 'confirmacao_pedida_em' => now()->subDay(), 'start_time' => '08:00:00', 'end_time' => '08:30:00']);
        $recente = $this->agendamento(['confirmacao_pedida_em' => now()->subDay(), 'start_time' => '11:30:00', 'end_time' => '12:00:00']); // ainda não deu 1h
        $comProduto = $this->agendamento(['confirmacao_pedida_em' => now()->subDay(), 'start_time' => '08:30:00', 'end_time' => '09:00:00']);
        $p = Product::factory()->create(['barbershop_id' => $this->bs->id]);
        $comProduto->products()->attach($p->id, ['quantity' => 1, 'price' => 30, 'commission_value' => 0]);

        $this->artisan('agenda:faltas')->assertSuccessful();

        $this->assertSame(Schedule::STATUS_FALTA, $lembrado->fresh()->status);
        $this->assertSame(Schedule::POR_SISTEMA, $lembrado->fresh()->cancelado_por);
        $this->assertSame(Schedule::STATUS_PENDENTE, $semPedido->fresh()->status);   // vira "não registrado"
        $this->assertSame(Schedule::STATUS_CONFIRMADO, $confirmado->fresh()->status);
        $this->assertSame(Schedule::STATUS_PENDENTE, $recente->fresh()->status);
        $this->assertSame(Schedule::STATUS_PENDENTE, $comProduto->fresh()->status); // produto lançado = veio
        $this->assertSame(1, $comProduto->fresh()->products()->count());
    }

    public function test_pedido_de_confirmacao_so_conta_quando_o_lembrete_sai(): void
    {
        $s = $this->agendamento(['date' => '2026-10-09']);

        Http::fake(['*' => Http::response(['status' => 'held'])]); // retido pelo horário: não saiu
        (new SendAppointmentWhatsapp($s->id, SendAppointmentWhatsapp::LEMBRETE_24H))->handle();
        $this->assertNull($s->fresh()->confirmacao_pedida_em);

        Http::fake(['*' => Http::response(['status' => 'dispatched'])]);
        (new SendAppointmentWhatsapp($s->id, SendAppointmentWhatsapp::LEMBRETE_24H))->handle();
        $this->assertNotNull($s->fresh()->confirmacao_pedida_em);
    }

    public function test_apoio_no_dia_seguinte_so_se_nao_revertida(): void
    {
        $falta = $this->agendamento(['date' => '2026-10-07', 'status' => Schedule::STATUS_FALTA, 'cancelado_por' => Schedule::POR_SISTEMA, 'falta_em' => '2026-10-07 11:05']);
        $revertida = $this->agendamento(['date' => '2026-10-07', 'status' => Schedule::STATUS_CONCLUIDO, 'falta_em' => '2026-10-07 11:05']);
        $deHoje = $this->agendamento(['status' => Schedule::STATUS_FALTA, 'cancelado_por' => Schedule::POR_SISTEMA, 'falta_em' => '2026-10-08 11:05']);

        $this->artisan('agenda:apoio', ['--agora' => '2026-10-08 10:00'])->assertSuccessful();
        $this->artisan('agenda:apoio', ['--agora' => '2026-10-08 10:00'])->assertSuccessful();

        $enviados = Bus::dispatched(SendAppointmentWhatsapp::class, fn ($j) => $j->trigger === SendAppointmentWhatsapp::APOIO_FALTA);
        $this->assertSame([$falta->id], $enviados->pluck('scheduleId')->all());
        $this->assertNull($revertida->fresh()->apoio_enviado_em);
        $this->assertNull($deHoje->fresh()->apoio_enviado_em);
    }

    public function test_pendencias_resumo_e_registro(): void
    {
        $this->admin();
        $seg = $this->agendamento(['date' => '2026-10-06']);
        $this->agendamento(['date' => '2026-10-06', 'start_time' => '11:00:00', 'end_time' => '11:30:00', 'status' => Schedule::STATUS_CONFIRMADO]);
        $ter = $this->agendamento(['date' => '2026-10-07']);
        $falta = $this->agendamento(['date' => '2026-10-07', 'start_time' => '15:00:00', 'end_time' => '15:30:00', 'status' => Schedule::STATUS_FALTA, 'cancelado_por' => Schedule::POR_SISTEMA, 'falta_em' => now()->subDay()]);
        $velha = $this->agendamento(['date' => '2026-10-01', 'status' => Schedule::STATUS_FALTA, 'cancelado_por' => Schedule::POR_SISTEMA, 'falta_em' => now()->subDays(6)]);
        $this->agendamento(['date' => '2026-10-08', 'start_time' => '09:00:00', 'end_time' => '09:30:00']); // hoje: ainda não é pendência

        $this->getJson('/api/pendencias/resumo')->assertOk()
            ->assertJsonPath('nao_registrados', 3)
            ->assertJsonPath('dias', 2)
            ->assertJsonPath('por_dia.0.data', '2026-10-07')
            ->assertJsonPath('faltas_para_revisar', 1);
        $this->getJson('/api/pendencias?mes=2026-10')->assertOk()->assertJsonCount(3, 'nao_registrados')->assertJsonCount(1, 'faltas');

        $this->postJson("/api/agendamentos/{$ter->id}/registrar", ['resultado' => 'falta'])->assertOk();
        $this->assertSame(Schedule::POR_BARBEARIA, $ter->fresh()->cancelado_por);

        // falta automática: "compareceu" reverte; depois de 3 dias não dá mais
        $this->postJson("/api/agendamentos/{$falta->id}/registrar", ['resultado' => 'cancelado'])->assertStatus(422);
        $this->postJson("/api/agendamentos/{$falta->id}/registrar", ['resultado' => 'concluido'])->assertOk();
        $this->assertSame(Schedule::STATUS_CONCLUIDO, $falta->fresh()->status);
        $this->postJson("/api/agendamentos/{$velha->id}/registrar", ['resultado' => 'concluido'])->assertStatus(422);

        // segunda inteira de uma vez
        $this->postJson('/api/pendencias/dia', ['data' => '2026-10-06', 'resultado' => 'concluido'])->assertOk()->assertJsonPath('total', 2);
        $this->assertSame(Schedule::STATUS_CONCLUIDO, $seg->fresh()->status);
        $this->getJson('/api/pendencias/resumo')->assertJsonPath('nao_registrados', 0)->assertJsonPath('faltas_para_revisar', 0);
    }

    public function test_faltou_mesmo_tira_dos_avisos(): void
    {
        $this->admin();
        $falta = $this->agendamento(['date' => '2026-10-07', 'status' => Schedule::STATUS_FALTA, 'cancelado_por' => Schedule::POR_SISTEMA, 'falta_em' => now()->subDay()]);

        $this->postJson("/api/agendamentos/{$falta->id}/registrar", ['resultado' => 'falta'])->assertOk();
        $this->assertNotNull($falta->fresh()->falta_confirmada_em);
        $this->getJson('/api/pendencias/resumo')->assertJsonPath('faltas_para_revisar', 0);
        $this->putJson("/api/agendamentos/{$falta->id}", ['status' => 'concluido'])->assertStatus(422);
    }

    public function test_cliente_confirma_pelo_link_e_cancelamento_dele_e_registrado(): void
    {
        $s = $this->agendamento(['date' => '2026-10-10']);
        $outro = $this->agendamento(['date' => '2026-10-11']);

        $this->getJson("/api/b/loja/meu-horario/{$s->token_cliente}")->assertJsonPath('pode_confirmar', true);
        $this->postJson("/api/b/loja/meu-horario/{$s->token_cliente}/confirmar")->assertOk()->assertJsonPath('horario.status', 'confirmado');
        $this->postJson("/api/b/loja/meu-horario/{$s->token_cliente}/confirmar")->assertOk(); // de novo: já confirmado

        $passado = $this->agendamento(['date' => '2026-10-07']);
        $this->postJson("/api/b/loja/meu-horario/{$passado->token_cliente}/confirmar")->assertStatus(422);

        $this->postJson("/api/b/loja/meu-horario/{$outro->token_cliente}/cancelar")->assertOk();
        $this->assertSame(Schedule::POR_CLIENTE, $outro->fresh()->cancelado_por);
    }

    public function test_falta_nao_conta_como_visita_no_relatorio(): void
    {
        $this->admin();
        $this->agendamento(['date' => '2026-10-06', 'status' => Schedule::STATUS_FALTA, 'cancelado_por' => Schedule::POR_SISTEMA]);
        $this->agendamento(['date' => '2026-10-07', 'status' => Schedule::STATUS_CANCELADO, 'cancelado_por' => Schedule::POR_CLIENTE]);

        $this->getJson('/api/relatorios?inicio=2026-10-01&fim=2026-10-31')->assertOk()
            ->assertJsonPath('agenda.faltas', 1)
            ->assertJsonPath('agenda.cancelados', 1)
            ->assertJsonPath('agenda.cancelados_pelo_cliente', 1)
            ->assertJsonPath('clientes.atendidos', 0);
    }
}
