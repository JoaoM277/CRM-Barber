<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Traits\ApiResponse;
use App\Http\Requests\StoreClientRequest;
use App\Models\Client;
use Exception;

class ClientController extends Controller
{
    use ApiResponse;

    public function index()
    {
        try {
            $clients = Client::all();

            return $this->Success(
                data: $clients,
                message: 'Clientes listados com sucesso.',
                statusCode: 200
            );
        } catch (Exception $e) {
            return $this->Error(
                message: 'Erro ao buscar a lista de clientes!',
                statusCode: 500
            );
        }
    }

    public function store(StoreClientRequest $request)
    {
        try {
            $data = $request->validated();

            $client = Client::create($data);

            return $this->Success(
                data: $client,
                message: 'Cliente criado com sucesso.',
                statusCode: 201
            );
        } catch (Exception $e) {
            return $this->Error(
                message: 'Erro ao criar cliente, verifique as credenciais!',
                statusCode: 400
            );
        }
    }

    public function show(Client $client)
    {
        try {
            return $this->Success(
                data: $client,
                message: 'Detalhes do cliente recuperados com sucesso.',
                statusCode: 200
            );
        } catch (Exception $e) {
            return $this->Error(
                message: 'Erro ao recuperar os dados!',
                statusCode: 500
            );
        }
    }

    public function update(StoreClientRequest $request, Client $client)
    {
        try {
            $data = $request->validated();

            $client->update($data);

            return $this->Success(
                data: $client,
                message: 'Cliente atualizado com sucesso!',
                statusCode: 200
            );
        } catch (Exception $e) {
            return $this->Error(
                message: 'Erro ao atualizar o cliente!',
                statusCode: 400
            );
        }
    }

    public function destroy(Client $client)
    {
        try {
            $client->delete();

            return $this->Success(
                data: $client,
                message: 'Cliente deletado com sucesso!',
                statusCode: 200
            );
        } catch (Exception $e) {
            return $this->Error(
                message: 'Erro ao deletar o cliente!',
                statusCode: 500
            );
        }
    }
}
