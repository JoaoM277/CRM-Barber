<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'admin' => \App\Http\Middleware\AdminMiddleware::class,
            'service.token' => \App\Http\Middleware\ServiceTokenMiddleware::class,
            'tenant' => \App\Http\Middleware\IdentifyTenant::class,
            'tenant.user' => \App\Http\Middleware\IdentifyTenantForUser::class,
        ]);

        // API-only: sem página de login web, então convidado não autenticado
        // recebe 401 JSON em vez de redirect para a rota "login" (inexistente).
        $middleware->redirectGuestsTo(fn () => null);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*'),
        );
    })->create();
