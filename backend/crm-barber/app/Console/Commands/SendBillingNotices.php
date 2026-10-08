<?php

namespace App\Console\Commands;

use App\Models\Subscription;
use App\Notifications\TrialEndingNotification;
use Illuminate\Console\Command;

/**
 * Avisos de fim do teste grátis (roda 1x por dia pelo scheduler):
 *  - faltando até 3 dias, ainda sem plano escolhido
 *  - teste terminou sem plano escolhido
 * Cada aviso sai uma vez por assinatura (colunas *_notice_sent_at).
 */
class SendBillingNotices extends Command
{
    protected $signature = 'billing:notify';

    protected $description = 'Envia os avisos de fim do teste grátis';

    private const DIAS_ANTES = 3;

    public function handle(): int
    {
        $base = Subscription::with('barbershop')
            ->where('status', Subscription::STATUS_TRIALING)
            ->whereNull('asaas_subscription_id')
            ->whereNotNull('trial_ends_at')
            ->whereHas('barbershop', fn ($q) => $q->where('active', true));

        $acabando = (clone $base)
            ->whereNull('trial_ending_notice_sent_at')
            ->whereBetween('trial_ends_at', [now(), now()->addDays(self::DIAS_ANTES)])
            ->get();

        $acabaram = (clone $base)
            ->whereNull('trial_ended_notice_sent_at')
            ->where('trial_ends_at', '<', now())
            // não manda "terminou" para quem terminou há muito tempo (ex.: antes deste recurso existir)
            ->where('trial_ends_at', '>=', now()->subDays(7))
            ->get();

        foreach ($acabando as $sub) {
            $sub->barbershop->owner()?->notify(new TrialEndingNotification($sub));
            $sub->update(['trial_ending_notice_sent_at' => now()]);
        }

        foreach ($acabaram as $sub) {
            $sub->barbershop->owner()?->notify(new TrialEndingNotification($sub, ended: true));
            $sub->update(['trial_ended_notice_sent_at' => now()]);
        }

        $this->info("Avisos: {$acabando->count()} teste(s) acabando, {$acabaram->count()} teste(s) encerrado(s).");

        return self::SUCCESS;
    }
}
