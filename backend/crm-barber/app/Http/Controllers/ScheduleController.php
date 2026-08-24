<?php

namespace App\Http\Controllers;

use App\Models\Schedule;
use App\Http\Requests\StoreScheduleRequest;
use App\Http\Controllers\Traits\ApiResponse;
use Illuminate\Http\Request;
use App\Http\Requests\UpdateScheduleRequest;
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

        $data['date']   = Carbon::createFromFormat('d/m/Y', $data['date'])->format('Y-m-d');
        $data['start_time']    = Carbon::createFromTime($data['start_time'], 0, 0)->toTimeString();
        $data['end_time']      = Carbon::createFromTime($data['end_time'], 0, 0)->toTimeString();

        $schedule = Schedule::create($data);

        return response()->json([
            'message' => 'Agendamento feito com sucesso!',
            'schedule' => $schedule
        ], 201);
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
            'client_id'   => 'required|integer|exists:clients,id',
            'worker_id'   => 'required|integer|exists:workers,id',
            'service_id'  => 'required|integer|exists:services,id',
            'date'        => 'required|date_format:d/m/Y',
            'start_time' => 'required|integer|between:0,23',
            'end_time' => 'required|integer|between:0,23|gt:start_time',
            'status'      => 'boolean',
            'observation' => 'nullable|string|max:1000'
        ]);

        $data['date']   = Carbon::createFromFormat('d/m/Y', $data['date'])->format('Y-m-d');
        $data['start_time']    = Carbon::createFromTime($data['start_time'], 0, 0)->toTimeString();
        $data['end_time']      = Carbon::createFromTime($data['end_time'], 0, 0)->toTimeString();

        $schedule->update($data);

        return response()->json([
            'message' => 'Agendamento atualizado com sucesso!',
            'schedule' => $schedule
        ], 201);
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
