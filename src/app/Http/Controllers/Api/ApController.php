<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ApSupplier;
use App\Models\ApTransaction;
use App\Services\PermissionService;
use App\Services\TelescopeService;
use App\Services\LedgerService;
use App\Services\ChartOfAccountsMappingService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class ApController extends Controller
{
    use BaseApiController;

    private LedgerService $ledgerService;
    private ChartOfAccountsMappingService $coaService;

    public function __construct(
        LedgerService $ledgerService,
        ChartOfAccountsMappingService $coaService
    ) {
        $this->ledgerService = $ledgerService;
        $this->coaService = $coaService;
    }

    /**
     * Get suppliers
     */
    public function suppliers(Request $request): JsonResponse
    {
        PermissionService::requirePermission('ap_suppliers', 'view');

        $page = max(1, (int)$request->input('page', 1));
        $perPage = min(100, max(1, (int)$request->input('per_page', 20)));
        $search = $request->input('search', '');

        $query = ApSupplier::query();

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%$search%")
                  ->orWhere('phone', 'like', "%$search%")
                  ->orWhere('tax_number', 'like', "%$search%");
            });
        }

        $total = $query->count();
        $suppliers = $query->orderBy('name')
            ->skip(($page - 1) * $perPage)
            ->take($perPage)
            ->get();

        return $this->paginatedResponse(
            \App\Http\Resources\ApSupplierResource::collection($suppliers),
            $total,
            $page,
            $perPage
        );
    }

    /**
     * Create supplier
     */
    public function storeSupplier(Request $request): JsonResponse
    {
        PermissionService::requirePermission('ap_suppliers', 'create');

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'phone' => 'nullable|string|max:50',
            'email' => 'nullable|email|max:255',
            'address' => 'nullable|string',
            'tax_number' => 'nullable|string|max:50',
            'payment_terms' => 'nullable|integer|min:0',
        ]);

        // Check for duplicates
        $exists = ApSupplier::where('name', $validated['name'])
            ->orWhere(function ($q) use ($validated) {
                if (!empty($validated['phone'])) {
                    $q->where('phone', $validated['phone']);
                }
            })
            ->exists();

        if ($exists) {
            return $this->errorResponse('Supplier with this name or phone already exists', 409);
        }

        $supplier = ApSupplier::create([
            ...$validated,
            'created_by' => auth()->id() ?? session('user_id'),
        ]);

        TelescopeService::logOperation('CREATE', 'ap_suppliers', $supplier->id, null, $validated);

        return $this->successResponse(['id' => $supplier->id]);
    }

    /**
     * Update supplier
     */
    public function updateSupplier(Request $request): JsonResponse
    {
        PermissionService::requirePermission('ap_suppliers', 'edit');

        $validated = $request->validate([
            'id' => 'required|exists:ap_suppliers,id',
            'name' => 'required|string|max:255',
            'phone' => 'nullable|string|max:50',
            'email' => 'nullable|email|max:255',
            'address' => 'nullable|string',
            'tax_number' => 'nullable|string|max:50',
            'payment_terms' => 'nullable|integer|min:0',
        ]);

        $supplier = ApSupplier::findOrFail($validated['id']);
        $oldValues = $supplier->toArray();
        $supplier->update($validated);

        TelescopeService::logOperation('UPDATE', 'ap_suppliers', $supplier->id, $oldValues, $validated);

        return $this->successResponse();
    }

    /**
     * Delete supplier
     */
    public function destroySupplier(Request $request): JsonResponse
    {
        PermissionService::requirePermission('ap_suppliers', 'delete');

        $id = $request->input('id');
        $supplier = ApSupplier::findOrFail($id);

        // Check if supplier has outstanding balance
        if ($supplier->current_balance > 0) {
            return $this->errorResponse('Cannot delete supplier with outstanding balance', 400);
        }

        $oldValues = $supplier->toArray();
        $supplier->delete();

        TelescopeService::logOperation('DELETE', 'ap_suppliers', $id, $oldValues, null);

        return $this->successResponse();
    }

    /**
     * Get AP transactions
     */
    public function transactions(Request $request): JsonResponse
    {
        PermissionService::requirePermission('ap_suppliers', 'view');

        $supplierId = $request->input('supplier_id');
        $page = max(1, (int)$request->input('page', 1));
        $perPage = min(100, max(1, (int)$request->input('per_page', 20)));

        $query = ApTransaction::with(['supplier', 'createdBy'])
            ->where('is_deleted', false);

        if ($supplierId) {
            $query->where('supplier_id', $supplierId);
        }

        $total = $query->count();
        $transactions = $query->orderBy('transaction_date', 'desc')
            ->skip(($page - 1) * $perPage)
            ->take($perPage)
            ->get();

        return $this->paginatedResponse(
            \App\Http\Resources\ApTransactionResource::collection($transactions),
            $total,
            $page,
            $perPage
        );
    }

    /**
     * Create AP transaction
     */
    public function storeTransaction(Request $request): JsonResponse
    {
        PermissionService::requirePermission('ap_suppliers', 'create');

        $validated = $request->validate([
            'supplier_id' => 'required|exists:ap_suppliers,id',
            'type' => 'required|in:invoice,payment,return',
            'amount' => 'required|numeric|min:0.01',
            'description' => 'nullable|string',
            'reference_type' => 'nullable|string',
            'reference_id' => 'nullable|integer',
            'date' => 'nullable|date',
        ]);

        return DB::transaction(function () use ($validated) {
            $transaction = ApTransaction::create([
                'supplier_id' => $validated['supplier_id'],
                'type' => $validated['type'],
                'amount' => $validated['amount'],
                'description' => $validated['description'] ?? '',
                'reference_type' => $validated['reference_type'] ?? null,
                'reference_id' => $validated['reference_id'] ?? null,
                'transaction_date' => $validated['date'] ?? now(),
                'created_by' => auth()->id() ?? session('user_id'),
            ]);

            // GL Posting
            $mappings = $this->coaService->getStandardAccounts();
            $glEntries = [];
            $supplier = ApSupplier::find($validated['supplier_id']);

            if ($validated['type'] === 'invoice') {
                // Supplier Invoice: Debit Expense/Inventory, Credit AP
                $glEntries[] = [
                    'account_code' => $mappings['operating_expenses'], // Simplified default
                    'entry_type' => 'DEBIT',
                    'amount' => $validated['amount'],
                    'description' => "Invoice from supplier: {$supplier->name} - " . ($validated['description'] ?? '')
                ];
                $glEntries[] = [
                    'account_code' => $mappings['accounts_payable'],
                    'entry_type' => 'CREDIT',
                    'amount' => $validated['amount'],
                    'description' => "Invoice from supplier: {$supplier->name} (AP Update)"
                ];
            } elseif ($validated['type'] === 'payment') {
                // Payment to Supplier: Debit AP, Credit Cash
                $glEntries[] = [
                    'account_code' => $mappings['accounts_payable'],
                    'entry_type' => 'DEBIT',
                    'amount' => $validated['amount'],
                    'description' => "Payment to supplier: {$supplier->name} - " . ($validated['description'] ?? '')
                ];
                $glEntries[] = [
                    'account_code' => $mappings['cash'],
                    'entry_type' => 'CREDIT',
                    'amount' => $validated['amount'],
                    'description' => "Payment to supplier: {$supplier->name} (AP Update)"
                ];
            } else {
                // Return: Debit AP, Credit Expense
                $glEntries[] = [
                    'account_code' => $mappings['accounts_payable'],
                    'entry_type' => 'DEBIT',
                    'amount' => $validated['amount'],
                    'description' => "Return to supplier: {$supplier->name} (AP Update)"
                ];
                $glEntries[] = [
                    'account_code' => $mappings['operating_expenses'],
                    'entry_type' => 'CREDIT',
                    'amount' => $validated['amount'],
                    'description' => "Return to supplier: {$supplier->name} - " . ($validated['description'] ?? '')
                ];
            }

            $voucherNumber = $this->ledgerService->postTransaction(
                $glEntries,
                'ap_transactions',
                $transaction->id,
                null,
                $validated['date'] ?? now()->format('Y-m-d')
            );

            $transaction->update(['description' => ($validated['description'] ?? '') . " [Voucher: $voucherNumber]"]);

            // Update supplier balance
            $this->updateSupplierBalance($validated['supplier_id']);

            TelescopeService::logOperation('CREATE', 'ap_transactions', $transaction->id, null, $validated);

            return $this->successResponse(['id' => $transaction->id, 'voucher_number' => $voucherNumber]);
        });
    }

    /**
     * Record supplier payment
     */
    public function recordPayment(Request $request): JsonResponse
    {
        PermissionService::requirePermission('ap_suppliers', 'create');

        $validated = $request->validate([
            'supplier_id' => 'required|exists:ap_suppliers,id',
            'amount' => 'required|numeric|min:0.01',
            'payment_method' => 'nullable|in:cash,bank_transfer,check',
            'description' => 'nullable|string',
            'date' => 'nullable|date',
        ]);

        return DB::transaction(function () use ($validated) {
            // Create payment transaction
            $transaction = ApTransaction::create([
                'supplier_id' => $validated['supplier_id'],
                'type' => 'payment',
                'amount' => $validated['amount'],
                'description' => $validated['description'] ?? 'Supplier payment',
                'transaction_date' => $validated['date'] ?? now(),
                'created_by' => auth()->id() ?? session('user_id'),
            ]);

            // Post to GL
            $accounts = $this->coaService->getStandardAccounts();
            $voucherNumber = $this->ledgerService->getNextVoucherNumber('APP');

            $glEntries = [
                [
                    'account_code' => $accounts['accounts_payable'],
                    'entry_type' => 'DEBIT',
                    'amount' => $validated['amount'],
                    'description' => "Supplier payment - Voucher #$voucherNumber"
                ],
                [
                    'account_code' => $accounts['cash'],
                    'entry_type' => 'CREDIT',
                    'amount' => $validated['amount'],
                    'description' => "Supplier payment - Voucher #$voucherNumber"
                ],
            ];

            $this->ledgerService->postTransaction(
                $glEntries,
                'ap_transactions',
                $transaction->id,
                $voucherNumber,
                $validated['date'] ?? now()->format('Y-m-d')
            );

            // Update supplier balance
            $this->updateSupplierBalance($validated['supplier_id']);

            TelescopeService::logOperation('CREATE', 'ap_transactions', $transaction->id, null, $validated);

            return $this->successResponse([
                'id' => $transaction->id,
                'voucher_number' => $voucherNumber,
            ]);
        });
    }

    /**
     * Get supplier ledger with aging
     */
    public function supplierLedger(Request $request): JsonResponse
    {
        PermissionService::requirePermission('ap_suppliers', 'view');

        $supplierId = $request->input('supplier_id');
        
        if (!$supplierId) {
            return $this->errorResponse('supplier_id is required', 400);
        }

        $supplier = ApSupplier::findOrFail($supplierId);
        $page = max(1, (int)$request->input('page', 1));
        $perPage = min(100, max(1, (int)$request->input('per_page', 20)));

        $query = ApTransaction::where('supplier_id', $supplierId)
            ->where('is_deleted', false)
            ->with('createdBy');

        $total = $query->count();
        $transactions = $query->orderBy('transaction_date', 'desc')
            ->skip(($page - 1) * $perPage)
            ->take($perPage)
            ->get();

        // Calculate aging using a targeted query for efficiency
        $agingData = ApTransaction::where('supplier_id', $supplierId)
            ->where('is_deleted', false)
            ->where('type', 'invoice')
            ->selectRaw('
                SUM(CASE WHEN DATEDIFF(?, transaction_date) <= 0 THEN amount ELSE 0 END) as current,
                SUM(CASE WHEN DATEDIFF(?, transaction_date) BETWEEN 1 AND 30 THEN amount ELSE 0 END) as `1_30`,
                SUM(CASE WHEN DATEDIFF(?, transaction_date) BETWEEN 31 AND 60 THEN amount ELSE 0 END) as `31_60`,
                SUM(CASE WHEN DATEDIFF(?, transaction_date) BETWEEN 61 AND 90 THEN amount ELSE 0 END) as `61_90`,
                SUM(CASE WHEN DATEDIFF(?, transaction_date) > 90 THEN amount ELSE 0 END) as `over_90`
            ', [now()->format('Y-m-d'), now()->format('Y-m-d'), now()->format('Y-m-d'), now()->format('Y-m-d'), now()->format('Y-m-d')])
            ->first();

        $aging = [
            'current' => (float)($agingData->current ?? 0),
            '1_30' => (float)($agingData->{'1_30'} ?? 0),
            '31_60' => (float)($agingData->{'31_60'} ?? 0),
            '61_90' => (float)($agingData->{'61_90'} ?? 0),
            'over_90' => (float)($agingData->over_90 ?? 0),
        ];

        return $this->successResponse([
            'supplier' => [
                'id' => $supplier->id,
                'name' => $supplier->name,
                'current_balance' => (float)$supplier->current_balance,
            ],
            'aging' => $aging,
            'transactions' => \App\Http\Resources\ApTransactionResource::collection($transactions),
            'pagination' => [
                'current_page' => $page,
                'per_page' => $perPage,
                'total_records' => $total,
                'total_pages' => ceil($total / $perPage),
            ],
        ]);
    }

    /**
     * Update supplier balance
     */
    private function updateSupplierBalance(int $supplierId): void
    {
        $balance = ApTransaction::where('supplier_id', $supplierId)
            ->where('is_deleted', false)
            ->selectRaw('
                SUM(CASE 
                    WHEN type = "invoice" THEN amount 
                    WHEN type IN ("payment", "return") THEN -amount 
                    ELSE 0 
                END) as balance
            ')
            ->value('balance') ?? 0;

        ApSupplier::where('id', $supplierId)->update([
            'current_balance' => $balance
        ]);
    }
}
