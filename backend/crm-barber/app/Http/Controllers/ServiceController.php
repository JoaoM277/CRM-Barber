<?php

namespace App\Http\Controllers;

use App\Models\Service;
use App\Http\Requests\StoreServiceRequest;
use App\Support\Audit;
use App\Support\PaginaPersonalizada;
use App\Support\TenantContext;
use Illuminate\Http\Request;

class ServiceController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        // página pública de agendamento: só os serviços oferecidos
        if ($request->routeIs('servicos.index')) {
            // foto, destaque e categoria são da personalização (Pro/Premium)
            $extras = PaginaPersonalizada::liberada(app(TenantContext::class)->barbershop());

            return response()->json(
                Service::where('active', true)->orderBy('ordem')->orderBy('name')
                    ->get(['id', 'name', 'description', 'duration_time', 'price', 'active', 'photo', 'destaque', 'categoria'])
                    ->map(fn (Service $s) => $extras ? $s : $s->setAttribute('photo', null)->setAttribute('destaque', null)->setAttribute('categoria', null)),
                200
            );
        }

        return response()->json(Service::orderBy('ordem')->orderBy('name')->get(), 200);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(StoreServiceRequest $request)
    {
        $service = Service::create($request->validated());

        return response()->json([
            'message' => 'Serviço criado com sucesso!',
            'service' => $service,
        ], 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(Service $service)
    {
        return response()->json($service);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, Service $service)
    {
        $data = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'description' => 'sometimes|nullable|string',
            'duration_time' => 'sometimes|nullable|integer|min:1',
            'price' => 'sometimes|numeric',
            'active' => 'sometimes|boolean',
            'destaque' => ['sometimes', 'nullable', 'in:mais_pedido,novo'],
            'categoria' => 'sometimes|nullable|string|max:40',
        ]);

        $service->update($data);

        return response()->json([
            'message' => 'Serviço atualizado com sucesso!',
            'service' => $service->fresh(),
        ], 200);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Service $service)
    {
        $nome = $service->name;
        $service->delete();

        Audit::log('servico.excluido', $service, "Serviço \"{$nome}\" excluído");

        return response()->json([
            'message' => 'Serviço deletado com sucesso!',
            'service' => $service,
        ], 200);
    }
}
