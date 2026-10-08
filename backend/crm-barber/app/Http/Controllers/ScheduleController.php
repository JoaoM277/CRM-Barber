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
use App\Http\Controllers\Traits\ValidaAgenda;
use App\Support\ComandaProdutos;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Carbon\Carbon;

class ScheduleController extends Controller
{
    use ApiResponse, ValidaAgenda;

    /**
     * Lista de agendamentos para o painel. Aceita ?data=YYYY-MM-DD (ou d/m/Y).
     * Devolve as chaves que o front-end (admin.js) consome.
     */
    public function index(Request $request)
    {
        $query = Schedule::with(['client', 'worker', 'service', 'services', 'products'])->orderBy('date')->orderBy('start_time');

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

        // período (visão de semana do painel): ?inicio=YYYY-MM-DD&fim=YYYY-MM-DD, até 31 dias
        if ($request->filled('inicio') && $request->filled('fim')) {
            try {
                $ini = Carbon::parse($request->query('inicio'))->startOfDay();
                $fim = Carbon::parse($request->query('fim'))->startOfDay();
                if ($fim->lt($ini)) {
                    [$ini, $fim] = [$fim, $ini];
                }
                if ($ini->diffInDays($fim) > 31) {
                    $fim = $ini->copy()->addDays(31);
                }
                $query->whereBetween('date', [$ini->toDateString(), $fim->toDateString()]);
            } catch (\Throwable $e) {
                // filtro inválido é ignorado
            }
        }
        if ($request->filled('profissional')) {
            $query->where('worker_id', (int) $request->query('profissional'));
        }

        // Sem filtro de data a lista cresce sem limite com o tempo; pagina com
        // um teto generoso (o painel de um dia normalmente nem chega perto).
        $perPage = min(max((int) $request->query('per_page', 200), 1), 500);
        $paginator = $query->paginate($perPage);

        $schedules = collect($paginator->items())->map(function (Schedule $s) {
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
                // produtos vendidos no atendimento
                'produtos' => ProductController::resumo($s),
                'total_produtos' => $s->totalProdutos(),
                // compat: serviço "primário"
                'Servico' => $s->service ? ['id' => $s->service->id, 'nome' => $s->service->name] : null,
                'Barbeiro' => $s->worker ? ['id' => $s->worker->id, 'nome' => $s->worker->name] : null,
            ];
        });

        return response()->json([
            'message' => 'Agendamentos listados com sucesso.',
            'data' => $schedules->values(),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'last_page' => $paginator->lastPage(),
            ],
        ]);
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

        // Anti-abuso: no máximo 5 agendamentos por telefone por hora (além do
        // throttle:15,1 por IP da rota) — evita spam de envio de WhatsApp.
        // (o painel, autenticado, não tem esse limite: o dono marca vários pelo telefone)
        $doPainel = (bool) $request->user();
        $rateLimitKey = 'agendamento-telefone:'.$phone;
        if (! $doPainel && RateLimiter::tooManyAttempts($rateLimitKey, 5)) {
            throw ValidationException::withMessages([
                'clienteTelefone' => ['Muitas tentativas de agendamento com esse telefone. Tente novamente mais tarde.'],
            ]);
        }
        if (! $doPainel) {
            RateLimiter::hit($rateLimitKey, 3600);
        }

        // withTrashed: se o cliente tinha sido excluído, restaura em vez de
        // tentar inserir (o índice único [barbershop_id, phone] não distingue
        // soft-deleted, então um create() bateria de frente com a linha antiga).
        $client = Client::withTrashed()->where('phone', $phone)->first();
        if ($client) {
            if ($client->trashed()) {
                $client->restore();
            }
        } else {
            $client = Client::create(['phone' => $phone, 'name' => $data['clienteNome']]);
        }

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

        $schedule = DB::transaction(function () use ($client, $data, $servicosOrdenados, $worker, $precoTotal, $comissaoTotal, $start, $end, $dateStr, $startStr, $endStr, $doPainel) {
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
                // marcado pelo próprio dono no painel = já confirmado
                'status' => $doPainel ? Schedule::STATUS_CONFIRMADO : Schedule::STATUS_PENDENTE,
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
            // link "meu horário" (cancelar/remarcar), mostrado na tela de sucesso
            'link_cliente' => $doPainel ? null : $schedule->linkCliente(),
        ], 201);
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
            'barbeiroId' => ['sometimes', 'integer', Rule::exists('workers', 'id')->where('barbershop_id', $schedule->barbershop_id)->whereNull('deleted_at')],
        ]);

        $update = [];
        if ($request->filled('barbeiroId') && (int) $data['barbeiroId'] !== (int) $schedule->worker_id) {
            $update['worker_id'] = (int) $data['barbeiroId'];
        }

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

        // Se remarcou data/horário/profissional, revalida a trava de conflito
        if (isset($update['date']) || isset($update['start_time']) || isset($update['worker_id'])) {
            $novaData = $update['date'] ?? (string) $schedule->date;
            $novoInicio = $update['start_time'] ?? (string) $schedule->start_time;
            $novoFim = Carbon::parse($novoInicio)
                ->addMinutes($this->scheduleDurationMinutes($schedule))
                ->format('H:i:s');
            $update['end_time'] = $novoFim;
            $this->assertDentroDoExpediente($novaData, $novoInicio, $novoFim);
            $this->assertHorarioLivre($update['worker_id'] ?? $schedule->worker_id, $novaData, $novoInicio, $novoFim, $schedule->id);
        }

        $statusAnterior = $schedule->status;
        $schedule->update($update);

        if (isset($update['status']) && $update['status'] !== $statusAnterior) {
            \App\Support\Audit::log(
                'agendamento.'.$update['status'],
                $schedule,
                "Agendamento #{$schedule->id}: {$statusAnterior} -> {$update['status']}",
            );

            // cancelado pela barbearia: avisa o cliente (opção dos lembretes)
            if ($update['status'] === Schedule::STATUS_CANCELADO) {
                ComandaProdutos::devolverTudo($schedule);
                $this->avisarCancelamento($schedule);
            }
        }

        return response()->json([
            'message' => 'Agendamento atualizado com sucesso!',
            'schedule' => $schedule->fresh(),
        ], 200);
    }

    /** Aviso de cancelamento no WhatsApp, se a barbearia ligou a opção e o horário ainda não passou. */
    private function avisarCancelamento(Schedule $schedule): void
    {
        $bs = $schedule->barbershop;
        if (! $bs || ! $bs->lembretes_whatsapp || ! $bs->aviso_cancelamento_whatsapp) {
            return;
        }
        $inicio = Carbon::parse(substr((string) $schedule->date, 0, 10).' '.substr((string) $schedule->start_time, 0, 5));
        if ($inicio->isPast()) {
            return;
        }
        try {
            Bus::dispatch(new SendAppointmentWhatsapp($schedule->id, SendAppointmentWhatsapp::CANCELAMENTO));
        } catch (\Throwable $e) {
            Log::warning('Falha ao enfileirar aviso de cancelamento: '.$e->getMessage());
        }
    }

    public function destroy(Schedule $schedule)
    {
        \App\Support\Audit::log('agendamento.removido', $schedule, "Agendamento #{$schedule->id} removido");

        ComandaProdutos::devolverTudo($schedule);
        $schedule->delete();

        return response()->json(['message' => 'Agendamento removido com sucesso!'], 200);
    }
}
