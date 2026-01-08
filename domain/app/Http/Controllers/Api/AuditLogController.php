<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Telescope;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class AuditLogController extends Controller
{
    use BaseApiController;

    public function index(Request $request): JsonResponse
    {
        $query = Telescope::with('user');

        if ($request->has('date_from') && $request->date_from) {
            $query->whereDate('created_at', '>=', $request->date_from);
        }
        if ($request->has('date_to') && $request->date_to) {
            $query->whereDate('created_at', '<=', $request->date_to);
        }
        if ($request->has('action') && $request->action) {
            $query->where('operation', $request->action);
        }
        if ($request->has('module') && $request->module) {
            $query->where('table_name', $request->module);
        }
        if ($request->has('search') && $request->search) {
            $search = $request->search;
            $query->where(function($q) use ($search) {
                $q->whereHas('user', function($u) use ($search) {
                    $u->where('name', 'like', "%{$search}%");
                })
                ->orWhere('record_id', 'like', "%{$search}%");
            });
        }

        $limit = $request->input('limit', 20);
        $logs = $query->orderBy('created_at', 'desc')->paginate($limit);

        $mappedData = collect($logs->items())->map(function ($log) {
            return [
                'id' => $log->id,
                'user_name' => $log->user ? $log->user->name : 'Unknown',
                'action' => strtolower($log->operation),
                'module' => $log->table_name,
                'description' => $this->generateDescription($log),
                'ip_address' => $log->ip_address,
                'created_at' => $log->created_at,
            ];
        });

        return response()->json([
            'success' => true,
            'logs' => $mappedData,
            'total' => $logs->total(),
            'current_page' => $logs->currentPage(),
            'last_page' => $logs->lastPage(),
        ]);
    }

    private function generateDescription($log)
    {
        $action = ucfirst(strtolower($log->operation));
        $module = ucfirst($log->table_name);
        return "$action operation on $module regarding record ID $log->record_id";
    }
}
