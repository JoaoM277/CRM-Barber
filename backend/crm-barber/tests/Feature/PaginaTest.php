<?php

namespace Tests\Feature;

use App\Models\Barbershop;
use App\Models\BarbershopPhoto;
use App\Models\Plan;
use App\Models\Service;
use App\Models\Subscription;
use App\Models\User;
use App\Models\Worker;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** Personalização da página de agendamento (planos Pro/Premium). */
class PaginaTest extends TestCase
{
    use RefreshDatabase;

    private Barbershop $bs;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
        $this->bs = Barbershop::factory()->create([
            'slug' => 'loja', 'instagram' => '@alpha.barber', 'whatsapp' => '(11) 98765-4321',
            'street' => 'Rua das Flores', 'number' => '10', 'neighborhood' => 'Centro', 'city' => 'São Paulo', 'state' => 'SP',
        ]);
        Sanctum::actingAs(User::factory()->admin()->create(['barbershop_id' => $this->bs->id]));
    }

    private function assinar(string $plano): void
    {
        Subscription::create([
            'barbershop_id' => $this->bs->id,
            'plan_id' => Plan::where('slug', $plano)->value('id'),
            'status' => Subscription::STATUS_ACTIVE,
        ]);
    }

    public function test_recurso_entra_nos_planos_pro_e_premium(): void
    {
        $this->assertFalse(Plan::where('slug', 'basico')->first()->hasFeature(Plan::FEATURE_PERSONALIZACAO));
        $this->assertTrue(Plan::where('slug', 'pro')->first()->hasFeature(Plan::FEATURE_PERSONALIZACAO));
        $this->assertTrue(Plan::where('slug', 'premium')->first()->hasFeature(Plan::FEATURE_PERSONALIZACAO));
    }

    public function test_plano_basico_fica_no_visual_padrao(): void
    {
        $this->assinar('basico');
        Service::factory()->create(['barbershop_id' => $this->bs->id, 'active' => true, 'categoria' => 'Cabelo', 'destaque' => 'novo']);

        $this->getJson('/api/pagina')->assertForbidden()->assertJsonPath('code', 'plan_feature');
        $this->getJson('/api/b/loja/barbearia')->assertOk()->assertJsonPath('pagina', null);
        $this->getJson('/api/b/loja/servicos')->assertOk()->assertJsonPath('0.categoria', null)->assertJsonPath('0.destaque', null);
    }

    public function test_salvar_estilo_e_textos_e_a_pagina_publica_recebe(): void
    {
        $this->assinar('pro');

        $this->putJson('/api/pagina', ['estilo' => 'neon'])->assertStatus(422);
        $this->putJson('/api/pagina', [
            'estilo' => 'urbano', 'fonte' => 'bebas', 'modo' => 'escuro', 'textura' => 'concreto',
            'boas_vindas' => 'Bora dar um tapa no visual?', 'sobre' => '  ', 'mostrar_endereco' => true,
        ])->assertOk()->assertJsonPath('pagina.estilo', 'urbano')->assertJsonPath('pagina.sobre', null);

        $this->getJson('/api/b/loja/barbearia')->assertOk()
            ->assertJsonPath('pagina.estilo', 'urbano')
            ->assertJsonPath('pagina.fonte', 'bebas')
            ->assertJsonPath('pagina.modo', 'escuro')
            ->assertJsonPath('pagina.boas_vindas', 'Bora dar um tapa no visual?')
            ->assertJsonPath('pagina.endereco', 'Rua das Flores 10, Centro, São Paulo - SP')
            ->assertJsonPath('pagina.instagram', 'https://instagram.com/alpha.barber')
            ->assertJsonPath('pagina.whatsapp', '5511987654321');

        // salvar em partes não apaga o resto; esconder o endereço tira o mapa
        $this->putJson('/api/pagina', ['mostrar_endereco' => false])->assertOk()->assertJsonPath('pagina.estilo', 'urbano');
        $this->getJson('/api/b/loja/barbearia')->assertJsonPath('pagina.endereco', null)->assertJsonPath('pagina.mapa_url', null);
    }

    public function test_capa_e_galeria(): void
    {
        $capa = $this->post('/api/pagina/capa', ['arquivo' => UploadedFile::fake()->image('capa.jpg', 2400, 1000)], ['Accept' => 'application/json'])
            ->assertOk()->json('pagina.capa_url');
        $this->assertNotNull($capa);
        $caminho = $this->bs->fresh()->pagina['capa_path'];
        Storage::disk('public')->assertExists($caminho);
        [$w, $h] = getimagesizefromstring(Storage::disk('public')->get($caminho));
        $this->assertSame([1600, 667], [$w, $h], 'mantém a proporção e reduz para 1600 px');

        $this->deleteJson('/api/pagina/capa')->assertOk()->assertJsonPath('pagina.capa_url', null);
        Storage::disk('public')->assertMissing($caminho);

        foreach (['a.jpg', 'b.jpg'] as $f) {
            $this->post('/api/pagina/galeria', ['arquivo' => UploadedFile::fake()->image($f, 800, 1000)], ['Accept' => 'application/json'])->assertCreated();
        }
        [$a, $b] = BarbershopPhoto::orderBy('ordem')->pluck('id')->all();
        $this->putJson('/api/pagina/galeria/ordem', ['ids' => [$b, $a]])->assertOk()->assertJsonPath('galeria.0.id', $b);
        $this->getJson('/api/b/loja/barbearia')->assertJsonPath('pagina.galeria.0.id', $b)->assertJsonCount(2, 'pagina.galeria');

        $this->deleteJson("/api/pagina/galeria/{$a}")->assertOk()->assertJsonCount(1, 'galeria');
    }

    public function test_galeria_tem_limite(): void
    {
        foreach (range(1, 12) as $i) {
            BarbershopPhoto::create(['barbershop_id' => $this->bs->id, 'path' => "galeria/{$this->bs->id}/x{$i}.webp", 'ordem' => $i]);
        }

        $this->post('/api/pagina/galeria', ['arquivo' => UploadedFile::fake()->image('c.jpg')], ['Accept' => 'application/json'])
            ->assertStatus(422)->assertJsonValidationErrors('arquivo');
    }

    public function test_servicos_com_categoria_destaque_foto_e_ordem(): void
    {
        $corte = Service::factory()->create(['barbershop_id' => $this->bs->id, 'active' => true, 'name' => 'Corte']);
        $barba = Service::factory()->create(['barbershop_id' => $this->bs->id, 'active' => true, 'name' => 'Barba']);

        $this->putJson("/api/servicos/{$corte->id}", ['categoria' => 'Cabelo', 'destaque' => 'mais_pedido'])->assertOk();
        $this->putJson("/api/servicos/{$corte->id}", ['destaque' => 'top'])->assertStatus(422);
        $this->putJson('/api/pagina/servicos/ordem', ['ids' => [$corte->id, $barba->id]])->assertOk();
        $this->post("/api/servicos/{$corte->id}/foto", ['arquivo' => UploadedFile::fake()->image('corte.jpg', 600, 600)], ['Accept' => 'application/json'])->assertOk();

        $this->getJson('/api/b/loja/servicos')->assertOk()
            ->assertJsonPath('0.name', 'Corte')
            ->assertJsonPath('0.categoria', 'Cabelo')
            ->assertJsonPath('0.destaque', 'mais_pedido')
            ->assertJsonPath('1.name', 'Barba');
        $this->assertNotNull($corte->fresh()->photo);
    }

    public function test_bio_e_instagram_do_profissional(): void
    {
        $w = Worker::factory()->create(['barbershop_id' => $this->bs->id, 'active' => true]);

        $this->putJson("/api/profissionais/{$w->id}", ['bio' => '10 anos de navalha', 'instagram' => 'https://www.instagram.com/leo.cortes/'])->assertOk();

        $this->getJson('/api/b/loja/profissionais')->assertOk()
            ->assertJsonPath('0.bio', '10 anos de navalha')
            ->assertJsonPath('0.instagram', 'https://instagram.com/leo.cortes');
        $this->assertArrayNotHasKey('pix_key', $this->getJson('/api/b/loja/profissionais')->json('0'));
    }
}
