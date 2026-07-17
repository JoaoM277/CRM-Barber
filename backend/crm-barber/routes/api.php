<?php

use App\Http\Controllers\ClientController;
use App\Http\Controllers\WorkerController;
use App\Http\Controllers\ServiceController;
use App\Http\Controllers\OperationTimeController;
use App\Http\Controllers\ScheduleController;
use Illuminate\Support\Facades\Route;

// Client
Route::get('/clients', [ClientController::class, 'index'])->name('clients.index');
Route::post('/clients', [ClientController::class, 'store'])->name('clients.store');
Route::get('/clients/{client}', [ClientController::class, 'show'])->name('clients.show');
Route::put('/clients/{client}', [ClientController::class, 'update'])->name('clients.update');
Route::delete('/clients/{client}', [ClientController::class, 'destroy'])->name('clients.delete');    


// Worker
Route::get('/workers', [WorkerController::class, 'index'])->name('workers.index');
Route::post('/workers', [WorkerController::class, 'store'])->name('workers.store');
Route::get('/workers/{worker}', [WorkerController::class, 'show'])->name('workers.show');
Route::put('/workers/{worker}', [WorkerController::class, 'update'])->name('workers.update');
Route::delete('/workers/{worker}', [WorkerController::class, 'destroy'])->name('workers.delete');  


// Service
Route::get('/services', [ServiceController::class, 'index'])->name('services.index');
Route::post('/services', [ServiceController::class, 'store'])->name('services.store');
Route::get('/services/{service}', [ServiceController::class, 'show'])->name('services.show');
Route::put('/services/{service}', [ServiceController::class, 'update'])->name('services.update');
Route::delete('/services/{service}', [ServiceController::class, 'destroy'])->name('services.delete');  

// OperationTime
Route::get('/operation_times', [OperationTimeController::class, 'index'])->name('operation_times.index');
Route::post('/operation_times', [OperationTimeController::class, 'store'])->name('operation_times.store');
Route::get('/operation_times/{operation_time}', [OperationTimeController::class, 'show'])->name('operation_times.show');
Route::put('/operation_times/{operation_time}', [OperationTimeController::class, 'update'])->name('operation_times.update');
Route::delete('/operation_times/{operation_time}', [OperationTimeController::class, 'destroy'])->name('operation_times.delete');  

// Schedule
Route::get('/schedules', [ScheduleController::class, 'index'])->name('schedules.index');
Route::post('/schedules', [ScheduleController::class, 'store'])->name('schedules.store');
Route::get('/schedules/{schedule}', [ScheduleController::class, 'show'])->name('schedules.show');
Route::put('/schedules/{schedule}', [ScheduleController::class, 'update'])->name('schedules.update');
Route::delete('/schedules/{schedule}', [ScheduleController::class, 'destroy'])->name('schedules.delete');  