<?php

namespace App\Support;

use App\Models\Product;
use App\Models\Schedule;
use App\Models\StockMovement;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Produtos vendidos num atendimento, sempre com o estoque andando junto:
 * cada diferença de quantidade vira uma movimentação (venda ou estorno).
 * O estoque pode ficar negativo (a venda não trava no balcão; a tela de
 * produtos mostra o saldo para o dono conferir).
 */
class ComandaProdutos
{
    /**
     * Deixa o atendimento com exatamente estes itens: [product_id => quantidade].
     * Itens que já estavam mantêm o preço da venda original; novos usam o preço atual.
     */
    public static function sincronizar(Schedule $schedule, array $itens): void
    {
        if ($schedule->status === Schedule::STATUS_CANCELADO) {
            throw ValidationException::withMessages(['itens' => ['Atendimento cancelado não recebe produtos.']]);
        }

        DB::transaction(function () use ($schedule, $itens) {
            $atuais = $schedule->products()->get()->keyBy('id');
            $ids = array_unique(array_merge(array_keys($itens), $atuais->keys()->all()));
            $produtos = Product::withTrashed()->whereIn('id', $ids)->lockForUpdate()->get()->keyBy('id');

            $pivot = [];
            foreach ($ids as $id) {
                $produto = $produtos->get($id);
                if (! $produto) {
                    throw ValidationException::withMessages(['itens' => ['Produto não encontrado.']]);
                }
                $novaQtd = (int) ($itens[$id] ?? 0);
                $antes = $atuais->get($id);
                $qtdAntes = $antes ? (int) $antes->pivot->quantity : 0;

                if (! $antes && ($produto->trashed() || ! $produto->active)) {
                    throw ValidationException::withMessages(['itens' => ["{$produto->name} não está mais à venda."]]);
                }

                self::movimentar($produto, $qtdAntes - $novaQtd, $schedule);

                if ($novaQtd > 0) {
                    $unitario = $antes ? (float) $antes->pivot->price : (float) $produto->price;
                    $comissaoUnit = $antes && $qtdAntes > 0
                        ? (float) $antes->pivot->commission_value / $qtdAntes
                        : $produto->commissionOn($unitario);
                    $pivot[$id] = [
                        'quantity' => $novaQtd,
                        'price' => $unitario,
                        'commission_value' => round($comissaoUnit * $novaQtd, 2),
                    ];
                }
            }

            $schedule->products()->sync($pivot);
        });

        $schedule->unsetRelation('products');
    }

    /** Atendimento cancelado: tudo volta para o estoque. */
    public static function devolverTudo(Schedule $schedule): void
    {
        if (! $schedule->products()->exists()) {
            return;
        }

        DB::transaction(function () use ($schedule) {
            foreach ($schedule->products()->get() as $p) {
                $produto = Product::withTrashed()->lockForUpdate()->find($p->id);
                self::movimentar($produto, (int) $p->pivot->quantity, $schedule);
            }
            $schedule->products()->detach();
        });
        $schedule->unsetRelation('products');
    }

    /** $delta > 0 volta ao estoque (estorno); < 0 sai (venda). */
    private static function movimentar(Product $produto, int $delta, Schedule $schedule): void
    {
        if ($delta === 0) {
            return;
        }
        $produto->increment('stock', $delta);
        StockMovement::create([
            'barbershop_id' => $produto->barbershop_id,
            'product_id' => $produto->id,
            'quantity' => $delta,
            'reason' => $delta < 0 ? StockMovement::VENDA : StockMovement::ESTORNO,
            'schedule_id' => $schedule->id,
            'user_id' => Auth::id(),
        ]);
    }
}
