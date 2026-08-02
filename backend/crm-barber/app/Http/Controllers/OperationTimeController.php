<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Traits\ApiResponse;
use App\Http\Requests\StoreOperationTimeRequest;
use App\Models\OperationTime;
use Carbon\Carbon;
use Exception;

class OperationTimeController extends Controller
{
    use ApiResponse;

    public function index()
    {
        try {
            $operationTimes = OperationTime::all();

            return $this->Success(
                data: $operationTimes,
                message: 'Horários de operação listados com sucesso.',
                statusCode: 200
            );
        } catch (Exception $e) {
            return $this->Error(
                message: 'Erro ao buscar a lista de horários de operação!',
                statusCode: 500
            );
        }
    }

    public function store(StoreOperationTimeRequest $request)
    {
        try {
            $data = $request->validated();

            $data['day_of_week'] = Carbon::createFromFormat('d/m/Y', $data['day_of_week'])->format('Y-m-d');
            $data['start_time'] = Carbon::createFromTime($data['start_time'], 0, 0)->toTimeString();
            $data['end_time'] = Carbon::createFromTime($data['end_time'], 0, 0)->toTimeString();
            $data['waiting_start'] = Carbon::createFromTime($data['waiting_start'], 0, 0)->toTimeString();
            $data['waiting_end'] = Carbon::createFromTime($data['waiting_end'], 0, 0)->toTimeString();

            $operationTime = OperationTime::create($data);

            return $this->Success(
                data: $operationTime,
                message: 'Horário de operação criado com sucesso.',
                statusCode: 201
            );
        } catch (Exception $e) {
            return $this->Error(
                message: 'Erro ao criar horário de operação, verifique as credenciais!',
                statusCode: 400
            );
        }
    }

    public function show(OperationTime $operationTime)
    {
        try {
            return $this->Success(
                data: $operationTime,
                message: 'Detalhes do horário de operação recuperados com sucesso.',
                statusCode: 200
            );
        } catch (Exception $e) {
            return $this->Error(
                message: 'Erro ao recuperar os dados!',
                statusCode: 500
            );
        }
    }

    public function update(StoreOperationTimeRequest $request, OperationTime $operationTime)
    {
        try {
            $data = $request->validated();

            $data['day_of_week'] = Carbon::createFromFormat('d/m/Y', $data['day_of_week'])->format('Y-m-d');
            $data['start_time'] = Carbon::createFromTime($data['start_time'], 0, 0)->toTimeString();
            $data['end_time'] = Carbon::createFromTime($data['end_time'], 0, 0)->toTimeString();
            $data['waiting_start'] = Carbon::createFromTime($data['waiting_start'], 0, 0)->toTimeString();
            $data['waiting_end'] = Carbon::createFromTime($data['waiting_end'], 0, 0)->toTimeString();

            $operationTime->update($data);

            return $this->Success(
                data: $operationTime,
                message: 'Horário de operação atualizado com sucesso!',
                statusCode: 200
            );
        } catch (Exception $e) {
            return $this->Error(
                message: 'Erro ao atualizar o horário de operação!',
                statusCode: 400
            );
        }
    }

    public function destroy(OperationTime $operationTime)
    {
        try {
            $operationTime->delete();

            return $this->Success(
                data: $operationTime,
                message: 'Horário de operação deletado com sucesso!',
                statusCode: 200
            );
        } catch (Exception $e) {
            return $this->Error(
                message: 'Erro ao deletar o horário de operação!',
                statusCode: 500
            );
        }
    }
}
