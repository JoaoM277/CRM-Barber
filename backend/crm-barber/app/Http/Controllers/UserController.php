<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreUserRequest;
use App\Http\Requests\UpdateUserRequest;
use App\Models\User;
use App\Support\TenantContext;
use Illuminate\Http\Request;

class UserController extends Controller
{
    public function __construct(protected TenantContext $tenant) {}

    /** Restringe a query aos usuários da barbearia do tenant atual. */
    protected function scoped()
    {
        return User::query()->where('barbershop_id', $this->tenant->id());
    }

    /** 404 se o usuário não for da barbearia atual (isolamento de tenant). */
    protected function assertSameTenant(User $user): void
    {
        abort_unless($user->barbershop_id === $this->tenant->id(), 404);
    }

    public function index()
    {
        return response()->json($this->scoped()->with('barbershop')->get(), 200);
    }

    public function store(StoreUserRequest $request)
    {
        $data = $request->validated();
        $data['barbershop_id'] = $this->tenant->id(); // nunca confia no payload

        $user = User::create($data);

        return response()->json([
            'message' => 'Usuário criado com sucesso!',
            'user' => $user->load('barbershop'),
        ], 201);
    }

    public function show(User $usuario)
    {
        $this->assertSameTenant($usuario);

        return response()->json($usuario->load('barbershop'), 200);
    }

    public function update(UpdateUserRequest $request, User $usuario)
    {
        $this->assertSameTenant($usuario);

        $data = $request->validated();
        unset($data['barbershop_id']); // não permite migrar usuário de barbearia

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
        $this->assertSameTenant($usuario);

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
