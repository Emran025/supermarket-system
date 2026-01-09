<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\GeneralLedger;
use App\Models\ChartOfAccount;
use App\Services\PermissionService;
use App\Services\LedgerService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class GeneralLedgerController extends Controller
{
    use BaseApiController;

    private LedgerService $ledgerService;

    public function __construct(LedgerService $ledgerService)
    {
        $this->ledgerService = $ledgerService;
    }

    /**
     * Get trial balance
     */
    public function trialBalance(Request $request): JsonResponse
    {
        PermissionService::requirePermission('general_ledger', 'view');

        $asOfDate = $request->input('as_of_date');

        try {
            $data = $this->ledgerService->getTrialBalanceData($asOfDate);
            
            $items = array_map(function($acc) {
                return [
                    'account_code' => $acc['account_code'],
                    'account_name' => $acc['account_name'],
                    'debit' => (float)$acc['debit_balance'],
                    'credit' => (float)$acc['credit_balance'],
                    'balance' => (float)($acc['debit_balance'] - $acc['credit_balance'])
                ];
            }, $data['accounts']);

            return response()->json([
                'success' => true,
                'items' => $items,
                'total_debit' => (float)$data['total_debits'],
                'total_credit' => (float)$data['total_credits'],
                'balance' => (float)($data['total_debits'] - $data['total_credits'])
            ]);
        } catch (\Exception $e) {
            return $this->errorResponse($e->getMessage(), 500);
        }
    }

    /**
     * Get account details with transaction history
     */
    public function accountDetails(Request $request): JsonResponse
    {
        PermissionService::requirePermission('general_ledger', 'view');

        $accountCode = $request->input('account_code');
        
        if (!$accountCode) {
            return $this->errorResponse('account_code is required', 400);
        }

        $account = ChartOfAccount::where('account_code', $accountCode)->first();
        
        if (!$account) {
            return $this->errorResponse('Account not found', 404);
        }

        $page = max(1, (int)$request->input('page', 1));
        $perPage = min(100, max(1, (int)$request->input('per_page', 50)));
        $startDate = $request->input('start_date');
        $endDate = $request->input('end_date');

        $query = GeneralLedger::where('account_id', $account->id)
            ->where('is_closed', false)
            ->with('createdBy');

        if ($startDate) {
            $query->where('voucher_date', '>=', $startDate);
        }

        if ($endDate) {
            $query->where('voucher_date', '<=', $endDate);
        }

        $total = $query->count();
        
        $transactions = $query->orderBy('voucher_date', 'desc')
            ->orderBy('id', 'desc')
            ->skip(($page - 1) * $perPage)
            ->take($perPage)
            ->get()
            ->map(function ($entry) {
                return [
                    'id' => $entry->id,
                    'voucher_number' => $entry->voucher_number,
                    'voucher_date' => $entry->voucher_date,
                    'entry_type' => $entry->entry_type,
                    'amount' => $entry->amount,
                    'description' => $entry->description,
                    'reference_type' => $entry->reference_type,
                    'reference_id' => $entry->reference_id,
                    'created_by' => $entry->createdBy?->username,
                    'created_at' => $entry->created_at,
                ];
            });

        // Calculate running balance
        $balance = $this->ledgerService->getAccountBalance($accountCode, $endDate);

        return response()->json([
            'success' => true,
            'account' => [
                'code' => $account->account_code,
                'name' => $account->account_name,
                'type' => $account->account_type,
                'current_balance' => $balance,
            ],
            'transactions' => $transactions,
            'pagination' => [
                'current_page' => $page,
                'per_page' => $perPage,
                'total_records' => $total,
                'total_pages' => ceil($total / $perPage),
            ],
        ]);
    }

    /**
     * Get GL entries with filtering
     */
    public function entries(Request $request): JsonResponse
    {
        PermissionService::requirePermission('general_ledger', 'view');

        $page = max(1, (int)$request->input('page', 1));
        $perPage = min(100, max(1, (int)$request->input('per_page', 50)));
        $startDate = $request->input('start_date');
        $endDate = $request->input('end_date');
        $voucherNumber = $request->input('voucher_number');
        $accountCode = $request->input('account_code');

        $query = GeneralLedger::with(['account', 'createdBy'])
            ->where('is_closed', false);

        if ($startDate) {
            $query->where('voucher_date', '>=', $startDate);
        }

        if ($endDate) {
            $query->where('voucher_date', '<=', $endDate);
        }

        if ($voucherNumber) {
            $query->where('voucher_number', 'like', "%$voucherNumber%");
        }

        if ($accountCode) {
            $account = ChartOfAccount::where('account_code', $accountCode)->first();
            if ($account) {
                $query->where('account_id', $account->id);
            }
        }

        $total = $query->count();
        
        $entries = $query->orderBy('voucher_date', 'desc')
            ->orderBy('voucher_number', 'desc')
            ->skip(($page - 1) * $perPage)
            ->take($perPage)
            ->get()
            ->map(function ($entry) {
                return [
                    'id' => $entry->id,
                    'entry_number' => $entry->voucher_number,
                    'entry_date' => $entry->voucher_date->format('Y-m-d'),
                    'account_code' => $entry->account?->account_code,
                    'account_name' => $entry->account?->account_name,
                    'debit_account' => $entry->entry_type === 'DEBIT' ? $entry->account?->account_name : '-',
                    'credit_account' => $entry->entry_type === 'CREDIT' ? $entry->account?->account_name : '-',
                    'entry_type' => $entry->entry_type,
                    'amount' => (float)$entry->amount,
                    'description' => $entry->description,
                    'reference' => $entry->reference_type ? "{$entry->reference_type} #{$entry->reference_id}" : '-',
                    'created_by' => $entry->createdBy?->username,
                    'created_at' => $entry->created_at->toDateTimeString(),
                ];
            });

        return response()->json([
            'success' => true,
            'entries' => $entries,
            'total' => $total,
            'page' => $page,
            'per_page' => $perPage
        ]);
    }

    /**
     * Get account activity summary
     */
    public function accountActivity(Request $request): JsonResponse
    {
        PermissionService::requirePermission('general_ledger', 'view');

        $startDate = $request->input('start_date', now()->startOfMonth()->format('Y-m-d'));
        $endDate = $request->input('end_date', now()->format('Y-m-d'));

        $accounts = ChartOfAccount::where('is_active', true)
            ->orderBy('account_code')
            ->get();

        $activity = [];

        foreach ($accounts as $account) {
            $totals = GeneralLedger::where('account_id', $account->id)
                ->where('is_closed', false)
                ->whereBetween('voucher_date', [$startDate, $endDate])
                ->selectRaw('
                    SUM(CASE WHEN entry_type = "DEBIT" THEN amount ELSE 0 END) as debits,
                    SUM(CASE WHEN entry_type = "CREDIT" THEN amount ELSE 0 END) as credits,
                    COUNT(*) as transaction_count
                ')
                ->first();

            $debits = (float)($totals->debits ?? 0);
            $credits = (float)($totals->credits ?? 0);
            $count = (int)($totals->transaction_count ?? 0);

            if ($count > 0) {
                $activity[] = [
                    'account_code' => $account->account_code,
                    'account_name' => $account->account_name,
                    'account_type' => $account->account_type,
                    'debits' => $debits,
                    'credits' => $credits,
                    'net_change' => $debits - $credits,
                    'transaction_count' => $count,
                ];
            }
        }

        return response()->json([
            'success' => true,
            'period' => [
                'start_date' => $startDate,
                'end_date' => $endDate,
            ],
            'data' => $activity,
        ]);
    }

    /**
     * Get account balance history over time
     */
    public function accountBalanceHistory(Request $request): JsonResponse
    {
        PermissionService::requirePermission('general_ledger', 'view');

        $accountCode = $request->input('account_code');
        
        if (!$accountCode) {
            return $this->errorResponse('account_code is required', 400);
        }

        $account = ChartOfAccount::where('account_code', $accountCode)->first();
        
        if (!$account) {
            return $this->errorResponse('Account not found', 404);
        }

        $startDate = $request->input('start_date', now()->startOfYear()->format('Y-m-d'));
        $endDate = $request->input('end_date', now()->format('Y-m-d'));
        $interval = $request->input('interval', 'month'); // day, week, month, year

        $entries = GeneralLedger::where('account_id', $account->id)
            ->where('is_closed', false)
            ->whereBetween('voucher_date', [$startDate, $endDate])
            ->orderBy('voucher_date', 'asc')
            ->get();

        $history = [];
        $runningBalance = 0;

        // Group by interval
        $grouped = $entries->groupBy(function ($entry) use ($interval) {
            $date = new \DateTime($entry->voucher_date);
            
            switch ($interval) {
                case 'day':
                    return $date->format('Y-m-d');
                case 'week':
                    return $date->format('Y-W');
                case 'year':
                    return $date->format('Y');
                case 'month':
                default:
                    return $date->format('Y-m');
            }
        });

        foreach ($grouped as $period => $periodEntries) {
            $debits = $periodEntries->where('entry_type', 'DEBIT')->sum('amount');
            $credits = $periodEntries->where('entry_type', 'CREDIT')->sum('amount');

            if (in_array($account->account_type, ['Asset', 'Expense'])) {
                $runningBalance += ($debits - $credits);
            } else {
                $runningBalance += ($credits - $debits);
            }

            $history[] = [
                'period' => $period,
                'debits' => $debits,
                'credits' => $credits,
                'balance' => $runningBalance,
            ];
        }

        return response()->json([
            'success' => true,
            'account' => [
                'code' => $account->account_code,
                'name' => $account->account_name,
                'type' => $account->account_type,
            ],
            'interval' => $interval,
            'history' => $history,
        ]);
    }
}
