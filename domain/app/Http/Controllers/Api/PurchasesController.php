<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Purchase;
use App\Models\PurchaseRequest;
use App\Models\Product;
use App\Services\PermissionService;
use App\Services\TelescopeService;
use App\Services\LedgerService;
use App\Services\ChartOfAccountsMappingService;
use App\Http\Requests\StorePurchaseRequest;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use App\Http\Controllers\Api\BaseApiController;

class PurchasesController extends Controller
{
    use BaseApiController;

    private LedgerService $ledgerService;
    private ChartOfAccountsMappingService $coaService;
    private \App\Services\InventoryCostingService $costingService;

    public function __construct(
        LedgerService $ledgerService,
        ChartOfAccountsMappingService $coaService,
        \App\Services\InventoryCostingService $costingService
    ) {
        $this->ledgerService = $ledgerService;
        $this->coaService = $coaService;
        $this->costingService = $costingService;
    }

    public function index(Request $request): JsonResponse
    {
        PermissionService::requirePermission('purchases', 'view');

        $page = max(1, (int)$request->input('page', 1));
        $perPage = min(100, max(1, (int)$request->input('per_page', 20)));
        $search = $request->input('search', '');

        $query = Purchase::with(['product', 'user', 'supplier']);

        if ($search) {
            $query->whereHas('product', function ($q) use ($search) {
                $q->where('name', 'like', "%$search%");
            });
        }

        $total = $query->count();
        $purchases = $query->orderBy('purchase_date', 'desc')
            ->skip(($page - 1) * $perPage)
            ->take($perPage)
            ->get()
            ->map(function ($purchase) {
                return [
                    'id' => $purchase->id,
                    'product_id' => $purchase->product_id,
                    'product_name' => $purchase->product->name,
                    'quantity' => $purchase->quantity,
                    'invoice_price' => $purchase->invoice_price, 
                    'unit_price' => $purchase->quantity > 0 ? round($purchase->invoice_price / $purchase->quantity, 2) : 0,
                    'total_price' => $purchase->invoice_price, // Frontend expects total_price
                    'supplier' => $purchase->supplier ? $purchase->supplier->name : null,
                    'unit_type' => $purchase->unit_type,
                    'production_date' => $purchase->production_date,
                    'expiry_date' => $purchase->expiry_date,
                    'purchase_date' => $purchase->purchase_date,
                    'created_at' => $purchase->created_at,
                    'notes' => $purchase->notes,
                    'voucher_number' => $purchase->voucher_number,
                    'approval_status' => $purchase->approval_status,
                ];
            });

        return $this->paginatedResponse($purchases, $total, $page, $perPage);
    }

    public function store(StorePurchaseRequest $request): JsonResponse
    {
        PermissionService::requirePermission('purchases', 'create');

        $validated = $request->validated();

        try {
            $product = Product::findOrFail($validated['product_id']);
            $itemsPerUnit = $product->items_per_unit ?? 1;
            $actualQuantity = ($validated['unit_type'] === 'main') 
                ? ($validated['quantity'] * $itemsPerUnit) 
                : $validated['quantity'];

            $unitCost = $validated['invoice_price'] / $actualQuantity;
            $vatRate = $validated['vat_rate'] ?? 0;
            $vatAmount = $validated['vat_amount'] ?? ($validated['invoice_price'] * $vatRate / 100);
            $subtotal = $validated['invoice_price'] - $vatAmount;

            // Determine approval status
            $approvalThreshold = (float) \App\Models\Setting::where('setting_key', 'purchase_approval_threshold')
                ->value('setting_value') ?? 10000;
            $approvalStatus = $validated['invoice_price'] >= $approvalThreshold ? 'pending' : 'approved';

            // Handle Supplier (Find or Create if name provided but ID missing)
            $supplierId = $validated['supplier_id'] ?? null;
            if (!$supplierId && $request->filled('supplier_name')) {
                $supplierName = $request->input('supplier_name');
                $supplier = \App\Models\ApSupplier::firstOrCreate(
                    ['name' => $supplierName],
                    ['created_by' => auth()->id() ?? session('user_id')]
                );
                $supplierId = $supplier->id;
            }

            $purchase = Purchase::create([
                'product_id' => $validated['product_id'],
                'quantity' => $validated['quantity'],
                'invoice_price' => $validated['invoice_price'],
                'unit_type' => $validated['unit_type'],
                'production_date' => $validated['production_date'] ?? null,
                'expiry_date' => $validated['expiry_date'] ?? null,
                'supplier_id' => $supplierId,
                'vat_rate' => $vatRate,
                'vat_amount' => $vatAmount,
                'user_id' => auth()->id() ?? session('user_id'),
                'approval_status' => $approvalStatus,
                'voucher_number' => $this->ledgerService->getNextVoucherNumber('PUR'),
                'notes' => $validated['notes'] ?? null,
            ]);

            // If approved, process immediately
            if ($approvalStatus === 'approved') {
                $this->processPurchase($purchase, $actualQuantity, $unitCost, $subtotal);
            }

            TelescopeService::logOperation('CREATE', 'purchases', $purchase->id, null, $validated);

            return response()->json([
                'success' => true,
                'id' => $purchase->id,
                'voucher_number' => $purchase->voucher_number,
                'approval_status' => $approvalStatus,
                'message' => $approvalStatus === 'pending' ? 'Purchase created and pending approval' : 'Purchase created successfully',
            ]);
        } catch (\Exception $e) {
            return $this->errorResponse($e->getMessage(), 500);
        }
    }

