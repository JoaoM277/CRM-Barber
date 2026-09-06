<?php

namespace App\Http\Controllers;

use App\Models\Aviso;
use Illuminate\Http\Request;

class AvisoController extends Controller
{
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
        $aviso = Aviso::firstOrCreate(
            ['id' => (int) $id],
            ['titulo' => '', 'mensagem' => '', 'ativo' => false],
        );

        return response()->json($aviso);
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

        $aviso = Aviso::firstOrNew(['id' => (int) $id]);
        $aviso->fill($data)->save();

        return response()->json([
            'message' => 'Aviso atualizado com sucesso!',
            'aviso' => $aviso->fresh(),
        ]);
    }
}
