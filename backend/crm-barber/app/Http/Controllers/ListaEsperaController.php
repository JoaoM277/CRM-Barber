<?php

namespace App\Http\Controllers;

use App\Models\Client;
use App\Models\WaitlistEntry;
use App\Support\Phone;
use App\Support\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/** Lista de espera: o cliente entra pela página de agendamento; o dono vê na agenda. */
class ListaEsperaController extends Controller
{
    /** Pedidos em aberto por cliente (evita alguém "reservar" a semana inteira). */
    public const MAX_POR_CLIENTE = 3;

    public function __construct(protected TenantContext $tenant) {}

    /** POST /b/{slug}/lista-espera (público) */
    public function store(Request $request): JsonResponse
    {
        $bs = $this->tenant->barbershop();
        abort_unless($bs?->lista_espera_ativa, 404, 'Lista de espera indisponível.');

        $data = $request->validate([
            'clienteNome' => 'required|string|min:2|max:255',
            'clienteTelefone' => 'required|string|max:20',
            'data' => ['required', 'date', 'after_or_equal:today', 'before_or_equal:'.now()->addDays(60)->toDateString()],
            'barbeiroId' => ['nullable', 'integer', Rule::exists('workers', 'id')->where('barbershop_id', $bs->id)->where('active', true)->whereNull('deleted_at')],
            'servicosIds' => 'nullable|array|max:10',
            'servicosIds.*' => ['integer', Rule::exists('services', 'id')->where('barbershop_id', $bs->id)],
            'website' => 'nullable|max:0', // honeypot
        ]);

        $phone = Phone::normalizeBr($data['clienteTelefone']);
        if (strlen($phone) < 12) {
            throw ValidationException::withMessages(['clienteTelefone' => ['Telefone inválido.']]);
        }

        $client = Client::withTrashed()->where('phone', $phone)->first();
        if ($client?->trashed()) {
            $client->restore();
        }
        $client ??= Client::create(['phone' => $phone, 'name' => $data['clienteNome']]);

        $dia = substr($data['data'], 0, 10);
        $existente = WaitlistEntry::where('client_id', $client->id)->whereDate('date', $dia)
            ->whereIn('status', [WaitlistEntry::AGUARDANDO, WaitlistEntry::AVISADO])->first();

        if (! $existente) {
            $abertos = WaitlistEntry::where('client_id', $client->id)->where('status', WaitlistEntry::AGUARDANDO)
                ->whereDate('date', '>=', now()->toDateString())->count();
            if ($abertos >= self::MAX_POR_CLIENTE) {
                throw ValidationException::withMessages(['data' => ['Você já está na lista de espera de '.self::MAX_POR_CLIENTE.' dias. Marque um horário livre ou fale com a barbearia.']]);
            }
        }

        $entrada = $existente ?? new WaitlistEntry(['client_id' => $client->id, 'date' => $dia]);
        $entrada->fill([
            'worker_id' => $data['barbeiroId'] ?? null,
            'service_ids' => $data['servicosIds'] ?? null,
            'status' => WaitlistEntry::AGUARDANDO,
        ])->save();

        $posicao = WaitlistEntry::whereDate('date', $dia)->where('status', WaitlistEntry::AGUARDANDO)->where('id', '<=', $entrada->id)->count();

        return response()->json([
            'message' => 'Pronto! Se abrir uma vaga nesse dia, você recebe um aviso no WhatsApp.',
            'posicao' => $posicao,
        ], $existente ? 200 : 201);
    }

    /** GET /lista-espera?data=YYYY-MM-DD (painel) */
    public function index(Request $request): JsonResponse
    {
        $request->validate(['data' => 'required|date']);

        $itens = WaitlistEntry::with(['client:id,name,phone', 'worker:id,name'])
            ->whereDate('date', $request->query('data'))
            ->whereIn('status', [WaitlistEntry::AGUARDANDO, WaitlistEntry::AVISADO, WaitlistEntry::AGENDOU])
            ->orderBy('id')
            ->get()
            ->map(fn (WaitlistEntry $e) => [
                'id' => $e->id,
                'status' => $e->status,
                'cliente' => $e->client?->name,
                'telefone' => $e->client?->phone,
                'profissional' => $e->worker?->name,
                'avisado_em' => $e->avisado_em,
                'criado_em' => $e->created_at,
            ]);

        return response()->json($itens);
    }

    /** DELETE /lista-espera/{entry} (painel) */
    public function destroy(WaitlistEntry $entry): JsonResponse
    {
        $entry->update(['status' => WaitlistEntry::REMOVIDO]);

        return response()->json(['message' => 'Removido da lista de espera.']);
    }
}
