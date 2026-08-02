<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Traits\ApiResponse;
use App\Http\Requests\StoreServiceRequest;
use App\Models\Service;
use Carbon\CarbonInterval;
use Exception;

class ServiceController extends Controller
{
    use ApiResponse;

    public function index()
    {
        try {
            $services = Service::all();

            return $this->Success(
                data: $services,
                message: 'Serviços listados com sucesso.',
                statusCode: 200
            );
        } catch (Exception $e) {
            return $this->Error(
                message: 'Erro ao buscar a lista de serviços!',
                statusCode: 500
            );
        }
    }

    public function store(StoreServiceRequest $request)
    {
        try {
            $data = $request->validated();

            if (isset($data['duration_time'])) {
                $data['duration_time'] = CarbonInterval::minutes($data['duration_time'])
                    ->cascade()
                    ->format('%H:%I:%S');
            }

            $service = Service::create($data);

            return $this->Success(
                data: $service,
                message: 'Serviço criado com sucesso.',
                statusCode: 201
            );
        } catch (Exception $e) {
            return $this->Error(
                message: 'Erro ao criar serviço, verifique as credenciais!',
                statusCode: 400
            );
        }
    }

    public function show(Service $service)
    {
        try {
            return $this->Success(
                data: $service,
                message: 'Detalhes do serviço recuperados com sucesso.',
                statusCode: 200
            );
        } catch (Exception $e) {
            return $this->Error(
                message: 'Erro ao recuperar os dados!',
                statusCode: 500
            );
        }
    }

    public function update(StoreServiceRequest $request, Service $service)
    {
        try {
            $data = $request->validated();

            if (isset($data['duration_time'])) {
                $data['duration_time'] = CarbonInterval::minutes($data['duration_time'])
                    ->cascade()
                    ->format('%H:%I:%S');
            }

            $service->update($data);

            return $this->Success(
                data: $service,
                message: 'Serviço atualizado com sucesso!',
                statusCode: 200
            );
        } catch (Exception $e) {
            return $this->Error(
                message: 'Erro ao atualizar o serviço!',
                statusCode: 400
            );
        }
    }

    public function destroy(Service $service)
    {
        try {
            $service->delete();

            return $this->Success(
                data: $service,
                message: 'Serviço deletado com sucesso!',
                statusCode: 200
            );
        } catch (Exception $e) {
            return $this->Error(
                message: 'Erro ao deletar o serviço!',
                statusCode: 500
            );
        }
    }
}
