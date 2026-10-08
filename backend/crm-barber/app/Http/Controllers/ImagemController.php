<?php

namespace App\Http\Controllers;

use App\Models\Worker;
use App\Support\Audit;
use App\Support\Imagem;
use App\Support\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Upload do logo da barbearia e da foto dos profissionais. */
class ImagemController extends Controller
{
    public function __construct(protected TenantContext $tenant) {}

    /** POST /barbearia/logo (multipart: arquivo) */
    public function logo(Request $request): JsonResponse
    {
        $request->validate(['arquivo' => Imagem::REGRA], $this->mensagens());
        $bs = $this->tenant->barbershop();

        $novo = Imagem::salvarQuadrada($request->file('arquivo'), "logos/{$bs->id}", 512);
        Imagem::apagar($bs->logo_path);
        $bs->update(['logo_path' => $novo]);
        Audit::log('barbearia.logo', $bs, 'Logo atualizado');

        return response()->json(['message' => 'Logo atualizado.', 'logo_url' => Imagem::url($novo)]);
    }

    /** DELETE /barbearia/logo */
    public function removerLogo(): JsonResponse
    {
        $bs = $this->tenant->barbershop();
        Imagem::apagar($bs->logo_path);
        $bs->update(['logo_path' => null]);

        return response()->json(['message' => 'Logo removido.']);
    }

    /** POST /profissionais/{worker}/foto (multipart: arquivo) */
    public function foto(Request $request, Worker $worker): JsonResponse
    {
        $request->validate(['arquivo' => Imagem::REGRA], $this->mensagens());

        $novo = Imagem::salvarQuadrada($request->file('arquivo'), "profissionais/{$worker->barbershop_id}", 400);
        Imagem::apagar($worker->photo);
        // a foto fica como URL pública: é o que a página de agendamento exibe direto
        $worker->update(['photo' => Imagem::url($novo)]);

        return response()->json(['message' => 'Foto atualizada.', 'photo' => $worker->photo]);
    }

    /** DELETE /profissionais/{worker}/foto */
    public function removerFoto(Worker $worker): JsonResponse
    {
        Imagem::apagar($worker->photo);
        $worker->update(['photo' => null]);

        return response()->json(['message' => 'Foto removida.']);
    }

    private function mensagens(): array
    {
        return [
            'arquivo.required' => 'Escolha uma imagem.',
            'arquivo.image' => 'O arquivo precisa ser uma imagem.',
            'arquivo.mimes' => 'Envie a imagem em JPG, PNG ou WebP.',
            'arquivo.max' => 'A imagem pode ter no máximo 5 MB.',
        ];
    }
}
