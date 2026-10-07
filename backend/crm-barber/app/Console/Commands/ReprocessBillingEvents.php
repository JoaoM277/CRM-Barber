<?php

namespace App\Console\Commands;

use App\Models\BillingEvent;
use App\Services\Billing\SubscriptionService;
use Illuminate\Console\Command;

/**
 * Reprocessa webhooks do Asaas que falharam (billing_events com error e sem
 * processed_at). O processamento é idempotente, então rodar de novo é seguro.
 */
class ReprocessBillingEvents extends Command
{
    protected $signature = 'billing:reprocess {--id= : reprocessa só este billing_events.id (mesmo se já processado)}';

    protected $description = 'Reprocessa webhooks de cobrança (Asaas) que falharam';

    public function handle(SubscriptionService $billing): int
    {
        $query = BillingEvent::query()->orderBy('id');

        if ($id = $this->option('id')) {
            $query->whereKey($id);
        } else {
            $query->whereNull('processed_at')->whereNotNull('error');
        }

        $events = $query->get();

        if ($events->isEmpty()) {
            $this->info('Nenhum evento para reprocessar.');

            return self::SUCCESS;
        }

        $falhas = 0;
        foreach ($events as $event) {
            try {
                $billing->handleEvent($event);
                $this->line("ok    #{$event->id} {$event->event}");
            } catch (\Throwable $e) {
                $falhas++;
                $event->update(['error' => $e->getMessage()]);
                $this->error("falha #{$event->id} {$event->event}: {$e->getMessage()}");
            }
        }

        return $falhas ? self::FAILURE : self::SUCCESS;
    }
}
