<?php

namespace App\Http\Controllers;

use App\Models\Service;
use App\Http\Requests\StoreServiceRequest;
use App\Support\Audit;
use Illuminate\Http\Request;

class ServiceController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        $service = Service::all();

        return response()->json($service, 200);
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
