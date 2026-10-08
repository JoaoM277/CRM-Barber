<?php

namespace Tests\Feature;

use App\Models\Barbershop;
use App\Models\Client;
use App\Models\Log;
use App\Models\Schedule;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class LgpdClienteTest extends TestCase
{
    use RefreshDatabase;

    private Barbershop $bs;

    protected function setUp(): void
    {
        parent::setUp();
        $this->bs = Barbershop::factory()->create();
    }

    private function clienteComHistorico(): Client
    {
        $c = Client::factory()->create(['barbershop_id' => $this->bs->id, 'name' => 'Maria Silva', 'phone' => '11988887777', 'email' => 'maria@ex.com', 'observation' => 'alérgica a X']);
        Schedule::factory()->create(['barbershop_id' => $this->bs->id, 'client_id' => $c->id, 'status' => Schedule::STATUS_CONCLUIDO, 'price' => 50, 'observation' => 'mora na rua Y']);
        Log::create(['action' => 'WHATSAPP_MENSAGE_SENT', 'client_id' => $c->id, 'description' => 'Olá Maria, 11988887777', 'ip' => '1.2.3.4']);

        return $c;
    }

    public function test_exporta_todos_os_dados_do_cliente(): void
    {
        $c = $this->clienteComHistorico();
        Sanctum::actingAs(User::factory()->admin()->create(['barbershop_id' => $this->bs->id]));

        $this->get("/api/clientes/{$c->id}/dados", ['Accept' => 'application/json'])
            ->assertOk()
            ->assertHeader('Content-Disposition', 'attachment; filename="dados-cliente-'.$c->id.'.json"')
            ->assertJsonPath('cliente.name', 'Maria Silva')
            ->assertJsonCount(1, 'atendimentos')
            ->assertJsonCount(1, 'mensagens');
    }

    public function test_anonimizar_apaga_dados_pessoais_e_mantem_o_faturamento(): void
    {
        $c = $this->clienteComHistorico();
        $outro = Client::factory()->create(['barbershop_id' => $this->bs->id]);
        Sanctum::actingAs(User::factory()->admin()->create(['barbershop_id' => $this->bs->id]));

        $this->postJson("/api/clientes/{$c->id}/anonimizar")->assertOk();
        $this->postJson("/api/clientes/{$outro->id}/anonimizar")->assertOk(); // dois anonimizados não colidem

        $linha = Client::withTrashed()->find($c->id);
        $this->assertSame('Cliente removido', $linha->name);
        $this->assertSame('anonimo-'.$c->id, $linha->getRawOriginal('phone'));
        $this->assertNull($linha->email);
        $this->assertNull($linha->observation);
        $this->assertNotNull($linha->deleted_at);

        $s = Schedule::where('client_id', $c->id)->first();
        $this->assertNull($s->observation);
        $this->assertEquals(50, $s->price);
        $this->assertNull(Log::where('client_id', $c->id)->first()->description);

        $this->getJson('/api/clientes')->assertJsonMissing(['name' => 'Maria Silva']);
    }

    public function test_so_admin_e_so_da_propria_barbearia(): void
    {
        $c = $this->clienteComHistorico();
        Sanctum::actingAs(User::factory()->create(['barbershop_id' => $this->bs->id, 'role' => User::ROLE_USER]));
        $this->postJson("/api/clientes/{$c->id}/anonimizar")->assertForbidden();

        Sanctum::actingAs(User::factory()->admin()->create(['barbershop_id' => Barbershop::factory()->create()->id]));
        $this->postJson("/api/clientes/{$c->id}/anonimizar")->assertNotFound();
    }
}
