<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Barbershop;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use App\Support\PlatformSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PlatformAdminTest extends TestCase
{
    use RefreshDatabase;

    private User $root;

    private Barbershop $bs;

    private User $dono;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'billing.asaas.api_key' => 'test-key',
            'billing.asaas.base_url' => 'https://asaas.test/v3',
        ]);

        $this->root = User::factory()->create([
            'barbershop_id' => null, 'role' => User::ROLE_SUPER_ADMIN, 'email' => 'root@plataforma.test',
        ]);
        $this->bs = Barbershop::factory()->create(['name' => 'Barbearia Alvo', 'slug' => 'alvo']);
        $this->dono = User::factory()->admin()->create(['barbershop_id' => $this->bs->id, 'email' => 'dono@alvo.test']);
    }

    private function sub(Barbershop $bs, array $attrs = [], string $plan = 'pro'): Subscription
    {
        return Subscription::create(array_merge([
            'barbershop_id' => $bs->id,
            'plan_id' => Plan::where('slug', $plan)->value('id'),
            'status' => Subscription::STATUS_TRIALING,
            'trial_ends_at' => now()->addDays(10),
        ], $attrs));
    }

    // ------------------------------------------------------------ acesso

    public function test_so_super_admin_entra_no_painel_universal(): void
    {
        Sanctum::actingAs($this->dono);
        $this->getJson('/api/plataforma/metricas')->assertForbidden();

        Sanctum::actingAs($this->root);
        $this->getJson('/api/plataforma/metricas')->assertOk();
    }

    public function test_super_admin_nao_acessa_rotas_de_barbearia(): void
    {
        Sanctum::actingAs($this->root);
        $this->getJson('/api/servicos')->assertForbidden();
    }

    public function test_login_do_super_admin_tem_sessao_curta(): void
    {
        $this->root->update(['password' => 'senha-forte-123']);

        $this->postJson('/api/login', ['email' => 'root@plataforma.test', 'password' => 'senha-forte-123'])
            ->assertOk()
            ->assertJsonPath('user.role', 'super_admin');

        $this->assertTrue($this->root->tokens()->first()->expires_at->lte(now()->addHours(12)));
    }

    // ------------------------------------------------------------ métricas

    public function test_metricas_contam_so_pagantes_no_mrr(): void
    {
        $this->sub($this->bs, [
            'status' => Subscription::STATUS_ACTIVE, 'asaas_subscription_id' => 'sub_1',
            'current_period_ends_at' => now()->addDays(20),
        ], 'pro'); // 99,90
        $outra = Barbershop::factory()->create();
        $this->sub($outra, ['status' => Subscription::STATUS_ACTIVE, 'current_period_ends_at' => now()->addDays(5)], 'premium'); // cortesia, sem gateway
        $this->sub(Barbershop::factory()->create()); // trial

        Sanctum::actingAs($this->root);
        $this->getJson('/api/plataforma/metricas')
            ->assertOk()
            ->assertJsonPath('mrr', 99.9)
            ->assertJsonPath('situacao.pagantes', 1)
            ->assertJsonPath('situacao.em_teste', 1)
            ->assertJsonPath('barbearias_total', 3)
            ->assertJsonCount(30, 'cadastros_30d');
    }

    // ------------------------------------------------------------ barbearias

    public function test_lista_busca_e_filtra_por_situacao(): void
    {
        $this->sub($this->bs, ['trial_ends_at' => now()->subDay()]); // modo leitura
        $this->sub(Barbershop::factory()->create(['name' => 'Outra Loja']));

        Sanctum::actingAs($this->root);

        $this->getJson('/api/plataforma/barbearias?busca=dono@alvo')
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.nome', 'Barbearia Alvo')
            ->assertJsonPath('data.0.dono.email', 'dono@alvo.test');

        $this->getJson('/api/plataforma/barbearias?situacao=modo_leitura')
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.acesso', 'read_only');
    }

    public function test_conceder_dias_estende_o_trial(): void
    {
        $sub = $this->sub($this->bs, ['trial_ends_at' => now()->subDay()]);
        Sanctum::actingAs($this->root);

        $this->postJson("/api/plataforma/barbearias/{$this->bs->id}/dias", ['dias' => 7])
            ->assertOk()
            ->assertJsonPath('assinatura.acesso', 'full');

        $this->assertTrue($sub->fresh()->trial_ends_at->isSameDay(now()->addDays(7)));
        $this->assertTrue(AuditLog::withoutTenantScope()->where('barbershop_id', $this->bs->id)
            ->where('action', 'plataforma.dias_concedidos')->exists());
    }

    public function test_conceder_dias_tira_pagante_do_atraso(): void
    {
        $sub = $this->sub($this->bs, [
            'status' => Subscription::STATUS_PAST_DUE, 'current_period_ends_at' => now()->subDays(10),
            'past_due_since' => now()->subDays(10), 'asaas_subscription_id' => 'sub_1',
        ]);
        Sanctum::actingAs($this->root);

        $this->postJson("/api/plataforma/barbearias/{$this->bs->id}/dias", ['dias' => 15])->assertOk();

        $sub->refresh();
        $this->assertSame(Subscription::STATUS_ACTIVE, $sub->status);
        $this->assertTrue($sub->hasFullAccess());
    }

    public function test_trocar_plano_atualiza_o_valor_no_asaas(): void
    {
        $this->sub($this->bs, ['status' => Subscription::STATUS_ACTIVE, 'asaas_subscription_id' => 'sub_7', 'current_period_ends_at' => now()->addDays(9)]);
        Http::fake(['asaas.test/v3/subscriptions/sub_7' => Http::response(['id' => 'sub_7'])]);
        Sanctum::actingAs($this->root);

        $this->putJson("/api/plataforma/barbearias/{$this->bs->id}/plano", ['plano' => 'premium'])
            ->assertOk()
            ->assertJsonPath('assinatura.plano.slug', 'premium');

        Http::assertSent(fn (HttpRequest $r) => $r->method() === 'PUT' && $r['value'] == 179.9);
    }

    public function test_suspender_derruba_sessoes_e_bloqueia_painel_e_site(): void
    {
        $this->sub($this->bs);
        $this->dono->createToken('auth-token');
        Sanctum::actingAs($this->root);

        $this->postJson("/api/plataforma/barbearias/{$this->bs->id}/suspender")->assertOk();

        $this->assertFalse($this->bs->fresh()->active);
        $this->assertSame(0, $this->dono->tokens()->count());
        $this->getJson('/api/b/alvo/servicos')->assertNotFound();

        Sanctum::actingAs($this->dono->fresh());
        $this->getJson('/api/servicos')->assertForbidden()->assertJsonPath('code', 'account_suspended');
    }

    // ------------------------------------------------------------ acesso de suporte

    public function test_acesso_de_suporte_entra_como_o_dono_com_restricoes(): void
    {
        $this->sub($this->bs);
        Sanctum::actingAs($this->root);

        $token = $this->postJson("/api/plataforma/barbearias/{$this->bs->id}/acessar")
            ->assertOk()
            ->json('token');

        $pat = $this->dono->tokens()->first();
        $this->assertStringStartsWith(User::SUPPORT_TOKEN_PREFIX, $pat->name);
        $this->assertTrue($pat->expires_at->lte(now()->addHours(2)));
        $this->assertTrue(AuditLog::withoutTenantScope()->where('action', 'plataforma.acesso_suporte')->exists());

        // usa o token de verdade (sem Sanctum::actingAs) para o currentAccessToken ser o de suporte
        $this->app['auth']->forgetGuards();
        $headers = ['Authorization' => "Bearer {$token}"];

        $this->getJson('/api/me', $headers)
            ->assertOk()
            ->assertJsonPath('email', 'dono@alvo.test')
            ->assertJsonPath('suporte', true);

        $this->getJson('/api/servicos', $headers)->assertOk();

        $this->putJson('/api/me/senha', ['senha_atual' => 'x', 'nova_senha' => 'y'], $headers)
            ->assertForbidden()
            ->assertJsonPath('code', 'support_restricted');

        $this->deleteJson('/api/assinatura', [], $headers)
            ->assertForbidden()
            ->assertJsonPath('code', 'support_restricted');
    }

    // ------------------------------------------------------------ configurações

    public function test_configuracoes_alteram_trial_de_novos_cadastros(): void
    {
        Sanctum::actingAs($this->root);
        $this->putJson('/api/plataforma/configuracoes', ['trial_days' => 30, 'trial_plan' => 'pro'])
            ->assertOk()
            ->assertJsonPath('configuracoes.trial_days', 30);

        $this->postJson('/api/cadastrar', [
            'name' => 'Novo', 'email' => 'novo@loja.test', 'password' => 'segredo123', 'barbershop_name' => 'Loja Nova',
        ])->assertCreated();

        $sub = Subscription::with('plan')->latest('id')->first();
        $this->assertSame('pro', $sub->plan->slug);
        $this->assertTrue($sub->trial_ends_at->isSameDay(now()->addDays(30)));
    }

    public function test_cadastro_fechado_recusa_novas_barbearias(): void
    {
        PlatformSettings::set(['signup_open' => false]);

        $this->postJson('/api/cadastrar', [
            'name' => 'Novo', 'email' => 'novo2@loja.test', 'password' => 'segredo123', 'barbershop_name' => 'Loja X',
        ])->assertForbidden()->assertJsonPath('code', 'signup_closed');
    }

    public function test_editar_plano(): void
    {
        Sanctum::actingAs($this->root);
        $plano = Plan::where('slug', 'basico')->first();

        $this->putJson("/api/plataforma/planos/{$plano->id}", ['price_cents' => 5990, 'max_workers' => 3, 'features' => ['whatsapp']])
            ->assertOk();

        $plano->refresh();
        $this->assertSame(5990, $plano->price_cents);
        $this->assertSame(3, $plano->max_workers);
        $this->assertSame(['whatsapp'], $plano->features);
    }

    public function test_comando_cria_admin_da_plataforma(): void
    {
        $this->artisan('plataforma:admin', ['email' => 'novo@plataforma.test'])
            ->expectsOutputToContain('Administrador criado')
            ->assertSuccessful();

        $this->assertTrue(User::where('email', 'novo@plataforma.test')->first()->isSuperAdmin());

        // não transforma usuário de barbearia em super admin
        $this->artisan('plataforma:admin', ['email' => 'dono@alvo.test'])->assertFailed();
    }
}
