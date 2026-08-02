<?php

namespace App\Http\Controllers;

use App\Models\OperationTime;
use Illuminate\Http\Request;
use Carbon\Carbon;

class OperationTimeController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        $operationTime = OperationTime::all();
        
        return response()->json($operationTime);
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
    public function store(Request $request)
    {
        $data = $request->validate([
            'day_of_week' => 'required|date_format:d/m/Y',
            'start_time' => 'required|integer|between:0,23',
            'end_time' => 'required|integer|between:0,23|gt:start_time',
            'waiting_start' => 'required|integer|between:0,23|gte:start_time|lte:end_time', 
            'waiting_end' => 'required|integer|between:0,23|gt:waiting_start|lte:end_time'
        ]);

        // Converte os inteiros de horas (ex: 8) para o formato H:i:s (ex: 08:00:00)
        $data['day_of_week']   = Carbon::createFromFormat('d/m/Y', $data['day_of_week'])->format('Y-m-d');
        $data['start_time']    = Carbon::createFromTime($data['start_time'], 0, 0)->toTimeString();
        $data['end_time']      = Carbon::createFromTime($data['end_time'], 0, 0)->toTimeString();
        $data['waiting_start'] = Carbon::createFromTime($data['waiting_start'], 0, 0)->toTimeString();
        $data['waiting_end']   = Carbon::createFromTime($data['waiting_end'], 0, 0)->toTimeString();
    

        $operationTime = OperationTime::create($data);

        return response()->json([
            'message' => 'Horário de funcionamento criado com sucesso!',
            'operationTime' => $operationTime
        ], 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(OperationTime $operationTime)
    {
        return response()->json($operationTime);
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(OperationTime $operationTime)
    {
        //
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, OperationTime $operationTime)
    {
        $data = $request->validate([
            'day_of_week' => 'required|date_format:d/m/Y',
            'start_time' => 'required|integer|between:0,23',
            'end_time' => 'required|integer|between:0,23|gt:start_time',
            'waiting_start' => 'required|integer|between:0,23|gte:start_time|lte:end_time', 
            'waiting_end' => 'required|integer|between:0,23|gt:waiting_start|lte:end_time'
        ]);

        $data['day_of_week']   = Carbon::createFromFormat('d/m/Y', $data['day_of_week'])->format('Y-m-d');
        $data['start_time']    = Carbon::createFromTime($data['start_time'], 0, 0)->toTimeString();
        $data['end_time']      = Carbon::createFromTime($data['end_time'], 0, 0)->toTimeString();
        $data['waiting_start'] = Carbon::createFromTime($data['waiting_start'], 0, 0)->toTimeString();
        $data['waiting_end']   = Carbon::createFromTime($data['waiting_end'], 0, 0)->toTimeString();

        $operationTime->update($data);

        return response()->json([
            'message' => 'Horário de funcionamento criado!',
            'operationTime' => $operationTime
        ], 201);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(OperationTime $operationTime)
    {
        $operationTime->delete();

        return response()->json([
            'message' => 'Horário de funcionamento deletado com sucesso!',
            'operationTime' => $operationTime
        ], 200);
    }
}
