<?php

namespace App\Http\Controllers;

use App\Models\Log;
use App\Http\Requests\StoreLogRequest;
use App\Http\Requests\UpdateLogRequest;

class LogController extends Controller
{
    public function index()
    {
        return Log::all();
    }


    public function store(StoreLogRequest $request)
    {
        $log = Log::create($request->validated());

        return response()->json($log);
    }


    public function show(Log $log)
    {
        return $log;
    }


    public function destroy(Log $log)
    {
        $log->delete();

        return response()->json([
            'message' => 'Log removido'
        ]);
    }
}
