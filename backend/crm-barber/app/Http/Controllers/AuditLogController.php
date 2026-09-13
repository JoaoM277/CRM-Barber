<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use Illuminate\Http\Request;

class AuditLogController extends Controller
{
    /**
     * Últimas ações do painel (quem fez o quê). Admin only.
     */
    public function index(Request $request)
    {
        $perPage = min((int) $request->query('per_page', 50), 200);

        $logs = AuditLog::with('user:id,name')
            ->orderByDesc('created_at')
            ->paginate($perPage);

        return response()->json([
            'data' => $logs->items(),
            'meta' => [
                'current_page' => $logs->currentPage(),
                'per_page' => $logs->perPage(),
                'total' => $logs->total(),
                'last_page' => $logs->lastPage(),
            ],
        ]);
    }
}
