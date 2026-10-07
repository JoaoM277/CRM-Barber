<?php

use App\Http\Controllers\LogController;
use App\Http\Controllers\ClientController;
use App\Http\Controllers\WorkerController;
use App\Http\Controllers\ServiceController;
use App\Http\Controllers\OperationTimeController;
use App\Http\Controllers\ScheduleController;
use App\Http\Controllers\BarbershopController;
use App\Http\Controllers\MessageController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\InstanceController;
use App\Http\Controllers\AvisoController;
use App\Http\Controllers\FaturamentoController;
use App\Http\Controllers\PayoutController;
use App\Http\Controllers\AuditLogController;
use App\Http\Controllers\AsaasWebhookController;
use App\Http\Controllers\BillingController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Auth (global — sem tenant; o login resolve a barbearia do usuário)
|--------------------------------------------------------------------------
*/
Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:6,1')->name('users.login');
Route::post('/cadastrar', [AuthController::class, 'register'])->middleware('throttle:6,1')->name('users.register');

// Planos à venda (landing page / tela de assinatura)
Route::get('/planos', [BillingController::class, 'plans'])->name('planos.index');

// Webhook do Asaas (autenticado pelo header asaas-access-token, ver AsaasWebhookController)
Route::post('/webhooks/asaas', AsaasWebhookController::class)->middleware('throttle:120,1')->name('webhooks.asaas');

/*
|--------------------------------------------------------------------------
| Rotas PÚBLICAS por barbearia (site de agendamento)
| A barbearia vem no path (/api/b/{slug}/...), no header X-Barbershop ou em ?barbershop=
|--------------------------------------------------------------------------
*/
Route::middleware('tenant')->group(function () {
    Route::prefix('b/{barbershop}')->group(function () {
        Route::get('/servicos', [ServiceController::class, 'index'])->name('servicos.index');
        Route::get('/profissionais', [WorkerController::class, 'index'])->name('profissionais.index');
        Route::post('/agendamentos', [ScheduleController::class, 'store'])->middleware(['throttle:15,1', 'booking.open'])->name('agendamentos.store');
        Route::get('/disponibilidade', [ScheduleController::class, 'disponibilidade'])->name('agendamentos.disponibilidade');
        Route::get('/avisos/ativo', [AvisoController::class, 'ativo'])->name('avisos.ativo');
        Route::get('/barbearia', [BarbershopController::class, 'publicIdentity'])->name('barbearia.identidade');
    });
});

/*
|--------------------------------------------------------------------------
| Rota INTERNA (serviço de mensagens Node -> Laravel)
|--------------------------------------------------------------------------
*/
Route::middleware('service.token')->group(function () {
    Route::post('/logs', [LogController::class, 'store'])->name('logs.store');
});

