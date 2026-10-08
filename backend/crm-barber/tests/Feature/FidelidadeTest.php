<?php

namespace Tests\Feature;

use App\Jobs\SendAppointmentWhatsapp;
use App\Models\Barbershop;
use App\Models\Client;
use App\Models\Schedule;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** Fidelidade: selos por atendimento concluído, prêmio e resgate. */
class FidelidadeTest extends TestCase
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
        Sanctum::actingAs(User::factory()->admin()->create(['barbershop_id' => $this->bs->id]));
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function ligar(int $meta = 3): void
    {
        $this->bs->update(['fidelidade_ativa' => true, 'fidelidade_meta' => $meta, 'fidelidade_premio' => '1 corte grátis', 'fidelidade_desde' => '2026-10-01']);
    }

    private function atendimento(string $data, string $status = Schedule::STATUS_CONCLUIDO): Schedule
    {
        return Schedule::factory()->create(['barbershop_id' => $this->bs->id, 'client_id' => $this->cliente->id, 'date' => $data, 'status' => $status]);
    }

    private function premios(): int
    {
        return Bus::dispatched(SendAppointmentWhatsapp::class, fn ($j) => $j->trigger === SendAppointmentWhatsapp::FIDELIDADE_PREMIO)->count();
    }

    public function test_ligar_exige_premio_e_comeca_a_contar_hoje(): void
    {
        $this->putJson('/api/fidelidade', ['ativa' => true])->assertStatus(422)->assertJsonValidationErrors('premio');
        $this->putJson('/api/fidelidade', ['meta' => 1])->assertStatus(422);

        $this->putJson('/api/fidelidade', ['ativa' => true, 'meta' => 8, 'premio' => 'Barba grátis'])->assertOk()
            ->assertJsonPath('ativa', true)
            ->assertJsonPath('meta', 8)
            ->assertJsonPath('desde', '2026-10-08');
    }

    public function test_selos_contam_concluidos_desde_o_inicio_do_programa(): void
    {
        $this->ligar();
        $this->atendimento('2026-09-20');                              // antes do programa
        $this->atendimento('2026-10-02');
        $this->atendimento('2026-10-03');
        $this->atendimento('2026-10-04', Schedule::STATUS_CANCELADO);  // não conta

        $c = collect($this->getJson('/api/clientes')->assertOk()->json())->firstWhere('id', $this->cliente->id);
        $this->assertSame(['selos' => 2, 'meta' => 3, 'premio' => '1 corte grátis', 'premio_disponivel' => false], $c['fidelidade']);

        $this->getJson("/api/clientes/{$this->cliente->id}")->assertOk()->assertJsonPath('fidelidade.selos', 2);
    }

    public function test_completar_o_cartao_avisa_o_cliente_e_o_premio_e_entregue_uma_vez(): void
    {
        $this->ligar();
        $this->atendimento('2026-10-02');
        $this->atendimento('2026-10-03');
        $hoje = $this->atendimento('2026-10-08', Schedule::STATUS_CONFIRMADO);

        $this->putJson("/api/agendamentos/{$hoje->id}", ['status' => Schedule::STATUS_CONCLUIDO])->assertOk();
        $this->assertSame(1, $this->premios());

        $this->getJson('/api/agendamentos?data=2026-10-08')->assertOk()
            ->assertJsonPath('data.0.fidelidade.premio_disponivel', true)
            ->assertJsonPath('data.0.client_id', $this->cliente->id);

        $this->postJson("/api/clientes/{$this->cliente->id}/fidelidade/resgatar", ['agendamento_id' => $hoje->id])->assertOk()
            ->assertJsonPath('fidelidade.selos', 0);
        $this->postJson("/api/clientes/{$this->cliente->id}/fidelidade/resgatar")->assertStatus(422);
        $this->assertDatabaseHas('loyalty_redemptions', ['client_id' => $this->cliente->id, 'schedule_id' => $hoje->id, 'selos' => 3, 'premio' => '1 corte grátis']);

        // o próximo atendimento é o 1º selo do novo cartão: sem novo aviso
        $outro = $this->atendimento('2026-10-08', Schedule::STATUS_CONFIRMADO);
        $this->putJson("/api/agendamentos/{$outro->id}", ['status' => Schedule::STATUS_CONCLUIDO])->assertOk();
        $this->assertSame(1, $this->premios());
    }

    public function test_mensagem_do_premio_e_cartao_no_link_do_cliente(): void
    {
        $this->ligar(2);
        $this->atendimento('2026-10-02');
        $s = $this->atendimento('2026-10-08');

        Http::fake(['*' => Http::response(['status' => 'dispatched'])]);
        (new SendAppointmentWhatsapp($s->id, SendAppointmentWhatsapp::FIDELIDADE_PREMIO))->handle();
        Http::assertSent(fn ($r) => $r['trigger'] === 'FIDELIDADE_PREMIO' && $r['meta'] === 2 && $r['premio'] === '1 corte grátis');

        $futuro = $this->atendimento('2026-10-20', Schedule::STATUS_PENDENTE);
        $this->getJson("/api/b/loja/meu-horario/{$futuro->token_cliente}")->assertOk()
            ->assertJsonPath('fidelidade.selos', 2)
            ->assertJsonPath('fidelidade.premio_disponivel', true);
    }

    public function test_quem_nao_e_admin_entrega_o_premio_mas_nao_configura(): void
    {
        $this->ligar(2);
        $this->atendimento('2026-10-02');
        $this->atendimento('2026-10-03');
        Sanctum::actingAs(User::factory()->create(['barbershop_id' => $this->bs->id, 'role' => 'user']));

        $this->putJson('/api/fidelidade', ['meta' => 5])->assertForbidden();
        $this->postJson("/api/clientes/{$this->cliente->id}/fidelidade/resgatar")->assertOk();
    }

    public function test_desligada_nao_mostra_nem_resgata(): void
    {
        $this->atendimento('2026-10-02');

        $c = collect($this->getJson('/api/clientes')->json())->firstWhere('id', $this->cliente->id);
        $this->assertArrayNotHasKey('fidelidade', $c);
        $this->postJson("/api/clientes/{$this->cliente->id}/fidelidade/resgatar")->assertStatus(422);
    }
}
