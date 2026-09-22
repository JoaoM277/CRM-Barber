<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreBarbershopRequest;
use App\Models\Barbershop;
use App\Support\TenantContext;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class BarbershopController extends Controller
{
    public function __construct(protected TenantContext $tenant) {}

    /** 404 se a barbearia da rota não for a do tenant logado. */
    protected function assertTenant(Barbershop $barbershop): void
    {
        abort_unless($barbershop->id === $this->tenant->id(), 404);
    }

    /**
     * Só a barbearia do usuário logado (nunca a lista global).
     */
    public function index()
    {
        return response()->json(
            Barbershop::where('id', $this->tenant->id())->get(),
            200,
        );
    }

    /**
     * Identidade visual pública da barbearia do tenant atual.
     * Consumida pela página de agendamento.
     */
    public function publicIdentity(TenantContext $tenant)
    {
        $bs = $tenant->barbershop();

        $accentPadrao = '#C89B3C';

        if (! $bs) {
            return response()->json([
                'name' => 'Barbearia',
                'subtitle' => 'BARBEARIA',
                'logo_url' => null,
                'city' => null,
                'state' => null,
                'accent_color' => $accentPadrao,
                'secondary_color' => $accentPadrao,
            ]);
        }

        $logoUrl = null;
        if ($bs->logo_path) {
            $logoUrl = str_starts_with($bs->logo_path, 'http')
                ? $bs->logo_path
                : Storage::disk('public')->url($bs->logo_path);
        }

        return response()->json([
            'name' => $bs->name,
            'subtitle' => $bs->subtitle ?: 'BARBEARIA',
            'logo_url' => $logoUrl,
            'city' => $bs->city,
            'state' => $bs->state,
            'accent_color' => $bs->accent_color ?: $accentPadrao,
            'secondary_color' => $bs->secondary_color ?: ($bs->accent_color ?: $accentPadrao),
        ]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(StoreBarbershopRequest $request)
    {
        $validated = $request->validated();

        $barbershop = Barbershop::create($validated);

        return response()->json($barbershop, 201);

    }

    /**
     * Display the specified resource.
     */
    public function show(Barbershop $barbershop)
    {
        $this->assertTenant($barbershop);

        return response()->json($barbershop);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, Barbershop $barbershop)
    {
        $this->assertTenant($barbershop);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'slug' => ['required', 'string', 'max:255', \Illuminate\Validation\Rule::unique('barbershops', 'slug')->ignore($barbershop->id)],

            'phone' => 'nullable|string|max:20',
            'email' => ['nullable', 'email', \Illuminate\Validation\Rule::unique('barbershops', 'email')->ignore($barbershop->id)],

            'zip_code' => 'nullable|string|max:10',
            'street' => 'nullable|string|max:255',
            'number' => 'nullable|string|max:20',
            'complement' => 'nullable|string|max:255',
            'neighborhood' => 'nullable|string|max:255',
            'city' => 'nullable|string|max:255',
            'state' => 'nullable|string|size:2',

            'logo_path' => 'nullable|string|max:255',

            'subtitle' => 'nullable|string|max:255',
            'accent_color' => ['nullable', 'string', 'regex:/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/'],
            'secondary_color' => ['nullable', 'string', 'regex:/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/'],

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

        return response()->json($barbershop->fresh(), 200);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Barbershop $barbershop)
    {
        $this->assertTenant($barbershop);

        $barbershop->delete();

        return response()->json(['Barbearia deletada com sucesso'], 200);
    }
}
