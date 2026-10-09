<?php

namespace App\Http\Controllers;

use App\Models\BarbershopPhoto;
use App\Models\Service;
use App\Support\Audit;
use App\Support\Imagem;
use App\Support\PaginaPersonalizada;
use App\Support\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/** "Personalizar página": estilo, capa, galeria e textos da página de agendamento. */
class PaginaController extends Controller
{
    public function __construct(protected TenantContext $tenant) {}

    /** GET /pagina */
    public function show(): JsonResponse
    {
        return response()->json($this->estado());
    }

    /** PUT /pagina — só os campos enviados mudam */
    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'estilo' => ['sometimes', Rule::in(PaginaPersonalizada::ESTILOS)],
            'fonte' => ['sometimes', Rule::in(PaginaPersonalizada::FONTES)],
            'modo' => ['sometimes', Rule::in(PaginaPersonalizada::MODOS)],
            'textura' => ['sometimes', Rule::in(PaginaPersonalizada::TEXTURAS)],
            'boas_vindas' => 'sometimes|nullable|string|max:140',
            'sobre' => 'sometimes|nullable|string|max:600',
            'mensagem_sucesso' => 'sometimes|nullable|string|max:200',
            'mostrar_endereco' => 'sometimes|boolean',
            'mostrar_horarios' => 'sometimes|boolean',
        ]);

        // textos vazios voltam ao padrão
        foreach (['boas_vindas', 'sobre', 'mensagem_sucesso'] as $k) {
            if (array_key_exists($k, $data)) {
                $data[$k] = trim((string) $data[$k]) ?: null;
            }
        }

        $bs = $this->tenant->barbershop();
        $bs->update(['pagina' => array_merge(PaginaPersonalizada::config($bs), $data)]);

        return response()->json(['message' => 'Página salva.'] + $this->estado());
    }

    /** POST /pagina/capa (multipart: arquivo) */
    public function capa(Request $request): JsonResponse
    {
        $request->validate(['arquivo' => Imagem::REGRA]);
        $bs = $this->tenant->barbershop();
        $config = PaginaPersonalizada::config($bs);

        $novo = Imagem::salvarRedimensionada($request->file('arquivo'), "capas/{$bs->id}", 1600);
        Imagem::apagar($config['capa_path']);
        $bs->update(['pagina' => array_merge($config, ['capa_path' => $novo])]);
        Audit::log('pagina.capa', $bs, 'Foto de capa atualizada');

        return response()->json(['message' => 'Capa atualizada.'] + $this->estado());
    }

    /** DELETE /pagina/capa */
    public function removerCapa(): JsonResponse
    {
        $bs = $this->tenant->barbershop();
        $config = PaginaPersonalizada::config($bs);
        Imagem::apagar($config['capa_path']);
        $bs->update(['pagina' => array_merge($config, ['capa_path' => null])]);

        return response()->json(['message' => 'Capa removida.'] + $this->estado());
    }

    /** POST /pagina/galeria (multipart: arquivo, legenda?) */
    public function adicionarFoto(Request $request): JsonResponse
    {
        $request->validate(['arquivo' => Imagem::REGRA, 'legenda' => 'nullable|string|max:120']);
        $bs = $this->tenant->barbershop();

        if (BarbershopPhoto::count() >= PaginaPersonalizada::MAX_FOTOS) {
            throw ValidationException::withMessages(['arquivo' => 'A galeria tem no máximo '.PaginaPersonalizada::MAX_FOTOS.' fotos. Remova uma para enviar outra.']);
        }

        BarbershopPhoto::create([
            'path' => Imagem::salvarRedimensionada($request->file('arquivo'), "galeria/{$bs->id}", 1200),
            'legenda' => trim((string) $request->input('legenda')) ?: null,
            'ordem' => (int) BarbershopPhoto::max('ordem') + 1,
        ]);

        return response()->json(['message' => 'Foto adicionada à galeria.'] + $this->estado(), 201);
    }

    /** DELETE /pagina/galeria/{foto} */
    public function removerFoto(BarbershopPhoto $foto): JsonResponse
    {
        Imagem::apagar($foto->path);
        $foto->delete();

        return response()->json(['message' => 'Foto removida.'] + $this->estado());
    }

    /** PUT /pagina/galeria/ordem {ids: [..]} */
    public function ordenarGaleria(Request $request): JsonResponse
    {
        $ids = $request->validate(['ids' => 'required|array|max:'.PaginaPersonalizada::MAX_FOTOS, 'ids.*' => 'integer'])['ids'];
        $this->ordenar(BarbershopPhoto::class, $ids);

        return response()->json(['message' => 'Ordem salva.'] + $this->estado());
    }

    /** PUT /pagina/servicos/ordem {ids: [..]} — ordem em que os serviços aparecem na página */
    public function ordenarServicos(Request $request): JsonResponse
    {
        $ids = $request->validate(['ids' => 'required|array|max:200', 'ids.*' => 'integer'])['ids'];
        $this->ordenar(Service::class, $ids);

        return response()->json(['message' => 'Ordem dos serviços salva.']);
    }

    /** POST /servicos/{service}/foto (multipart: arquivo) */
    public function fotoServico(Request $request, Service $service): JsonResponse
    {
        $request->validate(['arquivo' => Imagem::REGRA]);
        $novo = Imagem::salvarQuadrada($request->file('arquivo'), "servicos/{$service->barbershop_id}", 400);
        Imagem::apagar($service->photo);
        $service->update(['photo' => Imagem::url($novo)]);

        return response()->json(['message' => 'Foto do serviço atualizada.', 'photo' => $service->photo]);
    }

    /** DELETE /servicos/{service}/foto */
    public function removerFotoServico(Service $service): JsonResponse
    {
        Imagem::apagar($service->photo);
        $service->update(['photo' => null]);

        return response()->json(['message' => 'Foto do serviço removida.']);
    }

    /** Grava a posição de cada id (só os da barbearia: o escopo do tenant filtra). */
    private function ordenar(string $model, array $ids): void
    {
        DB::transaction(function () use ($model, $ids) {
            foreach (array_values($ids) as $pos => $id) {
                $model::whereKey($id)->update(['ordem' => $pos + 1]);
            }
        });
    }

    private function estado(): array
    {
        $bs = $this->tenant->barbershop()->fresh();
        $config = PaginaPersonalizada::config($bs);

        return [
            'pagina' => array_diff_key($config, ['capa_path' => true]) + ['capa_url' => $config['capa_path'] ? Imagem::url($config['capa_path']) : null],
            'galeria' => BarbershopPhoto::orderBy('ordem')->orderBy('id')->get(['id', 'path', 'legenda', 'ordem']),
            // para a pré-visualização ao vivo (o painel monta a página como ela vai ficar)
            'contato' => PaginaPersonalizada::contato($bs),
            'slug' => $bs->slug,
            'opcoes' => [
                'estilos' => PaginaPersonalizada::ESTILOS,
                'fontes' => PaginaPersonalizada::FONTES,
                'modos' => PaginaPersonalizada::MODOS,
                'texturas' => PaginaPersonalizada::TEXTURAS,
                'max_fotos' => PaginaPersonalizada::MAX_FOTOS,
            ],
        ];
    }
}