    private function processPurchase(Purchase $purchase, int $actualQuantity, float $unitCost, float $subtotal): void
    {
        DB::transaction(function () use ($purchase, $actualQuantity, $unitCost, $subtotal) {
            // Update stock
            $purchase->product->increment('stock_quantity', $actualQuantity);

            // Record in inventory costing
            $this->costingService->recordPurchase(
                $purchase->product_id, 
                $purchase->id, 
                $actualQuantity, 
                $unitCost, 
                $purchase->invoice_price, 
                'FIFO'
            );

            // Update weighted average cost
            $currentStock = $purchase->product->stock_quantity;
            $currentCost = $purchase->product->weighted_average_cost ?? 0;
            // Note: stock_quantity has already been incremented by line 135 in original code, so we use it directly?
            // Actually, in original code:
            // $purchase->product->increment('stock_quantity', $actualQuantity);
            // $currentStock = $purchase->product->stock_quantity;
            // The increment happens first.
            // Weighted Average Formula: ((OldQty * OldCost) + (NewQty * NewCost)) / (OldQty + NewQty)
            // If we already incremented stock:
            // OldQty = CurrentStock - NewQty
            $oldStock = $currentStock - $actualQuantity;
            
            $newCost = 0;
            if ($currentStock > 0) {
                 $newCost = (($oldStock * $currentCost) + ($purchase->invoice_price)) / $currentStock;
            }
            
            $purchase->product->update(['weighted_average_cost' => $newCost]);

            // Post to GL
            $accounts = $this->coaService->getStandardAccounts();
            $glEntries = [
                [
                    'account_code' => $accounts['inventory'],
                    'entry_type' => 'DEBIT',
                    'amount' => $subtotal,
                    'description' => "Purchase - Voucher #{$purchase->voucher_number}"
                ],
            ];

            if ($purchase->vat_amount > 0) {
                $glEntries[] = [
                    'account_code' => $accounts['input_vat'],
                    'entry_type' => 'DEBIT',
                    'amount' => $purchase->vat_amount,
                    'description' => "VAT Input - Voucher #{$purchase->voucher_number}"
                ];
            }

            // Credit side (Cash or AP)
            $paymentType = 'cash'; // Default, can be extended
            $glEntries[] = [
                'account_code' => $paymentType === 'cash' ? $accounts['cash'] : $accounts['accounts_payable'],
                'entry_type' => 'CREDIT',
                'amount' => $purchase->invoice_price,
                'description' => "Purchase Payment - Voucher #{$purchase->voucher_number}"
            ];

            $this->ledgerService->postTransaction(
                $glEntries,
                'purchases',
                $purchase->id,
                $purchase->voucher_number,
                now()->format('Y-m-d')
            );
        });
    }

    public function requests(Request $request): JsonResponse
    {
        PermissionService::requirePermission('purchases', 'view');

        $requests = PurchaseRequest::with(['product', 'user'])
            ->orderBy('created_at', 'desc')
            ->get();

        return $this->successResponse($requests);
    }

    public function storeRequest(Request $request): JsonResponse
    {
        PermissionService::requirePermission('purchases', 'create');

        $validated = $request->validate([
            'product_id' => 'nullable|exists:products,id',
            'product_name' => 'nullable|string|max:255',
            'quantity' => 'required|integer|min:1',
            'notes' => 'nullable|string',
            'supplier_name' => 'nullable|string|max:255',
        ]);

        if (!$validated['product_id'] && !$validated['product_name']) {
            return $this->errorResponse('Either product_id or product_name is required', 400);
        }

        $request = PurchaseRequest::create([
            'product_id' => $validated['product_id'] ?? null,
            'product_name' => $validated['product_name'] ?? null,
            'quantity' => $validated['quantity'],
            'notes' => $validated['notes'] ?? null,
            'user_id' => auth()->id() ?? session('user_id'),
            'status' => 'pending',
        ]);

        return $this->successResponse(['id' => $request->id]);
    }

