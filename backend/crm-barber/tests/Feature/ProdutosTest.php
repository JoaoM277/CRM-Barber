<?php

namespace Tests\Feature;

use App\Models\Barbershop;
use App\Models\Product;
use App\Models\Schedule;
use App\Models\User;
use App\Models\Worker;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** Produtos vendidos no atendimento, estoque e reflexo no financeiro. */
class ProdutosTest extends TestCase
{
    use RefreshDatabase;

    private Barbershop $bs;

    private Worker $worker;

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow('2026-10-08 12:00:00');
        $this->bs = Barbershop::factory()->create();
        $this->worker = Worker::factory()->create(['barbershop_id' => $this->bs->id, 'active' => true]);
        $this->admin();
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function admin(): void
    {
        Sanctum::actingAs(User::factory()->admin()->create(['barbershop_id' => $this->bs->id]));
    }

    private function produto(array $over = []): Product
    {
        return Product::factory()->create(['barbershop_id' => $this->bs->id, 'price' => 35, 'stock' => 10, 'commission_percent' => 10] + $over);
    }

    private function atendimento(array $over = []): Schedule
    {
        return Schedule::factory()->create([
            'barbershop_id' => $this->bs->id, 'worker_id' => $this->worker->id,
            'date' => '2026-10-08', 'price' => 50, 'commission_value' => 20, 'status' => Schedule::STATUS_PENDENTE,
        ] + $over);
    }

    private function vender(Schedule $s, array $itens)
    {
        return $this->putJson("/api/agendamentos/{$s->id}/produtos", [
            'itens' => collect($itens)->map(fn ($q, $id) => ['produto_id' => $id, 'quantidade' => $q])->values()->all(),
        ]);
    }

    public function test_cadastro_com_estoque_inicial_e_so_admin_gerencia(): void
    {
        $id = $this->postJson('/api/produtos', ['name' => 'Pomada', 'price' => 39.9, 'stock' => 12, 'stock_min' => 3, 'commission_percent' => 10])
            ->assertCreated()->assertJsonPath('stock', 12)->json('id');

        $this->getJson("/api/produtos/{$id}/movimentos")->assertOk()
            ->assertJsonPath('0.quantidade', 12)->assertJsonPath('0.motivo', 'entrada');

        // o saldo não muda pela edição, só por entrada/ajuste
        $this->putJson("/api/produtos/{$id}", ['stock' => 99])->assertStatus(422);

        Sanctum::actingAs(User::factory()->create(['barbershop_id' => $this->bs->id, 'role' => 'user']));
        $this->getJson('/api/produtos?ativos=1')->assertOk()->assertJsonCount(1);
        $this->postJson('/api/produtos', ['name' => 'X', 'price' => 1])->assertForbidden();
    }

    public function test_venda_no_atendimento_mexe_no_estoque_e_congela_o_preco(): void
    {
        $p = $this->produto();
        $s = $this->atendimento();

        $this->vender($s, [$p->id => 2])->assertOk()->assertJsonPath('produtos.0.total', 70.0);
        $this->assertSame(8, $p->fresh()->stock);

        // preço muda depois da venda: o item já vendido mantém o preço
        $p->update(['price' => 50]);
        $this->vender($s, [$p->id => 1])->assertOk()->assertJsonPath('produtos.0.preco', 35.0);
        $this->assertSame(9, $p->fresh()->stock);

        $this->vender($s, [])->assertOk()->assertJsonCount(0, 'produtos');
        $this->assertSame(10, $p->fresh()->stock);

        $motivos = $p->movements()->orderBy('id')->pluck('quantity')->all();
        $this->assertSame([-2, 1, 1], $motivos);
    }

    public function test_cancelar_devolve_o_estoque_e_cancelado_nao_recebe_produto(): void
    {
        $p = $this->produto();
        $s = $this->atendimento();
        $this->vender($s, [$p->id => 3])->assertOk();

        $this->putJson("/api/agendamentos/{$s->id}", ['status' => Schedule::STATUS_CANCELADO])->assertOk();

        $this->assertSame(10, $p->fresh()->stock);
        $this->vender($s, [$p->id => 1])->assertStatus(422);
    }

    public function test_entrada_e_ajuste_de_estoque(): void
    {
        $p = $this->produto(['stock' => 1, 'stock_min' => 2]);
        $this->assertTrue($p->estoque_baixo);

        $this->postJson("/api/produtos/{$p->id}/estoque", ['motivo' => 'entrada', 'quantidade' => 6])->assertOk()->assertJsonPath('produto.stock', 7);
        $this->postJson("/api/produtos/{$p->id}/estoque", ['motivo' => 'ajuste', 'quantidade' => -2, 'observacao' => 'contagem'])->assertOk()->assertJsonPath('produto.stock', 5);
        $this->postJson("/api/produtos/{$p->id}/estoque", ['motivo' => 'entrada', 'quantidade' => -1])->assertStatus(422);
    }

    public function test_produtos_entram_no_faturamento_comissao_e_repasse(): void
    {
        $p = $this->produto();
        $s = $this->atendimento();
        $this->vender($s, [$p->id => 2])->assertOk(); // 70 em produtos, 7 de comissão
        $s->update(['status' => Schedule::STATUS_CONCLUIDO]);

        $r = $this->getJson('/api/faturamento?inicio=2026-10-01&fim=2026-10-31')->assertOk()
            ->assertJsonPath('periodo.faturamento_servicos', 50.0)
            ->assertJsonPath('periodo.faturamento_produtos', 70.0)
            ->assertJsonPath('periodo.faturamento_total', 120.0)
            ->assertJsonPath('por_produto.0.quantidade', 2)
            ->assertJsonPath('por_profissional.0.produtos', 70.0);
        $this->assertEquals(27, $r->json('por_profissional.0.comissao'));
        $this->assertEquals(120, $r->json('dia'));

        $this->postJson('/api/payouts', ['worker_id' => $this->worker->id, 'inicio' => '2026-10-01', 'fim' => '2026-10-31'])->assertCreated();
        $this->assertDatabaseHas('payouts', ['worker_id' => $this->worker->id, 'total_comissao' => 27, 'total_bruto' => 120]);
    }

    public function test_produto_de_outra_barbearia_nao_entra(): void
    {
        $alheio = Product::factory()->create();
        $s = $this->atendimento();

        $this->vender($s, [$alheio->id => 1])->assertStatus(422);
        $this->putJson("/api/produtos/{$alheio->id}", ['price' => 1])->assertNotFound();
    }
}
