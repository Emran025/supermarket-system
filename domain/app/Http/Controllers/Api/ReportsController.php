<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ChartOfAccount;
use App\Models\GeneralLedger;
use App\Models\ArCustomer;
use App\Models\ArTransaction;
use App\Models\ApSupplier;
use App\Models\ApTransaction;
use App\Services\PermissionService;
use App\Services\LedgerService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class ReportsController extends Controller
{
    use BaseApiController;

    private LedgerService $ledgerService;

    public function __construct(LedgerService $ledgerService)
    {
        $this->ledgerService = $ledgerService;
    }

    /**
     * Get Balance Sheet
     */
    public function balanceSheet(Request $request): JsonResponse
    {
        PermissionService::requirePermission('reports', 'view');

        $asOfDate = $request->input('as_of_date', now()->format('Y-m-d'));

        // Get all asset accounts
        $assets = $this->getAccountTypeDetails('Asset', $asOfDate);
        $totalAssets = collect($assets)->sum('balance');

        // Get all liability accounts
        $liabilities = $this->getAccountTypeDetails('Liability', $asOfDate);
        $totalLiabilities = collect($liabilities)->sum('balance');

        // Get all equity accounts
        $equity = $this->getAccountTypeDetails('Equity', $asOfDate);
        
        // Calculate Current Net Income (Revenue - Expenses) to ensure balance
        // This is necessary because Revenue/Expenses are part of Equity (Retained Earnings) but sit in their own accounts until closing.
        $revenues = $this->getAccountTypeDetails('Revenue', $asOfDate);
        $expenses = $this->getAccountTypeDetails('Expense', $asOfDate);
        
        $totalRevenue = collect($revenues)->sum('balance');
        $totalExpenses = collect($expenses)->sum('balance');
        $netIncome = $totalRevenue - $totalExpenses;

        // Add Net Income to Equity as a distinct line item
        if ($netIncome != 0) {
            $equity[] = [
                'account_code' => '999999', // Virtual code
                'account_name' => 'Current Net Income / (Loss) - صافي الربح/الخسارة للفترة',
                'balance' => $netIncome,
            ];
        }

        $totalEquity = collect($equity)->sum('balance');

        return response()->json([
            'success' => true,
            'as_of_date' => $asOfDate,
            'data' => [
                'assets' => [
                    'accounts' => $assets,
                    'total' => $totalAssets,
                ],
                'liabilities' => [
                    'accounts' => $liabilities,
                    'total' => $totalLiabilities,
                ],
                'equity' => [
                    'accounts' => $equity,
                    'total' => $totalEquity,
                ],
                'total_liabilities_and_equity' => $totalLiabilities + $totalEquity,
                'is_balanced' => abs($totalAssets - ($totalLiabilities + $totalEquity)) < 0.01,
            ],
        ]);
    }

    /**
     * Get Profit & Loss Statement
     */
    public function profitLoss(Request $request): JsonResponse
    {
        PermissionService::requirePermission('reports', 'view');

        $startDate = $request->input('start_date', now()->startOfMonth()->format('Y-m-d'));
        $endDate = $request->input('end_date', now()->format('Y-m-d'));

        // Get revenue accounts
        $revenues = $this->getAccountTypeDetails('Revenue', $endDate, $startDate);
        $totalRevenue = collect($revenues)->sum('balance');

        // Get expense accounts
        $expenses = $this->getAccountTypeDetails('Expense', $endDate, $startDate);
        $totalExpenses = collect($expenses)->sum('balance');

        $netIncome = $totalRevenue - $totalExpenses;

        return response()->json([
            'success' => true,
            'period' => [
                'start_date' => $startDate,
                'end_date' => $endDate,
            ],
            'data' => [
                'revenue' => [
                    'accounts' => $revenues,
                    'total' => $totalRevenue,
                ],
                'expenses' => [
                    'accounts' => $expenses,
                    'total' => $totalExpenses,
                ],
                'net_income' => $netIncome,
            ],
        ]);
    }

    /**
     * Get Cash Flow Statement
     */
    public function cashFlow(Request $request): JsonResponse
    {
        PermissionService::requirePermission('reports', 'view');

        $startDate = $request->input('start_date', now()->startOfMonth()->format('Y-m-d'));
        $endDate = $request->input('end_date', now()->format('Y-m-d'));

        // Get cash account
        $cashAccount = ChartOfAccount::where('account_code', 'like', '1110%')
            ->orWhere('account_name', 'like', '%Cash%')
            ->orWhere('account_name', 'like', '%النقدية%')
            ->first();

        if (!$cashAccount) {
            // Fallback to finding any asset account that looks like cash if specific codes fail
            $cashAccount = ChartOfAccount::where('account_type', 'Asset')
                ->where('account_name', 'like', '%cash%')
                ->first();
                
            if (!$cashAccount) {
                 return $this->errorResponse('Cash account not found', 404);
            }
        }

        // Operating activities (from revenue and expense accounts)
        $netIncome = $this->getNetIncome($startDate, $endDate);

        // Investing activities (changes in asset accounts)
        $investing = $this->getInvestingActivities($startDate, $endDate);

        // Financing activities (changes in liability and equity accounts)
        $financing = $this->getFinancingActivities($startDate, $endDate);

        // Calculate net change in cash
        $netChange = $netIncome + $investing + $financing;

        // Get beginning and ending cash balances
        $beginningCash = $this->ledgerService->getAccountBalance($cashAccount->account_code, $startDate);
        $endingCash = $this->ledgerService->getAccountBalance($cashAccount->account_code, $endDate);

        return response()->json([
            'success' => true,
            'period' => [
                'start_date' => $startDate,
                'end_date' => $endDate,
            ],
            'data' => [
                'operating_activities' => [
                    'net_income' => $netIncome,
                ],
                'investing_activities' => [
                    'total' => $investing,
                ],
                'financing_activities' => [
                    'total' => $financing,
                ],
                'net_change_in_cash' => $netChange,
                'beginning_cash' => $beginningCash,
                'ending_cash' => $endingCash,
            ],
        ]);
    }

    /**
     * Get Aging Receivables Report
     */
    public function agingReceivables(Request $request): JsonResponse
    {
        PermissionService::requirePermission('reports', 'view');

        $asOfDate = $request->input('as_of_date', now()->format('Y-m-d'));

        $customers = ArCustomer::where('current_balance', '>', 0)->get();

        $aging = [];
        $totals = [
            'current' => 0,
            '1_30' => 0,
            '31_60' => 0,
            '61_90' => 0,
            'over_90' => 0,
            'total' => 0,
        ];

        foreach ($customers as $customer) {
            $transactions = ArTransaction::where('customer_id', $customer->id)
                ->where('is_deleted', false)
                ->where('type', '!=', 'payment')
                ->get();

            $customerAging = [
                'customer_id' => $customer->id,
                'customer_name' => $customer->name,
                'current' => 0,
                '1_30' => 0,
                '31_60' => 0,
                '61_90' => 0,
                'over_90' => 0,
                'total' => 0,
            ];

            foreach ($transactions as $transaction) {
                $daysOld = now()->diffInDays($transaction->transaction_date);
                $amount = (float)$transaction->amount;

                if ($daysOld <= 0) {
                    $customerAging['current'] += $amount;
                } elseif ($daysOld <= 30) {
                    $customerAging['1_30'] += $amount;
                } elseif ($daysOld <= 60) {
                    $customerAging['31_60'] += $amount;
                } elseif ($daysOld <= 90) {
                    $customerAging['61_90'] += $amount;
                } else {
                    $customerAging['over_90'] += $amount;
                }

                $customerAging['total'] += $amount;
            }

            if ($customerAging['total'] > 0) {
                $aging[] = $customerAging;

                $totals['current'] += $customerAging['current'];
                $totals['1_30'] += $customerAging['1_30'];
                $totals['31_60'] += $customerAging['31_60'];
                $totals['61_90'] += $customerAging['61_90'];
                $totals['over_90'] += $customerAging['over_90'];
                $totals['total'] += $customerAging['total'];
            }
        }

        return response()->json([
            'success' => true,
            'as_of_date' => $asOfDate,
            'data' => $aging,
            'totals' => $totals,
        ]);
    }

    /**
     * Get Aging Payables Report
     */
    public function agingPayables(Request $request): JsonResponse
    {
        PermissionService::requirePermission('reports', 'view');

        $asOfDate = $request->input('as_of_date', now()->format('Y-m-d'));

        $suppliers = ApSupplier::where('current_balance', '>', 0)->get();

        $aging = [];
        $totals = [
            'current' => 0,
            '1_30' => 0,
            '31_60' => 0,
            '61_90' => 0,
            'over_90' => 0,
            'total' => 0,
        ];

        foreach ($suppliers as $supplier) {
            $transactions = ApTransaction::where('supplier_id', $supplier->id)
                ->where('is_deleted', false)
                ->where('type', 'invoice')
                ->get();

            $supplierAging = [
                'supplier_id' => $supplier->id,
                'supplier_name' => $supplier->name,
                'current' => 0,
                '1_30' => 0,
                '31_60' => 0,
                '61_90' => 0,
                'over_90' => 0,
                'total' => 0,
            ];

            foreach ($transactions as $transaction) {
                $daysOld = now()->diffInDays($transaction->transaction_date);
                $amount = (float)$transaction->amount;

                if ($daysOld <= 0) {
                    $supplierAging['current'] += $amount;
                } elseif ($daysOld <= 30) {
                    $supplierAging['1_30'] += $amount;
                } elseif ($daysOld <= 60) {
                    $supplierAging['31_60'] += $amount;
                } elseif ($daysOld <= 90) {
                    $supplierAging['61_90'] += $amount;
                } else {
                    $supplierAging['over_90'] += $amount;
                }

                $supplierAging['total'] += $amount;
            }

            if ($supplierAging['total'] > 0) {
                $aging[] = $supplierAging;

                $totals['current'] += $supplierAging['current'];
                $totals['1_30'] += $supplierAging['1_30'];
                $totals['31_60'] += $supplierAging['31_60'];
                $totals['61_90'] += $supplierAging['61_90'];
                $totals['over_90'] += $supplierAging['over_90'];
                $totals['total'] += $supplierAging['total'];
            }
        }

        return response()->json([
            'success' => true,
            'as_of_date' => $asOfDate,
            'data' => $aging,
            'totals' => $totals,
        ]);
    }

    /**
     * Get Comparative Financial Report
     */
    public function comparative(Request $request): JsonResponse
    {
        PermissionService::requirePermission('reports', 'view');

        $currentStart = $request->input('current_start', now()->startOfMonth()->format('Y-m-d'));
        $currentEnd = $request->input('current_end', now()->format('Y-m-d'));
        $previousStart = $request->input('previous_start');
        $previousEnd = $request->input('previous_end');

        // Calculate current period metrics
        $currentRevenue = collect($this->getAccountTypeDetails('Revenue', $currentEnd, $currentStart))->sum('balance');
        $currentExpenses = collect($this->getAccountTypeDetails('Expense', $currentEnd, $currentStart))->sum('balance');
        $currentNetProfit = $currentRevenue - $currentExpenses;

        $report = [
            'current_period' => [
                'revenue' => $currentRevenue,
                'expenses' => $currentExpenses,
                'net_profit' => $currentNetProfit,
            ],
            'previous_period' => null,
            'changes' => null,
        ];

        // Calculate previous period metrics if requested
        if ($previousStart && $previousEnd) {
            $prevRevenue = collect($this->getAccountTypeDetails('Revenue', $previousEnd, $previousStart))->sum('balance');
            $prevExpenses = collect($this->getAccountTypeDetails('Expense', $previousEnd, $previousStart))->sum('balance');
            $prevNetProfit = $prevRevenue - $prevExpenses;

            $report['previous_period'] = [
                'revenue' => $prevRevenue,
                'expenses' => $prevExpenses,
                'net_profit' => $prevNetProfit,
            ];

            // Calculate changes
            $report['changes'] = [
                'revenue' => $this->calculateChange($currentRevenue, $prevRevenue),
                'expenses' => $this->calculateChange($currentExpenses, $prevExpenses),
                'net_profit' => $this->calculateChange($currentNetProfit, $prevNetProfit),
            ];
        }

        return response()->json([
            'success' => true,
            'data' => $report,
        ]);
    }

    private function calculateChange($current, $previous): array
    {
        $amount = $current - $previous;
        $percentage = $previous != 0 ? ($amount / abs($previous)) * 100 : ($amount == 0 ? 0 : 100);
        
        return [
            'amount' => $amount,
            'percentage' => $percentage
        ];
    }

    /**
     * Helper: Get account type details
     */
    private function getAccountTypeDetails(string $accountType, string $asOfDate, ?string $startDate = null): array
    {
        $accounts = ChartOfAccount::where('account_type', $accountType)
            ->where('is_active', true)
            ->orderBy('account_code')
            ->get();

        $details = [];

        foreach ($accounts as $account) {
            $query = GeneralLedger::where('account_id', $account->id)
                ->where('is_closed', false)
                ->where('voucher_date', '<=', $asOfDate);

            if ($startDate) {
                $query->where('voucher_date', '>=', $startDate);
            }

            $totals = $query->selectRaw('
                SUM(CASE WHEN entry_type = "DEBIT" THEN amount ELSE 0 END) as debits,
                SUM(CASE WHEN entry_type = "CREDIT" THEN amount ELSE 0 END) as credits
            ')->first();

            $debits = (float)($totals->debits ?? 0);
            $credits = (float)($totals->credits ?? 0);

            $balance = 0;
            if (in_array($accountType, ['Asset', 'Expense'])) {
                $balance = $debits - $credits;
            } else {
                $balance = $credits - $debits;
            }

            if ($balance != 0 || !$startDate) {
                $details[] = [
                    'account_code' => $account->account_code,
                    'account_name' => $account->account_name,
                    'balance' => $balance,
                ];
            }
        }

        return $details;
    }

    /**
     * Helper: Get net income for period
     */
    private function getNetIncome(string $startDate, string $endDate): float
    {
        $revenues = $this->getAccountTypeDetails('Revenue', $endDate, $startDate);
        $totalRevenue = collect($revenues)->sum('balance');

        $expenses = $this->getAccountTypeDetails('Expense', $endDate, $startDate);
        $totalExpenses = collect($expenses)->sum('balance');

        return $totalRevenue - $totalExpenses;
    }

    /**
     * Helper: Get investing activities
     */
    private function getInvestingActivities(string $startDate, string $endDate): float
    {
        // Simplified: Get changes in fixed asset accounts
        $assetAccounts = ChartOfAccount::where('account_type', 'Asset')
            ->where('account_code', 'like', '15%') // Fixed assets typically start with 15
            ->where('is_active', true)
            ->get();

        $total = 0;

        foreach ($assetAccounts as $account) {
            $change = GeneralLedger::where('account_id', $account->id)
                ->whereBetween('voucher_date', [$startDate, $endDate])
                ->selectRaw('
                    SUM(CASE WHEN entry_type = "CREDIT" THEN amount ELSE 0 END) -
                    SUM(CASE WHEN entry_type = "DEBIT" THEN amount ELSE 0 END) as net_change
                ')
                ->value('net_change') ?? 0;

            $total += (float)$change;
        }

        return $total;
    }

    /**
     * Helper: Get financing activities
     */
    private function getFinancingActivities(string $startDate, string $endDate): float
    {
        // Simplified: Get changes in long-term liability and equity accounts
        $financingAccounts = ChartOfAccount::whereIn('account_type', ['Liability', 'Equity'])
            ->where(function ($query) {
                $query->where('account_code', 'like', '25%') // Long-term liabilities
                      ->orWhere('account_code', 'like', '3%'); // Equity
            })
            ->where('is_active', true)
            ->get();

        $total = 0;

        foreach ($financingAccounts as $account) {
            $change = GeneralLedger::where('account_id', $account->id)
                ->whereBetween('voucher_date', [$startDate, $endDate])
                ->selectRaw('
                    SUM(CASE WHEN entry_type = "CREDIT" THEN amount ELSE 0 END) -
                    SUM(CASE WHEN entry_type = "DEBIT" THEN amount ELSE 0 END) as net_change
                ')
                ->value('net_change') ?? 0;

            $total += (float)$change;
        }

        return $total;
    }
}