    public function updateRequest(Request $request): JsonResponse
    {
        PermissionService::requirePermission('purchases', 'edit');

        $validated = $request->validate([
            'id' => 'required|exists:purchase_requests,id',
            'status' => 'required|in:approved,rejected',
        ]);

        $purchaseRequest = PurchaseRequest::findOrFail($validated['id']);
        $purchaseRequest->update(['status' => $validated['status']]);

        return $this->successResponse();
    }

    public function approve(Request $request): JsonResponse
    {
        PermissionService::requirePermission('purchases', 'edit');

        $purchaseId = $request->input('id');
        $purchase = Purchase::find($purchaseId);

        if (!$purchase) {
            return $this->errorResponse('Purchase not found', 404);
        }

        if ($purchase->approval_status === 'approved') {
            return $this->errorResponse('Purchase already approved', 400);
        }

        try {
            DB::beginTransaction();

            // Update status
            $purchase->update([
                'approval_status' => 'approved',
                'approved_by' => auth()->id() ?? session('user_id'),
                'approved_at' => now(),
            ]);

            // Process purchase (Stock + GL)
            $product = $purchase->product;
            $itemsPerUnit = $product->items_per_unit ?? 1;
            $actualQuantity = ($purchase->unit_type === 'main') 
                ? ($purchase->quantity * $itemsPerUnit) 
                : $purchase->quantity;

            $unitCost = $purchase->invoice_price / ($actualQuantity > 0 ? $actualQuantity : 1);
            $subtotal = $purchase->invoice_price - $purchase->vat_amount;

            $this->processPurchase($purchase, $actualQuantity, $unitCost, $subtotal);

            // Post to AP if credit purchase (Assuming logic from legacy where payment_type wasn't strictly in DB but inferred or default credit)
            // Legacy checked payment_type ?? 'credit'.
            // For now, we assume credit if supplier is set, or we need to add payment_type to Purchase model if not present.
            // The table has supplier_id.
            
            // Legacy: if ($payment_type === 'credit' && $supplier_id > 0)
            if ($purchase->supplier_id && $purchase->supplier_id > 0) {
                 // Create AP Transaction
                DB::table('ap_transactions')->insert([
                    'supplier_id' => $purchase->supplier_id,
                    'type' => 'invoice',
                    'amount' => $purchase->invoice_price,
                    'description' => "فاتورة شراء رقم " . $purchase->voucher_number,
                    'reference_type' => 'purchases',
                    'reference_id' => $purchase->id,
                    'created_by' => auth()->id() ?? session('user_id'),
                    'created_at' => now(),
                ]);

                // Update supplier balance
                $this->updateSupplierBalance($purchase->supplier_id);
            }

            DB::commit();
            TelescopeService::logOperation('UPDATE', 'purchases', $purchase->id, null, ['action' => 'approve']);

            return $this->successResponse(['message' => 'Purchase approved and processed successfully']);

        } catch (\Exception $e) {
            DB::rollBack();
            return $this->errorResponse($e->getMessage(), 500);
        }
    }

