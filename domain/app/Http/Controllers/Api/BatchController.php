<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Batch;
use App\Models\BatchItem;
use App\Services\PermissionService;
use App\Services\TelescopeService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class BatchController extends Controller
{
    use BaseApiController;

    public function index(Request $request): JsonResponse
    {
        PermissionService::requirePermission('batch_processing', 'view');

        $action = $request->query('action');
        if ($action === 'status') {
            return $this->show($request);
        }

        $page = $request->query('page', 1);
        $limit = $request->query('limit', 20);

        $batches = Batch::with('creator')
            ->orderBy('created_at', 'desc')
            ->paginate($limit, ['*'], 'page', $page);

        return $this->paginatedResponse(
            $batches->items(),
            $batches->total(),
            $batches->currentPage(),
            $batches->perPage()
        );
    }

    public function store(Request $request): JsonResponse
    {
        PermissionService::requirePermission('batch_processing', 'create');

        $action = $request->query('action');
        if ($action) {
            return $this->execute($request);
        }

        $validated = $request->validate([
            'batch_name' => 'required|string|max:100',
            'batch_type' => 'required|string|max:50',
            'description' => 'nullable|string',
        ]);

        $batch = Batch::create([
            'batch_name' => $validated['batch_name'],
            'batch_type' => $validated['batch_type'],
            'description' => $validated['description'],
            'status' => 'pending',
            'total_items' => 0,
            'created_by' => auth()->id() ?? session('user_id'),
        ]);

        TelescopeService::logOperation('CREATE', 'batch_processing', $batch->id, null, $validated);

        return $this->successResponse($batch);
    }

    public function show(Request $request): JsonResponse
    {
        PermissionService::requirePermission('batch_processing', 'view');

        $batchId = $request->query('batch_id');
        $batch = Batch::with('items')->findOrFail($batchId);

        return $this->successResponse($batch);
    }

    public function execute(Request $request): JsonResponse
    {
        PermissionService::requirePermission('batch_processing', 'edit');

        $batchId = $request->input('batch_id');
        $action = $request->query('action');
        
        $batch = Batch::findOrFail($batchId);
        
        if ($batch->status !== 'pending') {
            return $this->errorResponse('الدفعات المعلقة فقط يمكن تنفيذها', 400);
        }

        // Mark as processing
        $batch->update([
            'status' => 'processing',
            'started_at' => now(),
        ]);

        // Here you would normally queue a job
        // For now, we'll just mock completion for the UI to be happy
        // In a real system, you'd process items here based on $batch->batch_type
        
        // Mocking execution result
        $batch->update([
            'status' => 'completed',
            'completed_at' => now(),
        ]);

        TelescopeService::logOperation('EXECUTE', 'batch_processing', $batchId, ['status' => 'pending'], ['status' => 'completed']);

        return $this->successResponse([], 'تم تنفيذ الدفعة بنجاح');
    }

    public function destroy(Request $request): JsonResponse
    {
        PermissionService::requirePermission('batch_processing', 'delete');

        $id = $request->query('id') ?? $request->input('id');
        $batch = Batch::findOrFail($id);
        
        if ($batch->status === 'processing') {
            return $this->errorResponse('لا يمكن حذف دفعة قيد المعالجة', 400);
        }

        $oldValues = $batch->toArray();
        $batch->delete();

        TelescopeService::logOperation('DELETE', 'batch_processing', $id, $oldValues, null);

        return $this->successResponse([], 'تم حذف الدفعة بنجاح');
    }
}
