<?php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Models\Schedule;
use App\Models\StockMovement;
use App\Support\Audit;
use App\Support\ComandaProdutos;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Produtos: cadastro, estoque e venda no atendimento. */
class ProductController extends Controller
{
    /** GET /produtos (?ativos=1 para a venda no atendimento) */
    public function index(Request $request): JsonResponse
    {
        $produtos = Product::query()
            ->when($request->boolean('ativos'), fn ($q) => $q->where('active', true))
            ->orderBy('name')
            ->get();

        return response()->json($produtos);
    }

    /** POST /produtos (admin) */
    public function store(Request $request): JsonResponse
    {
        $produto = Product::create($this->validar($request) + ['stock' => (int) $request->input('stock', 0)]);
        if ($produto->stock !== 0) {
            $this->registrar($produto, $produto->stock, StockMovement::ENTRADA, 'Estoque inicial');
        }
        Audit::log('produto.criado', $produto, "Produto {$produto->name} cadastrado");

        return response()->json($produto->fresh(), 201);
    }

    /** PUT /produtos/{product} (admin) — o estoque muda só por entrada/ajuste */
    public function update(Request $request, Product $product): JsonResponse
    {
        $product->update($this->validar($request, parcial: true));

        return response()->json($product->fresh());
    }

    /** DELETE /produtos/{product} (admin) — some da venda; o histórico fica */
    public function destroy(Product $product): JsonResponse
    {
        $product->delete();
        Audit::log('produto.removido', $product, "Produto {$product->name} removido");

        return response()->json(['message' => 'Produto removido.']);
    }

    /**
     * POST /produtos/{product}/estoque (admin) {quantidade, motivo, observacao?}
     * entrada: soma (compra/reposição); ajuste: corrige o saldo (+ ou -) após contagem.
     */
    public function estoque(Request $request, Product $product): JsonResponse
    {
        $entrada = $request->input('motivo') === StockMovement::ENTRADA;
        $data = $request->validate([
            'motivo' => ['required', Rule::in([StockMovement::ENTRADA, StockMovement::AJUSTE])],
            'quantidade' => ['required', 'integer', 'not_in:0', $entrada ? 'between:1,10000' : 'between:-10000,10000'],
            'observacao' => 'nullable|string|max:255',
        ]);

        $product->increment('stock', (int) $data['quantidade']);
        $this->registrar($product, (int) $data['quantidade'], $data['motivo'], $data['observacao'] ?? null);

        return response()->json(['message' => 'Estoque atualizado.', 'produto' => $product->fresh()]);
    }

    /** GET /produtos/{product}/movimentos (admin) — últimas 50 movimentações */
    public function movimentos(Product $product): JsonResponse
    {
        return response()->json(
            $product->movements()->with('user:id,name')->latest('id')->limit(50)->get()
                ->map(fn (StockMovement $m) => [
                    'id' => $m->id,
                    'quantidade' => $m->quantity,
                    'motivo' => $m->reason,
                    'observacao' => $m->note,
                    'agendamento_id' => $m->schedule_id,
                    'usuario' => $m->user?->name,
                    'em' => $m->created_at,
                ])
        );
    }

    /**
     * PUT /agendamentos/{schedule}/produtos {itens: [{produto_id, quantidade}]}
     * Substitui os produtos vendidos no atendimento (lista completa).
     */
    public function vender(Request $request, Schedule $schedule): JsonResponse
    {
        $data = $request->validate([
            'itens' => 'present|array|max:30',
            'itens.*.produto_id' => ['required', 'integer', 'distinct', Rule::exists('products', 'id')->where('barbershop_id', $schedule->barbershop_id)],
            'itens.*.quantidade' => 'required|integer|min:1|max:99',
        ]);

        $itens = collect($data['itens'])->mapWithKeys(fn ($i) => [(int) $i['produto_id'] => (int) $i['quantidade']])->all();
        ComandaProdutos::sincronizar($schedule, $itens);

        return response()->json(['message' => 'Produtos do atendimento salvos.', 'produtos' => self::resumo($schedule->fresh())]);
    }

    /** Produtos de um atendimento no formato do painel. */
    public static function resumo(Schedule $s): array
    {
        $itens = $s->relationLoaded('products') ? $s->products : $s->products()->get();

        return $itens->map(fn (Product $p) => [
            'id' => $p->id,
            'nome' => $p->name,
            'quantidade' => (int) $p->pivot->quantity,
            'preco' => (float) $p->pivot->price,
            'total' => round((float) $p->pivot->price * (int) $p->pivot->quantity, 2),
        ])->values()->all();
    }

    private function validar(Request $request, bool $parcial = false): array
    {
        $req = $parcial ? 'sometimes' : 'required';

        $data = $request->validate([
            'name' => "{$req}|string|max:255",
            'description' => 'sometimes|nullable|string|max:500',
            'price' => "{$req}|numeric|min:0|max:99999",
            'cost' => 'sometimes|nullable|numeric|min:0|max:99999',
            // o saldo só muda por entrada/ajuste (fica no histórico); no cadastro, é o estoque inicial
            'stock' => $parcial ? 'prohibited' : 'sometimes|integer|between:-10000,10000',
            'stock_min' => 'sometimes|nullable|integer|min:0|max:10000',
            'commission_percent' => 'sometimes|numeric|min:0|max:100',
            'active' => 'sometimes|boolean',
        ]);
        unset($data['stock']);

        return $data;
    }

    private function registrar(Product $p, int $qtd, string $motivo, ?string $obs): void
    {
        StockMovement::create([
            'barbershop_id' => $p->barbershop_id,
            'product_id' => $p->id,
            'quantity' => $qtd,
            'reason' => $motivo,
            'user_id' => auth()->id(),
            'note' => $obs,
        ]);
    }
}
