<?php

namespace App\Http\Controllers;

use App\Models\Schedule;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class FaturamentoController extends Controller
{
    /**
     * Faturamento + folha de comissões.
     *
     * Query: ?inicio=YYYY-MM-DD&fim=YYYY-MM-DD (default: mês corrente).
     * Só considera agendamentos com status "concluido".
     */
    public function index(Request $request)
    {
        $inicio = $request->filled('inicio')
            ? Carbon::parse($request->query('inicio'))->startOfDay()
            : Carbon::now()->startOfMonth();

        $fim = $request->filled('fim')
            ? Carbon::parse($request->query('fim'))->endOfDay()
            : Carbon::now()->endOfMonth();

        // Teto de 1 ano por consulta — evita um relatório varrer anos de
        // histórico de uma vez (a agregação abaixo é feita em memória).
        if ($inicio->diffInDays($fim) > 366) {
            $fim = $inicio->copy()->addDays(366)->endOfDay();
        }

        $schedules = Schedule::query()
            ->with([
                'client:id,name',
                'service:id,name,price',
                'services:id,name,price',
                'worker:id,name,payment_type,commission_percent,fixed_salary',
                'products',
            ])
            ->where('status', Schedule::STATUS_CONCLUIDO)
            ->whereBetween('date', [$inicio->toDateString(), $fim->toDateString()])
            ->orderBy('date')
            ->get();

        $valorDe = fn (Schedule $s) => (float) ($s->price ?? optional($s->service)->price ?? 0);
        $comissaoDe = function (Schedule $s) use ($valorDe) {
            if ($s->commission_value !== null) {
                return (float) $s->commission_value;
            }

            return $s->worker ? $s->worker->commissionOn($valorDe($s)) : 0.0;
        };

        // produtos vendidos no atendimento (valor e comissão congelados no pivô)
        $produtosDe = fn (Schedule $s) => $s->totalProdutos();
        $comissaoProdutosDe = fn (Schedule $s) => (float) $s->products->sum(fn ($p) => (float) $p->pivot->commission_value);
        $totalDe = fn (Schedule $s) => $valorDe($s) + $produtosDe($s);
        $comissaoTotalDe = fn (Schedule $s) => $comissaoDe($s) + $comissaoProdutosDe($s);

        $nomesDe = function (Schedule $s) {
            $nomes = $s->servicosResolvidos()->pluck('name')->filter()->values();

            return $nomes->isNotEmpty() ? $nomes->implode(', ') : optional($s->service)->name;
        };

        $itens = $schedules->map(fn (Schedule $s) => [
            'id' => $s->id,
            'data' => (string) $s->date,
            'cliente' => optional($s->client)->name,
            'servico' => $nomesDe($s),
            'profissional' => optional($s->worker)->name,
            'valor' => round($totalDe($s), 2),
            'valor_servicos' => round($valorDe($s), 2),
            'valor_produtos' => round($produtosDe($s), 2),
            'comissao' => round($comissaoTotalDe($s), 2),
        ])->values();

        $porProfissional = $schedules->groupBy('worker_id')->map(function ($grp) use ($totalDe, $produtosDe, $comissaoTotalDe) {
            $w = $grp->first()->worker;
            $bruto = $grp->sum($totalDe);
            $comissao = $grp->sum($comissaoTotalDe);
            $fixo = ($w && $w->hasFixedSalary()) ? (float) $w->fixed_salary : 0.0;

            return [
                'worker_id' => $w?->id,
                'profissional' => $w?->name,
                'payment_type' => $w?->payment_type,
                'commission_percent' => $w ? (float) $w->commission_percent : 0,
                'atendimentos' => $grp->count(),
                'bruto' => round($bruto, 2),
                'produtos' => round($grp->sum($produtosDe), 2),
                'comissao' => round($comissao, 2),
                'fixo' => round($fixo, 2),
                'total_a_pagar' => round($comissao + $fixo, 2),
            ];
        })->values();

        // "Por serviço" olha a lista completa de cada agendamento (pivô), com
        // fallback para o service_id antigo quando não há pivô.
        $porServico = collect();
        foreach ($schedules as $s) {
            foreach ($s->servicosResolvidos() as $sv) {
                $valor = (float) ($sv->pivot?->price ?? $sv->price ?? 0);
                $atual = $porServico->get($sv->id, [
                    'servico' => $sv->name,
                    'quantidade' => 0,
                    'total' => 0.0,
                ]);
                $atual['quantidade']++;
                $atual['total'] += $valor;
                $porServico->put($sv->id, $atual);
            }
        }
        $porServico = $porServico->map(fn ($r) => [
            'servico' => $r['servico'],
            'quantidade' => $r['quantidade'],
            'total' => round($r['total'], 2),
        ])->values();

        $porProduto = collect();
        foreach ($schedules as $s) {
            foreach ($s->products as $p) {
                $atual = $porProduto->get($p->id, ['produto' => $p->name, 'quantidade' => 0, 'total' => 0.0]);
                $atual['quantidade'] += (int) $p->pivot->quantity;
                $atual['total'] += (float) $p->pivot->price * (int) $p->pivot->quantity;
                $porProduto->put($p->id, $atual);
            }
        }
        $porProduto = $porProduto->map(fn ($r) => ['produto' => $r['produto'], 'quantidade' => $r['quantidade'], 'total' => round($r['total'], 2)])
            ->sortByDesc('total')->values();

        $faturamentoTotal = round($itens->sum('valor'), 2);
        $totalComissoes = round($porProfissional->sum('comissao'), 2);
        $totalFixo = round($porProfissional->sum('fixo'), 2);

        return response()->json([
            // compat com os cards da "Visão Geral"
            'dia' => $this->totalEntre(Carbon::today(), Carbon::today()),
            'mes' => $this->totalEntre(Carbon::today()->copy()->startOfMonth(), Carbon::today()->copy()->endOfMonth()),
            'ano' => $this->totalEntre(Carbon::today()->copy()->startOfYear(), Carbon::today()->copy()->endOfYear()),

            'periodo' => [
                'inicio' => $inicio->toDateString(),
                'fim' => $fim->toDateString(),
                'atendimentos' => $itens->count(),
                'faturamento_total' => $faturamentoTotal,
                'faturamento_servicos' => round($itens->sum('valor_servicos'), 2),
                'faturamento_produtos' => round($itens->sum('valor_produtos'), 2),
                'total_comissoes' => $totalComissoes,
                'total_fixo' => $totalFixo,
                'lucro_liquido' => round($faturamentoTotal - $totalComissoes - $totalFixo, 2),
            ],
            'por_profissional' => $porProfissional,
            'por_servico' => $porServico,
            'por_produto' => $porProduto,
            'itens' => $itens,
        ]);
    }

    private function totalEntre(Carbon $inicio, Carbon $fim): float
    {
        $periodo = [$inicio->toDateString(), $fim->toDateString()];

        $servicos = (float) Schedule::query()
            ->where('status', Schedule::STATUS_CONCLUIDO)
            ->whereBetween('date', $periodo)
            ->leftJoin('services', 'services.id', '=', 'schedules.service_id')
            ->selectRaw('COALESCE(SUM(COALESCE(schedules.price, services.price)), 0) as total')
            ->value('total');

        $produtos = (float) Schedule::query()
            ->where('status', Schedule::STATUS_CONCLUIDO)
            ->whereBetween('date', $periodo)
            ->join('schedule_product', 'schedule_product.schedule_id', '=', 'schedules.id')
            ->selectRaw('COALESCE(SUM(schedule_product.price * schedule_product.quantity), 0) as total')
            ->value('total');

        return round($servicos + $produtos, 2);
    }
}
