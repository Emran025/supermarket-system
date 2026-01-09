<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ArCustomer;
use App\Models\ArTransaction;
use App\Services\PermissionService;
use App\Services\TelescopeService;
use App\Http\Requests\StoreArCustomerRequest;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use App\Http\Controllers\Api\BaseApiController;

use App\Services\LedgerService;
use App\Services\ChartOfAccountsMappingService;

class ArController extends Controller
{
    use BaseApiController;

    private LedgerService $ledgerService;
    private ChartOfAccountsMappingService $coaService;

    public function __construct(LedgerService $ledgerService, ChartOfAccountsMappingService $coaService)
    {
        $this->ledgerService = $ledgerService;
        $this->coaService = $coaService;
    }

    public function customers(Request $request): JsonResponse
    {
        PermissionService::requirePermission('ar_customers', 'view');

        $page = max(1, (int)$request->input('page', 1));
        $perPage = min(100, max(1, (int)$request->input('per_page', 20)));
        $search = $request->input('search', '');

        $query = ArCustomer::query();

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%$search%")
                  ->orWhere('phone', 'like', "%$search%")
                  ->orWhere('tax_number', 'like', "%$search%");
            });
        }

        $total = $query->count();
        $customers = $query->orderBy('name')
            ->skip(($page - 1) * $perPage)
            ->take($perPage)
            ->withSum(['invoices as total_debt' => function ($query) {
                $query->where('payment_type', 'credit');
            }], 'total_amount')
            ->get()
            ->map(function ($customer) {
                $customer->total_debt = $customer->total_debt ?? 0;
                $customer->total_paid = max(0, $customer->total_debt - $customer->current_balance);
                return $customer;
            });

        return $this->paginatedResponse(
            \App\Http\Resources\ArCustomerResource::collection($customers),
            $total,
            $page,
            $perPage
        );
    }

    public function storeCustomer(StoreArCustomerRequest $request): JsonResponse
    {
        PermissionService::requirePermission('ar_customers', 'create');

        $validated = $request->validated();

        // Check for duplicates
        $exists = ArCustomer::where('name', $validated['name'])
            ->orWhere(function ($q) use ($validated) {
                if (!empty($validated['phone'])) {
                    $q->where('phone', $validated['phone']);
                }
            })
            ->exists();

        if ($exists) {
            return $this->errorResponse('Customer with this name or phone already exists', 409);
        }

        $customer = ArCustomer::create([
            ...$validated,
            'created_by' => auth()->id() ?? session('user_id'),
        ]);

        TelescopeService::logOperation('CREATE', 'ar_customers', $customer->id, null, $validated);

        return $this->successResponse(['id' => $customer->id]);
    }

    public function updateCustomer(Request $request): JsonResponse
    {
        PermissionService::requirePermission('ar_customers', 'edit');

        $validated = $request->validate([
            'id' => 'required|exists:ar_customers,id',
            'name' => 'required|string|max:255',
            'phone' => 'nullable|string|max:50',
            'email' => 'nullable|email|max:255',
            'address' => 'nullable|string',
            'tax_number' => 'nullable|string|max:50',
        ]);

        $customer = ArCustomer::findOrFail($validated['id']);
        $oldValues = $customer->toArray();
        $customer->update($validated);

        TelescopeService::logOperation('UPDATE', 'ar_customers', $customer->id, $oldValues, $validated);

        return $this->successResponse();
    }

    public function destroyCustomer(Request $request): JsonResponse
    {
        PermissionService::requirePermission('ar_customers', 'delete');

        $id = $request->input('id');
        $customer = ArCustomer::findOrFail($id);
        $oldValues = $customer->toArray();
        $customer->delete();

        TelescopeService::logOperation('DELETE', 'ar_customers', $id, $oldValues, null);

        return $this->successResponse();
    }

    public function ledger(Request $request): JsonResponse
    {
        PermissionService::requirePermission('ar_customers', 'view');

        $customerId = $request->input('customer_id');
        if (!$customerId) {
            return $this->errorResponse('customer_id is required', 400);
        }

        $customer = ArCustomer::findOrFail($customerId);
        $page = max(1, (int)$request->input('page', 1));
        $perPage = min(100, max(1, (int)$request->input('per_page', 20)));

        $query = ArTransaction::where('customer_id', $customerId)
            ->where('is_deleted', false)
            ->with('createdBy');

        $total = $query->count();
        $transactions = $query->orderBy('transaction_date', 'desc')
            ->skip(($page - 1) * $perPage)
            ->take($perPage)
            ->get();

        return $this->successResponse([
            'customer' => [
                'id' => $customer->id,
                'name' => $customer->name,
                'current_balance' => (float)$customer->current_balance,
            ],
            'transactions' => \App\Http\Resources\ArTransactionResource::collection($transactions),
            'pagination' => [
                'current_page' => $page,
                'per_page' => $perPage,
                'total_records' => $total,
                'total_pages' => ceil($total / $perPage),
            ],
        ]);
    }

    public function storeTransaction(Request $request): JsonResponse
    {
        PermissionService::requirePermission('ar_customers', 'create');

        $validated = $request->validate([
            'customer_id' => 'required|exists:ar_customers,id',
            'type' => 'required|in:payment,return',
            'amount' => 'required|numeric|min:0.01',
            'description' => 'nullable|string',
            'date' => 'nullable|date',
        ]);

        return DB::transaction(function () use ($validated) {
            $transaction = ArTransaction::create([
                'customer_id' => $validated['customer_id'],
                'type' => $validated['type'],
                'amount' => $validated['amount'],
                'description' => $validated['description'] ?? '',
                'transaction_date' => $validated['date'] ?? now(),
                'created_by' => auth()->id() ?? session('user_id'),
            ]);

            // Update customer balance
            $balanceChange = $validated['type'] === 'payment' 
                ? -$validated['amount'] 
                : $validated['amount'];
            
            ArCustomer::where('id', $validated['customer_id'])
                ->increment('current_balance', $balanceChange);

            // GL Posting
            $mappings = $this->coaService->getStandardAccounts();
            $glEntries = [];
            $customer = ArCustomer::find($validated['customer_id']);

            if ($validated['type'] === 'payment') {
                // Payment Received: Debit Cash, Credit AR
                $glEntries[] = [
                    'account_code' => $mappings['cash'],
                    'entry_type' => 'DEBIT',
                    'amount' => $validated['amount'],
                    'description' => "Payment from customer: {$customer->name} - " . ($validated['description'] ?? '')
                ];
                $glEntries[] = [
                    'account_code' => $mappings['accounts_receivable'],
                    'entry_type' => 'CREDIT',
                    'amount' => $validated['amount'],
                    'description' => "Payment from customer: {$customer->name} (AR Update)"
                ];
            } else {
                // Return: Debit Sales Revenue (or Sales Return), Credit AR
                $glEntries[] = [
                    'account_code' => $mappings['sales_revenue'], // Simplified, usually a specific Sales Return account
                    'entry_type' => 'DEBIT',
                    'amount' => $validated['amount'],
                    'description' => "Return from customer: {$customer->name} - " . ($validated['description'] ?? '')
                ];
                $glEntries[] = [
                    'account_code' => $mappings['accounts_receivable'],
                    'entry_type' => 'CREDIT',
                    'amount' => $validated['amount'],
                    'description' => "Return from customer: {$customer->name} (AR Update)"
                ];
            }

            $voucherNumber = $this->ledgerService->postTransaction(
                $glEntries,
                'ar_transactions',
                $transaction->id,
                null,
                $validated['date'] ?? now()->format('Y-m-d')
            );

            $transaction->update(['description' => ($validated['description'] ?? '') . " [Voucher: $voucherNumber]"]);

            TelescopeService::logOperation('CREATE', 'ar_transactions', $transaction->id, null, $validated);

            return $this->successResponse(['id' => $transaction->id, 'voucher_number' => $voucherNumber]);
        });
    }

    public function destroyTransaction(Request $request): JsonResponse
    {
        PermissionService::requirePermission('ar_customers', 'delete');

        $id = $request->input('id');
        $transaction = ArTransaction::findOrFail($id);

        return DB::transaction(function () use ($transaction) {
            // Reverse balance change
            $balanceChange = $transaction->type === 'payment' 
                ? $transaction->amount 
                : -$transaction->amount;
            
            ArCustomer::where('id', $transaction->customer_id)
                ->increment('current_balance', $balanceChange);

            // Reverse GL entries
            $voucherNumber = \App\Models\GeneralLedger::where('reference_type', 'ar_transactions')
                ->where('reference_id', $transaction->id)
                ->value('voucher_number');
            
            if ($voucherNumber) {
                $this->ledgerService->reverseTransaction($voucherNumber, "Reversal of AR Transaction #{$transaction->id}");
            }

            // Soft delete
            $transaction->update([
                'is_deleted' => true,
                'deleted_at' => now(),
            ]);

            TelescopeService::logOperation('DELETE', 'ar_transactions', $transaction->id, $transaction->toArray(), null);

            return $this->successResponse();
        });
    }

    public function updateTransaction(Request $request): JsonResponse
    {
        PermissionService::requirePermission('ar_customers', 'edit');

        $validated = $request->validate([
            'id' => 'required|exists:ar_transactions,id',
            'restore' => 'nullable|boolean',
        ]);

        $transaction = ArTransaction::findOrFail($validated['id']);

        if ($validated['restore'] ?? false) {
            // Restore transaction
            $balanceChange = $transaction->type === 'payment' 
                ? -$transaction->amount 
                : $transaction->amount;
            
            ArCustomer::where('id', $transaction->customer_id)
                ->increment('current_balance', $balanceChange);

            $transaction->update([
                'is_deleted' => false,
                'deleted_at' => null,
            ]);

            TelescopeService::logOperation('UPDATE', 'ar_transactions', $transaction->id, ['is_deleted' => true], ['is_deleted' => false]);
        }

        return $this->successResponse();
    }
}
