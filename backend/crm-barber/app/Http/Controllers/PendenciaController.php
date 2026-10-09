<?php

namespace App\Http\Controllers;

use App\Models\Schedule;
use App\Support\Audit;
use App\Support\Presenca;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;

/**
 * Pendências da agenda: atendimentos de dias anteriores sem registro e faltas
 * automáticas que ainda podem ser corrigidas. O dono registra o que houve.
 */
class PendenciaController extends Controller
{
    /** GET /pendencias/resumo — para o aviso no topo do painel */
    public function resumo(): JsonResponse
    {
        $porDia = Presenca::naoRegistrados()
            ->selectRaw('date, COUNT(*) as n')
            ->groupBy('date')
            ->orderByDesc('date')
            ->get()
            ->map(fn ($r) => ['data' => substr((string) $r->date, 0, 10), 'total' => (int) $r->n]);

        return response()->json([
            'nao_registrados' => $porDia->sum('total'),
            'por_dia' => $porDia->take(5)->values(),
            'dias' => $porDia->count(),
            'faltas_para_revisar' => Presenca::faltasParaRevisar()->count(),
        ]);
    }

    /** GET /pendencias?mes=YYYY-MM (sem mês = todas em aberto) */
    public function index(Request $request): JsonResponse
    {
        $request->validate(['mes' => ['nullable', 'regex:/^\d{4}-\d{2}$/']]);
        $mes = $request->query('mes');
        $doMes = fn ($q) => $mes ? $q->whereBetween('date', [Carbon::parse("{$mes}-01")->toDateString(), Carbon::parse("{$mes}-01")->endOfMonth()->toDateString()]) : $q;

        $item = fn (Schedule $s) => [
            'id' => $s->id,
            'data' => substr((string) $s->date, 0, 10),
            'horario' => substr((string) $s->start_time, 0, 5),
            'status' => $s->status,
            'cliente' => $s->client?->name,
            'telefone' => $s->client?->phone,
            'profissional' => $s->worker?->name,
            'servicos' => $s->servicosResolvidos()->pluck('name')->implode(', '),
            'falta_em' => $s->falta_em,
            'reverter_ate' => $s->falta_em?->copy()->addDays(Schedule::DIAS_PARA_REVERTER),
        ];
        $com = ['client:id,name,phone', 'worker:id,name', 'services:id,name', 'service:id,name'];

        // meses que têm algo em aberto (para o filtro da aba)
        $meses = Presenca::naoRegistrados()->pluck('date')
            ->merge(Presenca::faltasParaRevisar()->pluck('date'))
            ->map(fn ($d) => substr((string) $d, 0, 7))->unique()->sortDesc()->values();

        return response()->json([
            'faltas' => $doMes(Presenca::faltasParaRevisar())->with($com)->orderByDesc('date')->orderBy('start_time')->get()->map($item),
            'nao_registrados' => $doMes(Presenca::naoRegistrados())->with($com)->orderByDesc('date')->orderBy('start_time')->limit(300)->get()->map($item),
            'meses' => $meses,
        ]);
    }

    /**
     * POST /agendamentos/{schedule}/registrar {resultado: concluido|falta|cancelado}
     * - não registrado (dia anterior): concluído, faltou ou cancelado
     * - falta automática (até 3 dias): "compareceu" (concluído) ou "faltou mesmo" (falta)
     */
    public function registrar(Request $request, Schedule $schedule): JsonResponse
    {
        $resultado = $request->validate(['resultado' => 'required|in:concluido,falta,cancelado'])['resultado'];
        $this->aplicar($schedule, $resultado);

        return response()->json(['message' => match ($resultado) {
            'concluido' => 'Registrado como atendido.',
            'falta' => 'Registrado como falta.',
            default => 'Registrado como cancelado.',
        }, 'agendamento' => $schedule->fresh()]);
    }

    /** POST /pendencias/dia {data, resultado: concluido|falta} — todos os não registrados de um dia */
    public function registrarDia(Request $request): JsonResponse
    {
        $data = $request->validate(['data' => 'required|date|before:today', 'resultado' => 'required|in:concluido,falta']);
        $lista = Presenca::naoRegistrados()->whereDate('date', $data['data'])->get();
        foreach ($lista as $s) {
            $this->aplicar($s, $data['resultado']);
        }

        return response()->json(['message' => "{$lista->count()} atendimento(s) registrado(s).", 'total' => $lista->count()]);
    }

    private function aplicar(Schedule $s, string $resultado): void
    {
        $naoRegistrado = in_array($s->status, [Schedule::STATUS_PENDENTE, Schedule::STATUS_CONFIRMADO], true) && $s->inicio()->isPast();
        $faltaAuto = $s->faltaRevertivel();

        if (! $naoRegistrado && ! $faltaAuto) {
            throw ValidationException::withMessages(['resultado' => [$s->status === Schedule::STATUS_FALTA
                ? 'O prazo de '.Schedule::DIAS_PARA_REVERTER.' dias para corrigir esta falta já passou.'
                : 'Este atendimento não está pendente de registro.']]);
        }
        if ($faltaAuto && $resultado === 'cancelado') {
            throw ValidationException::withMessages(['resultado' => ['Para uma falta, escolha "compareceu" ou "faltou mesmo".']]);
        }

        $antes = $s->status;
        match ($resultado) {
            // concluir vale como confirmado (a confirmação estava implícita)
            'concluido' => $s->update(['status' => Schedule::STATUS_CONCLUIDO, 'cancelado_por' => null]),
            'falta' => $s->update([
                'status' => Schedule::STATUS_FALTA,
                'cancelado_por' => $faltaAuto ? Schedule::POR_SISTEMA : Schedule::POR_BARBEARIA,
                'falta_em' => $s->falta_em ?? now(),
                'falta_confirmada_em' => now(),
            ]),
            'cancelado' => $s->update(['status' => Schedule::STATUS_CANCELADO, 'cancelado_por' => Schedule::POR_BARBEARIA]),
        };
        Audit::log('agendamento.registro', $s, "Agendamento #{$s->id}: {$antes} -> {$s->status} (registrado nas pendências)");
    }
}
