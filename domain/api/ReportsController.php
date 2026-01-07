<?php

require_once __DIR__ . '/Controller.php';
require_once __DIR__ . '/../LedgerService.php';
require_once __DIR__ . '/../InventoryCostingService.php';
require_once __DIR__ . '/../DepreciationService.php';
require_once __DIR__ . '/../ChartOfAccountsMappingService.php';

class ReportsController extends Controller {
    private $ledgerService;
    private $costingService;
    private $depreciationService;
    private $coaMapping;
    
    public function __construct() {
        parent::__construct();
        $this->ledgerService = new LedgerService();
        $this->costingService = new InventoryCostingService();
        $this->depreciationService = new DepreciationService();
        $this->coaMapping = new ChartOfAccountsMappingService();
    }

    public function handle() {
        if (!is_logged_in()) {
            $this->errorResponse('Unauthorized', 401);
        }

        $method = $_SERVER['REQUEST_METHOD'];
        if ($method !== 'GET') {
            $this->errorResponse('Method Not Allowed', 405);
        }

        $action = $_GET['action'] ?? '';
        
        if ($action === 'balance_sheet') {
            $this->getBalanceSheet();
        } elseif ($action === 'profit_loss' || $action === 'income_statement') {
            $this->getProfitLossStatement();
        } elseif ($action === 'cash_flow') {
            $this->getCashFlowStatement();
        } elseif ($action === 'equity_statement') {
            $this->getEquityStatement();
        } elseif ($action === 'aging_receivables') {
            $this->getAgingReceivables();
        } elseif ($action === 'aging_payables') {
            $this->getAgingPayables();
        } elseif ($action === 'comparative') {
            $this->getComparativeStatements();
        } else {
            $this->errorResponse('Invalid action');
        }
    }

