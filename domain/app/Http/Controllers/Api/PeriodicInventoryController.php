<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InventoryCount;
use App\Models\Product;
use App\Models\FiscalPeriod;
use App\Services\PermissionService;
use App\Services\TelescopeService;
use App\Services\LedgerService;
use App\Services\ChartOfAccountsMappingService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use App\Http\Controllers\Api\BaseApiController;

class PeriodicInventoryController extends Controller
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

    public function index(Request $request): JsonResponse
    {
        PermissionService::requirePermission('products', 'view');

        $page = max(1, (int)$request->input('page', 1));
        $perPage = min(100, max(1, (int)$request->input('per_page', 20)));
        $periodId = $request->input('period_id');

        $query = InventoryCount::with(['product', 'fiscalPeriod', 'countedBy']);

        if ($periodId) {
            $query->where('fiscal_period_id', $periodId);
        }

        $total = $query->count();
        $counts = $query->orderBy('count_date', 'desc')
            ->orderBy('id', 'desc')
            ->skip(($page - 1) * $perPage)
            ->take($perPage)
            ->get();

        return $this->paginatedResponse($counts, $total, $page, $perPage);
    }

    public function store(Request $request): JsonResponse
    {
        PermissionService::requirePermission('products', 'create');

        $validated = $request->validate([
            'product_id' => 'required|integer|exists:products,id',
            'counted_quantity' => 'required|integer|min:0',
            'count_date' => 'nullable|date',
            'fiscal_period_id' => 'required|integer|exists:fiscal_periods,id',
            'notes' => 'nullable|string',
        ]);

        $product = Product::findOrFail($validated['product_id']);
        $bookQuantity = $product->stock_quantity;
        $variance = $validated['counted_quantity'] - $bookQuantity;

        $count = InventoryCount::create([
            'product_id' => $validated['product_id'],
            'fiscal_period_id' => $validated['fiscal_period_id'],
            'count_date' => $validated['count_date'] ?? now()->format('Y-m-d'),
            'book_quantity' => $bookQuantity,
            'counted_quantity' => $validated['counted_quantity'],
            'variance' => $variance,
            'notes' => $validated['notes'] ?? null,
            'counted_by' => auth()->id() ?? session('user_id'),
        ]);

        TelescopeService::logOperation('CREATE', 'inventory_counts', $count->id, null, $validated);

        return $this->successResponse([
            'id' => $count->id,
            'book_quantity' => $bookQuantity,
            'variance' => $variance,
        ]);
    }

    public function process(Request $request): JsonResponse
    {
        PermissionService::requirePermission('products', 'edit');

        $validated = $request->validate([
            'fiscal_period_id' => 'required|integer|exists:fiscal_periods,id',
        ]);

        return DB::transaction(function () use ($validated) {
            $counts = InventoryCount::where('fiscal_period_id', $validated['fiscal_period_id'])
                ->where('is_processed', false)
                ->with('product')
                ->get();

            if ($counts->isEmpty()) {
                return $this->errorResponse('No unprocessed inventory counts found for this period', 400);
            }

            $accounts = $this->coaService->getStandardAccounts();
            $voucherNumber = $this->ledgerService->getNextVoucherNumber('INV');

            foreach ($counts as $count) {
                if ($count->variance == 0) {
                    continue; // No adjustment needed
                }

                $product = $count->product;
                $cost = $product->weighted_average_cost ?? 0;
                $adjustmentAmount = abs($count->variance * $cost);

                // Update product stock
                $product->update(['stock_quantity' => $count->counted_quantity]);

                // Post GL entries for variance
                $glEntries = [];

                if ($count->variance > 0) {
                    // Inventory increase
                    $glEntries[] = [
                        'account_code' => $accounts['inventory'],
                        'entry_type' => 'DEBIT',
                        'amount' => $adjustmentAmount,
                        'description' => "Inventory Count Adjustment - Product: {$product->name}",
                    ];
                    $glEntries[] = [
                        'account_code' => $accounts['other_revenue'],
                        'entry_type' => 'CREDIT',
                        'amount' => $adjustmentAmount,
                        'description' => "Inventory Count Adjustment - Product: {$product->name}",
                    ];
                } else {
                    // Inventory decrease
                    $glEntries[] = [
                        'account_code' => $accounts['cogs'],
                        'entry_type' => 'DEBIT',
                        'amount' => $adjustmentAmount,
                        'description' => "Inventory Count Adjustment - Product: {$product->name}",
                    ];
                    $glEntries[] = [
                        'account_code' => $accounts['inventory'],
                        'entry_type' => 'CREDIT',
                        'amount' => $adjustmentAmount,
                        'description' => "Inventory Count Adjustment - Product: {$product->name}",
                    ];
                }

                $this->ledgerService->postTransaction(
                    $glEntries,
                    'inventory_counts',
                    $count->id,
                    $voucherNumber,
                    $count->count_date
                );

                $count->update([
                    'is_processed' => true,
                    'processed_at' => now(),
                ]);
            }

            TelescopeService::logOperation('UPDATE', 'inventory_counts', null, null, ['fiscal_period_id' => $validated['fiscal_period_id']]);

            return $this->successResponse(['message' => 'Inventory counts processed successfully']);
        });
    }
}
