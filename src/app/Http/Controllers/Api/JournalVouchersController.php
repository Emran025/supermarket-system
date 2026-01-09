<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\JournalVoucher;
use App\Models\ChartOfAccount;
use App\Services\PermissionService;
use App\Services\TelescopeService;
use App\Services\LedgerService;
use App\Services\ChartOfAccountsMappingService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use App\Http\Controllers\Api\BaseApiController;

class JournalVouchersController extends Controller
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
        PermissionService::requirePermission('journal_vouchers', 'view');

        $page = max(1, (int)$request->input('page', 1));
        $perPage = min(100, max(1, (int)$request->input('per_page', 20)));
        $voucherNumber = $request->input('voucher_number');

        $query = JournalVoucher::query();
        if ($voucherNumber) {
            $query->where('voucher_number', 'like', "%$voucherNumber%");
        }
        
        $uniqueVoucherCount = $query->distinct('voucher_number')->count('voucher_number');
        $pagedVoucherNumbers = $query->distinct('voucher_number')
            ->orderBy('voucher_number', 'desc')
            ->skip(($page - 1) * $perPage)
            ->take($perPage)
            ->pluck('voucher_number');

        $allEntries = JournalVoucher::whereIn('voucher_number', $pagedVoucherNumbers)
            ->with(['account', 'creator'])
            ->orderBy('voucher_number', 'desc')
            ->orderBy('id')
            ->get()
            ->groupBy('voucher_number');

        $vouchers = $pagedVoucherNumbers->map(function ($vNum) use ($allEntries) {
            $entries = $allEntries->get($vNum);
            $first = $entries->first();
            
            return [
                'id' => $vNum, // Frontend uses .id for key and routing
                'voucher_number' => $vNum,
                'voucher_date' => $first->voucher_date->format('Y-m-d'),
                'description' => $first->description,
                'total_debit' => (float)$entries->where('entry_type', 'DEBIT')->sum('amount'),
                'total_credit' => (float)$entries->where('entry_type', 'CREDIT')->sum('amount'),
                'status' => 'posted', // In this system, they are posted immediately
                'created_by_name' => $first->creator?->username,
                'created_at' => $first->created_at->toDateTimeString(),
                'lines' => $entries->map(function($e) {
                    return [
                        'id' => $e->id,
                        'account_id' => $e->account_id,
                        'account_name' => $e->account?->account_name,
                        'debit' => $e->entry_type === 'DEBIT' ? (float)$e->amount : 0,
                        'credit' => $e->entry_type === 'CREDIT' ? (float)$e->amount : 0,
                        'description' => $e->description,
                    ];
                }),
            ];
        });

        return response()->json([
            'success' => true,
            'vouchers' => $vouchers,
            'total' => $uniqueVoucherCount
        ]);
    }

    public function show($id): JsonResponse
    {
        PermissionService::requirePermission('journal_vouchers', 'view');

        $entries = JournalVoucher::where('voucher_number', $id)
            ->with(['account', 'creator'])
            ->orderBy('id')
            ->get();

        if ($entries->isEmpty()) {
            return $this->errorResponse('Voucher not found', 404);
        }

        $first = $entries->first();
        $voucher = [
            'id' => $id,
            'voucher_number' => $id,
            'voucher_date' => $first->voucher_date->format('Y-m-d'),
            'description' => $first->description,
            'total_debit' => (float)$entries->where('entry_type', 'DEBIT')->sum('amount'),
            'total_credit' => (float)$entries->where('entry_type', 'CREDIT')->sum('amount'),
            'status' => 'posted',
            'lines' => $entries->map(function($e) {
                return [
                    'id' => $e->id,
                    'account_id' => $e->account_id,
                    'account_name' => $e->account?->account_name,
                    'debit' => $e->entry_type === 'DEBIT' ? (float)$e->amount : 0,
                    'credit' => $e->entry_type === 'CREDIT' ? (float)$e->amount : 0,
                    'description' => $e->description,
                ];
            }),
        ];

        return response()->json([
            'success' => true,
            'voucher' => $voucher
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        PermissionService::requirePermission('journal_vouchers', 'create');

        $validated = $request->validate([
            'voucher_date' => 'required|date',
            'description' => 'required|string',
            'entries' => 'required|array|min:2',
            'entries.*.account_code' => 'required|string',
            'entries.*.entry_type' => 'required|in:DEBIT,CREDIT',
            'entries.*.amount' => 'required|numeric|min:0.01',
            'entries.*.description' => 'nullable|string',
        ]);

        return DB::transaction(function () use ($validated) {
            $totalDebits = 0;
            $totalCredits = 0;
            $validatedEntries = [];

            foreach ($validated['entries'] as $entry) {
                $account = ChartOfAccount::where('account_code', $entry['account_code'])
                    ->where('is_active', true)
                    ->first();

                if (!$account) {
                    return $this->errorResponse("Account code '{$entry['account_code']}' not found or inactive", 400);
                }

                $validatedEntries[] = [
                    'account_id' => $account->id,
                    'account_code' => $entry['account_code'],
                    'entry_type' => $entry['entry_type'],
                    'amount' => $entry['amount'],
                    'description' => $entry['description'] ?? $validated['description'],
                ];

                if ($entry['entry_type'] === 'DEBIT') {
                    $totalDebits += $entry['amount'];
                } else {
                    $totalCredits += $entry['amount'];
                }
            }

            // Validate debits equal credits
            if (abs($totalDebits - $totalCredits) > 0.01) {
                return $this->errorResponse("Debits ($totalDebits) must equal Credits ($totalCredits)", 400);
            }

            // Generate voucher number
            $voucherNumber = $this->ledgerService->getNextVoucherNumber('JV');

            // Insert journal voucher entries
            foreach ($validatedEntries as $entry) {
                JournalVoucher::create([
                    'voucher_number' => $voucherNumber,
                    'voucher_date' => $validated['voucher_date'],
                    'account_id' => $entry['account_id'],
                    'entry_type' => $entry['entry_type'],
                    'amount' => $entry['amount'],
                    'description' => $entry['description'],
                    'created_by' => auth()->id() ?? session('user_id') ?? 1,
                ]);
            }

            // Post to General Ledger
            $glEntries = array_map(function ($entry) {
                return [
                    'account_code' => $entry['account_code'],
                    'entry_type' => $entry['entry_type'],
                    'amount' => $entry['amount'],
                    'description' => $entry['description'],
                ];
            }, $validatedEntries);

            $this->ledgerService->postTransaction(
                $glEntries,
                'journal_vouchers',
                null,
                $voucherNumber,
                $validated['voucher_date']
            );

            TelescopeService::logOperation('CREATE', 'journal_vouchers', null, null, $validated);

            return $this->successResponse(['voucher_number' => $voucherNumber]);
        });
    }

    public function destroy($id): JsonResponse
    {
        PermissionService::requirePermission('journal_vouchers', 'delete');

        $voucherNumber = $id;

        // Check if already reversed
        $reversed = \App\Models\GeneralLedger::where('voucher_number', $voucherNumber)
            ->where('description', 'like', '%Reversal%')
            ->exists();

        if ($reversed) {
            return $this->errorResponse('Journal voucher has already been reversed', 400);
        }

        try {
            // Reverse the journal voucher
            $this->ledgerService->reverseTransaction($voucherNumber, "إلغاء قيد يومية رقم $voucherNumber");
            TelescopeService::logOperation('REVERSE', 'journal_vouchers', null, null, ['voucher_number' => $voucherNumber]);

            return $this->successResponse(['message' => 'Journal voucher reversed successfully']);
        } catch (\Exception $e) {
            return $this->errorResponse($e->getMessage(), 500);
        }
    }

    public function post($id): JsonResponse
    {
        // Journal vouchers are posted automatically in this implementation
        return $this->successResponse(['message' => 'Voucher is already posted']);
    }
}
