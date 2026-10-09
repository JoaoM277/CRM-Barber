<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\OperationTime;
use App\Models\Schedule;
use App\Models\Worker;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/**
 * GET /relatorios?inicio=YYYY-MM-DD&fim=YYYY-MM-DD (padrão: mês corrente)
 *
 * Indicadores que o financeiro não mostra:
 *  - agenda: marcados, concluídos, cancelados (e quantos o próprio cliente cancelou)
 *  - clientes atendidos no período: novos x recorrentes
 *  - retorno: dos clientes que vieram pela 1ª vez entre 240 e 60 dias atrás,
 *    quantos voltaram em até 60 dias (não depende do período escolhido)
 *  - ocupação: tempo marcado / tempo disponível (expediente sem almoço), por
 *    profissional e por dia da semana
 *
 * "Visita" = agendamento não cancelado com data já passada (muita barbearia
 * não marca "concluído"; o financeiro, que mexe com dinheiro, só usa concluídos).
 */
class RelatorioController extends Controller
{
    public const JANELA_RETORNO = 60;

    public function index(Request $request): JsonResponse
    {
        $request->validate(['inicio' => 'sometimes|date', 'fim' => 'sometimes|date']);

        $inicio = $request->filled('inicio') ? Carbon::parse($request->query('inicio'))->startOfDay() : now()->startOfMonth();
        $fim = $request->filled('fim') ? Carbon::parse($request->query('fim'))->startOfDay() : now()->endOfMonth()->startOfDay();
        if ($fim->lessThan($inicio)) {
            [$inicio, $fim] = [$fim, $inicio];
        }
        if ($inicio->diffInDays($fim) > 366) {
            $fim = $inicio->copy()->addDays(366);
        }
        $ini = $inicio->toDateString();
        $f = $fim->toDateString();

        $doPeriodo = Schedule::query()->whereBetween('date', [$ini, $f])->get(['id', 'client_id', 'worker_id', 'date', 'start_time', 'end_time', 'status', 'cancelado_por']);

        return response()->json([
            'periodo' => ['inicio' => $ini, 'fim' => $f],
            'agenda' => $this->agenda($doPeriodo, $inicio, $fim),
            'clientes' => $this->clientes($doPeriodo, $ini),
            'retorno' => $this->retorno(),
            'ocupacao' => $this->ocupacao($doPeriodo, $inicio, $fim),
            'avaliacoes' => $this->avaliacoes($inicio, $fim),
        ]);
    }

    /** Notas dadas no período (pela data da resposta do cliente). */
    private function avaliacoes(Carbon $inicio, Carbon $fim): array
    {
        $janela = [$inicio->copy()->startOfDay(), $fim->copy()->endOfDay()];

        $notas = Schedule::query()
            ->with(['client:id,name', 'worker:id,name'])
            ->whereNotNull('avaliacao_nota')
            ->whereBetween('avaliacao_em', $janela)
            ->latest('avaliacao_em')
            ->get(['id', 'client_id', 'worker_id', 'avaliacao_nota', 'avaliacao_em', 'avaliacao_comentario']);

        $pedidos = Schedule::query()->whereBetween('avaliacao_pedida_em', $janela)->count();
        $media = fn ($c) => $c->count() ? round($c->avg('avaliacao_nota'), 2) : null;

        return [
            'total' => $notas->count(),
            'pedidos' => $pedidos,
            'media' => $media($notas),
            'distribuicao' => collect(range(1, 5))->mapWithKeys(fn ($n) => [$n => $notas->where('avaliacao_nota', $n)->count()]),
            'por_profissional' => $notas->groupBy('worker_id')->map(fn ($g) => [
                'profissional' => $g->first()->worker?->name,
                'media' => $media($g),
                'total' => $g->count(),
            ])->sortByDesc('media')->values(),
            // notas baixas primeiro: é o que o dono precisa ler
            'recentes' => $notas->sortBy(fn ($s) => [$s->avaliacao_nota > 3 ? 1 : 0, -$s->avaliacao_em->timestamp])->take(10)->map(fn (Schedule $s) => [
                'id' => $s->id,
                'nota' => $s->avaliacao_nota,
                'comentario' => $s->avaliacao_comentario,
                'cliente' => $s->client?->name,
                'profissional' => $s->worker?->name,
                'em' => $s->avaliacao_em,
            ])->values(),
        ];
    }

