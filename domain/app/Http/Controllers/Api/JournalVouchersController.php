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

        $query = JournalVoucher::with(['account', 'creator']);

        if ($voucherNumber) {
            $query->where('voucher_number', $voucherNumber);
        }

        // Get distinct vouchers
        $voucherNumbers = JournalVoucher::when($voucherNumber, function ($q) use ($voucherNumber) {
            $q->where('voucher_number', $voucherNumber);
        })
            ->distinct('voucher_number')
            ->pluck('voucher_number');

        $total = $voucherNumbers->count();
        $vouchers = [];

        foreach ($voucherNumbers->skip(($page - 1) * $perPage)->take($perPage) as $vNum) {
            $entries = JournalVoucher::where('voucher_number', $vNum)
                ->with('account')
                ->orderBy('id')
                ->get()
                ->map(function ($entry) {
                    return [
                        'account_code' => $entry->account->account_code,
                        'account_name' => $entry->account->account_name,
                        'account_type' => $entry->account->account_type,
                        'entry_type' => $entry->entry_type,
                        'amount' => $entry->amount,
                        'description' => $entry->description,
                    ];
                });

            $firstEntry = JournalVoucher::where('voucher_number', $vNum)->first();

            $vouchers[] = [
                'voucher_number' => $vNum,
                'voucher_date' => $firstEntry->voucher_date,
                'description' => $firstEntry->description,
                'created_by_name' => $firstEntry->creator?->username,
                'created_at' => $firstEntry->created_at,
                'entries' => $entries,
            ];
        }

        return $this->paginatedResponse($vouchers, $total, $page, $perPage);
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
                    'created_by' => auth()->id() ?? session('user_id'),
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

    public function destroy(Request $request): JsonResponse
    {
        PermissionService::requirePermission('journal_vouchers', 'delete');

        $voucherNumber = $request->input('voucher_number');
        if (!$voucherNumber) {
            return $this->errorResponse('Voucher number is required', 400);
        }

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
}
