<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Traits\ApiResponse;
use App\Http\Requests\StoreWorkerRequest;
use App\Models\Worker;
use Exception;

class WorkerController extends Controller
{
    use ApiResponse;

    public function index()
    {
        try {
            $workers = Worker::all();

            return $this->Success(
                data: $workers,
                message: 'Profissionais listados com sucesso.',
                statusCode: 200
            );
        } catch (Exception $e) {
            return $this->Error(
                message: 'Erro ao buscar a lista de profissionais!',
                statusCode: 500
            );
        }
    }

    public function store(StoreWorkerRequest $request)
    {
        try {
            $data = $request->validated();

            $worker = Worker::create($data);

            return $this->Success(
                data: $worker,
                message: 'Profissional criado com sucesso.',
                statusCode: 201
            );
        } catch (Exception $e) {
            return $this->Error(
                message: 'Erro ao criar profissional, verifique as credenciais!',
                statusCode: 400
            );
        }
    }

    public function show(Worker $worker)
    {
        try {
            return $this->Success(
                data: $worker,
                message: 'Detalhes do profissional recuperados com sucesso.',
                statusCode: 200
            );
        } catch (Exception $e) {
            return $this->Error(
                message: 'Erro ao recuperar os dados!',
                statusCode: 500
            );
        }
    }

    public function update(StoreWorkerRequest $request, Worker $worker)
    {
        try {
            $data = $request->validated();

            $worker->update($data);

            return $this->Success(
                data: $worker,
                message: 'Profissional atualizado com sucesso!',
                statusCode: 200
            );
        } catch (Exception $e) {
            return $this->Error(
                message: 'Erro ao atualizar o profissional!',
                statusCode: 400
            );
        }
    }

    public function destroy(Worker $worker)
    {
        try {
            $worker->delete();

            return $this->Success(
                data: $worker,
                message: 'Profissional deletado com sucesso!',
                statusCode: 200
            );
        } catch (Exception $e) {
            return $this->Error(
                message: 'Erro ao deletar o profissional!',
                statusCode: 500
            );
        }
    }
}
