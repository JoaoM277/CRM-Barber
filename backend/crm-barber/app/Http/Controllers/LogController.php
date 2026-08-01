<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Traits\ApiResponse;
use App\Http\Requests\StoreLogRequest;
use App\Models\Log;
use Exception;

class LogController extends Controller
{
    use ApiResponse;

    public function index()
    {
        try {
            $logs = Log::all();

            return $this->Success(
                data: $logs,
                message: 'Logs listados com sucesso.',
                statusCode: 200
            );
        } catch (Exception $e) {
            return $this->Error(
                message: 'Erro ao buscar a lista de logs!',
                statusCode: 500
            );
        }
    }

    public function store(StoreLogRequest $request)
    {
        try {
            $data = $request->validated();

            $log = Log::create($data);

            return $this->Success(
                data: $log,
                message: 'Log criado com sucesso.',
                statusCode: 201
            );
        } catch (Exception $e) {
            return $this->Error(
                message: 'Erro ao criar log, verifique as credenciais!',
                statusCode: 400
            );
        }
    }

    public function show(Log $log)
    {
        try {
            return $this->Success(
                data: $log,
                message: 'Detalhes do log recuperados com sucesso.',
                statusCode: 200
            );
        } catch (Exception $e) {
            return $this->Error(
                message: 'Erro ao recuperar os dados!',
                statusCode: 500
            );
        }
    }

    public function destroy(Log $log)
    {
        try {
            $log->delete();

            return $this->Success(
                data: $log,
                message: 'Log deletado com sucesso!',
                statusCode: 200
            );
        } catch (Exception $e) {
            return $this->Error(
                message: 'Erro ao deletar o log!',
                statusCode: 500
            );
        }
    }
}
