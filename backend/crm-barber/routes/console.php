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

// Avisos de fim do teste grátis (e-mail ao dono da barbearia).
Schedule::command('billing:notify')->dailyAt('10:00')->withoutOverlapping();

// Lembretes de 24h e 2h antes no WhatsApp (o comando só envia entre 8h e 21h).
Schedule::command('lembretes:enviar')->everyFiveMinutes()->withoutOverlapping();