/*
|--------------------------------------------------------------------------
| Rotas AUTENTICADAS (painel administrativo)
|--------------------------------------------------------------------------
*/
// 'subscription': painel em modo leitura quando a assinatura não dá mais acesso total
Route::middleware(['auth:sanctum', 'tenant.user', 'subscription'])->group(function () {
    Route::get('/me', [AuthController::class, 'me'])->name('users.me');
    Route::post('/logout', [AuthController::class, 'logout'])->name('users.logout');
    Route::put('/me/senha', [AuthController::class, 'updatePassword'])->name('users.update-password');
    Route::get('/pagina-inicial', [UserController::class, 'paginaInicial'])->name('users.pagina-inicial');

    // Client
    Route::get('/clientes', [ClientController::class, 'index'])->name('clientes.index');
    Route::post('/clientes', [ClientController::class, 'store'])->name('clientes.store');
    Route::get('/clientes/{client}', [ClientController::class, 'show'])->name('clientes.show');
    Route::put('/clientes/{client}', [ClientController::class, 'update'])->name('clientes.update');
    Route::delete('/clientes/{client}', [ClientController::class, 'destroy'])->name('clientes.delete');

    // Worker (o painel lista pela rota autenticada; o site público usa /b/{slug}/profissionais)
    Route::get('/profissionais', [WorkerController::class, 'index'])->name('profissionais.index.admin');
    Route::post('/profissionais', [WorkerController::class, 'store'])->name('profissionais.store');
    Route::get('/profissionais/{worker}', [WorkerController::class, 'show'])->name('profissionais.show');
    Route::put('/profissionais/{worker}', [WorkerController::class, 'update'])->name('profissionais.update');
    Route::delete('/profissionais/{worker}', [WorkerController::class, 'destroy'])->name('profissionais.delete');

    // Service (idem)
    Route::get('/servicos', [ServiceController::class, 'index'])->name('servicos.index.admin');
    Route::post('/servicos', [ServiceController::class, 'store'])->name('servicos.store');
    Route::get('/servicos/{service}', [ServiceController::class, 'show'])->name('servicos.show');
    Route::put('/servicos/{service}', [ServiceController::class, 'update'])->name('servicos.update');
    Route::delete('/servicos/{service}', [ServiceController::class, 'destroy'])->name('servicos.delete');

    // OperationTime
    Route::get('/tempo_de_operacao', [OperationTimeController::class, 'index'])->name('tempo_de_operacao.index');
    Route::post('/tempo_de_operacao', [OperationTimeController::class, 'store'])->name('tempo_de_operacao.store');
    Route::get('/tempo_de_operacao/{operationTime}', [OperationTimeController::class, 'show'])->name('tempo_de_operacao.show');
    Route::put('/tempo_de_operacao/{operationTime}', [OperationTimeController::class, 'update'])->name('tempo_de_operacao.update');
    Route::delete('/tempo_de_operacao/{operationTime}', [OperationTimeController::class, 'destroy'])->name('tempo_de_operacao.delete');

    // Schedule
    Route::get('/agendamentos', [ScheduleController::class, 'index'])->name('agendamentos.index');
    Route::get('/agendamentos/{schedule}', [ScheduleController::class, 'show'])->name('agendamentos.show');
    Route::put('/agendamentos/{schedule}', [ScheduleController::class, 'update'])->name('agendamentos.update');
    Route::delete('/agendamentos/{schedule}', [ScheduleController::class, 'destroy'])->name('agendamentos.delete');

    // Barbershop
    Route::get('/barbearias', [BarbershopController::class, 'index'])->name('barbearias.index');
    Route::post('/barbearias', [BarbershopController::class, 'store'])->name('barbearias.store');
    Route::get('/barbearias/{barbershop}', [BarbershopController::class, 'show'])->name('barbearias.show');
    Route::put('/barbearias/{barbershop}', [BarbershopController::class, 'update'])->name('barbearias.update');
    Route::delete('/barbearias/{barbershop}', [BarbershopController::class, 'destroy'])->name('barbearias.delete');

    // Log (leitura / gestão — o POST fica na rota interna acima)
    Route::get('/logs', [LogController::class, 'index'])->name('logs.index');
    Route::get('/logs/{log}', [LogController::class, 'show'])->name('logs.show');
    Route::delete('/logs/{log}', [LogController::class, 'destroy'])->name('logs.destroy');

    // Avisos (listagem)
    Route::get('/avisos', [AvisoController::class, 'index'])->name('avisos.index');

    // Serviço de mensagens (disparo manual)
    Route::post('/message', [MessageController::class, 'sendAppointmentConfirmation'])->name('mensagens.agendamento');

    /*
    |----------------------------------------------------------------------
    | Somente ADMIN
    |----------------------------------------------------------------------
    */
    Route::middleware('admin')->group(function () {
        // Assinatura do SaaS (sempre liberadas, mesmo em modo leitura)
        Route::get('/assinatura', [BillingController::class, 'show'])->name('assinatura.show');
        Route::post('/assinatura', [BillingController::class, 'subscribe'])->middleware('throttle:10,1')->name('assinatura.subscribe');
        Route::delete('/assinatura', [BillingController::class, 'cancel'])->name('assinatura.cancel');

        Route::get('/usuarios', [UserController::class, 'index'])->name('usuarios.index');
        Route::post('/usuarios', [UserController::class, 'store'])->name('usuarios.store');
        Route::get('/usuarios/{usuario}', [UserController::class, 'show'])->name('usuarios.show');
        Route::put('/usuarios/{usuario}', [UserController::class, 'update'])->name('usuarios.update');
        Route::delete('/usuarios/{usuario}', [UserController::class, 'destroy'])->name('usuarios.delete');

        Route::get('/avisos/{id}', [AvisoController::class, 'show'])->whereNumber('id')->name('avisos.show');
        Route::put('/avisos/{id}', [AvisoController::class, 'update'])->whereNumber('id')->name('avisos.update');

        // Faturamento + folha de comissões
        Route::get('/faturamento', [FaturamentoController::class, 'index'])->middleware('feature:financeiro')->name('faturamento.index');
        Route::get('/payouts', [PayoutController::class, 'index'])->middleware('feature:financeiro')->name('payouts.index');
        Route::post('/payouts', [PayoutController::class, 'store'])->middleware('feature:financeiro')->name('payouts.store');

        // Instâncias WhatsApp (Evolution API)
        Route::get('/instances', [InstanceController::class, 'index'])->name('instances.index');
        Route::post('/instances', [InstanceController::class, 'store'])->middleware('feature:whatsapp')->name('instances.store');
        Route::get('/instances/{instance}/qrcode', [InstanceController::class, 'qrcode'])->name('instances.qrcode');
        Route::get('/instances/{instance}/status', [InstanceController::class, 'status'])->name('instances.status');
        Route::delete('/instances/{instance}', [InstanceController::class, 'destroy'])->name('instances.destroy');

        // Auditoria (quem fez o quê no painel)
        Route::get('/auditoria', [AuditLogController::class, 'index'])->name('auditoria.index');
    });
});
