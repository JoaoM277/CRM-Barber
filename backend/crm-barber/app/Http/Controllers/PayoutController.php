<?php

namespace App\Http\Controllers;

use App\Models\Payout;
use App\Models\Schedule;
use App\Models\Worker;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class PayoutController extends Controller
{
    /**
     * Histórico de repasses.
     */
    public function index(): JsonResponse
    {
        $payouts = Payout::query()
            ->with('worker:id,name')
            ->orderByDesc('id')
            ->limit(200)
            ->get();

        return response()->json(['data' => $payouts]);
    }

    /**
     * Fecha o repasse de um profissional num período: calcula a partir dos
     * agendamentos concluídos e registra como pago.
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'worker_id' => 'required|integer|exists:workers,id',
            'inicio' => 'required|date',
            'fim' => 'required|date|after_or_equal:inicio',
            'observacao' => 'nullable|string|max:500',
        ]);

        $worker = Worker::findOrFail($data['worker_id']);
        $inicio = Carbon::parse($data['inicio'])->startOfDay();
        $fim = Carbon::parse($data['fim'])->endOfDay();

        $schedules = Schedule::query()
            ->with('service:id,price')
            ->where('worker_id', $worker->id)
            ->where('status', Schedule::STATUS_CONCLUIDO)
            ->whereBetween('date', [$inicio->toDateString(), $fim->toDateString()])
            ->get();

        $bruto = 0.0;
        $comissao = 0.0;

        foreach ($schedules as $s) {
            $valor = (float) ($s->price ?? optional($s->service)->price ?? 0);
            $bruto += $valor;
            $comissao += $s->commission_value !== null
                ? (float) $s->commission_value
                : $worker->commissionOn($valor);
        }

        $fixo = $worker->hasFixedSalary() ? (float) $worker->fixed_salary : 0.0;
        $total = round($comissao + $fixo, 2);

        $payout = Payout::create([
            'worker_id' => $worker->id,
            'periodo_inicio' => $inicio->toDateString(),
            'periodo_fim' => $fim->toDateString(),
            'atendimentos' => $schedules->count(),
            'total_bruto' => round($bruto, 2),
            'total_comissao' => round($comissao, 2),
            'total_fixo' => round($fixo, 2),
            'valor_pago' => $total,
            'status' => Payout::STATUS_PAGO,
            'pago_em' => now(),
            'observacao' => $data['observacao'] ?? null,
        ]);

        Audit::log('repasse.registrado', $payout, "Repasse de R$ {$total} pra {$worker->name} ({$inicio->toDateString()} a {$fim->toDateString()})");

        return response()->json([
            'message' => 'Repasse registrado com sucesso.',
            'payout' => $payout->load('worker:id,name'),
        ], 201);
    }
}
