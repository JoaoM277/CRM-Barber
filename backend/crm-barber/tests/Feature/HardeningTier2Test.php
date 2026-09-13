<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Barbershop;
use App\Models\OperationTime;
use App\Models\Schedule;
use App\Models\Service;
use App\Models\User;
use App\Models\Worker;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class HardeningTier2Test extends TestCase
{
    use RefreshDatabase;

    private Barbershop $bs;

    private Worker $worker;

    private Service $service;

    protected function setUp(): void
    {
        parent::setUp();

        $this->bs = Barbershop::factory()->create(['slug' => 'loja-t2']);
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
            'clienteNome' => 'Cliente T2',
            'clienteTelefone' => '11911112222',
            'barbeiroId' => $this->worker->id,
            'servicosIds' => [$this->service->id],
            'dataAgendamento' => Carbon::tomorrow()->toDateString(),
            'horario' => '10:00',
        ], $over);
    }

    // -------------------------- honeypot --------------------------

    public function test_honeypot_preenchido_e_rejeitado(): void
    {
        $this->postJson('/api/b/loja-t2/agendamentos', $this->payload(['website' => 'http://spam.com']))
            ->assertStatus(422);

        $this->assertDatabaseCount('schedules', 0);
    }

    public function test_honeypot_vazio_nao_atrapalha(): void
    {
        $this->postJson('/api/b/loja-t2/agendamentos', $this->payload(['website' => '']))
            ->assertCreated();
    }

    // -------------------------- rate limit por telefone --------------------------

    public function test_muitas_tentativas_com_mesmo_telefone_sao_bloqueadas(): void
    {
        $telefone = '11933334444';
        RateLimiter::clear('agendamento-telefone:55'.$telefone);

        // 5 tentativas (todas em horários diferentes) consomem a cota...
        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/b/loja-t2/agendamentos', $this->payload([
                'clienteTelefone' => $telefone,
                'horario' => sprintf('%02d:00', 8 + $i),
            ]));
        }

        // ...a 6ª é bloqueada mesmo num horário livre e válido
        $resp = $this->postJson('/api/b/loja-t2/agendamentos', $this->payload([
            'clienteTelefone' => $telefone,
            'horario' => '15:00',
        ]));

        $resp->assertStatus(422)->assertJsonValidationErrors('clienteTelefone');

        RateLimiter::clear('agendamento-telefone:55'.$telefone);
    }

    // -------------------------- paginação da agenda --------------------------

    public function test_listagem_de_agendamentos_devolve_meta_de_paginacao(): void
    {
        $admin = User::factory()->admin()->create(['barbershop_id' => $this->bs->id]);
        Sanctum::actingAs($admin);

        Schedule::factory()->count(3)->create([
            'barbershop_id' => $this->bs->id,
            'worker_id' => $this->worker->id,
            'service_id' => $this->service->id,
        ]);

        $resp = $this->getJson('/api/agendamentos?per_page=2')->assertOk();

        $resp->assertJsonStructure(['data', 'meta' => ['current_page', 'per_page', 'total', 'last_page']]);
        $this->assertCount(2, $resp->json('data'));
        $this->assertSame(3, $resp->json('meta.total'));
    }

    // -------------------------- teto de período no faturamento --------------------------

    public function test_faturamento_limita_o_periodo_a_um_ano(): void
    {
        $admin = User::factory()->admin()->create(['barbershop_id' => $this->bs->id]);
        Sanctum::actingAs($admin);

        $resp = $this->getJson('/api/faturamento?inicio=2000-01-01&fim=2030-01-01')->assertOk();

        $inicio = Carbon::parse($resp->json('periodo.inicio'));
        $fim = Carbon::parse($resp->json('periodo.fim'));

        $this->assertLessThanOrEqual(367, $inicio->diffInDays($fim));
    }

    // -------------------------- auditoria --------------------------

    public function test_cancelar_agendamento_gera_registro_de_auditoria(): void
    {
        $admin = User::factory()->admin()->create(['barbershop_id' => $this->bs->id]);
        Sanctum::actingAs($admin);

        $schedule = Schedule::factory()->create([
            'barbershop_id' => $this->bs->id,
            'worker_id' => $this->worker->id,
            'service_id' => $this->service->id,
        ]);

        $this->putJson("/api/agendamentos/{$schedule->id}", ['status' => Schedule::STATUS_CANCELADO])
            ->assertOk();

        $this->assertDatabaseHas('audit_logs', [
            'barbershop_id' => $this->bs->id,
            'user_id' => $admin->id,
            'action' => 'agendamento.cancelado',
            'subject_id' => $schedule->id,
        ]);

        $resp = $this->getJson('/api/auditoria')->assertOk();
        $this->assertGreaterThanOrEqual(1, count($resp->json('data')));
    }

    public function test_auditoria_e_isolada_por_barbearia(): void
    {
        $outraLoja = Barbershop::factory()->create();
        AuditLog::withoutGlobalScope('tenant')->create([
            'barbershop_id' => $outraLoja->id,
            'action' => 'teste.outra_loja',
            'created_at' => now(),
        ]);

        $admin = User::factory()->admin()->create(['barbershop_id' => $this->bs->id]);
        Sanctum::actingAs($admin);

        $resp = $this->getJson('/api/auditoria')->assertOk();

        $acoes = collect($resp->json('data'))->pluck('action');
        $this->assertFalse($acoes->contains('teste.outra_loja'));
    }
}
