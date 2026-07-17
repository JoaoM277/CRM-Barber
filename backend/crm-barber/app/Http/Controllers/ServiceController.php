<?php

namespace App\Http\Controllers;

use App\Models\Service;
use App\Http\Requests\StoreServiceRequest;
use Illuminate\Http\Request;
use App\Http\Requests\UpdateServiceRequest;
use Carbon\CarbonInterval;
use Illuminate\Foundation\Console\ServeCommand;

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
     * Show the form for creating a new resource.
     */
    public function create()
    {
        //
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'duration_time' => 'integer|min:1',
            'price' => 'numeric',
            'active' => 'boolean'
        ]);

        $validated['duration_time'] = CarbonInterval::minutes($request->duration_time)
        ->cascade()
        ->format('%H:%I:%S');
        
        $service = Service::create($data);
        $service->update($validated);

        return response()->json([
            'message' => 'Serviço criado com sucesso!',
            'serviço' => $service
        ], 200);
    }

    /**
     * Display the specified resource.
     */
    public function show(Service $service)
    {
        return response()->json($service);
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(Service $service)
    {
        //
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, Service $service)
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'duration_time' => 'integer|min:1',
            'price' => 'numeric',
            'active' => 'boolean'
        ]);

        $validated['duration_time'] = CarbonInterval::minutes($request->duration_time)
        ->cascade()
        ->format('%H:%I:%S');

        $service->update($data);
        $service->update($validated);

        return response()->json([
            'message' => 'Serviço atualizado com sucesso!',
            'service' => $service
        ], 200);

    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Service $service)
    {
        $service->delete();

        return response()->json([
            'message' => 'Serviço deletado com sucesso!',
            'service' => $service
        ], 200);
    }
}
