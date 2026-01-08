<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Telescope;
use App\Services\PermissionService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Http\Controllers\Api\BaseApiController;

class AuditTrailController extends Controller
{
    use BaseApiController;

    public function index(Request $request): JsonResponse
    {
        PermissionService::requirePermission('audit_trail', 'view');

        $page = max(1, (int)$request->input('page', 1));
        $perPage = min(100, max(1, (int)$request->input('per_page', 20)));

        $query = Telescope::with('user');

        if ($request->has('table_name')) {
            $query->where('table_name', $request->input('table_name'));
        }

        if ($request->has('record_id')) {
            $query->where('record_id', $request->input('record_id'));
        }

        if ($request->has('user_id')) {
            $query->where('user_id', $request->input('user_id'));
        }

        if ($request->has('operation')) {
            $query->where('operation', $request->input('operation'));
        }

        if ($request->has('start_date')) {
            $query->where('created_at', '>=', $request->input('start_date'));
        }

        if ($request->has('end_date')) {
            $query->where('created_at', '<=', $request->input('end_date') . ' 23:59:59');
        }

        $total = $query->count();

        $logs = $query->orderBy('created_at', 'desc')
            ->skip(($page - 1) * $perPage)
            ->take($perPage)
            ->get()
            ->map(function ($log) {
                return [
                    'id' => $log->id,
                    'user_id' => $log->user_id,
                    'user_name' => $log->user?->username,
                    'operation' => $log->operation,
                    'table_name' => $log->table_name,
                    'record_id' => $log->record_id,
                    'old_values' => $log->old_values,
                    'new_values' => $log->new_values,
                    'ip_address' => $log->ip_address,
                    'user_agent' => $log->user_agent,
                    'created_at' => $log->created_at,
                ];
            });

        // Get summary statistics
        $stats = Telescope::when($request->has('table_name'), function ($q) use ($request) {
            $q->where('table_name', $request->input('table_name'));
        })
            ->when($request->has('start_date'), function ($q) use ($request) {
                $q->where('created_at', '>=', $request->input('start_date'));
            })
            ->when($request->has('end_date'), function ($q) use ($request) {
                $q->where('created_at', '<=', $request->input('end_date') . ' 23:59:59');
            })
            ->selectRaw('operation, COUNT(*) as count')
            ->groupBy('operation')
            ->pluck('count', 'operation')
            ->toArray();

        return response()->json([
            'success' => true,
            'data' => [
                'logs' => $logs,
                'statistics' => $stats,
            ],
            'pagination' => [
                'current_page' => $page,
                'per_page' => $perPage,
                'total_records' => $total,
                'total_pages' => ceil($total / $perPage),
            ],
        ]);
    }
}
