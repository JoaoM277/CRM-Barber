<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreUserRequest;
use App\Http\Requests\UpdateUserRequest;
use App\Models\User;
use Illuminate\Http\Request;

class UserController extends Controller
{
    public function index()
    {
        return response()->json(User::with('barbershop')->get(), 200);
    }

    public function store(StoreUserRequest $request)
    {
        $user = User::create($request->validated());

        return response()->json([
            'message' => 'Usuário criado com sucesso!',
            'user' => $user->load('barbershop'),
        ], 201);
    }

    public function show(User $usuario)
    {
        return response()->json($usuario->load('barbershop'), 200);
    }

    public function update(UpdateUserRequest $request, User $usuario)
    {
        $data = $request->validated();

        if (empty($data['password'])) {
            unset($data['password']);
        }

        $usuario->update($data);

        return response()->json([
            'message' => 'Usuário atualizado com sucesso!',
            'user' => $usuario->fresh()->load('barbershop'),
        ], 200);
    }

    public function destroy(User $usuario)
    {
        $usuario->delete();

        return response()->json([
            'message' => 'Usuário removido com sucesso!',
        ], 200);
    }

    public function paginaInicial(Request $request)
    {
        return response()->json([
            'message' => 'Bem-vindo ao CRM Barber!',
            'user' => $request->user()->load('barbershop'),
        ], 200);
    }
}
