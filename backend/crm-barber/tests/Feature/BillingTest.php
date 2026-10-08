<?php

namespace Tests\Feature;

use App\Models\BillingEvent;
use App\Models\Barbershop;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use App\Models\Worker;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class BillingTest extends TestCase
{
    use RefreshDatabase;

    private Barbershop $bs;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'billing.asaas.api_key' => 'test-key',
            'billing.asaas.webhook_token' => 'whk-secret',
            'billing.asaas.base_url' => 'https://asaas.test/v3',
        ]);

        $this->bs = Barbershop::factory()->create(['slug' => 'loja-billing']);
        $this->admin = User::factory()->admin()->create(['barbershop_id' => $this->bs->id]);
    }

    private function sub(array $attrs = [], string $plan = 'premium'): Subscription
    {
        return Subscription::create(array_merge([
            'barbershop_id' => $this->bs->id,
            'plan_id' => Plan::where('slug', $plan)->value('id'),
            'status' => Subscription::STATUS_TRIALING,
            'trial_ends_at' => now()->addDays(10),
        ], $attrs));
    }

    private function webhook(array $payload, string $token = 'whk-secret')
    {
        return $this->postJson('/api/webhooks/asaas', $payload, ['asaas-access-token' => $token]);
    }

    // ------------------------------------------------------------ planos / trial

    public function test_migration_cria_os_tres_planos(): void
    {
        $this->getJson('/api/planos')
            ->assertOk()
            ->assertJsonCount(3)
            ->assertJsonPath('0.slug', 'basico')
            ->assertJsonPath('2.max_profissionais', null);
    }

    public function test_cadastro_novo_nasce_em_trial_de_14_dias_no_premium(): void
    {
        $this->postJson('/api/cadastrar', [
            'name' => 'Dono', 'email' => 'dono@novo.test', 'password' => 'segredo123',
            'barbershop_name' => 'Barbearia Nova', 'aceite_termos' => true,
        ])->assertCreated();

        $sub = Subscription::with('plan')->latest('id')->first();
        $this->assertSame(Subscription::STATUS_TRIALING, $sub->status);
        $this->assertSame('premium', $sub->plan->slug);
        $this->assertEqualsWithDelta(now()->addDays(14)->timestamp, $sub->trial_ends_at->timestamp, 5);
    }

    // ------------------------------------------------------------ modo leitura

    public function test_trial_vencido_deixa_painel_so_leitura(): void
    {
        $this->sub(['trial_ends_at' => now()->subDay()]);
        Sanctum::actingAs($this->admin);

        $this->getJson('/api/servicos')->assertOk();
        $this->postJson('/api/servicos', ['name' => 'Corte', 'price' => 30, 'duration_time' => 30])
            ->assertStatus(402)
            ->assertJsonPath('code', 'subscription_inactive');
    }

    public function test_modo_leitura_ainda_permite_ver_e_pagar_a_assinatura(): void
    {
        $this->sub(['trial_ends_at' => now()->subDay()]);
        Sanctum::actingAs($this->admin);

        $this->getJson('/api/assinatura')->assertOk()->assertJsonPath('assinatura.acesso', 'read_only');
        $this->postJson('/api/assinatura', ['plano' => 'pro', 'forma_pagamento' => 'PIX'])
            ->assertStatus(422) // falta CPF/CNPJ — passou do bloqueio 402
            ->assertJsonValidationErrors('cpf_cnpj');
    }

    public function test_atraso_dentro_da_carencia_mantem_acesso_e_depois_bloqueia(): void
    {
        $sub = $this->sub([
            'status' => Subscription::STATUS_PAST_DUE,
            'current_period_ends_at' => now()->subDays(3),
            'past_due_since' => now()->subDays(3),
        ]);
        $this->assertTrue($sub->hasFullAccess());
        $this->assertTrue($sub->isInGrace());

        $sub->update(['past_due_since' => now()->subDays(8)]);
        $this->assertFalse($sub->fresh()->hasFullAccess());
        // já pagou antes: o site público continua aceitando agendamento
        $this->assertTrue($sub->fresh()->acceptsPublicBookings());
    }

    public function test_trial_vencido_sem_pagamento_nao_ganha_carencia_nem_agendamento_publico(): void
    {
        $sub = $this->sub([
            'status' => Subscription::STATUS_PAST_DUE,
            'trial_ends_at' => now()->subDays(2),
            'past_due_since' => now()->subDay(),
        ]);

        $this->assertFalse($sub->hasFullAccess());
        $this->assertFalse($sub->acceptsPublicBookings());
    }

    public function test_agendamento_publico_recusado_com_trial_vencido(): void
    {
        $this->sub(['trial_ends_at' => now()->subDay()]);

        $this->postJson('/api/b/loja-billing/agendamentos', [])
            ->assertStatus(403)
            ->assertJsonPath('code', 'booking_unavailable');
    }

    // ------------------------------------------------------------ recursos / limites

    public function test_plano_basico_nao_tem_financeiro(): void
    {
        $this->sub([], 'basico');
        Sanctum::actingAs($this->admin);

        $this->getJson('/api/faturamento')
            ->assertStatus(403)
            ->assertJsonPath('code', 'plan_feature');
    }

    public function test_limite_de_profissionais_do_plano(): void
    {
        $this->sub([], 'basico'); // até 2
        Worker::factory()->count(2)->create(['barbershop_id' => $this->bs->id]);
        Sanctum::actingAs($this->admin);

        $this->postJson('/api/profissionais', ['name' => 'Terceiro', 'phone' => '11999990000'])
            ->assertStatus(403)
            ->assertJsonPath('code', 'plan_limit');
    }

    // ------------------------------------------------------------ assinar / cancelar

    public function test_assinar_cria_cliente_e_assinatura_no_asaas_e_devolve_link(): void
    {
        $this->sub(['trial_ends_at' => now()->addDays(5)]);
        Http::fake([
            'asaas.test/v3/customers' => Http::response(['id' => 'cus_1']),
            'asaas.test/v3/subscriptions' => Http::response(['id' => 'sub_1']),
            'asaas.test/v3/subscriptions/sub_1/payments' => Http::response(['data' => [[
                'id' => 'pay_1', 'value' => 99.9, 'status' => 'PENDING', 'billingType' => 'PIX',
                'dueDate' => now()->addDays(5)->toDateString(), 'invoiceUrl' => 'https://asaas.test/i/pay_1',
            ]]]),
        ]);
        Sanctum::actingAs($this->admin);

        $this->postJson('/api/assinatura', [
            'plano' => 'pro', 'forma_pagamento' => 'PIX', 'cpf_cnpj' => '123.456.789-09',
        ])
            ->assertOk()
            ->assertJsonPath('link_pagamento', 'https://asaas.test/i/pay_1')
            ->assertJsonPath('assinatura.plano.slug', 'pro');

        Http::assertSent(function (HttpRequest $r) {
            return $r->url() === 'https://asaas.test/v3/subscriptions'
                && $r['customer'] === 'cus_1'
                && $r['value'] == 99.9
                && $r['cycle'] === 'MONTHLY'
                // assinou no meio do trial: 1ª cobrança só no fim do trial
                && $r['nextDueDate'] === now()->addDays(5)->toDateString()
                && $r->header('access_token')[0] === 'test-key';
        });

        $sub = Subscription::first();
        $this->assertSame('cus_1', $sub->asaas_customer_id);
        $this->assertSame('sub_1', $sub->asaas_subscription_id);
        $this->assertSame(1, $sub->payments()->count());
    }

    public function test_celular_vai_sem_o_55_e_se_for_recusado_cria_o_cliente_sem_ele(): void
    {
        $this->bs->update(['whatsapp' => '+55 (99) 98888-7777']);
        $this->sub();
        $tentativas = 0;
        Http::fake([
            'asaas.test/v3/customers' => function (HttpRequest $r) use (&$tentativas) {
                $tentativas++;

                return isset($r['mobilePhone'])
                    ? Http::response(['errors' => [['code' => 'invalid_mobilePhone', 'description' => 'O celular informado é inválido.']]], 400)
                    : Http::response(['id' => 'cus_2']);
            },
            'asaas.test/v3/subscriptions' => Http::response(['id' => 'sub_2']),
            'asaas.test/v3/subscriptions/sub_2/payments' => Http::response(['data' => []]),
        ]);
        Sanctum::actingAs($this->admin);

        $this->postJson('/api/assinatura', ['plano' => 'pro', 'forma_pagamento' => 'PIX', 'cpf_cnpj' => '10433218100'])
            ->assertOk();

        $this->assertSame(2, $tentativas);
        Http::assertSent(fn (HttpRequest $r) => str_ends_with($r->url(), '/customers') && ($r->data()['mobilePhone'] ?? null) === '99988887777');
        $this->assertSame('cus_2', Subscription::first()->asaas_customer_id);
    }

    public function test_downgrade_recusado_se_tiver_mais_profissionais_que_o_plano(): void
    {
        $this->sub();
        Worker::factory()->count(3)->create(['barbershop_id' => $this->bs->id]);
        Http::fake();
        Sanctum::actingAs($this->admin);

        $this->postJson('/api/assinatura', ['plano' => 'basico', 'forma_pagamento' => 'PIX', 'cpf_cnpj' => '12345678909'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('plano');
        Http::assertNothingSent();
    }

    public function test_erro_do_asaas_vira_mensagem_legivel(): void
    {
        $this->sub();
        Http::fake([
            'asaas.test/v3/customers' => Http::response(['errors' => [['code' => 'invalid_cpfCnpj', 'description' => 'O CPF/CNPJ informado é inválido.']]], 400),
        ]);
        Sanctum::actingAs($this->admin);

        $this->postJson('/api/assinatura', ['plano' => 'pro', 'forma_pagamento' => 'PIX', 'cpf_cnpj' => '11111111111'])
            ->assertStatus(422)
            ->assertJsonPath('code', 'gateway_error')
            ->assertJsonPath('message', 'O CPF/CNPJ informado é inválido.');
    }

    public function test_cancelar_remove_no_asaas_e_mantem_acesso_ate_o_fim_do_periodo(): void
    {
        $this->sub([
            'status' => Subscription::STATUS_ACTIVE,
            'current_period_ends_at' => now()->addDays(20),
            'asaas_subscription_id' => 'sub_9',
        ]);
        Http::fake(['asaas.test/v3/subscriptions/sub_9' => Http::response(['deleted' => true])]);
        Sanctum::actingAs($this->admin);

        $this->deleteJson('/api/assinatura')
            ->assertOk()
            ->assertJsonPath('assinatura.status', 'canceled')
            ->assertJsonPath('assinatura.acesso', 'full');

        Http::assertSent(fn (HttpRequest $r) => $r->method() === 'DELETE' && str_ends_with($r->url(), '/subscriptions/sub_9'));
    }

    public function test_usuario_comum_nao_mexe_na_assinatura(): void
    {
        $this->sub();
        Sanctum::actingAs(User::factory()->create(['barbershop_id' => $this->bs->id]));

        $this->getJson('/api/assinatura')->assertForbidden();
    }

    // ------------------------------------------------------------ webhook

    public function test_webhook_sem_token_valido_e_recusado(): void
    {
        $this->webhook(['id' => 'evt_x', 'event' => 'PAYMENT_CONFIRMED'], 'errado')->assertUnauthorized();
        $this->assertSame(0, BillingEvent::count());
    }

    public function test_pagamento_confirmado_ativa_a_assinatura(): void
    {
        $sub = $this->sub(['asaas_subscription_id' => 'sub_1', 'trial_ends_at' => now()->subDay()]);
        $due = now()->toDateString();

        $this->webhook([
            'id' => 'evt_1', 'event' => 'PAYMENT_CONFIRMED',
            'payment' => ['id' => 'pay_1', 'subscription' => 'sub_1', 'value' => 99.9, 'status' => 'CONFIRMED', 'dueDate' => $due],
        ])->assertOk();

        $sub->refresh();
        $this->assertSame(Subscription::STATUS_ACTIVE, $sub->status);
        $this->assertTrue($sub->hasFullAccess());
        $this->assertTrue($sub->current_period_ends_at->isSameDay(now()->addMonthNoOverflow()));
        $this->assertSame('CONFIRMED', $sub->payments()->first()->status);
    }

    public function test_webhook_repetido_e_processado_uma_vez(): void
    {
        $this->sub(['asaas_subscription_id' => 'sub_1']);
        $payload = [
            'id' => 'evt_dup', 'event' => 'PAYMENT_OVERDUE',
            'payment' => ['id' => 'pay_1', 'subscription' => 'sub_1', 'value' => 99.9, 'status' => 'OVERDUE', 'dueDate' => now()->subDay()->toDateString()],
        ];

        $this->webhook($payload)->assertOk();
        $this->webhook($payload)->assertOk()->assertJsonPath('message', 'Evento já recebido.');

        $this->assertSame(1, BillingEvent::count());
        $this->assertSame(Subscription::STATUS_PAST_DUE, Subscription::first()->status);
    }

    public function test_assinatura_removida_no_asaas_vira_cancelada(): void
    {
        $this->sub(['status' => Subscription::STATUS_ACTIVE, 'asaas_subscription_id' => 'sub_1', 'current_period_ends_at' => now()->addDays(3)]);

        $this->webhook(['id' => 'evt_del', 'event' => 'SUBSCRIPTION_DELETED', 'subscription' => ['id' => 'sub_1']])->assertOk();

        $this->assertSame(Subscription::STATUS_CANCELED, Subscription::first()->status);
    }
}
