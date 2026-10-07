<?php

namespace App\Http\Controllers\Platform;

use App\Http\Controllers\Controller;
use App\Models\Barbershop;
use App\Models\Schedule;
use App\Models\Subscription;
use App\Models\SubscriptionPayment;
use Illuminate\Http\JsonResponse;

/**
 * GET /plataforma/metricas — indicadores do SaaS para o painel universal.
 *
 * Definições:
 *  - pagante: tem assinatura no gateway e status active/past_due
 *  - MRR: soma do preço do plano das pagantes (cortesias sem gateway não entram)
 *  - conversão: das barbearias cujo trial acabou nos últimos 90 dias, quantas já pagaram
 *  - churn 30d: canceladas nos últimos 30 dias / (pagantes hoje + essas canceladas)
 */
class PlatformMetricsController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $now = now();
        $subs = Subscription::with('plan')->get();

        $pagantes = $subs->filter(fn (Subscription $s) => $s->asaas_subscription_id
            && in_array($s->status, [Subscription::STATUS_ACTIVE, Subscription::STATUS_PAST_DUE], true));

        $mrrCents = $pagantes->sum(fn (Subscription $s) => $s->plan?->price_cents ?? 0);

        $mrrContratadoTrialCents = $subs
            ->filter(fn (Subscription $s) => $s->asaas_subscription_id && $s->status === Subscription::STATUS_TRIALING)
            ->sum(fn (Subscription $s) => $s->plan?->price_cents ?? 0);

        $situacao = [
            'em_teste' => $subs->filter(fn ($s) => $s->status === Subscription::STATUS_TRIALING && $s->hasFullAccess())->count(),
            'pagantes' => $pagantes->count(),
            'em_atraso' => $subs->where('status', Subscription::STATUS_PAST_DUE)->count(),
            'modo_leitura' => $subs->filter(fn ($s) => ! $s->hasFullAccess())->count(),
            'canceladas' => $subs->where('status', Subscription::STATUS_CANCELED)->count(),
            'suspensas' => Barbershop::where('active', false)->count(),
        ];

        $trialsEncerrados = $subs->filter(fn ($s) => $s->trial_ends_at
            && $s->trial_ends_at->between($now->copy()->subDays(90), $now));
        $convertidos = $trialsEncerrados->filter(fn ($s) => $s->hasEverPaid())->count();

        $canceladas30 = $subs->filter(fn ($s) => $s->canceled_at && $s->canceled_at->gte($now->copy()->subDays(30)))->count();
        $baseChurn = $pagantes->count() + $canceladas30;

        $receita30Cents = (int) SubscriptionPayment::whereNotNull('paid_at')
            ->where('paid_at', '>=', $now->copy()->subDays(30))
            ->sum('value_cents');

        // uso da plataforma (agendamentos criados nos últimos 30 dias, todas as barbearias)
        $agendamentos30 = Schedule::withoutTenantScope()->where('created_at', '>=', $now->copy()->subDays(30));

        return response()->json([
            'mrr' => $mrrCents / 100,
            'mrr_contratado_em_teste' => $mrrContratadoTrialCents / 100,
            'ticket_medio' => $pagantes->count() ? round($mrrCents / $pagantes->count() / 100, 2) : 0,
            'receita_30d' => $receita30Cents / 100,
            'barbearias_total' => Barbershop::count(),
            'situacao' => $situacao,
            'conversao_trial' => [
                'encerrados_90d' => $trialsEncerrados->count(),
                'convertidos' => $convertidos,
                'taxa' => $trialsEncerrados->count() ? round($convertidos / $trialsEncerrados->count() * 100, 1) : null,
            ],
            'churn_30d' => [
                'canceladas' => $canceladas30,
                'taxa' => $baseChurn ? round($canceladas30 / $baseChurn * 100, 1) : null,
            ],
            'por_plano' => $pagantes->groupBy(fn ($s) => $s->plan?->name ?? '—')->map->count(),
            'cadastros_30d' => $this->dailySeries(Barbershop::query(), 30),
            'uso' => [
                'agendamentos_30d' => (clone $agendamentos30)->count(),
                'barbearias_ativas_30d' => (clone $agendamentos30)->distinct()->count('barbershop_id'),
            ],
        ]);
    }

    /** Contagem por dia dos últimos N dias (dias sem registro = 0). */
    private function dailySeries($query, int $days): array
    {
        $start = now()->subDays($days - 1)->startOfDay();

        $counts = $query->where('created_at', '>=', $start)
            ->selectRaw('DATE(created_at) as dia, COUNT(*) as total')
            ->groupBy('dia')
            ->pluck('total', 'dia');

        $series = [];
        for ($d = $start->copy(); $d->lte(now()); $d->addDay()) {
            $key = $d->toDateString();
            $series[] = ['dia' => $key, 'total' => (int) ($counts[$key] ?? 0)];
        }

        return $series;
    }
}
