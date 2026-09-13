<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Monitora as instâncias de WhatsApp (precisa do scheduler rodando:
// `php artisan schedule:work` ou um cron chamando `schedule:run` a cada minuto).
Schedule::command('instances:check')->everyFiveMinutes()->withoutOverlapping();

// Limpa tokens de login expirados (ver SANCTUM_TOKEN_EXPIRATION).
Schedule::command('sanctum:prune-expired --hours=24')->daily();
