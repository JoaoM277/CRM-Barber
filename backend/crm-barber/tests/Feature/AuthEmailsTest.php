<?php

namespace Tests\Feature;

use App\Models\Barbershop;
use App\Models\BillingEvent;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use App\Notifications\PaymentOverdueNotification;
use App\Notifications\ResetPasswordNotification;
use App\Notifications\TrialEndingNotification;
use App\Notifications\WelcomeNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class AuthEmailsTest extends TestCase
{
    use RefreshDatabase;

    private function cadastro(array $over = []): array
    {
        return array_merge([
            'name' => 'Dona', 'email' => 'dona@nova.test', 'password' => 'segredo123',
            'barbershop_name' => 'Barbearia Nova', 'aceite_termos' => true,
        ], $over);
    }

    // ------------------------------------------------------------ cadastro

    public function test_cadastro_exige_aceite_dos_termos(): void
    {
        $this->postJson('/api/cadastrar', $this->cadastro(['aceite_termos' => false]))
            ->assertStatus(422)
            ->assertJsonValidationErrors('aceite_termos');
    }

    public function test_cadastro_grava_aceite_e_manda_boas_vindas(): void
    {
        Notification::fake();

        $this->postJson('/api/cadastrar', $this->cadastro())->assertCreated();

        $user = User::where('email', 'dona@nova.test')->first();
        $this->assertNotNull($user->terms_accepted_at);
        Notification::assertSentTo($user, WelcomeNotification::class);
    }

    // ------------------------------------------------------------ esqueci minha senha

    public function test_esqueci_senha_manda_link_e_nao_revela_se_a_conta_existe(): void
    {
        Notification::fake();
        $user = User::factory()->admin()->create(['email' => 'dono@loja.test', 'barbershop_id' => Barbershop::factory()->create()->id]);

        $existe = $this->postJson('/api/senha/esqueci', ['email' => 'dono@loja.test'])->assertOk()->json('message');
        $naoExiste = $this->postJson('/api/senha/esqueci', ['email' => 'ninguem@loja.test'])->assertOk()->json('message');

        $this->assertSame($existe, $naoExiste);
        Notification::assertSentTo($user, ResetPasswordNotification::class, function ($n) use ($user) {
            $mail = $n->toMail($user);

            return str_contains($mail->actionUrl, '/redefinir-senha.html?token=')
                && str_contains($mail->actionUrl, urlencode('dono@loja.test'));
        });
    }

    public function test_redefinir_senha_com_token_valido_troca_e_derruba_sessoes(): void
    {
        Notification::fake();
        $user = User::factory()->admin()->create(['email' => 'dono@loja.test', 'barbershop_id' => Barbershop::factory()->create()->id]);
        $user->createToken('sessao-antiga');

        $this->postJson('/api/senha/esqueci', ['email' => 'dono@loja.test']);
        $token = null;
        Notification::assertSentTo($user, ResetPasswordNotification::class, function ($n) use (&$token) {
            $token = $n->token;

            return true;
        });

        $this->postJson('/api/senha/redefinir', [
            'email' => 'dono@loja.test', 'token' => $token,
            'password' => 'novaSenha123', 'password_confirmation' => 'novaSenha123',
        ])->assertOk();

        $this->assertSame(0, $user->tokens()->count());
        $this->postJson('/api/login', ['email' => 'dono@loja.test', 'password' => 'novaSenha123'])->assertOk();
    }

    public function test_redefinir_senha_com_token_invalido_falha(): void
    {
        User::factory()->create(['email' => 'dono@loja.test', 'barbershop_id' => Barbershop::factory()->create()->id]);

        $this->postJson('/api/senha/redefinir', [
            'email' => 'dono@loja.test', 'token' => 'inventado',
            'password' => 'novaSenha123', 'password_confirmation' => 'novaSenha123',
        ])->assertStatus(422);
    }

    // ------------------------------------------------------------ avisos de cobrança

    private function lojaComTrial(array $sub): array
    {
        $bs = Barbershop::factory()->create();
        $dono = User::factory()->admin()->create(['barbershop_id' => $bs->id]);
        $s = Subscription::create(array_merge([
            'barbershop_id' => $bs->id,
            'plan_id' => Plan::where('slug', 'premium')->value('id'),
            'status' => Subscription::STATUS_TRIALING,
        ], $sub));

        return [$dono, $s];
    }

    public function test_aviso_de_fim_do_teste_sai_uma_vez(): void
    {
        Notification::fake();
        [$acabando] = $this->lojaComTrial(['trial_ends_at' => now()->addDays(2)]);
        [$acabou] = $this->lojaComTrial(['trial_ends_at' => now()->subDay()]);
        [$longe] = $this->lojaComTrial(['trial_ends_at' => now()->addDays(10)]);

        $this->artisan('billing:notify')->assertSuccessful();
        $this->artisan('billing:notify')->assertSuccessful(); // 2ª rodada não repete

        Notification::assertSentToTimes($acabando, TrialEndingNotification::class, 1);
        Notification::assertSentTo($acabou, TrialEndingNotification::class, fn ($n) => $n->ended);
        Notification::assertSentToTimes($acabou, TrialEndingNotification::class, 1);
        Notification::assertNotSentTo($longe, TrialEndingNotification::class);
    }

    public function test_quem_ja_escolheu_plano_nao_recebe_aviso_de_fim_do_teste(): void
    {
        Notification::fake();
        [$dono] = $this->lojaComTrial(['trial_ends_at' => now()->addDay(), 'asaas_subscription_id' => 'sub_1']);

        $this->artisan('billing:notify');

        Notification::assertNotSentTo($dono, TrialEndingNotification::class);
    }

    public function test_fatura_vencida_avisa_o_dono_uma_vez(): void
    {
        Notification::fake();
        config(['billing.asaas.webhook_token' => 'whk']);
        [$dono] = $this->lojaComTrial([
            'status' => Subscription::STATUS_ACTIVE, 'asaas_subscription_id' => 'sub_1',
            'current_period_ends_at' => now()->subDay(),
        ]);
        $payment = ['id' => 'pay_1', 'subscription' => 'sub_1', 'value' => 99.9, 'status' => 'OVERDUE', 'dueDate' => now()->subDay()->toDateString(), 'invoiceUrl' => 'https://asaas.test/i/1'];

        $this->postJson('/api/webhooks/asaas', ['id' => 'evt_a', 'event' => 'PAYMENT_OVERDUE', 'payment' => $payment], ['asaas-access-token' => 'whk'])->assertOk();
        // mesmo evento com outro id (o Asaas reenvia) — não manda de novo
        $this->postJson('/api/webhooks/asaas', ['id' => 'evt_b', 'event' => 'PAYMENT_OVERDUE', 'payment' => $payment], ['asaas-access-token' => 'whk'])->assertOk();

        $this->assertSame(2, BillingEvent::whereNotNull('processed_at')->count());
        Notification::assertSentToTimes($dono, PaymentOverdueNotification::class, 1);
    }
}
