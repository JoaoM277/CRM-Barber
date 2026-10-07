<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Cobrança da assinatura do SaaS (gateway Asaas).
 *
 * - plans: catálogo de planos (preço + limites/recursos). Os 3 planos padrão
 *   são inseridos aqui mesmo para a produção já nascer com eles; preço e
 *   limites podem ser ajustados direto na tabela.
 * - subscriptions: 1 por barbearia. Barbearias que já existem ganham um trial
 *   novo a partir de agora.
 * - subscription_payments: espelho local das cobranças do Asaas (faturas).
 * - billing_events: webhooks recebidos (idempotência + auditoria).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('plans', function (Blueprint $table) {
            $table->id();
            $table->string('slug')->unique();
            $table->string('name');
            $table->unsignedInteger('price_cents');
            // null = sem limite
            $table->unsignedInteger('max_workers')->nullable();
            // recursos liberados: ["whatsapp", "financeiro", ...]
            $table->json('features');
            $table->boolean('active')->default(true);
            $table->unsignedSmallInteger('sort')->default(0);
            $table->timestamps();
        });

        Schema::create('subscriptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('barbershop_id')->unique()->constrained()->cascadeOnDelete();
            $table->foreignId('plan_id')->constrained();
            // trialing | active | past_due | canceled
            $table->string('status', 20)->index();
            $table->timestamp('trial_ends_at')->nullable();
            // até quando o último pagamento confirmado cobre
            $table->timestamp('current_period_ends_at')->nullable();
            // vencimento da cobrança em atraso mais antiga (início da carência)
            $table->timestamp('past_due_since')->nullable();
            $table->timestamp('canceled_at')->nullable();
            $table->string('billing_type', 20)->nullable();
            $table->string('asaas_customer_id')->nullable()->index();
            $table->string('asaas_subscription_id')->nullable()->unique();
            $table->timestamps();
        });

        Schema::create('subscription_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('subscription_id')->constrained()->cascadeOnDelete();
            $table->string('asaas_payment_id')->unique();
            $table->unsignedInteger('value_cents');
            $table->string('status', 30);
            $table->string('billing_type', 20)->nullable();
            $table->date('due_date')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->string('invoice_url')->nullable();
            $table->timestamps();
        });

        Schema::create('billing_events', function (Blueprint $table) {
            $table->id();
            $table->string('provider', 20)->default('asaas');
            $table->string('event_id')->unique();
            $table->string('event', 60);
            $table->json('payload');
            $table->timestamp('processed_at')->nullable();
            $table->text('error')->nullable();
            $table->timestamps();
        });

        $now = now();

        // Valores iniciais — ajuste preço/limites direto na tabela se mudar.
        DB::table('plans')->insert([
            [
                'slug' => 'basico', 'name' => 'Básico', 'price_cents' => 4990,
                'max_workers' => 2, 'features' => json_encode([]),
                'active' => true, 'sort' => 1, 'created_at' => $now, 'updated_at' => $now,
            ],
            [
                'slug' => 'pro', 'name' => 'Pro', 'price_cents' => 9990,
                'max_workers' => 5, 'features' => json_encode(['whatsapp', 'financeiro']),
                'active' => true, 'sort' => 2, 'created_at' => $now, 'updated_at' => $now,
            ],
            [
                'slug' => 'premium', 'name' => 'Premium', 'price_cents' => 17990,
                'max_workers' => null, 'features' => json_encode(['whatsapp', 'financeiro']),
                'active' => true, 'sort' => 3, 'created_at' => $now, 'updated_at' => $now,
            ],
        ]);

        // Trial roda no plano mais completo, para a barbearia experimentar tudo.
        $trialPlanId = DB::table('plans')->where('slug', 'premium')->value('id');
        $trialEndsAt = $now->copy()->addDays((int) config('billing.trial_days', 14));

        DB::table('barbershops')->orderBy('id')->pluck('id')->each(function ($id) use ($trialPlanId, $trialEndsAt, $now) {
            DB::table('subscriptions')->insert([
                'barbershop_id' => $id,
                'plan_id' => $trialPlanId,
                'status' => 'trialing',
                'trial_ends_at' => $trialEndsAt,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('billing_events');
        Schema::dropIfExists('subscription_payments');
        Schema::dropIfExists('subscriptions');
        Schema::dropIfExists('plans');
    }
};