    private function agenda(Collection $doPeriodo, Carbon $inicio, Carbon $fim): array
    {
        $cancelados = $doPeriodo->where('status', Schedule::STATUS_CANCELADO);
        $faltas = $doPeriodo->where('status', Schedule::STATUS_FALTA);
        $total = $doPeriodo->count();

        // cancelamentos feitos pelo cliente (resposta "2", link "meu horário");
        // os antigos, sem cancelado_por, vêm do registro de auditoria
        $semOrigem = $cancelados->whereNull('cancelado_por')->pluck('id');
        $peloCliente = $cancelados->where('cancelado_por', Schedule::POR_CLIENTE)->count() + ($semOrigem->isEmpty() ? 0 : AuditLog::query()
            ->where('action', 'agendamento.cancelado_cliente')
            ->where('subject_type', Schedule::class)
            ->whereIn('subject_id', $semOrigem)
            ->distinct()
            ->count('subject_id'));

        return [
            'total' => $total,
            'concluidos' => $doPeriodo->where('status', Schedule::STATUS_CONCLUIDO)->count(),
            'cancelados' => $cancelados->count(),
            'cancelados_pelo_cliente' => $peloCliente,
            'taxa_cancelamento' => $total ? round($cancelados->count() / $total, 4) : 0,
            'faltas' => $faltas->count(),
            'taxa_faltas' => $total ? round($faltas->count() / $total, 4) : 0,
        ];
    }

    private function clientes(Collection $doPeriodo, string $ini): array
    {
        $hoje = now()->toDateString();
        $atendidos = $doPeriodo
            ->whereNotIn('status', Schedule::NAO_ACONTECEU)
            ->filter(fn (Schedule $s) => substr((string) $s->date, 0, 10) <= $hoje)
            ->pluck('client_id')->unique()->values();

        if ($atendidos->isEmpty()) {
            return ['atendidos' => 0, 'novos' => 0, 'recorrentes' => 0];
        }

        // novo = a primeira visita da história caiu dentro do período
        $novos = Schedule::query()
            ->whereIn('client_id', $atendidos)
            ->whereNotIn('status', Schedule::NAO_ACONTECEU)
            ->groupBy('client_id')
            ->selectRaw('client_id, MIN(date) as primeira')
            ->get()
            ->filter(fn ($r) => substr((string) $r->primeira, 0, 10) >= $ini)
            ->count();

        return ['atendidos' => $atendidos->count(), 'novos' => $novos, 'recorrentes' => $atendidos->count() - $novos];
    }

    private function retorno(): array
    {
        $hoje = now()->startOfDay();
        $visitas = Schedule::query()
            ->whereNotIn('status', Schedule::NAO_ACONTECEU)
            ->where('date', '<=', $hoje->toDateString())
            ->orderBy('date')
            ->get(['client_id', 'date'])
            ->groupBy('client_id')
            ->map(fn ($g) => $g->map(fn ($s) => substr((string) $s->date, 0, 10))->unique()->values());

        $desde = $hoje->copy()->subDays(240)->toDateString();
        $ate = $hoje->copy()->subDays(self::JANELA_RETORNO)->toDateString();

        $coorte = 0;
        $voltaram = 0;
        $intervalos = [];

        foreach ($visitas as $datas) {
            $primeira = $datas->first();
            if ($primeira >= $desde && $primeira <= $ate) {
                $coorte++;
                $segunda = $datas->get(1);
                if ($segunda && Carbon::parse($primeira)->diffInDays(Carbon::parse($segunda)) <= self::JANELA_RETORNO) {
                    $voltaram++;
                }
            }
            // intervalo entre visitas consecutivas no último ano
            $ultimoAno = $datas->filter(fn ($d) => $d >= $hoje->copy()->subYear()->toDateString())->values();
            for ($i = 1; $i < $ultimoAno->count(); $i++) {
                $intervalos[] = Carbon::parse($ultimoAno[$i - 1])->diffInDays(Carbon::parse($ultimoAno[$i]));
            }
        }

        return [
            'janela_dias' => self::JANELA_RETORNO,
            'coorte' => $coorte,
            'voltaram' => $voltaram,
            'taxa' => $coorte ? round($voltaram / $coorte, 4) : null,
            'intervalo_medio_dias' => $intervalos ? (int) round(array_sum($intervalos) / count($intervalos)) : null,
        ];
    }

