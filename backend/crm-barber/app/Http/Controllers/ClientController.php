<?php

namespace App\Http\Controllers;

use App\Models\LoyaltyRedemption;
use App\Support\Fidelidade;
use App\Support\TenantContext;
use App\Http\Requests\StoreClientRequest;
use App\Models\Client;
use App\Models\Schedule;
use Illuminate\Support\Facades\DB;
use App\Support\Audit;
use App\Support\Phone;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ClientController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        // CRM: além do cadastro, o histórico de cada cliente (visitas concluídas,
        // última visita, quanto já gastou e se tem horário marcado à frente)
        $query = Client::query()
            ->withCount(['schedules as visitas' => fn ($q) => $q->where('status', Schedule::STATUS_CONCLUIDO)])
            ->withMax(['schedules as ultima_visita' => fn ($q) => $q->where('status', Schedule::STATUS_CONCLUIDO)], 'date')
            ->withSum(['schedules as total_gasto' => fn ($q) => $q->where('status', Schedule::STATUS_CONCLUIDO)], 'price')
            ->withMin(['schedules as proximo_horario' => fn ($q) => $q
                ->whereIn('status', [Schedule::STATUS_PENDENTE, Schedule::STATUS_CONFIRMADO])
                ->where('date', '>=', now()->toDateString())], 'date')
            ->orderBy('name');

        if ($busca = trim((string) $request->query('busca'))) {
            $digitos = preg_replace('/\D/', '', $busca);
            $query->where(function ($q) use ($busca, $digitos) {
                $q->where('name', 'like', "%{$busca}%");
                if ($digitos !== '') {
                    $q->orWhere('phone', 'like', "%{$digitos}%");
                }
            });
        }

        $clientes = $query->get();

        // fidelidade: selos de cada cliente (quando o programa está ligado)
        $bs = app(TenantContext::class)->barbershop();
        if (Fidelidade::ativa($bs)) {
            $selos = Fidelidade::selos($bs, $clientes->pluck('id')->all());
            $clientes->each(fn (Client $c) => $c->setAttribute('fidelidade', Fidelidade::resumo($bs, $c->id, $selos[$c->id] ?? 0)));
        }

        return response()->json($clientes, 200);
    }
    /**
     * Show the form for creating a new resource.
     */
    public function create()
    {
        //
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(StoreClientRequest $request)
    {
        $data = $request->validated();

        // Cliente excluído com o mesmo telefone -> restaura em vez de inserir
        // (o índice único não distingue soft-deleted).
        $client = Client::withTrashed()->where('phone', $data['phone'])->first();
        if ($client) {
            $client->restore();
            $client->update($data);
        } else {
            $client = Client::create($data);
        }

        return response()->json($client, 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(Client $client)
    {
        // ficha do cliente com o histórico de atendimentos (mais recentes primeiro)
        $historico = $client->schedules()
            ->with(['worker:id,name', 'services:id,name', 'service:id,name'])
            ->orderByDesc('date')->orderByDesc('start_time')
            ->limit(50)
            ->get()
            ->map(fn (Schedule $s) => [
                'id' => $s->id,
                'date' => (string) $s->date,
                'start_time' => substr((string) $s->start_time, 0, 5),
                'status' => $s->status,
                'price' => $s->price,
                'profissional' => $s->worker?->name,
                'servicos' => $s->servicosResolvidos()->pluck('name')->implode(', '),
            ]);

        $bs = app(TenantContext::class)->barbershop();
        $fidelidade = $bs ? Fidelidade::resumo($bs, $client->id) : null;
        $resgates = $fidelidade ? LoyaltyRedemption::where('client_id', $client->id)->latest('id')->limit(10)->get(['id', 'premio', 'created_at']) : [];

        return response()->json($client->toArray() + ['historico' => $historico, 'fidelidade' => $fidelidade, 'resgates' => $resgates], 200);
    }
    /**
     * Show the form for editing the specified resource.
     */
    public function edit(Client $client)
    {
        //
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, Client $client)
    {
        $request->merge(['phone' => Phone::normalizeBr((string) $request->input('phone'))]);

        $data = $request->validate([
            'name' => 'required|string|max:255',
            'email' => ['nullable', 'email', Rule::unique('clients', 'email')->where('barbershop_id', $client->barbershop_id)->whereNull('deleted_at')->ignore($client->id)],
            'phone' => ['required', 'string', 'max:20', Rule::unique('clients', 'phone')->where('barbershop_id', $client->barbershop_id)->whereNull('deleted_at')->ignore($client->id)],
            'birth_date' => 'nullable|date',
            'observation' => 'nullable|string',
        ]);

        $client->update($data);

        return response()->json(['message' => 'Cliente atualizado com sucesso!', 'data' => $client->fresh()], 200);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Client $client)
    {
        $nome = $client->name;
        $client->delete();

        Audit::log('cliente.excluido', $client, "Cliente \"{$nome}\" excluído");

        return response()->json([
            'message' => 'Client removed successfully!'
        ], 200);

    }

    /**
     * LGPD — portabilidade/acesso: tudo o que a barbearia guarda sobre o
     * cliente, em JSON, para entregar a ele quando pedir.
     * GET /clientes/{client}/dados
     */
    public function exportarDados(Client $client)
    {
        $dados = [
            'gerado_em' => now()->toIso8601String(),
            'barbearia' => $client->barbershop?->name,
            'cliente' => $client->only(['name', 'phone', 'email', 'birth_date', 'observation', 'created_at']),
            'atendimentos' => $client->schedules()
                ->with(['worker:id,name', 'services:id,name', 'service:id,name'])
                ->orderBy('date')->get()
                ->map(fn (Schedule $s) => [
                    'data' => (string) $s->date,
                    'horario' => substr((string) $s->start_time, 0, 5),
                    'servicos' => $s->servicosResolvidos()->pluck('name')->implode(', '),
                    'profissional' => $s->worker?->name,
                    'valor' => $s->price,
                    'situacao' => $s->status,
                    'observacao' => $s->observation,
                ]),
            'mensagens' => \App\Models\Log::where('client_id', $client->id)->orderBy('created_at')
                ->get(['action', 'description', 'created_at']),
        ];

        Audit::log('cliente.dados_exportados', $client, 'Dados do cliente exportados (LGPD)');

        return response()->json($dados, 200, [
            'Content-Disposition' => 'attachment; filename="dados-cliente-'.$client->id.'.json"',
        ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    }

    /**
     * LGPD — eliminação: apaga os dados pessoais do cliente a pedido dele.
     * Os atendimentos continuam (faturamento, comissões e obrigação fiscal),
     * mas sem nada que identifique a pessoa.
     * POST /clientes/{client}/anonimizar
     */
    public function anonimizar(Client $client)
    {
        DB::transaction(function () use ($client) {
            $client->schedules()->update(['observation' => null]);
            \App\Models\Log::where('client_id', $client->id)->update(['description' => null, 'ip' => null]);
            // direto no banco: o model normaliza telefone para dígitos e o marcador
            // "anonimo-ID" (único por cliente) viraria um número que pode colidir
            DB::table('clients')->where('id', $client->id)->update([
                'name' => 'Cliente removido',
                'phone' => 'anonimo-'.$client->id,
                'email' => null,
                'birth_date' => null,
                'observation' => null,
                'updated_at' => now(),
            ]);
            $client->delete();
        });

        // sem nome no registro: o próprio log não pode guardar o dado apagado
        Audit::log('cliente.anonimizado', $client, 'Dados pessoais de um cliente apagados a pedido (LGPD)');

        return response()->json(['message' => 'Dados pessoais apagados. O histórico de atendimentos ficou sem identificação.']);
    }
}
