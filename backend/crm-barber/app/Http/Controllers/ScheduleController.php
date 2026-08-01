<?php

namespace App\Http\Controllers;

use App\Models\Schedule;
use App\Http\Controllers\Traits\ApiResponse;
use App\Http\Requests\StoreScheduleRequest;
use Illuminate\Http\Request;
use Carbon\Carbon;
use Exception;

class ScheduleController extends Controller
{

    use ApiResponse;
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        try {
            $schedule = Schedule::all();

            return $this->Success(
                data: $schedule,
                message: 'Agendamentos listados com sucesso.',
                statusCode: 200
            );
        } catch (Exception $e) {
            return $this->Error(
                message: 'Erro ao buscar a lista de agendamentos!',
                statusCode: 500
            );
        }
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(StoreScheduleRequest $request)
    {
        try {
            $data = $request->validated();

            $data['date']   = Carbon::createFromFormat('d/m/Y', $data['date'])->format('Y-m-d');
            $data['start_time']    = Carbon::createFromTime($data['start_time'], 0, 0)->toTimeString();
            $data['end_time']      = Carbon::createFromTime($data['end_time'], 0, 0)->toTimeString();
        
            $schedule = Schedule::create($data);

            return $this->Success(
                data: $schedule,
                message: 'Agendamentos criados com sucesso.',
                statusCode: 201
            );

        } catch (Exception $e){
            return $this->Error(
                message: 'Erro ao criar agendamento, verifique as credenciais!',
                statusCode: 400
            );
        }

    }

    /**
     * Display the specified resource.
     */
    public function show(Schedule $schedule)
    {
        try {
            return $this->Success(
                data: $schedule,
                message: 'Detalhes do agendamento recuperados com sucesso.',
                statusCode: 200
            );
        } catch (Exception $e) {
            return $this->Error(
                message: 'Erro ao recuperar os dados!',
                statusCode: 500
            );
        }
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(StoreScheduleRequest $request, Schedule $schedule)
    {
        try {
            $data = $request->validated();

            $data['date']   = Carbon::createFromFormat('d/m/Y', $data['date'])->format('Y-m-d');
            $data['start_time']    = Carbon::createFromTime($data['start_time'], 0, 0)->toTimeString();
            $data['end_time']      = Carbon::createFromTime($data['end_time'], 0, 0)->toTimeString();

            $schedule->update($data);

            return $this->Success(
                data: $schedule,
                message: 'Agendamento atualizado com sucesso!',
                statusCode: 200
            );

        } catch (Exception $e) {
            return $this->Error(
                message: 'Erro ao atualizar o agendamento!',
                statusCode: 400
            );
        }
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Schedule $schedule)
    {
        try {
            $schedule->delete();

            return $this->Success(
                data: $schedule,
                message: 'Agendamento deletado com sucesso!',
                statusCode: 200
            );
        } catch(Exception $e) {
            return $this->Error(
                message: 'Erro ao deletar o agendamento!',
                statusCode: 500
            ); 
        }
    }
}
