<?php

namespace Tests\Feature;

use App\Jobs\SendWaitlistWhatsapp;
use App\Models\Barbershop;
use App\Models\Client;
use App\Models\OperationTime;
use App\Models\Schedule;
use App\Models\Service;
use App\Models\User;
use App\Models\WaitlistEntry;
use App\Models\Worker;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** Lista de espera: entrar pelo link, aviso quando vaga, saída ao marcar. */
class ListaEsperaTest extends TestCase
{
    use RefreshDatabase;

    private Barbershop $bs;

    private Worker $worker;

    private Service $servico;

    protected function setUp(): void
    {
        parent::setUp();
        Bus::fake();
        Carbon::setTestNow('2026-10-08 10:00:00');

        $this->bs = Barbershop::factory()->create(['slug' => 'loja']);
        $this->worker = Worker::factory()->create(['barbershop_id' => $this->bs->id, 'active' => true]);
        $this->servico = Service::factory()->create(['barbershop_id' => $this->bs->id, 'active' => true, 'duration_time' => 30, 'price' => 40]);
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

    private function entrar(string $data, string $fone = '(11) 98765-4321', array $over = [])
    {
        return $this->postJson('/api/b/loja/lista-espera', array_merge([
            'clienteNome' => 'João da Silva', 'clienteTelefone' => $fone, 'data' => $data, 'servicosIds' => [$this->servico->id],
        ], $over));
    }

    private function horario(string $data, array $over = []): Schedule
    {
        return Schedule::factory()->create(array_merge([
            'barbershop_id' => $this->bs->id, 'worker_id' => $this->worker->id,
            'client_id' => Client::factory()->create(['barbershop_id' => $this->bs->id])->id,
            'date' => $data, 'start_time' => '15:00:00', 'end_time' => '15:30:00', 'status' => Schedule::STATUS_CONFIRMADO,
        ], $over));
    }

    private function avisados(): array
    {
        return Bus::dispatched(SendWaitlistWhatsapp::class)->map(fn ($j) => $j->entryId)->sort()->values()->all();
    }

    private function admin(): void
    {
        Sanctum::actingAs(User::factory()->admin()->create(['barbershop_id' => $this->bs->id]));
    }

    public function test_cliente_entra_na_lista_pela_pagina(): void
    {
        $this->getJson('/api/b/loja/barbearia')->assertJsonPath('lista_espera', true);

        $this->entrar('2026-10-10')->assertCreated()->assertJsonPath('posicao', 1);
        $this->entrar('2026-10-10')->assertOk(); // de novo no mesmo dia: atualiza, não duplica
        $this->assertSame(1, WaitlistEntry::withoutGlobalScopes()->count());

        $this->entrar('2026-10-11')->assertCreated();
        $this->entrar('2026-10-12')->assertCreated();
        $this->entrar('2026-10-13')->assertStatus(422)->assertJsonValidationErrors('data'); // máximo de 3 dias

        $this->entrar('2026-10-07', '11955550000')->assertStatus(422);                       // dia que já passou
        $this->entrar('2026-10-10', '11955550000', ['website' => 'bot'])->assertStatus(422);  // honeypot

        $this->bs->update(['lista_espera_ativa' => false]);
        $this->entrar('2026-10-14', '11944440000')->assertNotFound();
    }

    public function test_cancelamento_avisa_os_tres_primeiros_respeitando_o_profissional(): void
    {
        $outro = Worker::factory()->create(['barbershop_id' => $this->bs->id, 'active' => true]);
        $this->entrar('2026-10-10', '11900000001')->assertCreated();
        $this->entrar('2026-10-10', '11900000002', ['barbeiroId' => $outro->id])->assertCreated(); // prefere outro
        $this->entrar('2026-10-10', '11900000003')->assertCreated();
        $this->entrar('2026-10-10', '11900000004', ['barbeiroId' => $this->worker->id])->assertCreated();
        $this->entrar('2026-10-10', '11900000005')->assertCreated();
        $ids = WaitlistEntry::withoutGlobalScopes()->orderBy('id')->pluck('id')->all();

        $s = $this->horario('2026-10-10');
        $this->admin();
        $this->putJson("/api/agendamentos/{$s->id}", ['status' => Schedule::STATUS_CANCELADO])->assertOk();

        $this->assertSame([$ids[0], $ids[2], $ids[3]], $this->avisados());
        $this->assertSame(WaitlistEntry::AVISADO, WaitlistEntry::withoutGlobalScopes()->find($ids[0])->status);
        $this->assertSame(WaitlistEntry::AGUARDANDO, WaitlistEntry::withoutGlobalScopes()->find($ids[4])->status);
    }

    public function test_quem_marca_sai_da_lista_e_a_noite_ninguem_e_avisado(): void
    {
        $this->entrar('2026-10-10')->assertCreated();

        $this->postJson('/api/b/loja/agendamentos', [
            'clienteNome' => 'João da Silva', 'clienteTelefone' => '(11) 98765-4321',
            'barbeiroId' => $this->worker->id, 'servicosIds' => [$this->servico->id],
            'dataAgendamento' => '2026-10-10', 'horario' => '09:00',
        ])->assertCreated();
        $this->assertSame(WaitlistEntry::AGENDOU, WaitlistEntry::withoutGlobalScopes()->first()->status);

        $this->entrar('2026-10-11', '11955550000')->assertCreated();
        Carbon::setTestNow('2026-10-08 23:00:00');
        $s = $this->horario('2026-10-11');
        $this->admin();
        $this->putJson("/api/agendamentos/{$s->id}", ['status' => Schedule::STATUS_CANCELADO])->assertOk();
        $this->assertSame([], $this->avisados());
    }

    public function test_remarcar_pelo_link_libera_o_horario_antigo(): void
    {
        $this->entrar('2026-10-10', '11955550000')->assertCreated();
        $s = $this->horario('2026-10-10');

        $this->postJson("/api/b/loja/meu-horario/{$s->token_cliente}/remarcar", ['dataAgendamento' => '2026-10-11', 'horario' => '10:00'])->assertOk();

        $this->assertCount(1, $this->avisados());
    }

    public function test_painel_ve_e_remove_e_a_mensagem_leva_o_dia(): void
    {
        $this->entrar('2026-10-10')->assertCreated();
        $e = WaitlistEntry::withoutGlobalScopes()->first();
        $this->admin();

        $this->getJson('/api/lista-espera?data=2026-10-10')->assertOk()
            ->assertJsonPath('0.cliente', 'João da Silva')
            ->assertJsonPath('0.status', 'aguardando');

        $e->update(['status' => WaitlistEntry::AVISADO]);
        Http::fake(['*' => Http::response(['status' => 'dispatched'])]);
        (new SendWaitlistWhatsapp($e->id, '15:00'))->handle();
        Http::assertSent(fn ($r) => $r['trigger'] === 'LISTA_ESPERA' && $r['time'] === '15:00' && str_ends_with($r['link'], '?b=loja&d=2026-10-10'));

        $this->deleteJson("/api/lista-espera/{$e->id}")->assertOk();
        $this->assertSame(WaitlistEntry::REMOVIDO, $e->fresh()->status);
    }
}
