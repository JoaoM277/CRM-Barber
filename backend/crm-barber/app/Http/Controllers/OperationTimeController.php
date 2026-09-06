<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreOperationTimeRequest;
use App\Models\OperationTime;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;

class OperationTimeController extends Controller
{
    /**
     * Grade de funcionamento (1 linha por dia da semana).
     */
    public function index()
    {
        return response()->json(
            OperationTime::orderBy('day_of_week')->get()
        );
    }

    /**
     * Cria/atualiza o horário de um dia da semana (idempotente por day_of_week).
     */
    public function store(StoreOperationTimeRequest $request)
    {
        $data = $request->validated();

        $operationTime = OperationTime::updateOrCreate(
            ['day_of_week' => $data['day_of_week']],
            Arr::only($data, ['active', 'start_time', 'end_time', 'waiting_start', 'waiting_end']),
        );

        return response()->json([
            'message' => 'Horário de funcionamento salvo!',
            'operationTime' => $operationTime,
        ], 201);
    }

    public function show(OperationTime $operationTime)
    {
        return response()->json($operationTime);
    }

    public function update(Request $request, OperationTime $operationTime)
    {
        $data = $request->validate([
            'active' => 'sometimes|boolean',
            'start_time' => ['sometimes', 'regex:/^\d{2}:\d{2}$/'],
            'end_time' => ['sometimes', 'regex:/^\d{2}:\d{2}$/'],
            'waiting_start' => ['sometimes', 'nullable', 'regex:/^\d{2}:\d{2}$/'],
            'waiting_end' => ['sometimes', 'nullable', 'regex:/^\d{2}:\d{2}$/'],
        ]);

        $operationTime->update($data);

        return response()->json([
            'message' => 'Horário de funcionamento atualizado!',
            'operationTime' => $operationTime->fresh(),
        ], 200);
    }

    public function destroy(OperationTime $operationTime)
    {
        $operationTime->delete();

        return response()->json(['message' => 'Horário de funcionamento removido.'], 200);
    }
}
