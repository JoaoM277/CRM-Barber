<?php

namespace Tests\Feature;

use App\Models\Barbershop;
use App\Models\Schedule;
use App\Models\Service;
use App\Models\User;
use App\Models\Worker;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** Barbeiro solo x equipe: cadastro, virada automática e o dono sem comissão. */
class EquipeTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Bus::fake();
        Notification::fake();
        Carbon::setTestNow('2026-10-08 10:00:00');
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function cadastrar(string $modelo, array $over = []): Barbershop
    {
        $this->postJson('/api/cadastrar', array_merge([
            'name' => 'Léo Navalha', 'email' => "leo-{$modelo}@ex.com", 'password' => 'segredo123',
            'barbershop_name' => "Barbearia {$modelo}", 'barbershop_whatsapp' => '(11) 98765-4321',
            'modelo_equipe' => $modelo, 'aceite_termos' => true,
        ], $over))->assertCreated();

        return Barbershop::where('name', "Barbearia {$modelo}")->firstOrFail();
    }

    private function entrar(Barbershop $bs): void
    {
        Sanctum::actingAs(User::where('barbershop_id', $bs->id)->firstOrFail());
    }

    public function test_cadastro_solo_ja_cria_o_dono_na_agenda(): void
    {
        $bs = $this->cadastrar('solo');

        $this->assertSame('solo', $bs->modelo_equipe);
        $dono = Worker::withoutGlobalScopes()->where('barbershop_id', $bs->id)->sole();
        $this->assertSame('Léo Navalha', $dono->name);
        $this->assertSame(Worker::PAYMENT_PROPRIETARIO, $dono->payment_type);
        $this->assertSame('5511987654321', $dono->phone);

        $equipe = $this->cadastrar('equipe', ['barbershop_whatsapp' => null]);
        $this->assertSame('equipe', $equipe->modelo_equipe);
        $this->assertSame(0, Worker::withoutGlobalScopes()->where('barbershop_id', $equipe->id)->count());
    }

    public function test_solo_que_contrata_vira_equipe(): void
    {
        $bs = $this->cadastrar('solo');
        $this->entrar($bs);

        $this->postJson('/api/profissionais', [
            'name' => 'Carlos', 'phone' => '(11) 91234-5678', 'payment_type' => 'comissao', 'commission_percent' => 40, 'active' => true,
        ])->assertCreated()->assertJsonPath('modelo_equipe', 'equipe');

        $this->assertSame('equipe', $bs->fresh()->modelo_equipe);
        // o dono continua dono
        $this->assertSame(1, Worker::where('payment_type', Worker::PAYMENT_PROPRIETARIO)->count());
    }

    public function test_dono_nao_tem_comissao_nem_repasse(): void
    {
        $bs = $this->cadastrar('solo');
        $this->entrar($bs);
        $dono = Worker::sole();
        $servico = Service::factory()->create(['barbershop_id' => $bs->id, 'active' => true, 'price' => 50, 'duration_time' => 30]);

        $this->postJson("/api/b/{$bs->slug}/agendamentos", [
            'clienteNome' => 'Cliente', 'clienteTelefone' => '(11) 95555-0000', 'barbeiroId' => $dono->id,
            'servicosIds' => [$servico->id], 'dataAgendamento' => '2026-10-09', 'horario' => '10:00',
        ])->assertCreated();
        $s = Schedule::sole();
        $this->assertEquals(0, $s->commission_value);
        $s->update(['status' => Schedule::STATUS_CONCLUIDO]);

        $this->getJson('/api/faturamento?inicio=2026-10-01&fim=2026-10-31')->assertOk()
            ->assertJsonPath('periodo.lucro_liquido', 50);
        $this->postJson('/api/payouts', ['worker_id' => $dono->id, 'inicio' => '2026-10-01', 'fim' => '2026-10-31'])->assertStatus(422);
    }

    public function test_trocar_o_modelo_nas_configuracoes(): void
    {
        $bs = $this->cadastrar('equipe');
        $this->entrar($bs);
        $a = Worker::factory()->create(['barbershop_id' => $bs->id, 'active' => true, 'payment_type' => 'comissao', 'commission_percent' => 40]);
        $b = Worker::factory()->create(['barbershop_id' => $bs->id, 'active' => true]);

        $this->putJson('/api/barbearia/modelo-equipe', ['modelo' => 'solo'])->assertStatus(422);

        $b->update(['active' => false]);
        $this->putJson('/api/barbearia/modelo-equipe', ['modelo' => 'solo'])->assertOk()->assertJsonPath('modelo_equipe', 'solo');
        $this->assertSame(Worker::PAYMENT_PROPRIETARIO, $a->fresh()->payment_type);

        $this->putJson('/api/barbearia/modelo-equipe', ['modelo' => 'equipe'])->assertOk()->assertJsonPath('modelo_equipe', 'equipe');
    }

    public function test_dono_da_equipe_que_atende_e_so_ele_ve(): void
    {
        $bs = $this->cadastrar('equipe');
        $this->entrar($bs);
        $barbeiro = Worker::factory()->create(['barbershop_id' => $bs->id, 'active' => true, 'payment_type' => 'comissao', 'commission_percent' => 40]);

        $this->postJson('/api/profissionais/eu-tambem-atendo')->assertCreated()
            ->assertJsonPath('worker.name', 'Léo Navalha')
            ->assertJsonPath('worker.payment_type', Worker::PAYMENT_PROPRIETARIO);
        $this->getJson('/api/profissionais')->assertOk()->assertJsonPath('1.payment_type', Worker::PAYMENT_PROPRIETARIO);

        // um barbeiro (usuário comum) não vê como cada um recebe nem consegue mudar
        Sanctum::actingAs(User::factory()->create(['barbershop_id' => $bs->id, 'role' => 'user']));
        $lista = $this->getJson('/api/profissionais')->assertOk()->json();
        foreach ($lista as $w) {
            $this->assertArrayNotHasKey('payment_type', $w);
            $this->assertArrayNotHasKey('commission_percent', $w);
            $this->assertArrayNotHasKey('pix_key', $w);
        }
        $this->putJson("/api/profissionais/{$barbeiro->id}", ['commission_percent' => 90, 'payment_type' => 'proprietario', 'speciality' => 'Degradê'])->assertOk();
        $this->assertEquals(40, $barbeiro->fresh()->commission_percent);
        $this->assertSame('comissao', $barbeiro->fresh()->payment_type);
        $this->assertSame('Degradê', $barbeiro->fresh()->speciality);
        $this->postJson('/api/profissionais/eu-tambem-atendo')->assertForbidden();
    }

    public function test_profissional_sem_telefone(): void
    {
        $bs = $this->cadastrar('equipe');
        $this->entrar($bs);

        $this->postJson('/api/profissionais', ['name' => 'Sem Fone', 'payment_type' => 'comissao', 'commission_percent' => 30, 'active' => true])->assertCreated();
        $this->postJson('/api/profissionais', ['name' => 'Outro Sem Fone', 'payment_type' => 'comissao', 'commission_percent' => 30, 'active' => true])->assertCreated();
    }
}
