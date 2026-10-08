<?php

namespace App\Services\Billing;

use App\Models\Barbershop;
use App\Models\BillingEvent;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\SubscriptionPayment;
use App\Models\User;
use App\Models\Worker;
use App\Notifications\PaymentOverdueNotification;
use App\Services\Asaas\AsaasClient;
use App\Services\Asaas\AsaasException;
use App\Support\PlatformSettings;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class SubscriptionService
{
    public const BILLING_TYPES = ['PIX', 'BOLETO', 'CREDIT_CARD'];

    public function __construct(protected AsaasClient $asaas) {}

    /** Trial da barbearia recém-criada (chamado pelo TenantProvisioner). */
    public function startTrial(Barbershop $barbershop): Subscription
    {
        $plan = Plan::where('slug', PlatformSettings::get('trial_plan'))->first()
            ?? Plan::active()->get()->last();

        return Subscription::create([
            'barbershop_id' => $barbershop->id,
            'plan_id' => $plan->id,
            'status' => Subscription::STATUS_TRIALING,
            'trial_ends_at' => now()->addDays(PlatformSettings::trialDays()),
        ]);
    }

    /**
     * Assina (ou troca de plano/forma de pagamento) pelo Asaas.
     * Devolve a assinatura e o link da cobrança em aberto (quando houver).
     *
     * @return array{0: Subscription, 1: ?string}
     */
    public function subscribe(Subscription $sub, Plan $plan, string $billingType, User $owner, ?string $cpfCnpj, ?string $phone): array
    {
        $this->assertWorkersFit($sub->barbershop_id, $plan);

        $barbershop = $sub->barbershop;

        // cliente no Asaas (1 por barbearia)
        if (! $sub->asaas_customer_id) {
            if (! $cpfCnpj) {
                throw ValidationException::withMessages(['cpf_cnpj' => 'Informe o CPF ou CNPJ para emitir a cobrança.']);
            }
            $dados = array_filter([
                'name' => $barbershop->name,
                'cpfCnpj' => $cpfCnpj,
                'email' => $owner->email,
                'mobilePhone' => $this->asaasPhone($phone ?: $barbershop->whatsapp ?: $barbershop->phone),
                'externalReference' => $this->reference($barbershop),
            ]);

            try {
                $customer = $this->asaas->createCustomer($dados);
            } catch (AsaasException $e) {
                // celular é opcional: se o Asaas recusar o número, cria o cliente sem ele
                if (! isset($dados['mobilePhone']) || ! in_array('invalid_mobilePhone', $e->codes, true)) {
                    throw $e;
                }
                unset($dados['mobilePhone']);
                $customer = $this->asaas->createCustomer($dados);
            }
            $sub->asaas_customer_id = $customer['id'];
            $sub->save();
        } elseif ($cpfCnpj) {
            $this->asaas->updateCustomer($sub->asaas_customer_id, ['cpfCnpj' => $cpfCnpj]);
        }

        if ($sub->asaas_subscription_id && $sub->status !== Subscription::STATUS_CANCELED) {
            // troca de plano/forma: o Asaas ajusta também as cobranças ainda em aberto
            $this->asaas->updateSubscription($sub->asaas_subscription_id, [
                'value' => $plan->price(),
                'billingType' => $billingType,
                'description' => $this->description($plan),
                'updatePendingPayments' => true,
            ]);
        } else {
            $remote = $this->asaas->createSubscription([
                'customer' => $sub->asaas_customer_id,
                'billingType' => $billingType,
                'value' => $plan->price(),
                'nextDueDate' => $this->firstDueDate($sub)->toDateString(),
                'cycle' => 'MONTHLY',
                'description' => $this->description($plan),
                'externalReference' => $this->reference($barbershop),
            ]);
            $sub->asaas_subscription_id = $remote['id'];

            if ($sub->status === Subscription::STATUS_CANCELED) {
                // voltou a assinar depois de cancelar: mantém o que ainda resta
                // (período pago ou trial); sem nada restante fica aguardando o
                // pagamento, em modo leitura até ele ser confirmado
                $sub->status = match (true) {
                    (bool) $sub->current_period_ends_at?->isFuture() => Subscription::STATUS_ACTIVE,
                    (bool) $sub->trial_ends_at?->isFuture() && ! $sub->hasEverPaid() => Subscription::STATUS_TRIALING,
                    default => Subscription::STATUS_PAST_DUE,
                };
                $sub->past_due_since = $sub->status === Subscription::STATUS_PAST_DUE ? now() : null;
                $sub->canceled_at = null;
            }
        }

        $sub->plan_id = $plan->id;
        $sub->billing_type = $billingType;
        $sub->save();

        return [$sub->refresh(), $this->syncPayments($sub)];
    }

    /**
     * Painel universal: concede dias de acesso. Em trial (sem nunca ter pago)
     * estende o trial; senão estende o período pago como cortesia e tira do atraso.
     */
    public function grantDays(Subscription $sub, int $days): Subscription
    {
        if (in_array($sub->status, [Subscription::STATUS_TRIALING, Subscription::STATUS_CANCELED], true) && ! $sub->hasEverPaid()) {
            $base = $sub->trial_ends_at && $sub->trial_ends_at->isFuture() ? $sub->trial_ends_at : now();
            $sub->trial_ends_at = $base->copy()->addDays($days);
            if ($sub->status === Subscription::STATUS_CANCELED && ! $sub->asaas_subscription_id) {
                $sub->status = Subscription::STATUS_TRIALING;
                $sub->canceled_at = null;
            }
        } else {
            $base = $sub->current_period_ends_at && $sub->current_period_ends_at->isFuture() ? $sub->current_period_ends_at : now();
            $sub->current_period_ends_at = $base->copy()->addDays($days);
            if ($sub->status === Subscription::STATUS_PAST_DUE) {
                $sub->status = Subscription::STATUS_ACTIVE;
                $sub->past_due_since = null;
            }
        }

        $sub->save();

        return $sub;
    }

    /**
     * Painel universal: troca o plano. Com assinatura no gateway, o valor da
     * mensalidade muda lá também (inclusive cobranças em aberto).
     */
    public function adminChangePlan(Subscription $sub, Plan $plan): Subscription
    {
        $this->assertWorkersFit($sub->barbershop_id, $plan);

        if ($sub->asaas_subscription_id) {
            $this->asaas->updateSubscription($sub->asaas_subscription_id, [
                'value' => $plan->price(),
                'description' => $this->description($plan),
                'updatePendingPayments' => true,
            ]);
        }

        $sub->update(['plan_id' => $plan->id]);

        return $sub;
    }

    /** Cancela a renovação. O acesso continua até o fim do período já pago (ou do trial). */
    public function cancel(Subscription $sub): Subscription
    {
        if ($sub->asaas_subscription_id) {
            $this->asaas->deleteSubscription($sub->asaas_subscription_id);
        }

        $sub->update([
            'status' => Subscription::STATUS_CANCELED,
            'canceled_at' => now(),
            'asaas_subscription_id' => null,
        ]);

        return $sub;
    }

    /**
     * Busca as cobranças da assinatura no Asaas e espelha localmente.
     * Devolve o link da cobrança em aberto mais antiga.
     */
    public function syncPayments(Subscription $sub): ?string
    {
        if (! $sub->asaas_subscription_id) {
            return null;
        }

        foreach ($this->asaas->subscriptionPayments($sub->asaas_subscription_id) as $p) {
            $this->upsertPayment($sub, $p);
        }

        return $sub->payments()
            ->whereIn('status', ['PENDING', 'OVERDUE'])
            ->orderBy('due_date')
            ->value('invoice_url');
    }

    /**
     * Processa um webhook já gravado em billing_events. Idempotente: reprocessar
     * o mesmo evento não muda o resultado.
     */
    public function handleEvent(BillingEvent $event): void
    {
        $payload = $event->payload;
        $type = $event->event;

        if (str_starts_with($type, 'PAYMENT_') && isset($payload['payment'])) {
            $this->handlePaymentEvent($type, $payload['payment']);
        } elseif (in_array($type, ['SUBSCRIPTION_DELETED', 'SUBSCRIPTION_INACTIVATED'], true) && isset($payload['subscription'])) {
            $sub = Subscription::where('asaas_subscription_id', $payload['subscription']['id'] ?? null)->first();
            if ($sub && $sub->status !== Subscription::STATUS_CANCELED) {
                $sub->update(['status' => Subscription::STATUS_CANCELED, 'canceled_at' => now()]);
            }
        }

        $event->update(['processed_at' => now(), 'error' => null]);
    }

    protected function handlePaymentEvent(string $type, array $payment): void
    {
        $sub = $this->findSubscriptionForPayment($payment);

        if (! $sub) {
            Log::warning('Asaas: cobrança sem assinatura correspondente', ['payment' => $payment['id'] ?? null]);

            return;
        }

        // a fatura já estava vencida antes deste evento? (webhook repetido não reenvia o aviso)
        $jaVencida = SubscriptionPayment::where('asaas_payment_id', $payment['id'] ?? null)->value('status') === 'OVERDUE';

        $local = DB::transaction(function () use ($type, $payment, $sub) {
            $local = $this->upsertPayment($sub, $payment);
            $due = isset($payment['dueDate']) ? Carbon::parse($payment['dueDate'])->startOfDay() : null;

            switch ($type) {
                case 'PAYMENT_CONFIRMED':
                case 'PAYMENT_RECEIVED':
                    $coveredUntil = ($due ?? now())->copy()->addMonthNoOverflow()->endOfDay();
                    $sub->current_period_ends_at = $sub->current_period_ends_at && $sub->current_period_ends_at->gt($coveredUntil)
                        ? $sub->current_period_ends_at
                        : $coveredUntil;
                    $sub->past_due_since = null;
                    if ($sub->status !== Subscription::STATUS_CANCELED) {
                        $sub->status = Subscription::STATUS_ACTIVE;
                    }
                    break;

                case 'PAYMENT_OVERDUE':
                    if ($sub->status !== Subscription::STATUS_CANCELED) {
                        $sub->status = Subscription::STATUS_PAST_DUE;
                        $since = $due ?? now();
                        $sub->past_due_since = $sub->past_due_since && $sub->past_due_since->lt($since)
                            ? $sub->past_due_since
                            : $since;
                    }
                    break;
            }

            $sub->save();

            return $local;
        });

        if ($type === 'PAYMENT_OVERDUE' && ! $jaVencida && $sub->status === Subscription::STATUS_PAST_DUE) {
            // falha no e-mail não pode marcar o webhook como não processado
            rescue(fn () => $sub->barbershop?->owner()?->notify(new PaymentOverdueNotification($local)));
        }
    }

    protected function findSubscriptionForPayment(array $payment): ?Subscription
    {
        if (! empty($payment['subscription'])) {
            $sub = Subscription::where('asaas_subscription_id', $payment['subscription'])->first();
            if ($sub) {
                return $sub;
            }
        }

        if (! empty($payment['externalReference']) && preg_match('/^barbershop:(\d+)$/', $payment['externalReference'], $m)) {
            return Subscription::where('barbershop_id', (int) $m[1])->first();
        }

        return ! empty($payment['customer'])
            ? Subscription::where('asaas_customer_id', $payment['customer'])->first()
            : null;
    }

    protected function upsertPayment(Subscription $sub, array $p): SubscriptionPayment
    {
        $paidAt = $p['clientPaymentDate'] ?? $p['paymentDate'] ?? $p['confirmedDate'] ?? null;

        return SubscriptionPayment::updateOrCreate(
            ['asaas_payment_id' => $p['id']],
            [
                'subscription_id' => $sub->id,
                'value_cents' => (int) round(((float) ($p['value'] ?? 0)) * 100),
                'status' => $p['status'] ?? 'PENDING',
                'billing_type' => $p['billingType'] ?? null,
                'due_date' => $p['dueDate'] ?? null,
                'paid_at' => $paidAt,
                'invoice_url' => $p['invoiceUrl'] ?? null,
            ]
        );
    }

    /** Assinando durante o trial, a 1ª cobrança vence no fim do trial (o teste não é encurtado). */
    protected function firstDueDate(Subscription $sub): Carbon
    {
        $candidates = [now()->startOfDay()];

        if ($sub->status === Subscription::STATUS_TRIALING && $sub->trial_ends_at?->isFuture()) {
            $candidates[] = $sub->trial_ends_at->copy()->startOfDay();
        }
        if ($sub->current_period_ends_at?->isFuture()) {
            $candidates[] = $sub->current_period_ends_at->copy()->startOfDay();
        }

        return collect($candidates)->max();
    }

    protected function assertWorkersFit(int $barbershopId, Plan $plan): void
    {
        if ($plan->max_workers === null) {
            return;
        }

        $count = Worker::withoutGlobalScopes()->where('barbershop_id', $barbershopId)->whereNull('deleted_at')->count();

        if ($count > $plan->max_workers) {
            throw ValidationException::withMessages([
                'plano' => "O plano {$plan->name} permite até {$plan->max_workers} profissionais e a barbearia tem {$count}. Exclua profissionais ou escolha um plano maior.",
            ]);
        }
    }

    /** Celular no formato do Asaas: DDD + número, sem o 55 (null se não parecer celular BR). */
    protected function asaasPhone(?string $phone): ?string
    {
        $digits = preg_replace('/\D/', '', (string) $phone);

        if (strlen($digits) >= 12 && str_starts_with($digits, '55')) {
            $digits = substr($digits, 2);
        }

        return preg_match('/^\d{2}9\d{8}$/', $digits) ? $digits : null;
    }

    protected function reference(Barbershop $barbershop): string
    {
        return 'barbershop:'.$barbershop->id;
    }

    protected function description(Plan $plan): string
    {
        return config('app.name', 'CRM-Barber').' — Plano '.$plan->name;
    }
}
