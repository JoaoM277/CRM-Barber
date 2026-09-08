<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

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
    ];

    protected $casts = [
        'price' => 'decimal:2',
        'commission_value' => 'decimal:2',
    ];

    public function client(){
        return $this->belongsTo(Client::class);
    }
    public function worker(){
        return $this->belongsTo(Worker::class);
    }

    /**
     * Serviço "primário" do agendamento (o primeiro escolhido). Mantido por
     * compatibilidade; a lista completa está em services().
     */
    public function service(){
        return $this->belongsTo(Service::class);
    }

    /**
     * Todos os serviços do agendamento, com snapshot de preço/comissão no pivô.
     */
    public function services(){
        return $this->belongsToMany(Service::class, 'schedule_service')
            ->withPivot(['price', 'commission_value'])
            ->withTimestamps();
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
