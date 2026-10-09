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

/** Avaliações dentro da Vellis: comentário, publicação, resposta e o Google como opção. */
class AvaliacoesTest extends TestCase
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
        $this->bs = Barbershop::factory()->create(['slug' => 'loja', 'google_review_url' => 'https://g.page/r/loja/review']);
        $this->cliente = Client::factory()->create(['barbershop_id' => $this->bs->id, 'name' => 'João da Silva', 'phone' => '5511987654321']);
        Instance::create(['barbershop_id' => $this->bs->id, 'name' => 'loja-x1', 'status' => Instance::STATUS_CONECTADO]);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function avaliado(int $nota, ?string $comentario = null, array $over = []): Schedule
    {
        return Schedule::factory()->create(array_merge([
            'barbershop_id' => $this->bs->id, 'client_id' => $this->cliente->id, 'status' => Schedule::STATUS_CONCLUIDO,
            'date' => '2026-10-07', 'avaliacao_pedida_em' => now()->subDay(), 'avaliacao_nota' => $nota,
            'avaliacao_em' => now()->subHours(20), 'avaliacao_comentario' => $comentario,
        ], $over));
    }

    private function mensagem(string $texto)
    {
        return $this->postJson('/api/webhooks/evolution/tok-evo', [
            'event' => 'messages.upsert', 'instance' => 'loja-x1',
            'data' => ['key' => ['remoteJid' => '5511987654321@s.whatsapp.net', 'fromMe' => false], 'message' => ['conversation' => $texto]],
        ])->assertOk();
    }

    public function test_nota_alta_tambem_pode_comentar_e_vai_para_a_pagina(): void
    {
        $s = Schedule::factory()->create([
            'barbershop_id' => $this->bs->id, 'client_id' => $this->cliente->id, 'status' => Schedule::STATUS_CONCLUIDO,
            'date' => '2026-10-08', 'avaliacao_pedida_em' => now()->subMinutes(10),
        ]);

        $this->mensagem('5')->assertJsonPath('resultado', 'avaliacao');
        $this->mensagem('Corte impecável, atendimento nota 10!')->assertJsonPath('resultado', 'comentario');

        $this->assertSame('Corte impecável, atendimento nota 10!', $s->fresh()->avaliacao_comentario);
        $this->getJson('/api/b/loja/avaliacoes')->assertOk()
            ->assertJsonPath('data.0.comentario', 'Corte impecável, atendimento nota 10!')
            ->assertJsonPath('data.0.cliente', 'João S.')
            ->assertJsonPath('resumo.total', 1);
        $this->getJson('/api/b/loja/barbearia')->assertJsonPath('avaliacoes.media', 5);
    }

    public function test_google_e_opcao_desligada_por_padrao(): void
    {
        $s = $this->avaliado(5);
        Http::fake(['*' => Http::response(['status' => 'dispatched'])]);

        (new SendAppointmentWhatsapp($s->id, SendAppointmentWhatsapp::AVALIACAO_ALTA))->handle();
        Http::assertSent(fn ($r) => $r['review_link'] === null);

        $this->bs->update(['avaliacao_google' => true]);
        (new SendAppointmentWhatsapp($s->id, SendAppointmentWhatsapp::AVALIACAO_ALTA))->handle();
        Http::assertSent(fn ($r) => $r['review_link'] === 'https://g.page/r/loja/review');
    }

    public function test_so_notas_altas_com_comentario_e_nao_escondidas_ficam_publicas(): void
    {
        $this->avaliado(5, 'Excelente');
        $this->avaliado(4, 'Muito bom');
        $this->avaliado(5);                                         // sem comentário
        $this->avaliado(2, 'Demorou');                              // nota baixa
        $this->avaliado(5, 'Spam', ['avaliacao_oculta' => true]);   // escondida

        $r = $this->getJson('/api/b/loja/avaliacoes')->assertOk()->assertJsonCount(2, 'data');
        $this->assertEqualsCanonicalizing(['Excelente', 'Muito bom'], collect($r->json('data'))->pluck('comentario')->all());
        // média: as 4 não escondidas (5 + 4 + 5 + 2) / 4 = 4
        $r->assertJsonPath('resumo.media', 4)->assertJsonPath('resumo.total', 4);
    }

    public function test_dono_responde_e_esconde_pelo_painel(): void
    {
        Sanctum::actingAs(User::factory()->admin()->create(['barbershop_id' => $this->bs->id]));
        $boa = $this->avaliado(5, 'Excelente');
        $this->avaliado(2, 'Demorou');

        $this->getJson('/api/avaliacoes')->assertOk()
            ->assertJsonPath('resumo.total', 2)
            ->assertJsonPath('resumo.publicas', 1)
            ->assertJsonPath('resumo.sem_resposta', 2)
            ->assertJsonPath('resumo.distribuicao.5', 1);
        $this->getJson('/api/avaliacoes?status=interna')->assertJsonCount(1, 'data')->assertJsonPath('data.0.nota', 2);

        $this->putJson("/api/avaliacoes/{$boa->id}", ['resposta' => 'Valeu, João!'])->assertOk()->assertJsonPath('avaliacao.resposta', 'Valeu, João!');
        $this->getJson('/api/b/loja/avaliacoes')->assertJsonPath('data.0.resposta', 'Valeu, João!');

        $this->putJson("/api/avaliacoes/{$boa->id}", ['oculta' => true])->assertOk()->assertJsonPath('avaliacao.publica', false);
        $this->getJson('/api/b/loja/avaliacoes')->assertJsonCount(0, 'data');

        $sem = Schedule::factory()->create(['barbershop_id' => $this->bs->id, 'client_id' => $this->cliente->id]);
        $this->putJson("/api/avaliacoes/{$sem->id}", ['oculta' => true])->assertNotFound();

        Sanctum::actingAs(User::factory()->create(['barbershop_id' => $this->bs->id, 'role' => 'user']));
        $this->getJson('/api/avaliacoes')->assertForbidden();
    }

    public function test_configuracao_do_google_no_painel(): void
    {
        Sanctum::actingAs(User::factory()->admin()->create(['barbershop_id' => $this->bs->id]));

        $this->getJson('/api/whatsapp/avaliacao')->assertJsonPath('google', false);
        $this->putJson('/api/whatsapp/avaliacao', ['google' => true])->assertOk()->assertJsonPath('google', true);
    }
}
