<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreWorkerRequest;
use App\Models\Worker;
use Illuminate\Http\Request;
use App\Http\Requests\UpdateWorkerRequest;

class WorkerController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        $worker = Worker::all();
        
        return response()->json($worker, 200);
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
            'phone' => 'required|string|max:20|unique:workers,phone',
            'photo' => 'nullable|string',
            'speciality' => 'nullable|string',
            'active' => 'boolean'
        ]);

        $worker = Worker::create($data);

        return response()->json([
            'message' => 'Profissional criado com sucesso!',
            'worker' => $worker
        ], 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(Worker $worker)
    {
        return response()->json($worker, 201);
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(Worker $worker)
    {
        //
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, Worker $worker)
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'phone' => 'required|string|max:20|unique:workers,phone',
            'photo' => 'nullable|string',
            'speciality' => 'nullable|string',
            'active' => 'boolean'
        ]);

        $worker->update($data);

        return response()->json([
            'message' => 'Profissional atualizado com sucesso!'
        ], 200);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Worker $worker)
    {
        $worker->delete();

        return response()->json([
        'message' => 'Profissional deletado com sucesso!',
        'worker' => $worker
        ], 200);
    }
}
