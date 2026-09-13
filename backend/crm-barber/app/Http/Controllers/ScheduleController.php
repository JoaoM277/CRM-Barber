<?php

namespace App\Http\Controllers;

use App\Jobs\SendAppointmentWhatsapp;
use App\Models\Client;
use App\Models\OperationTime;
use App\Models\Schedule;
use App\Models\Service;
use App\Models\Worker;
use App\Http\Requests\StoreScheduleRequest;
use App\Http\Controllers\Traits\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Carbon\Carbon;

class ScheduleController extends Controller
{
    use ApiResponse;

    /**
     * Lista de agendamentos para o painel. Aceita ?data=YYYY-MM-DD (ou d/m/Y).
     * Devolve as chaves que o front-end (admin.js) consome.
     */
    public function index(Request $request)
    {
        $query = Schedule::with(['client', 'worker', 'service', 'services'])->orderBy('date')->orderBy('start_time');

        if ($request->filled('data')) {
            try {
                $data = str_contains($request->query('data'), '/')
                    ? Carbon::createFromFormat('d/m/Y', $request->query('data'))
                    : Carbon::parse($request->query('data'));
                $query->whereDate('date', $data->format('Y-m-d'));
            } catch (\Throwable $e) {
                // filtro inválido é ignorado
            }
        }

        $schedules = $query->get()->map(function (Schedule $s) {
            $servicos = $s->servicosResolvidos();

            return [
                'id' => $s->id,
                'status' => $s->status,
                'date' => (string) $s->date,
                'data' => (string) $s->date,
                'start_time' => substr((string) $s->start_time, 0, 5),
                'horario' => substr((string) $s->start_time, 0, 5),
                'end_time' => substr((string) $s->end_time, 0, 5),
                'observation' => $s->observation,
                'price' => $s->price,
                'commission_value' => $s->commission_value,
                'cliente_nome' => $s->client?->name,
                'cliente_telefone' => $s->client?->phone,
                'client' => $s->client,
                'worker' => $s->worker,
                'service' => $s->service,
                // lista completa de serviços do agendamento
                'servicos' => $servicos->map(fn ($sv) => [
                    'id' => $sv->id,
                    'nome' => $sv->name,
                    'preco' => (float) ($sv->pivot?->price ?? $sv->price ?? 0),
                ])->values(),
                'servicos_nomes' => $servicos->pluck('name')->implode(', '),
                // compat: serviço "primário"
                'Servico' => $s->service ? ['id' => $s->service->id, 'nome' => $s->service->name] : null,
                'Barbeiro' => $s->worker ? ['id' => $s->worker->id, 'nome' => $s->worker->name] : null,
            ];
        });

        return $this->Success(
            data: $schedules,
            message: 'Agendamentos listados com sucesso.',
        );
    }

