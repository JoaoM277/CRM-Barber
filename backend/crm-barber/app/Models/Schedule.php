<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

class Schedule extends Model
{
    /** @use HasFactory<\Database\Factories\ScheduleFactory> */
    use BelongsToTenant, HasFactory;

    // protected $table = 'schedules';

    public const STATUS_PENDENTE = 'pendente';

    public const STATUS_CONFIRMADO = 'confirmado';

    public const STATUS_CONCLUIDO = 'concluido';

    public const STATUS_CANCELADO = 'cancelado';

    public const STATUSES = [
        self::STATUS_PENDENTE,
        self::STATUS_CONFIRMADO,
        self::STATUS_CONCLUIDO,
        self::STATUS_CANCELADO,
    ];

    protected $attributes = [
        'status' => self::STATUS_PENDENTE,
    ];

    protected $fillable = [
        'barbershop_id',
        'client_id',
        'worker_id',
        'service_id',
        'price',
        'commission_value',
        'date',
        'start_time',
        'end_time',
        'status',
        'observation',
        'lembrete_24h_em',
        'lembrete_2h_em',
        'resposta_cliente_em',
        'avaliacao_pedida_em',
        'avaliacao_nota',
        'avaliacao_em',
        'avaliacao_comentario',
        'avaliacao_oculta',
        'avaliacao_resposta',
        'avaliacao_respondida_em',
    ];

    /** Chave do link "meu horário": só vai para o cliente (WhatsApp / tela de sucesso). */
    protected $hidden = ['token_cliente'];

    protected static function booted(): void
    {
        static::creating(function (Schedule $s) {
            $s->token_cliente ??= Str::random(40);
        });
    }

    /** Link em que o cliente vê, cancela ou remarca o horário (sem login). */
    public function linkCliente(): ?string
    {
        $slug = $this->barbershop?->slug;
        if (! $slug || ! $this->token_cliente) {
            return null;
        }

        return rtrim((string) config('app.frontend_url'), '/').'/?b='.$slug.'&h='.$this->token_cliente;
    }

    public function inicio(): Carbon
    {
        return Carbon::parse(substr((string) $this->date, 0, 10).' '.substr((string) $this->start_time, 0, 5));
    }

    /**
     * Motivo pelo qual o cliente NÃO pode mais cancelar/remarcar pelo link
     * (null = pode). Regras: a barbearia permite, o horário está em aberto e
     * ainda falta pelo menos a antecedência configurada.
     */
    public function bloqueioAlteracaoCliente(): ?string
    {
        $bs = $this->barbershop;
        if ($this->status === self::STATUS_CANCELADO) {
            return 'Este horário foi cancelado.';
        }
        if ($this->status === self::STATUS_CONCLUIDO || $this->inicio()->isPast()) {
            return 'Este horário já passou.';
        }
        if (! $bs || ! $bs->alterar_pelo_link) {
            return 'Para cancelar ou remarcar, fale direto com a barbearia.';
        }
        $horas = (int) $bs->antecedencia_alteracao_horas;
        if ($horas > 0 && now()->addHours($horas)->greaterThan($this->inicio())) {
            return "Faltam menos de {$horas}h para o horário. Para cancelar ou remarcar agora, fale direto com a barbearia.";
        }

        return null;
    }

    protected $casts = [
        'price' => 'decimal:2',
        'commission_value' => 'decimal:2',
        'lembrete_24h_em' => 'datetime',
        'lembrete_2h_em' => 'datetime',
        'resposta_cliente_em' => 'datetime',
        'avaliacao_pedida_em' => 'datetime',
        'avaliacao_nota' => 'integer',
        'avaliacao_em' => 'datetime',
        'avaliacao_oculta' => 'boolean',
        'avaliacao_respondida_em' => 'datetime',
    ];

    // withTrashed(): histórico não pode sumir quando cliente/profissional/
    // serviço é excluído (soft delete) depois do agendamento existir.
    public function client(){
        return $this->belongsTo(Client::class)->withTrashed();
    }
    public function worker(){
        return $this->belongsTo(Worker::class)->withTrashed();
    }

    /**
     * Serviço "primário" do agendamento (o primeiro escolhido). Mantido por
     * compatibilidade; a lista completa está em services().
     */
    public function service(){
        return $this->belongsTo(Service::class)->withTrashed();
    }

    /**
     * Todos os serviços do agendamento, com snapshot de preço/comissão no pivô.
     */
    public function services(){
        return $this->belongsToMany(Service::class, 'schedule_service')
            ->withPivot(['price', 'commission_value'])
            ->withTimestamps()
            ->withTrashed();
    }

    /**
     * Produtos vendidos no atendimento (preço unitário e comissão congelados no pivô).
     */
    public function products()
    {
        return $this->belongsToMany(Product::class, 'schedule_product')
            ->withPivot(['quantity', 'price', 'commission_value'])
            ->withTimestamps()
            ->withTrashed();
    }

    /** Total vendido em produtos neste atendimento. */
    public function totalProdutos(): float
    {
        $itens = $this->relationLoaded('products') ? $this->products : $this->products()->get();

        return round($itens->sum(fn ($p) => (float) $p->pivot->price * (int) $p->pivot->quantity), 2);
    }

    /**
     * Coleção de serviços do agendamento com fallback para o service_id antigo
     * (registros criados antes do multi-serviço).
     */
    public function servicosResolvidos()
    {
        $carregados = $this->relationLoaded('services') ? $this->services : $this->services()->get();

        if ($carregados->isNotEmpty()) {
            return $carregados;
        }

        return $this->service ? collect([$this->service]) : collect();
    }
}
