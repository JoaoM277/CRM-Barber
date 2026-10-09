<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreWorkerRequest;
use App\Models\Worker;
use App\Support\Audit;
use App\Support\PaginaPersonalizada;
use App\Support\TenantContext;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class WorkerController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        // Página pública de agendamento (/b/{slug}/profissionais): só quem está
        // atendendo e só o que o cliente precisa ver. Telefone, Pix, salário e
        // comissão ficam para o painel autenticado.
        if ($request->routeIs('profissionais.index')) {
            // bio e Instagram são da personalização (Pro/Premium)
            $extras = PaginaPersonalizada::liberada(app(TenantContext::class)->barbershop());

            return response()->json(
                Worker::where('active', true)->orderBy('name')->get(['id', 'name', 'photo', 'speciality', 'active', 'bio', 'instagram'])
                    ->map(function (Worker $w) use ($extras) {
                        $w->setAttribute('instagram', $extras ? PaginaPersonalizada::instagram($w->instagram) : null);

                        return $extras ? $w : $w->setAttribute('bio', null);
                    }),
                200
            );
        }

        return response()->json($this->paraQuemVe($request, Worker::all()), 200);
    }

    /**
     * Como cada um recebe (e quem é o dono, que não tem comissão) é assunto
     * só do administrador: os outros usuários não recebem esses campos.
     */
    private const DADOS_PAGAMENTO = ['payment_type', 'commission_percent', 'fixed_salary', 'pix_key'];

    private function paraQuemVe(Request $request, $workers)
    {
        if ($request->user()?->isAdmin()) {
            return $workers;
        }
        $esconder = fn (Worker $w) => $w->makeHidden(self::DADOS_PAGAMENTO);

        return $workers instanceof Worker ? $esconder($workers) : $workers->each($esconder);
    }

    /**
     * POST /profissionais/eu-tambem-atendo (admin)
     * O dono da equipe que também atende entra na agenda como "Dono":
     * sem comissão nem salário, e só ele (admin) vê isso.
     */
    public function euTambemAtendo(Request $request, TenantContext $tenant)
    {
        $user = $request->user();
        $bs = $tenant->barbershop();

        $limit = $bs?->subscription?->workerLimit();
        if ($limit !== null && Worker::count() >= $limit) {
            return response()->json([
                'code' => 'plan_limit',
                'message' => "Seu plano permite até {$limit} profissionais. Faça upgrade em \"Assinatura\" para cadastrar mais.",
            ], 403);
        }

        $worker = Worker::create([
            'name' => $user->name,
            'phone' => null,
            'payment_type' => Worker::PAYMENT_PROPRIETARIO,
            'commission_percent' => 0,
            'fixed_salary' => 0,
            'active' => true,
        ]);

        return response()->json(['message' => 'Pronto: você está na agenda como dono, sem comissão.', 'worker' => $worker], 201);
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
    public function store(StoreWorkerRequest $request, TenantContext $tenant)
    {
        $data = $request->validated();
        // pagamento (e quem é o dono) só o administrador define
        if (! $request->user()?->isAdmin()) {
            $data = array_diff_key($data, array_flip(self::DADOS_PAGAMENTO));
        }

        // limite de profissionais do plano (restaurar um excluído também conta)
        $limit = $tenant->barbershop()?->subscription?->workerLimit();
        if ($limit !== null && Worker::count() >= $limit) {
            return response()->json([
                'code' => 'plan_limit',
                'message' => "Seu plano permite até {$limit} profissionais. Faça upgrade em \"Assinatura\" para cadastrar mais.",
            ], 403);
        }

        // Se existir um profissional excluído com o mesmo telefone, restaura
        // em vez de tentar inserir (o índice único não distingue soft-deleted).
        $worker = ! empty($data['phone']) ? Worker::withTrashed()->where('phone', $data['phone'])->first() : null;
        if ($worker) {
            $worker->restore();
            $worker->update($data);
        } else {
            $worker = Worker::create($data);
        }

        // barbeiro solo que contratou alguém: a conta passa para equipe (comissões)
        $bs = $tenant->barbershop();
        $virouEquipe = false;
        if ($bs?->ehSolo() && Worker::where('active', true)->count() > 1) {
            $bs->update(['modelo_equipe' => \App\Models\Barbershop::EQUIPE]);
            $virouEquipe = true;
        }

        return response()->json([
            'message' => $virouEquipe ? 'Profissional cadastrado. Sua barbearia agora está no modo equipe.' : 'Profissional criado com sucesso!',
            'worker' => $this->paraQuemVe($request, $worker),
            'modelo_equipe' => $bs?->modelo_equipe,
        ], 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(Request $request, Worker $worker)
    {
        return response()->json($this->paraQuemVe($request, $worker), 200);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, Worker $worker)
    {
        $data = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'phone' => ['sometimes', 'nullable', 'string', 'max:20', Rule::unique('workers', 'phone')->where('barbershop_id', $worker->barbershop_id)->whereNull('deleted_at')->ignore($worker->id)],
            'photo' => 'sometimes|nullable|string',
            'speciality' => 'sometimes|nullable|string',
            'active' => 'sometimes|boolean',
            'payment_type' => ['sometimes', Rule::in(\App\Models\Worker::PAYMENT_TYPES)],
            'commission_percent' => 'sometimes|nullable|numeric|min:0|max:100',
            'fixed_salary' => 'sometimes|nullable|numeric|min:0',
            'pix_key' => 'sometimes|nullable|string|max:255',
            'bio' => 'sometimes|nullable|string|max:160',
            'instagram' => 'sometimes|nullable|string|max:60',
        ]);

        // pagamento (e quem é o dono) só o administrador define
        if (! $request->user()?->isAdmin()) {
            $data = array_diff_key($data, array_flip(self::DADOS_PAGAMENTO));
        }

        $worker->update($data);

        return response()->json([
            'message' => 'Profissional atualizado com sucesso!',
            'worker' => $this->paraQuemVe($request, $worker->fresh()),
        ], 200);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Worker $worker)
    {
        $nome = $worker->name;
        $worker->delete();

        Audit::log('profissional.excluido', $worker, "Profissional \"{$nome}\" excluído");

        return response()->json([
        'message' => 'Profissional deletado com sucesso!',
        'worker' => $worker
        ], 200);
    }
}