    /**
     * Disponibilidade pública: só data/horário/profissional dos agendamentos
     * futuros e não cancelados. Sem dados do cliente.
     */
    public function disponibilidade(Request $request)
    {
        $ocupados = Schedule::query()
            ->whereDate('date', '>=', now()->toDateString())
            ->where('status', '!=', Schedule::STATUS_CANCELADO)
            ->get(['date', 'start_time', 'end_time', 'worker_id'])
            ->map(fn (Schedule $s) => [
                'date' => (string) $s->date,
                'start_time' => substr((string) $s->start_time, 0, 5),
                'end_time' => substr((string) $s->end_time, 0, 5),
                'worker_id' => $s->worker_id,
            ]);

        $expediente = OperationTime::orderBy('day_of_week')->get()->map(fn (OperationTime $o) => [
            'day_of_week' => (int) $o->day_of_week,
            'active' => (bool) $o->active,
            'start_time' => substr((string) $o->start_time, 0, 5),
            'end_time' => substr((string) $o->end_time, 0, 5),
            'waiting_start' => $o->waiting_start ? substr((string) $o->waiting_start, 0, 5) : null,
            'waiting_end' => $o->waiting_end ? substr((string) $o->waiting_end, 0, 5) : null,
        ]);

        return response()->json(['data' => $ocupados, 'expediente' => $expediente], 200);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(StoreScheduleRequest $request)
    {
        $data = $request->validated();

        $phone = \App\Support\Phone::normalizeBr($data['clienteTelefone']);

        $client = Client::firstOrCreate(
            ['phone' => $phone],
            ['name' => $data['clienteNome']],
        );

        // Serviços na ordem em que o cliente escolheu (o 1º vira o "primário").
        $idsPedidos = array_values(array_unique(array_map('intval', $data['servicosIds'])));
        $servicos = Service::whereIn('id', $idsPedidos)->get()->keyBy('id');
        $servicosOrdenados = collect($idsPedidos)
            ->map(fn ($id) => $servicos->get($id))
            ->filter()
            ->values();

        if ($servicosOrdenados->isEmpty()) {
            throw ValidationException::withMessages([
                'servicosIds' => ['Nenhum serviço válido foi selecionado.'],
            ]);
        }

        $worker = Worker::find($data['barbeiroId']);

        $duracaoTotal = $servicosOrdenados->sum(fn (Service $s) => $this->serviceDurationMinutes($s));
        $precoTotal = round($servicosOrdenados->sum(fn (Service $s) => (float) ($s->price ?? 0)), 2);
        $comissaoTotal = $worker ? $worker->commissionOn($precoTotal) : 0.0;

        $dateStr = Carbon::parse($data['dataAgendamento'])->format('Y-m-d');
        $start = Carbon::parse($data['horario']);
        $end = (clone $start)->addMinutes($duracaoTotal);
        $startStr = $start->format('H:i:s');
        $endStr = $end->format('H:i:s');

        // Expediente não corre risco de corrida (não depende de outras linhas).
        $this->assertDentroDoExpediente($dateStr, $startStr, $endStr);

        $schedule = DB::transaction(function () use ($client, $data, $servicosOrdenados, $worker, $precoTotal, $comissaoTotal, $start, $end, $dateStr, $startStr, $endStr) {
            // Trava as linhas do profissional naquele dia até o fim da transação:
            // dois POSTs simultâneos pro mesmo slot serializam aqui, e o 2º vê o 1º.
            Schedule::where('worker_id', $data['barbeiroId'])
                ->whereDate('date', $dateStr)
                ->lockForUpdate()
                ->get();

            $this->assertHorarioLivre($data['barbeiroId'], $dateStr, $startStr, $endStr);

            $schedule = Schedule::create([
                'client_id' => $client->id,
                'worker_id' => $data['barbeiroId'],
                'service_id' => $servicosOrdenados->first()->id,
                'price' => $precoTotal,
                'commission_value' => $comissaoTotal,
                'date' => Carbon::parse($data['dataAgendamento'])->format('Y-m-d'),
                'start_time' => $start->format('H:i:s'),
                'end_time' => $end->format('H:i:s'),
                'status' => Schedule::STATUS_PENDENTE,
                'observation' => $data['observacoes'] ?? null,
            ]);

            $pivot = $servicosOrdenados->mapWithKeys(function (Service $s) use ($worker) {
                $preco = (float) ($s->price ?? 0);

                return [$s->id => [
                    'price' => round($preco, 2),
                    'commission_value' => $worker ? $worker->commissionOn($preco) : 0.0,
                ]];
            })->all();

            $schedule->services()->sync($pivot);

            return $schedule;
        });

        // Bus::dispatch enfileira na hora (não no __destruct), então um erro de
        // infra da fila é capturado aqui e não derruba o agendamento.
        try {
            Bus::dispatch(new SendAppointmentWhatsapp($schedule->id));
        } catch (\Throwable $e) {
            Log::warning('Falha ao enfileirar confirmação de WhatsApp: '.$e->getMessage());
        }

        return response()->json([
            'message' => 'Agendamento feito com sucesso!',
            'schedule' => $schedule->load(['client', 'worker', 'service', 'services']),
        ], 201);
    }

    /**
     * Duração de um serviço em minutos; usa 30 min como padrão.
     */
    private function serviceDurationMinutes(?Service $service): int
    {
        return ($service && $service->duration_time > 0) ? (int) $service->duration_time : 30;
    }

    /**
     * Duração total do agendamento = soma dos serviços (fallback 30 min).
     */
    private function scheduleDurationMinutes(Schedule $schedule): int
    {
        $servicos = $schedule->servicosResolvidos();

        if ($servicos->isEmpty()) {
            return 30;
        }

        return max(1, (int) $servicos->sum(fn (Service $s) => $this->serviceDurationMinutes($s)));
    }

    /**
     * Display the specified resource.
     */
    public function show(Schedule $schedule)
    {
        return $this->Success(
            data: $schedule->load(['client', 'worker', 'service', 'services']),
            message: 'Detalhes do agendamento recuperados',
        );
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, Schedule $schedule)
    {
        $data = $request->validate([
            'status' => ['sometimes', Rule::in(Schedule::STATUSES)],
            'observation' => 'sometimes|nullable|string|max:1000',
            'observacoes' => 'sometimes|nullable|string|max:1000',
            'dataAgendamento' => 'sometimes|date',
            'horario' => ['sometimes', 'regex:/^\d{2}:\d{2}$/'],
        ]);

        $update = [];

        if ($request->has('status')) {
            $update['status'] = $data['status'];

            // ao concluir, garante o snapshot de valor/comissão (registros antigos)
            if ($data['status'] === Schedule::STATUS_CONCLUIDO && $schedule->price === null) {
                $schedule->loadMissing('service', 'worker');
                $price = (float) (optional($schedule->service)->price ?? 0);
                $update['price'] = $price;
                $update['commission_value'] = $schedule->worker ? $schedule->worker->commissionOn($price) : 0;
            }
        }
        if ($request->has('observation') || $request->has('observacoes')) {
            $update['observation'] = $data['observation'] ?? $data['observacoes'] ?? null;
        }
        if ($request->filled('dataAgendamento')) {
            $update['date'] = Carbon::parse($data['dataAgendamento'])->format('Y-m-d');
        }
        if ($request->filled('horario')) {
            $update['start_time'] = $data['horario'].':00';
        }

        // Se remarcou data/horário, revalida a trava de conflito
        if (isset($update['date']) || isset($update['start_time'])) {
            $novaData = $update['date'] ?? (string) $schedule->date;
            $novoInicio = $update['start_time'] ?? (string) $schedule->start_time;
            $novoFim = Carbon::parse($novoInicio)
                ->addMinutes($this->scheduleDurationMinutes($schedule))
                ->format('H:i:s');
            $update['end_time'] = $novoFim;
            $this->assertDentroDoExpediente($novaData, $novoInicio, $novoFim);
            $this->assertHorarioLivre($schedule->worker_id, $novaData, $novoInicio, $novoFim, $schedule->id);
        }

        $schedule->update($update);

        return response()->json([
            'message' => 'Agendamento atualizado com sucesso!',
            'schedule' => $schedule->fresh(),
        ], 200);
    }

    /**
     * Trava de horário: rejeita agendamento no passado ou que sobreponha
     * outro agendamento não-cancelado do mesmo profissional.
     */
    private function assertHorarioLivre(int $workerId, string $date, string $start, string $end, ?int $ignoreId = null): void
    {
        if (Carbon::parse("{$date} ".substr($start, 0, 5))->isPast()) {
            throw ValidationException::withMessages([
                'horario' => ['Não é possível agendar em um horário que já passou.'],
            ]);
        }

        $conflito = Schedule::query()
            ->where('worker_id', $workerId)
            ->whereDate('date', $date)
            ->where('status', '!=', Schedule::STATUS_CANCELADO)
            ->where('start_time', '<', $end)
            ->where('end_time', '>', $start)
            ->when($ignoreId, fn ($q) => $q->where('id', '!=', $ignoreId))
            ->exists();

        if ($conflito) {
            throw ValidationException::withMessages([
                'horario' => ['Este profissional já tem um agendamento nesse horário.'],
            ]);
        }
    }

    /**
     * Valida o slot contra o horário de funcionamento (grade por dia da semana).
     */
    private function assertDentroDoExpediente(string $date, string $start, string $end): void
    {
        $dow = Carbon::parse($date)->dayOfWeek; // 0 = domingo ... 6 = sábado
        $op = OperationTime::where('day_of_week', $dow)->first();

        if (! $op || ! $op->active) {
            throw ValidationException::withMessages([
                'horario' => ['A barbearia não abre neste dia da semana.'],
            ]);
        }

        $s = substr($start, 0, 5);
        $e = substr($end, 0, 5);
        $abre = substr((string) $op->start_time, 0, 5);
        $fecha = substr((string) $op->end_time, 0, 5);

        if ($s < $abre || $e > $fecha) {
            throw ValidationException::withMessages([
                'horario' => ["Fora do horário de funcionamento ({$abre} às {$fecha})."],
            ]);
        }

        if ($op->waiting_start && $op->waiting_end) {
            $ws = substr((string) $op->waiting_start, 0, 5);
            $we = substr((string) $op->waiting_end, 0, 5);
            if ($s < $we && $e > $ws) {
                throw ValidationException::withMessages([
                    'horario' => ["Esse horário cai no intervalo da barbearia ({$ws} às {$we})."],
                ]);
            }
        }
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Schedule $schedule)
    {
        $schedule->delete();

        return response()->json(['message' => 'Agendamento removido com sucesso!'], 200);
    }
}