    public function update(Request $request): JsonResponse
    {
        PermissionService::requirePermission('purchases', 'edit');

        $id = $request->input('id');
        $purchase = Purchase::with('product')->find($id);

        if (!$purchase) {
            return $this->errorResponse('Purchase not found', 404);
        }

        // Check 24h rule
        if ($purchase->purchase_date) {
            $purchaseTime = strtotime($purchase->purchase_date);
            if ((time() - $purchaseTime) > 3600 * 24) {
                return $this->errorResponse('Cannot edit purchase after 24 hours', 403);
            }
        }

        $validated = $request->validate([
            'id' => 'required',
            'product_id' => 'required|exists:products,id',
            'quantity' => 'required|numeric|min:0',
            'invoice_price' => 'required|numeric|min:0',
            'unit_type' => 'required|in:main,sub',
            'purchase_date' => 'required|date',
            'production_date' => 'nullable|date',
            'expiry_date' => 'nullable|date',
        ]);

        try {
            DB::beginTransaction();

            $oldPurchase = clone $purchase;

            // Update purchase record
            $purchase->update([
                'product_id' => $validated['product_id'],
                'quantity' => $validated['quantity'],
                'invoice_price' => $validated['invoice_price'],
                'purchase_date' => $validated['purchase_date'],
                'unit_type' => $validated['unit_type'],
                'production_date' => $validated['production_date'] ?? null,
                'expiry_date' => $validated['expiry_date'] ?? null,
                'notes' => $request->input('notes'),
            ]);

            // Reverse old stock impact
            if ($oldPurchase->approval_status === 'approved') {
                $oldItemsPerUnit = $oldPurchase->product->items_per_unit ?? 1;
                $oldActualQty = ($oldPurchase->unit_type === 'main') 
                    ? ($oldPurchase->quantity * $oldItemsPerUnit) 
                    : $oldPurchase->quantity;
                
                $oldPurchase->product->decrement('stock_quantity', $oldActualQty);

                // Apply new stock impact
                $newProduct = Product::find($validated['product_id']);
                $newItemsPerUnit = $newProduct->items_per_unit ?? 1;
                $newActualQty = ($validated['unit_type'] === 'main')
                    ? ($validated['quantity'] * $newItemsPerUnit)
                    : $validated['quantity'];

                $newProduct->increment('stock_quantity', $newActualQty);

                // Recalculate WAC and Unit Price (Simplified for update - normally requires re-running all history, but for now apply legacy logic)
                // Legacy: Update WAC based on single transaction diff? No, legacy calculated new WAC on CREATE. On UPDATE it did weird things.
                // Legacy Update Logic:
                // 1. Reverse old stock.
                // 2. Calc new WAC and Price based on new values.
                
                $pricePerItem = ($newActualQty > 0) ? ($validated['invoice_price'] / $newActualQty) : 0;
                $newUnitPrice = $pricePerItem + ($newProduct->minimum_profit_margin ?? 0);
                
                // Note: Strictly speaking, updating WAC on edit is hard without full history replay. 
                // Legacy just updated unit_price but seemingly didn't perfectly fix WAC in the update block shown?
                // Wait, legacy `updatePurchase` line 584: uses $new_unit_price for `unit_price`, but doesn't explicitly update `weighted_average_cost` column in the UPDATE query?
                // Ah, line 584: "UPDATE products SET stock_quantity = stock_quantity + ?, unit_price = ? WHERE id = ?"
                // It does NOT update WAC in legacy update! It ONLY updates stock quantity and selling price.
                
                $newProduct->update(['unit_price' => $newUnitPrice]);
            }

            DB::commit();
            TelescopeService::logOperation('UPDATE', 'purchases', $id, null, $validated);

            return $this->successResponse(['message' => 'Purchase updated successfully']);

        } catch (\Exception $e) {
            DB::rollBack();
            return $this->errorResponse($e->getMessage(), 500);
        }
    }

    public function destroy(Request $request): JsonResponse
    {
        PermissionService::requirePermission('purchases', 'delete');

        $id = $request->input('id');
        $purchase = Purchase::with('product')->find($id);

        if (!$purchase) {
            return $this->errorResponse('Purchase not found', 404);
        }

        if ($purchase->is_reversed) {
            return $this->errorResponse('Purchase has already been reversed', 400);
        }

        try {
            DB::beginTransaction();

            $purchase->update([
                'is_reversed' => true,
                'reversed_at' => now(),
                'reversed_by' => auth()->id() ?? session('user_id'),
            ]);

            // Reverse Stock
            if ($purchase->approval_status === 'approved') {
                $itemsPerUnit = $purchase->product->items_per_unit ?? 1;
                $actualQty = ($purchase->unit_type === 'main') 
                    ? ($purchase->quantity * $itemsPerUnit) 
                    : $purchase->quantity;
                
                $purchase->product->decrement('stock_quantity', $actualQty);
            }

            // Reverse GL
            if ($purchase->voucher_number) {
                 try {
                    $this->ledgerService->reverseTransaction($purchase->voucher_number, "Reversal of Purchase #" . $purchase->voucher_number);
                } catch (\Exception $e) {
                    // Log but continue
                    \Illuminate\Support\Facades\Log::error("Failed to reverse GL: " . $e->getMessage());
                }
            }

            // Reverse AP
            DB::table('ap_transactions')
                ->where('reference_type', 'purchases')
                ->where('reference_id', $purchase->id)
                ->update(['is_deleted' => true]);
            
            if ($purchase->supplier_id) {
                $this->updateSupplierBalance($purchase->supplier_id);
            }

            DB::commit();
            TelescopeService::logOperation('REVERSE', 'purchases', $id, null, ['voucher_number' => $purchase->voucher_number]);

            return $this->successResponse(['message' => 'Purchase reversed successfully']);

        } catch (\Exception $e) {
            DB::rollBack();
            return $this->errorResponse($e->getMessage(), 500);
        }
    }

    private function updateSupplierBalance($supplier_id)
    {
        $balance = DB::table('ap_transactions')
            ->where('supplier_id', $supplier_id)
            ->where('is_deleted', 0)
            ->sum(DB::raw("CASE 
                WHEN type = 'invoice' THEN amount 
                WHEN type IN ('payment', 'return') THEN -amount 
                ELSE 0 
            END"));
        
        DB::table('ap_suppliers')->where('id', $supplier_id)->update(['current_balance' => $balance]);
    }
}