    private function getBalanceSheet() {
        // Use General Ledger for accurate balance sheet calculations
        $accounts = $this->coaMapping->getStandardAccounts();
        
        // 1. ASSETS - Get from GL accounts
        $cash_balance = $this->ledgerService->getAccountBalance($accounts['cash']);
        $ar_balance = $this->ledgerService->getAccountBalance($accounts['accounts_receivable']);
        
        // Inventory value from costing (unsold inventory)
        $inventory_value = $this->costingService->getInventoryValue();
        
        // Fixed Assets (book value after depreciation)
        $fixed_assets_result = mysqli_query($this->conn, 
            "SELECT a.id, a.value, 
                    (SELECT COALESCE(MAX(accumulated_depreciation), 0) FROM asset_depreciation WHERE asset_id = a.id) as acc_dep
             FROM assets a 
             WHERE a.status = 'active'");
        $fixed_assets_value = 0;
        while ($row = mysqli_fetch_assoc($fixed_assets_result)) {
            $book_value = floatval($row['value']) - floatval($row['acc_dep'] ?? 0);
            $fixed_assets_value += max(0, $book_value);
        }
        
        $total_assets = $cash_balance + $ar_balance + $inventory_value + $fixed_assets_value;
        
        // 2. LIABILITIES - Get from GL accounts
        $ap_balance = $this->ledgerService->getAccountBalance($accounts['accounts_payable']);
        $output_vat = $this->ledgerService->getAccountBalance($accounts['output_vat']);
        $input_vat = $this->ledgerService->getAccountBalance($accounts['input_vat']);
        $net_vat_liability = $output_vat - $input_vat; // Positive = liability, negative = asset
        
        $total_liabilities = $ap_balance + max(0, $net_vat_liability);
        
        // 3. EQUITY - Get from GL accounts
        $capital = $this->ledgerService->getAccountBalance($accounts['capital']);
        $retained_earnings = $this->ledgerService->getAccountBalance($accounts['retained_earnings']);
        
        // 4. INCOME STATEMENT - Get from GL accounts
        $sales_revenue = $this->ledgerService->getAccountBalance($accounts['sales_revenue']);
        $other_revenues = $this->ledgerService->getAccountBalance($accounts['other_revenue']);
        $total_revenue = $sales_revenue + $other_revenues;
        
        $cogs = $this->ledgerService->getAccountBalance($accounts['cogs']);
        $operating_expenses = $this->ledgerService->getAccountBalance($accounts['operating_expenses']);
        $depreciation_expense = $this->ledgerService->getAccountBalance($accounts['depreciation_expense']);
        $total_expenses = $cogs + $operating_expenses + $depreciation_expense;
        
        $net_profit = $total_revenue - $total_expenses;
        
        // Calculate equity
        $total_equity = $capital + $retained_earnings + $net_profit;
        
        // Verify accounting equation: Assets = Liabilities + Equity
        $equation_balance = $total_assets - ($total_liabilities + $total_equity);
        
        $data = [
            'assets' => [
                'cash' => $cash_balance,
                'cash_estimate' => $cash_balance, // ALM-001: Cash from GL (excludes credit sales)
                'accounts_receivable' => $ar_balance,
                'inventory' => $inventory_value,
                'stock_value' => $inventory_value, // Alias for frontend compatibility
                'fixed_assets' => $fixed_assets_value,
                'total_assets' => $total_assets
            ],
            'liabilities' => [
                'accounts_payable' => $ap_balance,
                'vat_liability' => max(0, $net_vat_liability),
                'total_liabilities' => $total_liabilities
            ],
            'equity' => [
                'capital' => $capital,
                'retained_earnings' => $retained_earnings,
                'current_profit' => $net_profit,
                'total_equity' => $total_equity
            ],
            'income_statement' => [
                'total_sales' => $sales_revenue, // Alias for frontend compatibility
                'sales_revenue' => $sales_revenue,
                'other_revenues' => $other_revenues,
                'total_revenue' => $total_revenue,
                'total_purchases' => 0, // Purchases are capitalized to inventory, not expensed
                'cost_of_goods_sold' => $cogs,
                'operating_expenses' => $operating_expenses,
                'depreciation_expense' => $depreciation_expense,
                'total_expenses' => $total_expenses,
                'net_profit' => $net_profit
            ],
            'accounting_equation' => [
                'assets' => $total_assets,
                'liabilities_plus_equity' => $total_liabilities + $total_equity,
                'difference' => $equation_balance,
                'is_balanced' => abs($equation_balance) < 0.01
            ]
        ];

        $this->successResponse(['data' => $data]);
    }

    private function getProfitLossStatement() {
        $accounts = $this->coaMapping->getStandardAccounts();
        $start_date = $_GET['start_date'] ?? null;
        $end_date = $_GET['end_date'] ?? null;
        
        // Build date filter for GL entries
        $date_filter = "";
        if ($start_date && $end_date) {
            $start_esc = mysqli_real_escape_string($this->conn, $start_date);
            $end_esc = mysqli_real_escape_string($this->conn, $end_date);
            $date_filter = "AND gl.voucher_date BETWEEN '$start_esc' AND '$end_esc'";
        }
        
        // REVENUE
        $sales_revenue = $this->getAccountBalanceForPeriod($accounts['sales_revenue'], $date_filter);
        $other_revenues = $this->getAccountBalanceForPeriod($accounts['other_revenue'], $date_filter);
        $total_revenue = $sales_revenue + $other_revenues;
        
        // EXPENSES
        $cogs = $this->getAccountBalanceForPeriod($accounts['cogs'], $date_filter);
        $operating_expenses = $this->getAccountBalanceForPeriod($accounts['operating_expenses'], $date_filter);
        $depreciation_expense = $this->getAccountBalanceForPeriod($accounts['depreciation_expense'], $date_filter);
        
        // Get all expense accounts for detailed breakdown
        $expense_details = $this->getAccountTypeDetails('Expense', $date_filter);
        
        $total_expenses = $cogs + $operating_expenses + $depreciation_expense;
        
        // Calculate profit/loss
        $gross_profit = $total_revenue - $cogs;
        $operating_profit = $gross_profit - $operating_expenses - $depreciation_expense;
        $net_profit = $operating_profit; // Assuming no other income/expenses for now
        
        $data = [
            'period' => [
                'start_date' => $start_date,
                'end_date' => $end_date
            ],
            'revenue' => [
                'sales_revenue' => $sales_revenue,
                'other_revenues' => $other_revenues,
                'total_revenue' => $total_revenue
            ],
            'cost_of_goods_sold' => [
                'cogs' => $cogs
            ],
            'gross_profit' => $gross_profit,
            'operating_expenses' => [
                'operating_expenses' => $operating_expenses,
                'depreciation_expense' => $depreciation_expense,
                'total_operating_expenses' => $operating_expenses + $depreciation_expense,
                'details' => $expense_details
            ],
            'operating_profit' => $operating_profit,
            'net_profit' => $net_profit
        ];
        
        $this->successResponse(['data' => $data]);
    }
    
    private function getAccountBalanceForPeriod($account_code, $date_filter = "") {
        $code_esc = mysqli_real_escape_string($this->conn, $account_code);
        
        $result = mysqli_query($this->conn, 
            "SELECT coa.account_type,
                    SUM(CASE WHEN gl.entry_type = 'DEBIT' THEN gl.amount ELSE 0 END) as total_debits,
                    SUM(CASE WHEN gl.entry_type = 'CREDIT' THEN gl.amount ELSE 0 END) as total_credits
             FROM general_ledger gl
             JOIN chart_of_accounts coa ON gl.account_id = coa.id
             WHERE coa.account_code = '$code_esc' AND gl.is_closed = 0 $date_filter");
        
        if (!$result || mysqli_num_rows($result) == 0) {
            return 0;
        }
        
        $row = mysqli_fetch_assoc($result);
        $debits = floatval($row['total_debits'] ?? 0);
        $credits = floatval($row['total_credits'] ?? 0);
        $account_type = $row['account_type'];
        
        // For Revenue: Credit increases, Debit decreases
        // For Expense: Debit increases, Credit decreases
        if (in_array($account_type, ['Revenue'])) {
            return $credits - $debits;
        } else {
            return $debits - $credits;
        }
    }
    
    private function getAccountTypeDetails($account_type, $date_filter = "") {
        $type_esc = mysqli_real_escape_string($this->conn, $account_type);
        
        $result = mysqli_query($this->conn, 
            "SELECT coa.account_code, coa.account_name,
                    SUM(CASE WHEN gl.entry_type = 'DEBIT' THEN gl.amount ELSE 0 END) as total_debits,
                    SUM(CASE WHEN gl.entry_type = 'CREDIT' THEN gl.amount ELSE 0 END) as total_credits
             FROM general_ledger gl
             JOIN chart_of_accounts coa ON gl.account_id = coa.id
             WHERE coa.account_type = '$type_esc' AND coa.is_active = 1 AND gl.is_closed = 0 $date_filter
             GROUP BY coa.id, coa.account_code, coa.account_name
             HAVING (total_debits + total_credits) > 0.01
             ORDER BY coa.account_code");
        
        $details = [];
        while ($row = mysqli_fetch_assoc($result)) {
            $debits = floatval($row['total_debits'] ?? 0);
            $credits = floatval($row['total_credits'] ?? 0);
            
            // For Expense: Debit increases, Credit decreases
            $balance = $debits - $credits;
            
            if (abs($balance) > 0.01) {
                $details[] = [
                    'account_code' => $row['account_code'],
                    'account_name' => $row['account_name'],
                    'amount' => $balance
                ];
            }
        }
        
        return $details;
    }
    
    /**
     * Cash Flow Statement
     */
    private function getCashFlowStatement() {
        $start_date = $_GET['start_date'] ?? null;
        $end_date = $_GET['end_date'] ?? null;
        
        if (!$start_date || !$end_date) {
            $this->errorResponse('Start date and end date are required');
        }
        
        $accounts = $this->coaMapping->getStandardAccounts();
        $start_esc = mysqli_real_escape_string($this->conn, $start_date);
        $end_esc = mysqli_real_escape_string($this->conn, $end_date);
        
        // Opening cash balance
        $opening_cash = $this->ledgerService->getAccountBalance($accounts['cash'], date('Y-m-d', strtotime($start_date . ' -1 day')));
        
        // Operating Activities
        // Cash from customers (sales revenue + decrease in AR)
        $sales_revenue = $this->getAccountBalanceForPeriod($accounts['sales_revenue'], "AND gl.voucher_date BETWEEN '$start_esc' AND '$end_esc'");
        $other_revenue = $this->getAccountBalanceForPeriod($accounts['other_revenue'], "AND gl.voucher_date BETWEEN '$start_esc' AND '$end_esc'");
        
        // AR change
        $ar_start = $this->ledgerService->getAccountBalance($accounts['accounts_receivable'], date('Y-m-d', strtotime($start_date . ' -1 day')));
        $ar_end = $this->ledgerService->getAccountBalance($accounts['accounts_receivable'], $end_date);
        $ar_decrease = $ar_start - $ar_end; // Positive = cash received
        
        // Cash paid to suppliers (COGS + increase in inventory + decrease in AP)
        $cogs = $this->getAccountBalanceForPeriod($accounts['cogs'], "AND gl.voucher_date BETWEEN '$start_esc' AND '$end_esc'");
        
        // Inventory change (simplified - actual calculation would need beginning/ending inventory)
        $inventory_start = $this->costingService->getInventoryValue(); // Simplified
        $inventory_end = $this->costingService->getInventoryValue();
        $inventory_increase = max(0, $inventory_end - $inventory_start);
        
        // AP change
        $ap_start = $this->ledgerService->getAccountBalance($accounts['accounts_payable'], date('Y-m-d', strtotime($start_date . ' -1 day')));
        $ap_end = $this->ledgerService->getAccountBalance($accounts['accounts_payable'], $end_date);
        $ap_decrease = $ap_start - $ap_end; // Positive = cash paid
        
        // Operating expenses paid
        $operating_expenses = $this->getAccountBalanceForPeriod($accounts['operating_expenses'], "AND gl.voucher_date BETWEEN '$start_esc' AND '$end_esc'");
        
        $cash_from_operations = $sales_revenue + $other_revenue + $ar_decrease - $cogs - $inventory_increase - $ap_decrease - $operating_expenses;
        
        // Investing Activities
        // Fixed assets purchases (simplified - would need to track asset purchases)
        $fixed_assets_purchases = 0; // Placeholder
        
        $cash_from_investing = -$fixed_assets_purchases;
        
        // Financing Activities
        // Capital contributions and withdrawals (simplified)
        $capital_contributions = 0; // Placeholder
        
        $cash_from_financing = $capital_contributions;
        
        // Net change in cash
        $net_cash_change = $cash_from_operations + $cash_from_investing + $cash_from_financing;
        $ending_cash = $opening_cash + $net_cash_change;
        
        $this->successResponse([
            'data' => [
                'period' => [
                    'start_date' => $start_date,
                    'end_date' => $end_date
                ],
                'operating_activities' => [
                    'sales_revenue' => $sales_revenue,
                    'other_revenue' => $other_revenue,
                    'accounts_receivable_decrease' => $ar_decrease,
                    'cost_of_goods_sold' => -$cogs,
                    'inventory_increase' => -$inventory_increase,
                    'accounts_payable_decrease' => -$ap_decrease,
                    'operating_expenses' => -$operating_expenses,
                    'net_cash_from_operations' => $cash_from_operations
                ],
                'investing_activities' => [
                    'fixed_assets_purchases' => -$fixed_assets_purchases,
                    'net_cash_from_investing' => $cash_from_investing
                ],
                'financing_activities' => [
                    'capital_contributions' => $capital_contributions,
                    'net_cash_from_financing' => $cash_from_financing
                ],
                'summary' => [
                    'opening_cash' => $opening_cash,
                    'net_cash_change' => $net_cash_change,
                    'ending_cash' => $ending_cash
                ]
            ]
        ]);
    }
    
    /**
     * Statement of Changes in Equity
     */
    private function getEquityStatement() {
        $start_date = $_GET['start_date'] ?? null;
        $end_date = $_GET['end_date'] ?? null;
        
        $accounts = $this->coaMapping->getStandardAccounts();
        
        // Opening balances
        $opening_capital = $this->ledgerService->getAccountBalance($accounts['capital'], 
            $start_date ? date('Y-m-d', strtotime($start_date . ' -1 day')) : null);
        $opening_retained_earnings = $this->ledgerService->getAccountBalance($accounts['retained_earnings'], 
            $start_date ? date('Y-m-d', strtotime($start_date . ' -1 day')) : null);
        
        // Current period changes
        $date_filter = "";
        if ($start_date && $end_date) {
            $start_esc = mysqli_real_escape_string($this->conn, $start_date);
            $end_esc = mysqli_real_escape_string($this->conn, $end_date);
            $date_filter = "AND gl.voucher_date BETWEEN '$start_esc' AND '$end_esc'";
        }
        
        // Net income for period
        $revenue = $this->getAccountBalanceForPeriod($accounts['sales_revenue'], $date_filter) + 
                   $this->getAccountBalanceForPeriod($accounts['other_revenue'], $date_filter);
        $expenses = $this->getAccountBalanceForPeriod($accounts['cogs'], $date_filter) +
                    $this->getAccountBalanceForPeriod($accounts['operating_expenses'], $date_filter) +
                    $this->getAccountBalanceForPeriod($accounts['depreciation_expense'], $date_filter);
        $net_income = $revenue - $expenses;
        
        // Capital changes (contributions/withdrawals)
        $capital_changes = $this->getAccountBalanceForPeriod($accounts['capital'], $date_filter);
        
        // Ending balances
        $ending_capital = $this->ledgerService->getAccountBalance($accounts['capital'], $end_date);
        $ending_retained_earnings = $opening_retained_earnings + $net_income;
        
        $this->successResponse([
            'data' => [
                'period' => [
                    'start_date' => $start_date,
                    'end_date' => $end_date
                ],
                'capital' => [
                    'opening_balance' => $opening_capital,
                    'contributions' => max(0, $capital_changes),
                    'withdrawals' => abs(min(0, $capital_changes)),
                    'ending_balance' => $ending_capital
                ],
                'retained_earnings' => [
                    'opening_balance' => $opening_retained_earnings,
                    'net_income' => $net_income,
                    'ending_balance' => $ending_retained_earnings
                ],
                'total_equity' => [
                    'opening_balance' => $opening_capital + $opening_retained_earnings,
                    'ending_balance' => $ending_capital + $ending_retained_earnings
                ]
            ]
        ]);
    }
    
    /**
     * Aging Receivables Report
     */
    private function getAgingReceivables() {
        $as_of_date = $_GET['as_of_date'] ?? date('Y-m-d');
        $date_esc = mysqli_real_escape_string($this->conn, $as_of_date);
        
        $result = mysqli_query($this->conn, 
            "SELECT c.id, c.name, c.phone, c.current_balance,
                    SUM(CASE WHEN t.transaction_date >= DATE_SUB('$date_esc', INTERVAL 30 DAY) THEN t.amount ELSE 0 END) as current,
                    SUM(CASE WHEN t.transaction_date >= DATE_SUB('$date_esc', INTERVAL 60 DAY) 
                             AND t.transaction_date < DATE_SUB('$date_esc', INTERVAL 30 DAY) THEN t.amount ELSE 0 END) as days_30_60,
                    SUM(CASE WHEN t.transaction_date >= DATE_SUB('$date_esc', INTERVAL 90 DAY) 
                             AND t.transaction_date < DATE_SUB('$date_esc', INTERVAL 60 DAY) THEN t.amount ELSE 0 END) as days_60_90,
                    SUM(CASE WHEN t.transaction_date < DATE_SUB('$date_esc', INTERVAL 90 DAY) THEN t.amount ELSE 0 END) as over_90
             FROM ar_customers c
             LEFT JOIN ar_transactions t ON c.id = t.customer_id 
                 AND t.type = 'invoice' AND t.is_deleted = 0
                 AND t.transaction_date <= '$date_esc'
             WHERE c.current_balance > 0.01
             GROUP BY c.id, c.name, c.phone, c.current_balance
             HAVING current_balance > 0.01
             ORDER BY c.current_balance DESC");
        
        $aging = [];
        $totals = ['current' => 0, 'days_30_60' => 0, 'days_60_90' => 0, 'over_90' => 0, 'total' => 0];
        
        while ($row = mysqli_fetch_assoc($result)) {
            $current = floatval($row['current'] ?? 0);
            $days_30_60 = floatval($row['days_30_60'] ?? 0);
            $days_60_90 = floatval($row['days_60_90'] ?? 0);
            $over_90 = floatval($row['over_90'] ?? 0);
            $total = floatval($row['current_balance']);
            
            $aging[] = [
                'customer_id' => intval($row['id']),
                'customer_name' => $row['name'],
                'phone' => $row['phone'],
                'current_balance' => $total,
                'aging' => [
                    'current' => $current,
                    'days_30_60' => $days_30_60,
                    'days_60_90' => $days_60_90,
                    'over_90' => $over_90
                ]
            ];
            
            $totals['current'] += $current;
            $totals['days_30_60'] += $days_30_60;
            $totals['days_60_90'] += $days_60_90;
            $totals['over_90'] += $over_90;
            $totals['total'] += $total;
        }
        
        $this->successResponse([
            'data' => $aging,
            'totals' => $totals,
            'as_of_date' => $as_of_date
        ]);
    }
    
    /**
     * Aging Payables Report
     */
    private function getAgingPayables() {
        $as_of_date = $_GET['as_of_date'] ?? date('Y-m-d');
        $date_esc = mysqli_real_escape_string($this->conn, $as_of_date);
        
        $result = mysqli_query($this->conn, 
            "SELECT s.id, s.name, s.phone, s.current_balance,
                    SUM(CASE WHEN t.transaction_date >= DATE_SUB('$date_esc', INTERVAL 30 DAY) THEN t.amount ELSE 0 END) as current,
                    SUM(CASE WHEN t.transaction_date >= DATE_SUB('$date_esc', INTERVAL 60 DAY) 
                             AND t.transaction_date < DATE_SUB('$date_esc', INTERVAL 30 DAY) THEN t.amount ELSE 0 END) as days_30_60,
                    SUM(CASE WHEN t.transaction_date >= DATE_SUB('$date_esc', INTERVAL 90 DAY) 
                             AND t.transaction_date < DATE_SUB('$date_esc', INTERVAL 60 DAY) THEN t.amount ELSE 0 END) as days_60_90,
                    SUM(CASE WHEN t.transaction_date < DATE_SUB('$date_esc', INTERVAL 90 DAY) THEN t.amount ELSE 0 END) as over_90
             FROM ap_suppliers s
             LEFT JOIN ap_transactions t ON s.id = t.supplier_id 
                 AND t.type = 'invoice' AND t.is_deleted = 0
                 AND t.transaction_date <= '$date_esc'
             WHERE s.current_balance > 0.01
             GROUP BY s.id, s.name, s.phone, s.current_balance
             HAVING current_balance > 0.01
             ORDER BY s.current_balance DESC");
        
        $aging = [];
        $totals = ['current' => 0, 'days_30_60' => 0, 'days_60_90' => 0, 'over_90' => 0, 'total' => 0];
        
        while ($row = mysqli_fetch_assoc($result)) {
            $current = floatval($row['current'] ?? 0);
            $days_30_60 = floatval($row['days_30_60'] ?? 0);
            $days_60_90 = floatval($row['days_60_90'] ?? 0);
            $over_90 = floatval($row['over_90'] ?? 0);
            $total = floatval($row['current_balance']);
            
            $aging[] = [
                'supplier_id' => intval($row['id']),
                'supplier_name' => $row['name'],
                'phone' => $row['phone'],
                'current_balance' => $total,
                'aging' => [
                    'current' => $current,
                    'days_30_60' => $days_30_60,
                    'days_60_90' => $days_60_90,
                    'over_90' => $over_90
                ]
            ];
            
            $totals['current'] += $current;
            $totals['days_30_60'] += $days_30_60;
            $totals['days_60_90'] += $days_60_90;
            $totals['over_90'] += $over_90;
            $totals['total'] += $total;
        }
        
        $this->successResponse([
            'data' => $aging,
            'totals' => $totals,
            'as_of_date' => $as_of_date
        ]);
    }
    
    /**
     * Comparative Financial Statements
     * Compares current period with previous period
     */
    private function getComparativeStatements() {
        $current_start = $_GET['current_start'] ?? null;
        $current_end = $_GET['current_end'] ?? date('Y-m-d');
        $previous_start = $_GET['previous_start'] ?? null;
        $previous_end = $_GET['previous_end'] ?? null;
        
        if (!$current_start) {
            $this->errorResponse('Current period start date is required');
        }
        
        // If previous period not specified, calculate from current period
        if (!$previous_start || !$previous_end) {
            $current_days = (strtotime($current_end) - strtotime($current_start)) / 86400;
            $previous_end = date('Y-m-d', strtotime($current_start . ' -1 day'));
            $previous_start = date('Y-m-d', strtotime($previous_end . " -$current_days days"));
        }
        
        $accounts = $this->coaMapping->getStandardAccounts();
        
        // Get current period data
        $current_date_filter = "AND gl.voucher_date BETWEEN '" . mysqli_real_escape_string($this->conn, $current_start) . 
                               "' AND '" . mysqli_real_escape_string($this->conn, $current_end) . "'";
        $previous_date_filter = "AND gl.voucher_date BETWEEN '" . mysqli_real_escape_string($this->conn, $previous_start) . 
                                "' AND '" . mysqli_real_escape_string($this->conn, $previous_end) . "'";
        
        // Revenue comparison
        $current_revenue = $this->getAccountBalanceForPeriod($accounts['sales_revenue'], $current_date_filter) +
                          $this->getAccountBalanceForPeriod($accounts['other_revenue'], $current_date_filter);
        $previous_revenue = $this->getAccountBalanceForPeriod($accounts['sales_revenue'], $previous_date_filter) +
                           $this->getAccountBalanceForPeriod($accounts['other_revenue'], $previous_date_filter);
        
        // Expense comparison
        $current_expenses = $this->getAccountBalanceForPeriod($accounts['cogs'], $current_date_filter) +
                           $this->getAccountBalanceForPeriod($accounts['operating_expenses'], $current_date_filter) +
                           $this->getAccountBalanceForPeriod($accounts['depreciation_expense'], $current_date_filter);
        $previous_expenses = $this->getAccountBalanceForPeriod($accounts['cogs'], $previous_date_filter) +
                            $this->getAccountBalanceForPeriod($accounts['operating_expenses'], $previous_date_filter) +
                            $this->getAccountBalanceForPeriod($accounts['depreciation_expense'], $previous_date_filter);
        
        // Net profit comparison
        $current_profit = $current_revenue - $current_expenses;
        $previous_profit = $previous_revenue - $previous_expenses;
        
        // Calculate changes
        $revenue_change = $current_revenue - $previous_revenue;
        $expense_change = $current_expenses - $previous_expenses;
        $profit_change = $current_profit - $previous_profit;
        
        // Calculate percentages
        $revenue_change_pct = $previous_revenue > 0 ? ($revenue_change / $previous_revenue) * 100 : 0;
        $expense_change_pct = $previous_expenses > 0 ? ($expense_change / $previous_expenses) * 100 : 0;
        $profit_change_pct = abs($previous_profit) > 0.01 ? ($profit_change / abs($previous_profit)) * 100 : 0;
        
        $this->successResponse([
            'data' => [
                'current_period' => [
                    'start_date' => $current_start,
                    'end_date' => $current_end,
                    'revenue' => $current_revenue,
                    'expenses' => $current_expenses,
                    'net_profit' => $current_profit
                ],
                'previous_period' => [
                    'start_date' => $previous_start,
                    'end_date' => $previous_end,
                    'revenue' => $previous_revenue,
                    'expenses' => $previous_expenses,
                    'net_profit' => $previous_profit
                ],
                'changes' => [
                    'revenue' => [
                        'amount' => $revenue_change,
                        'percentage' => $revenue_change_pct
                    ],
                    'expenses' => [
                        'amount' => $expense_change,
                        'percentage' => $expense_change_pct
                    ],
                    'net_profit' => [
                        'amount' => $profit_change,
                        'percentage' => $profit_change_pct
                    ]
                ]
            ]
        ]);
    }
}
