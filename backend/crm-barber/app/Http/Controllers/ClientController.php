<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreClientRequest;
use App\Models\Client;
use App\Support\Audit;
use App\Support\Phone;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ClientController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        $clients = Client::all();

        return response()->json($clients, 200);
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
    public function store(StoreClientRequest $request)
    {
        $data = $request->validated();

        // Cliente excluído com o mesmo telefone -> restaura em vez de inserir
        // (o índice único não distingue soft-deleted).
        $client = Client::withTrashed()->where('phone', $data['phone'])->first();
        if ($client) {
            $client->restore();
            $client->update($data);
        } else {
            $client = Client::create($data);
        }

        return response()->json($client, 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(Client $client)
    {
        return response()->json($client, 200);
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(Client $client)
    {
        //
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, Client $client)
    {
        $request->merge(['phone' => Phone::normalizeBr((string) $request->input('phone'))]);

        $data = $request->validate([
            'name' => 'required|string|max:255',
            'email' => ['nullable', 'email', Rule::unique('clients', 'email')->where('barbershop_id', $client->barbershop_id)->whereNull('deleted_at')->ignore($client->id)],
            'phone' => ['required', 'string', 'max:20', Rule::unique('clients', 'phone')->where('barbershop_id', $client->barbershop_id)->whereNull('deleted_at')->ignore($client->id)],
            'birth_date' => 'nullable|date',
            'observation' => 'nullable|string',
        ]);

        $client->update($data);

        return response()->json(['message' => 'Cliente atualizado com sucesso!', 'data' => $client->fresh()], 200);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Client $client)
    {
        $nome = $client->name;
        $client->delete();

        Audit::log('cliente.excluido', $client, "Cliente \"{$nome}\" excluído");

        return response()->json([
            'message' => 'Client removed successfully!'
        ], 200);

    }
}
