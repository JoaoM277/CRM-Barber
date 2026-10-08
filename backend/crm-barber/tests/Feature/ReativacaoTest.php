<?php

namespace Tests\Feature;

use App\Console\Commands\SendReactivations;
use App\Jobs\SendReactivationWhatsapp;
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

/** Reativação de clientes sumidos: X dias sem visita → convite no WhatsApp. */
class ReativacaoTest extends TestCase
{
    use RefreshDatabase;

    private Barbershop $bs;

    protected function setUp(): void
    {
        parent::setUp();
        Bus::fake();
        Carbon::setTestNow('2026-10-08 10:30:00');
        $this->bs = Barbershop::factory()->create(['slug' => 'loja', 'reativacao_whatsapp' => true, 'reativacao_dias' => 45]);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    /** Cliente com visitas nas datas dadas (data => status). */
    private function cliente(array $visitas, array $over = []): Client
    {
        $c = Client::factory()->create(['barbershop_id' => $this->bs->id] + $over);
        foreach ($visitas as $data => $status) {
            Schedule::factory()->create(['barbershop_id' => $this->bs->id, 'client_id' => $c->id, 'date' => $data, 'status' => $status]);
        }

        return $c;
    }

    private function convidados(): array
    {
        return Bus::dispatched(SendReactivationWhatsapp::class)->map(fn ($j) => $j->clientId)->sort()->values()->all();
    }

    public function test_sumido_recebe_o_convite_uma_vez(): void
    {
        // a última visita válida foi em agosto (o cancelamento de outubro não conta)
        $c = $this->cliente(['2026-08-01' => Schedule::STATUS_CONCLUIDO, '2026-10-01' => Schedule::STATUS_CANCELADO]);

        $this->artisan('reativacao:enviar')->assertSuccessful();
        $this->artisan('reativacao:enviar')->assertSuccessful();

        $this->assertSame([$c->id], $this->convidados());
        $this->assertNotNull($c->fresh()->reativacao_enviada_em);
    }

    public function test_quem_nao_recebe(): void
    {
        $this->cliente(['2026-09-30' => Schedule::STATUS_CONCLUIDO]);                                        // veio há pouco
        $this->cliente(['2026-07-01' => Schedule::STATUS_CONCLUIDO, '2026-10-20' => Schedule::STATUS_PENDENTE]); // já tem horário marcado
        $this->cliente(['2025-06-01' => Schedule::STATUS_CONCLUIDO]);                                        // mais de 1 ano
        $this->cliente(['2026-08-01' => Schedule::STATUS_CONCLUIDO], ['reativacao_bloqueada_em' => now()]); // pediu para sair
        $this->cliente(['2026-08-01' => Schedule::STATUS_CONCLUIDO], ['reativacao_enviada_em' => '2026-08-20']); // já convidado neste sumiço
        $this->cliente(['2026-08-01' => Schedule::STATUS_CONCLUIDO])->delete();                            // excluído

        // outra barbearia, com a opção desligada
        $outra = Barbershop::factory()->create();
        $c = Client::factory()->create(['barbershop_id' => $outra->id]);
        Schedule::factory()->create(['barbershop_id' => $outra->id, 'client_id' => $c->id, 'date' => '2026-07-01', 'status' => Schedule::STATUS_CONCLUIDO]);

        $this->artisan('reativacao:enviar')->assertSuccessful();

        $this->assertSame([], $this->convidados());
    }

    public function test_voltou_depois_do_convite_e_sumiu_de_novo_recebe_outro(): void
    {
        $c = $this->cliente(['2026-08-20' => Schedule::STATUS_CONCLUIDO], ['reativacao_enviada_em' => '2026-06-01']);

        $this->artisan('reativacao:enviar');

        $this->assertSame([$c->id], $this->convidados());
    }

    public function test_limite_diario_por_barbearia(): void
    {
        for ($i = 0; $i < SendReactivations::POR_DIA + 2; $i++) {
            $this->cliente(['2026-08-01' => Schedule::STATUS_CONCLUIDO]);
        }

        $this->artisan('reativacao:enviar');

        $this->assertCount(SendReactivations::POR_DIA, $this->convidados());
    }

    public function test_mensagem_leva_o_link_e_respeita_o_sair(): void
    {
        Http::fake(['*' => Http::response(['status' => 'dispatched'])]);
        $c = $this->cliente(['2026-08-01' => Schedule::STATUS_CONCLUIDO], ['name' => 'João da Silva', 'phone' => '5511987654321']);

        (new SendReactivationWhatsapp($c->id))->handle();
        Http::assertSent(fn ($r) => $r['trigger'] === 'REATIVACAO' && $r['name'] === 'João' && str_ends_with($r['link'], '/?b=loja'));

        // cliente responde SAIR no WhatsApp
        config(['services.evolution.webhook_token' => 'tok-evo']);
        Instance::create(['barbershop_id' => $this->bs->id, 'name' => 'loja-x1', 'status' => Instance::STATUS_CONECTADO]);
        $this->postJson('/api/webhooks/evolution/tok-evo', [
            'event' => 'messages.upsert',
            'instance' => 'loja-x1',
            'data' => ['key' => ['remoteJid' => '5511987654321@s.whatsapp.net', 'fromMe' => false], 'message' => ['conversation' => 'Sair']],
        ])->assertOk()->assertJsonPath('resultado', 'sair');

        $this->assertNotNull($c->fresh()->reativacao_bloqueada_em);
        (new SendReactivationWhatsapp($c->id))->handle();
        Http::assertSentCount(1);
    }

    public function test_painel_mostra_resultados_e_salva(): void
    {
        $this->bs->update(['reativacao_whatsapp' => false]);
        Sanctum::actingAs(User::factory()->admin()->create(['barbershop_id' => $this->bs->id]));

        $this->cliente(['2026-08-01' => Schedule::STATUS_CONCLUIDO]); // sumido
        $voltou = $this->cliente(['2026-07-01' => Schedule::STATUS_CONCLUIDO], ['reativacao_enviada_em' => now()->subDays(10)]);
        Schedule::factory()->create(['barbershop_id' => $this->bs->id, 'client_id' => $voltou->id, 'date' => '2026-10-15']);

        $this->getJson('/api/whatsapp/reativacao')->assertOk()
            ->assertJsonPath('ativo', false)
            ->assertJsonPath('sumidos_agora', 1)
            ->assertJsonPath('enviados_30d', 1)
            ->assertJsonPath('voltaram_30d', 1);

        $this->putJson('/api/whatsapp/reativacao', ['ativo' => true, 'dias' => 60])->assertOk()
            ->assertJsonPath('ativo', true)
            ->assertJsonPath('dias', 60);
        $this->putJson('/api/whatsapp/reativacao', ['dias' => 5])->assertStatus(422);
    }
}
