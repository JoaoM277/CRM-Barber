<?php

namespace Tests\Feature;

use App\Models\Barbershop;
use App\Models\Instance;
use App\Models\Plan;
use App\Models\Service;
use App\Models\Subscription;
use App\Models\User;
use App\Models\Worker;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class OnboardingTest extends TestCase
{
    use RefreshDatabase;

    private Barbershop $bs;

    protected function setUp(): void
    {
        parent::setUp();
        $this->bs = Barbershop::factory()->create();
        Sanctum::actingAs(User::factory()->admin()->create(['barbershop_id' => $this->bs->id]));
    }

    private function passo(array $resp, string $id): ?array
    {
        return collect($resp['passos'])->firstWhere('id', $id);
    }

    public function test_barbearia_nova_comeca_com_nada_feito(): void
    {
        $r = $this->getJson('/api/onboarding')->assertOk()->json();

        $this->assertSame(0, $r['feitos']);
        $this->assertFalse($r['concluido']);
        $this->assertFalse($this->passo($r, 'servicos')['feito']);
    }

    public function test_passos_sao_detectados_pelos_dados_da_propria_barbearia(): void
    {
        Service::factory()->create(['barbershop_id' => $this->bs->id]);
        Worker::factory()->create(['barbershop_id' => $this->bs->id]);
        // WhatsApp conectado de OUTRA barbearia não conta
        Instance::create(['barbershop_id' => Barbershop::factory()->create()->id, 'name' => 'outra', 'status' => Instance::STATUS_CONECTADO]);

        $r = $this->getJson('/api/onboarding')->json();

        $this->assertTrue($this->passo($r, 'servicos')['feito']);
        $this->assertTrue($this->passo($r, 'profissionais')['feito']);
        $this->assertFalse($this->passo($r, 'whatsapp')['feito']);
    }

    public function test_marcar_passos_manuais_e_dispensar(): void
    {
        $this->postJson('/api/onboarding/marcar', ['passo' => 'horarios'])->assertOk();
        $r = $this->postJson('/api/onboarding/marcar', ['passo' => 'dispensar'])->assertOk()->json();

        $this->assertTrue($this->passo($r, 'horarios')['feito']);
        $this->assertTrue($r['dispensado']);
        $this->postJson('/api/onboarding/marcar', ['passo' => 'servicos'])->assertStatus(422); // detectado, não manual
    }

    public function test_plano_sem_whatsapp_nao_mostra_o_passo(): void
    {
        Subscription::create([
            'barbershop_id' => $this->bs->id, 'plan_id' => Plan::where('slug', 'basico')->value('id'),
            'status' => Subscription::STATUS_TRIALING, 'trial_ends_at' => now()->addDays(5),
        ]);

        $r = $this->getJson('/api/onboarding')->json();

        $this->assertNull($this->passo($r, 'whatsapp'));
    }

    public function test_servicos_padrao_so_quando_nao_ha_nenhum(): void
    {
        $this->postJson('/api/onboarding/servicos-padrao')->assertCreated();
        $this->assertSame(4, Service::where('barbershop_id', $this->bs->id)->count());

        $this->postJson('/api/onboarding/servicos-padrao')->assertStatus(422);
        $this->assertSame(4, Service::where('barbershop_id', $this->bs->id)->count());
    }
}
