<?php

namespace App\Http\Controllers;

use App\Models\Client;
use App\Models\Schedule;
use App\Models\Service;
use App\Models\Worker;
use App\Http\Requests\StoreScheduleRequest;
use App\Http\Controllers\Traits\ApiResponse;
use Illuminate\Http\Request;
use App\Http\Requests\UpdateScheduleRequest;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
use Carbon\Carbon;

class ScheduleController extends Controller
{

     use ApiResponse;
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        $schedule = Schedule::all();

        return $this->Success(
            data: $schedule,
            message: 'Agendamentos listados com sucesso.',
        );//response()->json($schedule);
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create()
    {
        //
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(StoreScheduleRequest $request)
    {
        $data = $request->validated();

        $phone = preg_replace('/\D/', '', $data['clienteTelefone']);

        $client = Client::firstOrCreate(
            ['phone' => $phone],
            ['name' => $data['clienteNome']],
        );

        $serviceId = $data['servicosIds'][0];
        $service   = Service::find($serviceId);

        $start = Carbon::parse($data['horario']);
        $end   = (clone $start)->addMinutes($this->serviceDurationMinutes($service));

        $schedule = Schedule::create([
            'client_id'   => $client->id,
            'worker_id'   => $data['barbeiroId'],
            'service_id'  => $serviceId,
            'date'        => Carbon::parse($data['dataAgendamento'])->format('Y-m-d'),
            'start_time'  => $start->format('H:i:s'),
            'end_time'    => $end->format('H:i:s'),
            'status'      => Schedule::STATUS_PENDENTE,
            'observation' => $data['observacoes'] ?? null,
        ]);

        $this->dispatchWhatsappConfirmation($client, $schedule);

        return response()->json([
            'message' => 'Agendamento feito com sucesso!',
            'schedule' => $schedule->load(['client', 'worker', 'service']),
        ], 201);
    }

    /**
     * Duração do serviço em minutos (coluna TIME); usa 30 min como padrão.
     */
    private function serviceDurationMinutes(?Service $service): int
    {
        if (! $service || ! $service->duration_time) {
            return 30;
        }

        $d = Carbon::parse($service->duration_time);

        return ($d->hour * 60 + $d->minute) ?: 30;
    }

    /**
     * Aciona o serviço de mensagens (Node) para a confirmação via WhatsApp.
     * Nunca derruba o agendamento se o serviço estiver fora do ar.
     */
    private function dispatchWhatsappConfirmation(Client $client, Schedule $schedule): void
    {
        $phone = preg_replace('/\D/', '', (string) $client->phone);
        if (! str_starts_with($phone, '55')) {
            $phone = '55'.$phone;
        }

        $worker = Worker::find($schedule->worker_id);

        try {
            $url = rtrim(config('services.messages.url'), '/');
            Http::timeout(5)->post("{$url}/message", [
                'phone'   => $phone,
                'name'    => $client->name,
                'trigger' => 'AGENDAMENTO',
                'date'    => Carbon::parse($schedule->date)->format('Y-m-d'),
                'time'    => substr((string) $schedule->start_time, 0, 5),
                'barber'  => $worker?->name,
            ]);
        } catch (\Throwable $e) {
            Log::warning('Falha ao acionar o serviço de mensagens: '.$e->getMessage());
        }
    }

    /**
     * Display the specified resource.
     */
    public function show(Schedule $schedule)
    {
        return $this->Success(
            data: $schedule,
            message: 'Detalhes do agendamento recuperados',
        ); //response()->json($schedule);
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(Schedule $schedule)
    {
        //
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, Schedule $schedule)
    {
        $data = $request->validate([
            'status'          => ['sometimes', Rule::in(Schedule::STATUSES)],
            'observation'     => 'sometimes|nullable|string|max:1000',
            'observacoes'     => 'sometimes|nullable|string|max:1000',
            'dataAgendamento' => 'sometimes|date',
            'horario'         => ['sometimes', 'regex:/^\d{2}:\d{2}$/'],
        ]);

        $update = [];

        if ($request->has('status')) {
            $update['status'] = $data['status'];
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

        $schedule->update($update);

        return response()->json([
            'message' => 'Agendamento atualizado com sucesso!',
            'schedule' => $schedule->fresh(),
        ], 200);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Schedule $schedule)
    {
        $schedule->delete();

        return response()->json($schedule);
    }
}
