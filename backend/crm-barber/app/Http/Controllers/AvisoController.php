<?php

namespace App\Http\Controllers;

use App\Models\Aviso;
use App\Support\TenantContext;
use Illuminate\Http\Request;

class AvisoController extends Controller
{
    public function __construct(protected TenantContext $tenant) {}

    /**
     * O aviso é um singleton por barbearia. Resolve (ou cria) o registro do
     * tenant atual; o {id} da rota é ignorado (mantido só por compat do painel).
     */
    protected function avisoDoTenant(): Aviso
    {
        return Aviso::firstOrCreate(
            ['barbershop_id' => $this->tenant->id()],
            ['titulo' => '', 'mensagem' => '', 'ativo' => false],
        );
    }

    /**
     * Endpoint público consumido pelo site (script.js).
     * Formato: { exibir: bool, dados: { id, titulo, mensagem } | null }
     */
    public function ativo()
    {
        $aviso = Aviso::where('ativo', true)->latest('updated_at')->first();

        return response()->json([
            'exibir' => (bool) $aviso,
            'dados' => $aviso ? [
                'id' => $aviso->id,
                'titulo' => $aviso->titulo,
                'mensagem' => $aviso->mensagem,
            ] : null,
        ]);
    }

    /**
     * Lista (painel).
     */
    public function index()
    {
        return response()->json(Aviso::orderByDesc('id')->get());
    }

    /**
     * Detalhe (painel). Cria o registro na hora se ainda não existir.
     */
    public function show(string $id)
    {
        return response()->json($this->avisoDoTenant());
    }

    /**
     * Atualiza (painel).
     */
    public function update(Request $request, string $id)
    {
        $data = $request->validate([
            'titulo' => 'required|string|max:255',
            'mensagem' => 'required|string|max:2000',
            'ativo' => 'required|boolean',
        ]);

        $aviso = $this->avisoDoTenant();
        $aviso->fill($data)->save();

        return response()->json([
            'message' => 'Aviso atualizado com sucesso!',
            'aviso' => $aviso->fresh(),
        ]);
    }
}
