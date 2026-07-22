<?php

use App\Http\Controllers\LogController;
use App\Http\Controllers\ClientController;
use App\Http\Controllers\WorkerController;
use App\Http\Controllers\ServiceController;
use App\Http\Controllers\OperationTimeController;
use App\Http\Controllers\ScheduleController;
use App\Http\Controllers\BarbershopController;
use App\Http\Controllers\MessageController;
use Illuminate\Support\Facades\Route;

// Client
Route::get('/clientes', [ClientController::class, 'index'])->name('clientes.index');
Route::post('/clientes', [ClientController::class, 'store'])->name('clientes.store');
Route::get('/clientes/{cliente}', [ClientController::class, 'show'])->name('clientes.show');
Route::put('/clientes/{cliente}', [ClientController::class, 'update'])->name('clientes.update');
Route::delete('/clientes/{cliente}', [ClientController::class, 'destroy'])->name('clientes.delete');    


// Worker
Route::get('/profissionais', [WorkerController::class, 'index'])->name('profissionais.index');
Route::post('/profissionais', [WorkerController::class, 'store'])->name('profissionais.store');
Route::get('/profissionais/{profissional}', [WorkerController::class, 'show'])->name('profissionais.show');
Route::put('/profissionais/{profissional}', [WorkerController::class, 'update'])->name('profissionais.update');
Route::delete('/profissionais/{profissional}', [WorkerController::class, 'destroy'])->name('profissionais.delete');  


// Service
Route::get('/servicos', [ServiceController::class, 'index'])->name('servicos.index');
Route::post('/servicos', [ServiceController::class, 'store'])->name('servicos.store');
Route::get('/servicos/{servico}', [ServiceController::class, 'show'])->name('servicos.show');
Route::put('/servicos/{servico}', [ServiceController::class, 'update'])->name('servicos.update');
Route::delete('/servicos/{servico}', [ServiceController::class, 'destroy'])->name('servicos.delete');  

// OperationTime
Route::get('/tempo_de_operacao', [OperationTimeController::class, 'index'])->name('tempo_de_operacao.index');
Route::post('/tempo_de_operacao', [OperationTimeController::class, 'store'])->name('tempo_de_operacao.store');
Route::get('/tempo_de_operacao/{operacao}', [OperationTimeController::class, 'show'])->name('tempo_de_operacao.show');
Route::put('/tempo_de_operacao/{operacao}', [OperationTimeController::class, 'update'])->name('tempo_de_operacao.update');
Route::delete('/tempo_de_operacao/{operacao}', [OperationTimeController::class, 'destroy'])->name('tempo_de_operacao.delete');  

// Schedule
Route::get('/agendamentos', [ScheduleController::class, 'index'])->name('agendamentos.index');
Route::post('/agendamentos', [ScheduleController::class, 'store'])->name('agendamentos.store');
Route::get('/agendamentos/{agendamento}', [ScheduleController::class, 'show'])->name('agendamentos.show');
Route::put('/agendamentos/{agendamento}', [ScheduleController::class, 'update'])->name('agendamentos.update');
Route::delete('/agendamentos/{agendamento}', [ScheduleController::class, 'destroy'])->name('agendamentos.delete');

// Barbershop
Route::get('/barbearias', [BarbershopController::class, 'index'])->name('barbearias.index');
Route::post('/barbearias', [BarbershopController::class, 'store'])->name('barbearias.store');
Route::get('/barbearias/{barbearia}', [BarbershopController::class, 'show'])->name('barbearias.show');
Route::put('/barbearias/{barbearia}', [BarbershopController::class, 'update'])->name('barbearias.update');
Route::delete('/barbearias/{barbearia}', [BarbershopController::class, 'destroy'])->name('barbearias.delete');  

// Log
Route::apiResource('logs', LogController::class);

// Message Service
Route::post('/mensagens/agendamento', [MessageController::class, 'sendAppointmentConfirmation'])->name('mensagens.agendamento');
