<?php

namespace App\Http\Controllers;

use App\Models\Schedule;
use App\Support\Audit;
use App\Support\Avaliacoes;
use App\Support\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Avaliações dos clientes: aba do painel e seção pública da página de agendamento. */
class AvaliacoesController extends Controller
{
    public function __construct(protected TenantContext $tenant) {}

    /** GET /avaliacoes?nota=&profissional=&status=publica|interna|oculta&pagina= (painel) */
    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'nota' => 'nullable|integer|between:1,5',
            'profissional' => 'nullable|integer',
            'status' => 'nullable|in:publica,interna,oculta,sem_resposta',
        ]);
        $bs = $this->tenant->barbershop();

        $q = Schedule::query()->with(['client:id,name', 'worker:id,name'])->whereNotNull('avaliacao_nota')
            ->when($request->filled('nota'), fn ($q) => $q->where('avaliacao_nota', (int) $request->query('nota')))
            ->when($request->filled('profissional'), fn ($q) => $q->where('worker_id', (int) $request->query('profissional')))
            ->when($request->query('status') === 'oculta', fn ($q) => $q->where('avaliacao_oculta', true))
            ->when($request->query('status') === 'sem_resposta', fn ($q) => $q->whereNull('avaliacao_resposta')->whereNotNull('avaliacao_comentario'))
            ->when($request->query('status') === 'publica', fn ($q) => $q->where('avaliacao_oculta', false)->where('avaliacao_nota', '>=', Avaliacoes::NOTA_PUBLICA)->whereNotNull('avaliacao_comentario'))
            ->when($request->query('status') === 'interna', fn ($q) => $q->where('avaliacao_oculta', false)->where(fn ($q) => $q->where('avaliacao_nota', '<', Avaliacoes::NOTA_PUBLICA)->orWhereNull('avaliacao_comentario')))
            ->latest('avaliacao_em');

        $pagina = $q->paginate(20);

        // números gerais (sem filtro): média, distribuição e quantas esperam resposta
        $todas = Schedule::query()->whereNotNull('avaliacao_nota');
        $dist = (clone $todas)->selectRaw('avaliacao_nota as nota, COUNT(*) as n')->groupBy('avaliacao_nota')->pluck('n', 'nota');

        return response()->json([
            'data' => collect($pagina->items())->map(fn (Schedule $s) => $this->item($s)),
            'meta' => ['pagina' => $pagina->currentPage(), 'ultima' => $pagina->lastPage(), 'total' => $pagina->total()],
            'resumo' => (Avaliacoes::resumo($bs) ?? ['media' => null, 'total' => 0]) + [
                'distribuicao' => collect(range(1, 5))->mapWithKeys(fn ($n) => [$n => (int) ($dist[$n] ?? 0)]),
                'publicas' => Avaliacoes::publicas($bs)->count(),
                'sem_resposta' => (clone $todas)->whereNotNull('avaliacao_comentario')->whereNull('avaliacao_resposta')->count(),
            ],
        ]);
    }

    /** PUT /avaliacoes/{schedule} {oculta?, resposta?} (painel) */
    public function update(Request $request, Schedule $schedule): JsonResponse
    {
        abort_if($schedule->avaliacao_nota === null, 404);
        $data = $request->validate([
            'oculta' => 'sometimes|boolean',
            'resposta' => 'sometimes|nullable|string|max:500',
        ]);

        $campos = [];
        if (array_key_exists('oculta', $data)) {
            $campos['avaliacao_oculta'] = $data['oculta'];
        }
        if (array_key_exists('resposta', $data)) {
            $resposta = trim((string) $data['resposta']) ?: null;
            $campos['avaliacao_resposta'] = $resposta;
            $campos['avaliacao_respondida_em'] = $resposta ? now() : null;
        }
        $schedule->update($campos);
        Audit::log('avaliacao.atualizada', $schedule, isset($campos['avaliacao_oculta'])
            ? ($campos['avaliacao_oculta'] ? 'Avaliação escondida da página' : 'Avaliação de volta à página')
            : 'Resposta à avaliação salva');

        return response()->json(['message' => 'Avaliação atualizada.', 'avaliacao' => $this->item($schedule->fresh(['client', 'worker']))]);
    }

    /** GET /b/{slug}/avaliacoes?pagina= (público: só as publicadas) */
    public function publicas(Request $request): JsonResponse
    {
        $bs = $this->tenant->barbershop();
        abort_unless($bs, 404);

        $pagina = Avaliacoes::publicas($bs)->with(['client:id,name', 'worker:id,name'])->latest('avaliacao_em')->paginate(6);

        return response()->json([
            'resumo' => Avaliacoes::resumo($bs),
            'data' => collect($pagina->items())->map(fn (Schedule $s) => [
                'id' => $s->id,
                'nota' => $s->avaliacao_nota,
                'comentario' => $s->avaliacao_comentario,
                'cliente' => Avaliacoes::nomeCurto($s->client?->name),
                'profissional' => $s->worker?->name,
                'em' => $s->avaliacao_em?->toDateString(),
                'resposta' => $s->avaliacao_resposta,
            ]),
            'mais' => $pagina->hasMorePages(),
        ]);
    }

    private function item(Schedule $s): array
    {
        return [
            'id' => $s->id,
            'nota' => $s->avaliacao_nota,
            'comentario' => $s->avaliacao_comentario,
            'cliente' => $s->client?->name,
            'cliente_id' => $s->client_id,
            'profissional' => $s->worker?->name,
            'data_atendimento' => substr((string) $s->date, 0, 10),
            'em' => $s->avaliacao_em,
            'oculta' => (bool) $s->avaliacao_oculta,
            'publica' => Avaliacoes::ehPublica($s),
            'resposta' => $s->avaliacao_resposta,
            'respondida_em' => $s->avaliacao_respondida_em,
        ];
    }
}
