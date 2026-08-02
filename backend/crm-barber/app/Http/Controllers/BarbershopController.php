<?php

namespace App\Http\Controllers;

use App\Models\Barbershop;
use Illuminate\Http\Request;

class BarbershopController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        return response()->json(Barbershop::all(), 200);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'slug' => 'required|string|max:255|unique:barbershops,slug',

            'phone' => 'nullable|string|max:20',
            'email' => 'nullable|email|unique:barbershops,email',

            'zip_code' => 'nullable|string|max:10',
            'street' => 'nullable|string|max:255',
            'number' => 'nullable|string|max:20',
            'complement' => 'nullable|string|max:255',
            'neighborhood' => 'nullable|string|max:255',
            'city' => 'nullable|string|max:255',
            'state' => 'nullable|string|size:2',

            'logo' => 'nullable|string|max:255',

            'opening_time' => 'nullable|date_format:H:i',
            'closing_time' => 'nullable|date_format:H:i',

            'whatsapp' => 'nullable|string|max:20',
            'instagram' => 'nullable|string|max:255',
            'website' => 'nullable|url|max:255',

            'timezone' => 'nullable|string|max:100',

            'subscription_plan' => 'nullable|in:free,basic,premium',
            'subscription_ends_at' => 'nullable|date',

            'active' => 'nullable|boolean',
        ]);

        $barbershop = Barbershop::create($validated);

        return response()->json($barbershop, 201);

    }

    /**
     * Display the specified resource.
     */
    public function show(string $id)
    {
        return response()->json(Barbershop::findOrFail($id));
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, Barbershop $barbershop)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'slug' => 'required|string|max:255|unique:barbershops,slug',

            'phone' => 'nullable|string|max:20',
            'email' => 'nullable|email|unique:barbershops,email',

            'zip_code' => 'nullable|string|max:10',
            'street' => 'nullable|string|max:255',
            'number' => 'nullable|string|max:20',
            'complement' => 'nullable|string|max:255',
            'neighborhood' => 'nullable|string|max:255',
            'city' => 'nullable|string|max:255',
            'state' => 'nullable|string|size:2',

            'logo' => 'nullable|string|max:255',

            'opening_time' => 'nullable|date_format:H:i',
            'closing_time' => 'nullable|date_format:H:i',

            'whatsapp' => 'nullable|string|max:20',
            'instagram' => 'nullable|string|max:255',
            'website' => 'nullable|url|max:255',

            'timezone' => 'nullable|string|max:100',

            'subscription_plan' => 'nullable|in:free,basic,premium',
            'subscription_ends_at' => 'nullable|date',

            'active' => 'nullable|boolean',
        ]);

        $barbershop->update($validated);

        return response()->json($barbershop, 201);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Barbershop $barbershop)
    {
        $barbershop->delete();

        return response()->json(['Barbearia deletada com sucesso'], 200);
    }
}
