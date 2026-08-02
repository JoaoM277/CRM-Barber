<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Traits\ApiResponse;
use App\Http\Requests\StoreBarbershopRequest;
use App\Models\Barbershop;
use Exception;

class BarbershopController extends Controller
{
    use ApiResponse;

    public function index()
    {
        try {
            $barbershops = Barbershop::all();

            return $this->Success(
                data: $barbershops,
                message: 'Barbearias listadas com sucesso.',
                statusCode: 200
            );
        } catch (Exception $e) {
            return $this->Error(
                message: 'Erro ao buscar a lista de barbearias!',
                statusCode: 500
            );
        }
    }

    public function store(StoreBarbershopRequest $request)
    {
        try {
            $data = $request->validated();

            $barbershop = Barbershop::create($data);

            return $this->Success(
                data: $barbershop,
                message: 'Barbearia criada com sucesso.',
                statusCode: 201
            );
        } catch (Exception $e) {
            return $this->Error(
                message: 'Erro ao criar barbearia, verifique as credenciais!',
                statusCode: 400
            );
        }
    }

    public function show(Barbershop $barbershop)
    {
        try {
            return $this->Success(
                data: $barbershop,
                message: 'Detalhes da barbearia recuperados com sucesso.',
                statusCode: 200
            );
        } catch (Exception $e) {
            return $this->Error(
                message: 'Erro ao recuperar os dados!',
                statusCode: 500
            );
        }
    }

    public function update(StoreBarbershopRequest $request, Barbershop $barbershop)
    {
        try {
            $data = $request->validated();

            $barbershop->update($data);

            return $this->Success(
                data: $barbershop,
                message: 'Barbearia atualizada com sucesso!',
                statusCode: 200
            );
        } catch (Exception $e) {
            return $this->Error(
                message: 'Erro ao atualizar a barbearia!',
                statusCode: 400
            );
        }
    }

    public function destroy(Barbershop $barbershop)
    {
        try {
            $barbershop->delete();

            return $this->Success(
                data: $barbershop,
                message: 'Barbearia deletada com sucesso!',
                statusCode: 200
            );
        } catch (Exception $e) {
            return $this->Error(
                message: 'Erro ao deletar a barbearia!',
                statusCode: 500
            );
        }
    }
}
