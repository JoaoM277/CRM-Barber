<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreWorkerRequest;
use App\Models\Worker;
use App\Support\Audit;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

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
    public function store(StoreWorkerRequest $request)
    {
        $data = $request->validated();

        // Se existir um profissional excluído com o mesmo telefone, restaura
        // em vez de tentar inserir (o índice único não distingue soft-deleted).
        $worker = Worker::withTrashed()->where('phone', $data['phone'])->first();
        if ($worker) {
            $worker->restore();
            $worker->update($data);
        } else {
            $worker = Worker::create($data);
        }

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
        return response()->json($worker, 200);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, Worker $worker)
    {
        $data = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'phone' => ['sometimes', 'required', 'string', 'max:20', Rule::unique('workers', 'phone')->where('barbershop_id', $worker->barbershop_id)->whereNull('deleted_at')->ignore($worker->id)],
            'photo' => 'sometimes|nullable|string',
            'speciality' => 'sometimes|nullable|string',
            'active' => 'sometimes|boolean',
            'payment_type' => ['sometimes', Rule::in(\App\Models\Worker::PAYMENT_TYPES)],
            'commission_percent' => 'sometimes|nullable|numeric|min:0|max:100',
            'fixed_salary' => 'sometimes|nullable|numeric|min:0',
            'pix_key' => 'sometimes|nullable|string|max:255',
        ]);

        $worker->update($data);

        return response()->json([
            'message' => 'Profissional atualizado com sucesso!',
            'worker' => $worker->fresh(),
        ], 200);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Worker $worker)
    {
        $nome = $worker->name;
        $worker->delete();

        Audit::log('profissional.excluido', $worker, "Profissional \"{$nome}\" excluído");

        return response()->json([
        'message' => 'Profissional deletado com sucesso!',
        'worker' => $worker
        ], 200);
    }
}
