<?php

namespace Tests\Feature;

use App\Jobs\SendAppointmentWhatsapp;
use App\Models\Barbershop;
use App\Models\Client;
use App\Models\Instance;
use App\Models\Schedule;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** Avaliação pós-atendimento: pedido de nota, resposta, comentário e relatório. */
class AvaliacaoTest extends TestCase
{
    use RefreshDatabase;

    private Barbershop $bs;

    private Client $cliente;

    protected function setUp(): void
    {
        parent::setUp();
        Bus::fake();
        Carbon::setTestNow('2026-10-08 15:00:00');
        config(['services.evolution.webhook_token' => 'tok-evo']);

        $this->bs = Barbershop::factory()->create(['google_review_url' => 'https://g.page/r/loja/review', 'avaliacao_google' => true]);
        $this->cliente = Client::factory()->create(['barbershop_id' => $this->bs->id, 'phone' => '5511987654321']);
        Instance::create(['barbershop_id' => $this->bs->id, 'name' => 'loja-x1', 'status' => Instance::STATUS_CONECTADO]);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function atendimento(array $over = []): Schedule
    {
        return Schedule::factory()->create(array_merge([
            'barbershop_id' => $this->bs->id, 'client_id' => $this->cliente->id,
            'date' => '2026-10-08', 'start_time' => '13:00:00', 'end_time' => '13:30:00', 'status' => Schedule::STATUS_CONCLUIDO,
        ], $over));
    }

    private function pedidos(): int
    {
        return Bus::dispatched(SendAppointmentWhatsapp::class, fn ($j) => $j->trigger === SendAppointmentWhatsapp::AVALIACAO_PEDIDO)->count();
    }

    private function mensagem(string $texto)
    {
        return $this->postJson('/api/webhooks/evolution/tok-evo', [
            'event' => 'messages.upsert',
            'instance' => 'loja-x1',
            'data' => ['key' => ['remoteJid' => '5511987654321@s.whatsapp.net', 'fromMe' => false], 'message' => ['conversation' => $texto]],
        ])->assertOk();
    }

    public function test_pedido_sai_uma_hora_depois_do_atendimento_concluido(): void
    {
        $s = $this->atendimento();                                                         // terminou 13:30
        $this->atendimento(['start_time' => '14:00:00', 'end_time' => '14:30:00']);      // só 30 min atrás
        $this->atendimento(['status' => Schedule::STATUS_CONFIRMADO, 'start_time' => '10:00:00', 'end_time' => '10:30:00']); // não concluído

        $this->artisan('avaliacoes:enviar', ['--agora' => '2026-10-08 22:00'])->assertSuccessful(); // fora do horário
        $this->assertSame(0, $this->pedidos());

        $this->artisan('avaliacoes:enviar')->assertSuccessful();
        $this->artisan('avaliacoes:enviar')->assertSuccessful();

        $this->assertSame(1, $this->pedidos());
        $this->assertNotNull($s->fresh()->avaliacao_pedida_em);
    }

    public function test_um_pedido_por_cliente_a_cada_30_dias_e_opcao_desligada(): void
    {
        $this->atendimento(['date' => '2026-09-28', 'avaliacao_pedida_em' => '2026-09-28 15:00']);
        $this->atendimento();

        $this->artisan('avaliacoes:enviar');
        $this->assertSame(0, $this->pedidos());

        $outro = Client::factory()->create(['barbershop_id' => $this->bs->id]);
        $this->atendimento(['client_id' => $outro->id]);
        $this->bs->update(['avaliacao_whatsapp' => false]);
        $this->artisan('avaliacoes:enviar');
        $this->assertSame(0, $this->pedidos());
    }

    public function test_nota_alta_recebe_o_link_do_google(): void
    {
        $s = $this->atendimento(['avaliacao_pedida_em' => now()->subMinutes(20)]);

        $this->mensagem('5 estrelas')->assertJsonPath('resultado', 'avaliacao');

        $this->assertSame(5, $s->fresh()->avaliacao_nota);
        Bus::assertDispatched(SendAppointmentWhatsapp::class, fn ($j) => $j->trigger === SendAppointmentWhatsapp::AVALIACAO_ALTA);

        Http::fake(['*' => Http::response(['status' => 'dispatched'])]);
        (new SendAppointmentWhatsapp($s->id, SendAppointmentWhatsapp::AVALIACAO_ALTA))->handle();
        Http::assertSent(fn ($r) => $r['review_link'] === 'https://g.page/r/loja/review');
    }

    public function test_nota_baixa_e_o_comentario_seguinte(): void
    {
        $s = $this->atendimento(['avaliacao_pedida_em' => now()->subMinutes(20)]);

        $this->mensagem('2')->assertJsonPath('resultado', 'avaliacao');
        Bus::assertDispatched(SendAppointmentWhatsapp::class, fn ($j) => $j->trigger === SendAppointmentWhatsapp::AVALIACAO_BAIXA);

        $this->mensagem('Esperei 40 minutos além do horário marcado')->assertJsonPath('resultado', 'comentario');
        $this->mensagem('outra coisa')->assertJsonPath('resultado', 'ignorado');

        $this->assertSame('Esperei 40 minutos além do horário marcado', $s->fresh()->avaliacao_comentario);
    }

    public function test_1_responde_a_pergunta_mais_recente(): void
    {
        $avaliacao = $this->atendimento(['avaliacao_pedida_em' => now()->subMinutes(60)]);
        $futuro = $this->atendimento(['date' => '2026-10-09', 'start_time' => '10:00:00', 'end_time' => '10:30:00', 'status' => Schedule::STATUS_PENDENTE, 'lembrete_24h_em' => now()->subMinutes(30)]);

        // o lembrete foi o último: "1" confirma o horário de amanhã
        $this->mensagem('1')->assertJsonPath('resultado', 'confirmar');
        $this->assertSame(Schedule::STATUS_CONFIRMADO, $futuro->fresh()->status);
        $this->assertNull($avaliacao->fresh()->avaliacao_nota);

        // agora o pedido de avaliação é o mais recente: "1" é nota
        $avaliacao->update(['avaliacao_pedida_em' => now()->subMinutes(5)]);
        $this->mensagem('1')->assertJsonPath('resultado', 'avaliacao');
        $this->assertSame(1, $avaliacao->fresh()->avaliacao_nota);
    }

    public function test_relatorio_e_configuracao_no_painel(): void
    {
        Sanctum::actingAs(User::factory()->admin()->create(['barbershop_id' => $this->bs->id]));
        $this->atendimento(['avaliacao_pedida_em' => now()->subHour(), 'avaliacao_nota' => 5, 'avaliacao_em' => now()]);
        $this->atendimento(['avaliacao_pedida_em' => now()->subHour(), 'avaliacao_nota' => 2, 'avaliacao_em' => now(), 'avaliacao_comentario' => 'demorou']);
        $this->atendimento(['avaliacao_pedida_em' => now()->subHour()]);

        $this->getJson('/api/relatorios?inicio=2026-10-01&fim=2026-10-31')->assertOk()
            ->assertJsonPath('avaliacoes.total', 2)
            ->assertJsonPath('avaliacoes.pedidos', 3)
            ->assertJsonPath('avaliacoes.media', 3.5)
            ->assertJsonPath('avaliacoes.recentes.0.nota', 2)
            ->assertJsonPath('avaliacoes.recentes.0.comentario', 'demorou');

        $this->putJson('/api/whatsapp/avaliacao', ['google_review_url' => 'http://inseguro.com'])->assertStatus(422);
        $this->putJson('/api/whatsapp/avaliacao', ['ativo' => false, 'google_review_url' => 'https://g.page/r/nova/review'])->assertOk()
            ->assertJsonPath('ativo', false)
            ->assertJsonPath('google_review_url', 'https://g.page/r/nova/review');
    }
}
