<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\SalesService;
use App\Services\PermissionService;
use App\Services\TelescopeService;
use App\Models\Invoice;
use App\Http\Requests\StoreInvoiceRequest;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Http\Controllers\Api\BaseApiController;

class SalesController extends Controller
{
    use BaseApiController;
    private SalesService $salesService;

    public function __construct(SalesService $salesService)
    {
        $this->salesService = $salesService;
    }

    public function index(Request $request): JsonResponse
    {
        PermissionService::requirePermission('sales', 'view');

        $page = max(1, (int)$request->input('page', 1));
        $perPage = min(100, max(1, (int)$request->input('per_page', 20)));
        $paymentType = $request->input('payment_type');
        $customerId = $request->input('customer_id');

        $query = Invoice::with(['user', 'customer']);

        if ($paymentType) {
            $query->where('payment_type', $paymentType);
        }

        if ($customerId) {
            $query->where('customer_id', $customerId);
        }

        $total = $query->count();
        $invoices = $query->orderBy('created_at', 'desc')
            ->skip(($page - 1) * $perPage)
            ->take($perPage)
            ->get()
            ->map(function ($invoice) {
                return [
                    'id' => $invoice->id,
                    'invoice_number' => $invoice->invoice_number,
                    'total_amount' => $invoice->total_amount,
                    'payment_type' => $invoice->payment_type,
                    'customer_id' => $invoice->customer_id,
                    'customer_name' => $invoice->customer?->name,
                    'amount_paid' => $invoice->amount_paid,
                    'user_id' => $invoice->user_id,
                    'cashier_name' => $invoice->user?->username,
                    'created_at' => $invoice->created_at,
                ];
            });

        return response()->json([
            'success' => true,
            'data' => $invoices,
            'pagination' => [
                'current_page' => $page,
                'per_page' => $perPage,
                'total_records' => $total,
                'total_pages' => ceil($total / $perPage),
            ],
        ]);
    }

    public function store(StoreInvoiceRequest $request): JsonResponse
    {
        PermissionService::requirePermission('sales', 'create');

        $validated = $request->validated();

        $validated['user_id'] = auth()->id() ?? session('user_id');

        try {
            $invoiceId = $this->salesService->createInvoice($validated);
            TelescopeService::logOperation('CREATE', 'invoices', $invoiceId, null, $validated);

            return response()->json([
                'success' => true,
                'id' => $invoiceId,
                'invoice_id' => $invoiceId,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage()
            ], 500);
        }
    }

    public function show(Request $request): JsonResponse
    {
        $id = $request->input('id');
        if (!$id) {
            return $this->errorResponse('Invoice ID is required', 400);
        }
        PermissionService::requirePermission('sales', 'view');

        $invoice = Invoice::with(['items.product', 'user', 'customer', 'zatcaEinvoice'])
            ->findOrFail($id);

        return response()->json([
            'success' => true,
            'data' => $invoice,
        ]);
    }

    public function destroy(Request $request): JsonResponse
    {
        PermissionService::requirePermission('sales', 'delete');

        $id = $request->input('id');
        $invoice = Invoice::findOrFail($id);
        $oldValues = $invoice->toArray();

        try {
            $this->salesService->deleteInvoice($id);
            TelescopeService::logOperation('DELETE', 'invoices', $id, $oldValues, null);

            return response()->json([
                'success' => true,
                'message' => 'Invoice deleted successfully'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage()
            ], 500);
        }
    }
}
