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
use App\Http\Controllers\OnboardingController;
use App\Http\Controllers\ImagemController;
use App\Http\Controllers\Platform\PlatformBarbershopController;
use App\Http\Controllers\Platform\PlatformMetricsController;
use App\Http\Controllers\Platform\PlatformSettingsController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Auth (global — sem tenant; o login resolve a barbearia do usuário)
|--------------------------------------------------------------------------
*/
Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:6,1')->name('users.login');
Route::post('/cadastrar', [AuthController::class, 'register'])->middleware('throttle:6,1')->name('users.register');
Route::post('/senha/esqueci', [AuthController::class, 'forgotPassword'])->middleware('throttle:5,1')->name('senha.esqueci');
Route::post('/senha/redefinir', [AuthController::class, 'resetPassword'])->middleware('throttle:10,1')->name('senha.redefinir');

// Planos à venda (landing page / tela de assinatura)
Route::get('/planos', [BillingController::class, 'plans'])->name('planos.index');
Route::get('/publico/config', [BillingController::class, 'publicConfig'])->name('publico.config');

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
Route::middleware(['auth:sanctum', 'tenant.user', 'subscription', 'support.restrict'])->group(function () {
    Route::get('/me', [AuthController::class, 'me'])->name('users.me');
    Route::post('/logout', [AuthController::class, 'logout'])->name('users.logout');
    Route::put('/me/senha', [AuthController::class, 'updatePassword'])->name('users.update-password');
    Route::get('/pagina-inicial', [UserController::class, 'paginaInicial'])->name('users.pagina-inicial');

    // Guia de primeiros passos
    Route::get('/onboarding', [OnboardingController::class, 'show'])->name('onboarding.show');
    Route::post('/onboarding/marcar', [OnboardingController::class, 'mark'])->name('onboarding.marcar');
    Route::post('/onboarding/servicos-padrao', [OnboardingController::class, 'defaultServices'])->name('onboarding.servicos');

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
    Route::post('/profissionais/{worker}/foto', [ImagemController::class, 'foto'])->middleware('throttle:20,1')->name('profissionais.foto');
    Route::delete('/profissionais/{worker}/foto', [ImagemController::class, 'removerFoto'])->name('profissionais.foto.remover');

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
    // marcar pelo painel (o dono atendendo por telefone/balcão); já nasce confirmado
    Route::post('/agendamentos', [ScheduleController::class, 'store'])->name('agendamentos.store.painel');
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
        // LGPD do cliente final: cópia dos dados e eliminação a pedido
        Route::get('/clientes/{client}/dados', [ClientController::class, 'exportarDados'])->name('clientes.dados');
        Route::post('/clientes/{client}/anonimizar', [ClientController::class, 'anonimizar'])->name('clientes.anonimizar');

        // Logo da barbearia (aparece na página de agendamento)
        Route::post('/barbearia/logo', [ImagemController::class, 'logo'])->middleware('throttle:20,1')->name('barbearia.logo');
        Route::delete('/barbearia/logo', [ImagemController::class, 'removerLogo'])->name('barbearia.logo.remover');

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

/*
|--------------------------------------------------------------------------
| PAINEL UNIVERSAL (dono da plataforma — role super_admin)
|--------------------------------------------------------------------------
*/
Route::middleware(['auth:sanctum', 'super_admin'])->prefix('plataforma')->name('plataforma.')->group(function () {
    Route::get('/me', [PlatformSettingsController::class, 'me'])->name('me');
    Route::get('/metricas', PlatformMetricsController::class)->name('metricas');

    Route::get('/barbearias', [PlatformBarbershopController::class, 'index'])->name('barbearias.index');
    Route::get('/barbearias/{id}', [PlatformBarbershopController::class, 'show'])->whereNumber('id')->name('barbearias.show');
    Route::post('/barbearias/{id}/dias', [PlatformBarbershopController::class, 'grantDays'])->whereNumber('id')->name('barbearias.dias');
    Route::put('/barbearias/{id}/plano', [PlatformBarbershopController::class, 'changePlan'])->whereNumber('id')->name('barbearias.plano');
    Route::post('/barbearias/{id}/suspender', [PlatformBarbershopController::class, 'suspend'])->whereNumber('id')->name('barbearias.suspender');
    Route::post('/barbearias/{id}/reativar', [PlatformBarbershopController::class, 'reactivate'])->whereNumber('id')->name('barbearias.reativar');
    Route::post('/barbearias/{id}/acessar', [PlatformBarbershopController::class, 'impersonate'])->whereNumber('id')->middleware('throttle:20,1')->name('barbearias.acessar');

    Route::get('/configuracoes', [PlatformSettingsController::class, 'show'])->name('configuracoes.show');
    Route::put('/configuracoes', [PlatformSettingsController::class, 'update'])->name('configuracoes.update');
    Route::put('/planos/{plan}', [PlatformSettingsController::class, 'updatePlan'])->name('planos.update');

    Route::get('/cobranca/eventos', [PlatformSettingsController::class, 'billingEvents'])->name('cobranca.eventos');
    Route::post('/cobranca/eventos/{event}/reprocessar', [PlatformSettingsController::class, 'reprocessEvent'])->name('cobranca.reprocessar');
});
