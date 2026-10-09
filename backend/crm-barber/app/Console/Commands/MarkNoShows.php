<?php

namespace App\Console\Commands;

use App\Support\Presenca;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

/** Falta automática: 1h depois do horário, quem foi lembrado e não confirmou. */
class MarkNoShows extends Command
{
    protected $signature = 'agenda:faltas {--agora= : simula o horário atual (testes), formato Y-m-d H:i}';

    protected $description = 'Marca como falta os agendamentos não confirmados 1h depois do horário';

    public function handle(): int
    {
        $n = Presenca::marcarFaltas($this->option('agora') ? Carbon::parse($this->option('agora')) : null);
        $this->info("Faltas automáticas: {$n}.");

        return self::SUCCESS;
    }
}