    private function ocupacao(Collection $doPeriodo, Carbon $inicio, Carbon $fim): array
    {
        $minutos = fn (?string $h) => $h ? ((int) substr($h, 0, 2)) * 60 + (int) substr($h, 3, 2) : 0;

        // minutos de atendimento por dia da semana (expediente menos almoço)
        $abertoPorDia = OperationTime::all()->mapWithKeys(function (OperationTime $o) use ($minutos) {
            if (! $o->active) {
                return [(int) $o->day_of_week => 0];
            }
            $total = $minutos((string) $o->end_time) - $minutos((string) $o->start_time);
            if ($o->waiting_start && $o->waiting_end) {
                $total -= max(0, $minutos((string) $o->waiting_end) - $minutos((string) $o->waiting_start));
            }

            return [(int) $o->day_of_week => max(0, $total)];
        });

        $profissionais = Worker::where('active', true)->orderBy('name')->get(['id', 'name']);
        // a falta conta na ocupação: o horário ficou reservado para o cliente
        $marcados = $doPeriodo->where('status', '!=', Schedule::STATUS_CANCELADO);
        $duracao = fn (Schedule $s) => max(0, $minutos((string) $s->end_time) - $minutos((string) $s->start_time));

        $disponivelPorDow = array_fill(0, 7, 0);
        for ($d = $inicio->copy(); $d->lte($fim); $d->addDay()) {
            $disponivelPorDow[$d->dayOfWeek] += (int) ($abertoPorDia[$d->dayOfWeek] ?? 0);
        }
        $disponivelPorProfissional = array_sum($disponivelPorDow);

        $porProfissional = $profissionais->map(function (Worker $w) use ($marcados, $duracao, $disponivelPorProfissional) {
            $dele = $marcados->where('worker_id', $w->id);
            $ocupados = $dele->sum($duracao);

            return [
                'worker_id' => $w->id,
                'profissional' => $w->name,
                'atendimentos' => $dele->count(),
                'horas_ocupadas' => round($ocupados / 60, 1),
                'horas_disponiveis' => round($disponivelPorProfissional / 60, 1),
                'ocupacao' => $disponivelPorProfissional ? round(min(1, $ocupados / $disponivelPorProfissional), 4) : 0,
            ];
        })->values();

        $equipe = max(1, $profissionais->count());
        $porDia = collect(range(0, 6))->map(function (int $dow) use ($marcados, $duracao, $disponivelPorDow, $equipe, $profissionais) {
            $ocupados = $marcados
                ->filter(fn (Schedule $s) => Carbon::parse($s->date)->dayOfWeek === $dow && $profissionais->contains('id', $s->worker_id))
                ->sum($duracao);
            $disponivel = $disponivelPorDow[$dow] * $equipe;

            return ['dia' => $dow, 'aberto' => $disponivel > 0, 'ocupacao' => $disponivel ? round(min(1, $ocupados / $disponivel), 4) : 0];
        })->values();

        $totalDisponivel = $disponivelPorProfissional * $profissionais->count();
        $totalOcupado = $marcados->filter(fn (Schedule $s) => $profissionais->contains('id', $s->worker_id))->sum($duracao);

        return [
            'geral' => $totalDisponivel ? round(min(1, $totalOcupado / $totalDisponivel), 4) : 0,
            'por_profissional' => $porProfissional,
            'por_dia_semana' => $porDia,
        ];
    }
}
