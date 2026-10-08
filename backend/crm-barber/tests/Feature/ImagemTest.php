<?php

namespace Tests\Feature;

use App\Models\Barbershop;
use App\Models\User;
use App\Models\Worker;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ImagemTest extends TestCase
{
    use RefreshDatabase;

    private Barbershop $bs;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
        $this->bs = Barbershop::factory()->create(['slug' => 'loja']);
        Sanctum::actingAs(User::factory()->admin()->create(['barbershop_id' => $this->bs->id]));
    }

    public function test_logo_vira_webp_quadrado_e_aparece_na_pagina_publica(): void
    {
        $this->post('/api/barbearia/logo', ['arquivo' => UploadedFile::fake()->image('logo.png', 1200, 800)], ['Accept' => 'application/json'])
            ->assertOk();

        $caminho = $this->bs->fresh()->logo_path;
        $this->assertMatchesRegularExpression('#^logos/\d+/[0-9a-f-]+\.webp$#', $caminho);
        Storage::disk('public')->assertExists($caminho);
        [$w, $h] = getimagesizefromstring(Storage::disk('public')->get($caminho));
        $this->assertSame([512, 512], [$w, $h]);

        $this->getJson('/api/b/loja/barbearia')->assertOk()->assertJsonPath('logo_url', Storage::disk('public')->url($caminho));
    }

    public function test_trocar_logo_apaga_o_anterior(): void
    {
        $this->post('/api/barbearia/logo', ['arquivo' => UploadedFile::fake()->image('a.jpg', 600, 600)], ['Accept' => 'application/json']);
        $antigo = $this->bs->fresh()->logo_path;
        $this->post('/api/barbearia/logo', ['arquivo' => UploadedFile::fake()->image('b.jpg', 600, 600)], ['Accept' => 'application/json']);

        Storage::disk('public')->assertMissing($antigo);
        Storage::disk('public')->assertExists($this->bs->fresh()->logo_path);
    }

    public function test_recusa_arquivo_que_nao_e_imagem(): void
    {
        $this->post('/api/barbearia/logo', ['arquivo' => UploadedFile::fake()->create('virus.php', 10, 'text/x-php')], ['Accept' => 'application/json'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('arquivo');
    }

    public function test_foto_do_profissional_e_publica_e_reduzida(): void
    {
        $w = Worker::factory()->create(['barbershop_id' => $this->bs->id, 'active' => true]);

        $this->post("/api/profissionais/{$w->id}/foto", ['arquivo' => UploadedFile::fake()->image('eu.jpg', 2000, 3000)], ['Accept' => 'application/json'])
            ->assertOk();

        $foto = $w->fresh()->photo;
        $this->assertStringStartsWith(Storage::disk('public')->url('profissionais/'), $foto);
        $this->getJson('/api/b/loja/profissionais')->assertJsonPath('0.photo', $foto);

        $this->deleteJson("/api/profissionais/{$w->id}/foto")->assertOk();
        $this->assertNull($w->fresh()->photo);
    }

    public function test_nao_troca_foto_de_profissional_de_outra_barbearia(): void
    {
        $outro = Worker::factory()->create(['barbershop_id' => Barbershop::factory()->create()->id]);

        $this->post("/api/profissionais/{$outro->id}/foto", ['arquivo' => UploadedFile::fake()->image('x.jpg')], ['Accept' => 'application/json'])
            ->assertNotFound();
    }
}
