<?php

namespace App\Http\Controllers\Platform;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Barbershop;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use App\Services\Asaas\AsaasException;
use App\Services\Billing\SubscriptionService;
use App\Support\Audit;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/** Gestão das barbearias clientes pelo painel universal. */
class PlatformBarbershopController extends Controller
{
    /** Duração do acesso de suporte ao painel de uma barbearia. */
    private const SUPPORT_TOKEN_HOURS = 2;

    public function __construct(protected SubscriptionService $billing) {}

    /** GET /plataforma/barbearias?busca=&situacao=&page= */
    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'situacao' => ['nullable', Rule::in(['em_teste', 'pagantes', 'em_atraso', 'modo_leitura', 'canceladas', 'suspensas'])],
        ]);

        $query = $this->baseQuery()->orderByDesc('barbershops.created_at');

        if ($busca = trim((string) $request->query('busca'))) {
            $query->where(function (Builder $q) use ($busca) {
                $q->where('barbershops.name', 'like', "%{$busca}%")
                    ->orWhere('barbershops.slug', 'like', "%{$busca}%")
                    ->orWhereHas('users', fn (Builder $u) => $u->where('email', 'like', "%{$busca}%"));
            });
        }

        // situação depende de regras em PHP (Subscription::accessLevel); filtra
        // depois de carregar — a base de clientes cabe folgada em memória por ora
        $rows = $query->get()->map(fn (Barbershop $b) => $this->row($b));

        if ($situacao = $request->query('situacao')) {
            $rows = $rows->filter(fn ($r) => in_array($situacao, $r['situacoes'], true));
        }

        $perPage = 25;
        $page = max(1, (int) $request->query('page', 1));

        return response()->json([
            'data' => $rows->slice(($page - 1) * $perPage, $perPage)->values(),
            'meta' => ['total' => $rows->count(), 'per_page' => $perPage, 'current_page' => $page],
        ]);
    }

    /** GET /plataforma/barbearias/{barbershop} */
    public function show(int $id): JsonResponse
    {
        $b = $this->baseQuery()->findOrFail($id);
        $sub = $b->subscription;

        return response()->json([
            ...$this->row($b),
            'endereco' => trim(collect([$b->city, $b->state])->filter()->implode(' / ')),
            'telefone' => $b->whatsapp ?: $b->phone,
            'assinatura' => $sub?->toPanelArray(),
            'gateway' => $sub ? [
                'cliente' => $sub->asaas_customer_id,
                'assinatura' => $sub->asaas_subscription_id,
            ] : null,
            'faturas' => $sub
                ? $sub->payments()->latest('due_date')->limit(12)->get()->map->toPanelArray()->values()
                : [],
            'usuarios' => User::where('barbershop_id', $b->id)->get(['id', 'name', 'email', 'role', 'created_at']),
            'atividade' => AuditLog::withoutTenantScope()->with('user:id,name')
                ->where('barbershop_id', $b->id)->latest('created_at')->limit(15)
                ->get(['id', 'user_id', 'action', 'description', 'created_at']),
        ]);
    }

    /** POST /plataforma/barbearias/{barbershop}/dias {dias} — estende trial ou concede cortesia */
    public function grantDays(Request $request, int $id): JsonResponse
    {
        $data = $request->validate(['dias' => 'required|integer|min:1|max:365']);
        $sub = $this->subscriptionOrFail($id);

        $this->billing->grantDays($sub, $data['dias']);
        Audit::logFor($id, 'plataforma.dias_concedidos', $sub, "{$data['dias']} dia(s) concedidos pela administração");

        return response()->json(['message' => "{$data['dias']} dia(s) concedidos.", 'assinatura' => $sub->fresh('plan')->toPanelArray()]);
    }

    /** PUT /plataforma/barbearias/{barbershop}/plano {plano} */
    public function changePlan(Request $request, int $id): JsonResponse
    {
        $data = $request->validate(['plano' => ['required', Rule::exists('plans', 'slug')]]);
        $sub = $this->subscriptionOrFail($id);
        $plan = Plan::where('slug', $data['plano'])->firstOrFail();

        try {
            $this->billing->adminChangePlan($sub, $plan);
        } catch (AsaasException $e) {
            return response()->json(['code' => 'gateway_error', 'message' => $e->userMessage()], 422);
        }

        Audit::logFor($id, 'plataforma.plano_alterado', $sub, "Plano alterado para {$plan->name} pela administração");

        return response()->json(['message' => "Plano alterado para {$plan->name}.", 'assinatura' => $sub->fresh('plan')->toPanelArray()]);
    }

    /** POST /plataforma/barbearias/{barbershop}/suspender  e  /reativar */
    public function suspend(int $id): JsonResponse
    {
        return $this->setActive($id, false);
    }

    public function reactivate(int $id): JsonResponse
    {
        return $this->setActive($id, true);
    }

    /**
     * POST /plataforma/barbearias/{barbershop}/acessar — token de suporte para
     * abrir o painel da barbearia como o admin dela, por tempo limitado.
     */
    public function impersonate(Request $request, int $id): JsonResponse
    {
        $b = Barbershop::findOrFail($id);
        $owner = User::where('barbershop_id', $b->id)->where('role', User::ROLE_ADMIN)->orderBy('id')->first();

        if (! $owner) {
            return response()->json(['message' => 'Esta barbearia não tem usuário administrador.'], 422);
        }

        $token = $owner->createToken(
            User::SUPPORT_TOKEN_PREFIX.$request->user()->id,
            ['*'],
            now()->addHours(self::SUPPORT_TOKEN_HOURS)
        );

        Audit::logFor($b->id, 'plataforma.acesso_suporte', $owner, 'Acesso de suporte ao painel ('.$request->user()->email.')');

        return response()->json([
            'token' => $token->plainTextToken,
            'expira_em' => now()->addHours(self::SUPPORT_TOKEN_HOURS)->toIso8601String(),
            'barbearia' => $b->name,
        ]);
    }

    // ----------------------------------------------------------------------

    private function baseQuery(): Builder
    {
        $desde = now()->subDays(30);

        return Barbershop::query()
            ->with(['subscription.plan', 'users' => fn ($q) => $q->where('role', User::ROLE_ADMIN)->orderBy('id')])
            ->withCount([
                'workers as profissionais' => fn ($q) => $q->withoutTenantScope(),
                'schedules as agendamentos_30d' => fn ($q) => $q->withoutTenantScope()->where('created_at', '>=', $desde),
            ])
            ->addSelect([
                // último uso do painel por algum usuário da barbearia (tokens de suporte não contam)
                'ultimo_acesso' => DB::table('personal_access_tokens')
                    ->join('users', 'users.id', '=', 'personal_access_tokens.tokenable_id')
                    ->where('personal_access_tokens.tokenable_type', User::class)
                    ->whereColumn('users.barbershop_id', 'barbershops.id')
                    ->where('personal_access_tokens.name', 'not like', User::SUPPORT_TOKEN_PREFIX.'%')
                    ->selectRaw('MAX(personal_access_tokens.last_used_at)'),
            ]);
    }

    private function row(Barbershop $b): array
    {
        $sub = $b->subscription;
        $owner = $b->users->first();

        return [
            'id' => $b->id,
            'nome' => $b->name,
            'slug' => $b->slug,
            'ativa' => (bool) $b->active,
            'dono' => $owner ? ['nome' => $owner->name, 'email' => $owner->email] : null,
            'plano' => $sub?->plan?->name,
            'plano_slug' => $sub?->plan?->slug,
            'status' => $sub?->status,
            'acesso' => $sub?->accessLevel(),
            'acesso_ate' => $sub?->accessEndsAt()?->toIso8601String(),
            'mensalidade' => $sub?->asaas_subscription_id ? ($sub->plan?->price() ?? 0) : 0,
            'situacoes' => $this->situacoes($b, $sub),
            'profissionais' => (int) $b->profissionais,
            'agendamentos_30d' => (int) $b->agendamentos_30d,
            'ultimo_acesso' => $b->ultimo_acesso,
            'criada_em' => $b->created_at?->toIso8601String(),
        ];
    }

    /** Situações em que a barbearia se encaixa (mesmas categorias das métricas). */
    private function situacoes(Barbershop $b, ?Subscription $sub): array
    {
        $s = [];
        if (! $b->active) {
            $s[] = 'suspensas';
        }
        if (! $sub) {
            return $s;
        }
        if ($sub->status === Subscription::STATUS_TRIALING && $sub->hasFullAccess()) {
            $s[] = 'em_teste';
        }
        if ($sub->asaas_subscription_id && in_array($sub->status, [Subscription::STATUS_ACTIVE, Subscription::STATUS_PAST_DUE], true)) {
            $s[] = 'pagantes';
        }
        if ($sub->status === Subscription::STATUS_PAST_DUE) {
            $s[] = 'em_atraso';
        }
        if (! $sub->hasFullAccess()) {
            $s[] = 'modo_leitura';
        }
        if ($sub->status === Subscription::STATUS_CANCELED) {
            $s[] = 'canceladas';
        }

        return $s;
    }

    private function subscriptionOrFail(int $barbershopId): Subscription
    {
        Barbershop::findOrFail($barbershopId);

        return Subscription::with('plan')->where('barbershop_id', $barbershopId)->first()
            ?? $this->billing->startTrial(Barbershop::find($barbershopId))->load('plan');
    }

    private function setActive(int $id, bool $active): JsonResponse
    {
        $b = Barbershop::findOrFail($id);
        $b->update(['active' => $active]);

        if (! $active) {
            // derruba as sessões abertas da barbearia
            DB::table('personal_access_tokens')
                ->where('tokenable_type', User::class)
                ->whereIn('tokenable_id', User::where('barbershop_id', $id)->pluck('id'))
                ->delete();
        }

        Audit::logFor($id, $active ? 'plataforma.reativada' : 'plataforma.suspensa', $b,
            $active ? 'Conta reativada pela administração' : 'Conta suspensa pela administração');

        return response()->json(['message' => $active ? 'Barbearia reativada.' : 'Barbearia suspensa.']);
    }
}
