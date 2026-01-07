<?php

require_once __DIR__ . '/Controller.php';
require_once __DIR__ . '/../LedgerService.php';
require_once __DIR__ . '/../ChartOfAccountsMappingService.php';

/**
 * GeneralLedgerController
 * Provides professional accounting interfaces for GL operations
 */
class GeneralLedgerController extends Controller {
    private $ledgerService;
    private $coaMapping;
    
    public function __construct() {
        parent::__construct();
        $this->ledgerService = new LedgerService();
        $this->coaMapping = new ChartOfAccountsMappingService();
    }
    
    public function handle() {
        if (!is_logged_in()) {
            $this->errorResponse('Unauthorized', 401);
        }
        
        $method = $_SERVER['REQUEST_METHOD'];
        $action = $_GET['action'] ?? '';
        
        if ($method === 'GET') {
            if ($action === 'trial_balance') {
                $this->getTrialBalance();
            } elseif ($action === 'account_details') {
                $this->getAccountDetails();
            } elseif ($action === 'entries') {
                $this->getEntries();
            } elseif ($action === 'account_activity') {
                $this->getAccountActivity();
            } elseif ($action === 'balance_history') {
                $this->getAccountBalanceHistory();
            } else {
                $this->errorResponse('Invalid action');
            }
        }
    }
    
    /**
     * Trial Balance - Critical accounting report
     * Shows all accounts with debit/credit balances
     */
    private function getTrialBalance() {
        $as_of_date = $_GET['as_of_date'] ?? null;
        $fiscal_period_id = $_GET['fiscal_period_id'] ?? null;
        
        $date_filter = "";
        if ($as_of_date) {
            $date_esc = mysqli_real_escape_string($this->conn, $as_of_date);
            $date_filter = "AND gl.voucher_date <= '$date_esc'";
        }
        
        $period_filter = "";
        if ($fiscal_period_id) {
            $period_esc = intval($fiscal_period_id);
            $period_filter = "AND gl.fiscal_period_id = $period_esc";
        }
        
        $result = mysqli_query($this->conn, 
            "SELECT coa.id, coa.account_code, coa.account_name, coa.account_type,
                    SUM(CASE WHEN gl.entry_type = 'DEBIT' THEN gl.amount ELSE 0 END) as total_debits,
                    SUM(CASE WHEN gl.entry_type = 'CREDIT' THEN gl.amount ELSE 0 END) as total_credits
             FROM chart_of_accounts coa
             LEFT JOIN general_ledger gl ON coa.id = gl.account_id AND gl.is_closed = 0 $date_filter $period_filter
             WHERE coa.is_active = 1
             GROUP BY coa.id, coa.account_code, coa.account_name, coa.account_type
             HAVING (total_debits + total_credits) > 0.01 OR coa.account_type IN ('Asset', 'Liability', 'Equity')
             ORDER BY coa.account_code");
        
        $accounts = [];
        $total_debits = 0;
        $total_credits = 0;
        
        while ($row = mysqli_fetch_assoc($result)) {
            $debits = floatval($row['total_debits'] ?? 0);
            $credits = floatval($row['total_credits'] ?? 0);
            $account_type = $row['account_type'];
            
            // Calculate balance based on account type
            if (in_array($account_type, ['Asset', 'Expense'])) {
                $balance = $debits - $credits;
                $debit_balance = $balance > 0 ? $balance : 0;
                $credit_balance = $balance < 0 ? abs($balance) : 0;
            } else {
                $balance = $credits - $debits;
                $debit_balance = $balance < 0 ? abs($balance) : 0;
                $credit_balance = $balance > 0 ? $balance : 0;
            }
            
            // Only include accounts with activity or permanent accounts
            if (abs($balance) > 0.01 || in_array($account_type, ['Asset', 'Liability', 'Equity'])) {
                $accounts[] = [
                    'account_code' => $row['account_code'],
                    'account_name' => $row['account_name'],
                    'account_type' => $account_type,
                    'debit_balance' => $debit_balance,
                    'credit_balance' => $credit_balance,
                    'total_debits' => $debits,
                    'total_credits' => $credits
                ];
                
                $total_debits += $debit_balance;
                $total_credits += $credit_balance;
            }
        }
        
        $this->successResponse([
            'data' => $accounts,
            'summary' => [
                'total_debits' => $total_debits,
                'total_credits' => $total_credits,
                'difference' => abs($total_debits - $total_credits),
                'is_balanced' => abs($total_debits - $total_credits) < 0.01
            ],
            'as_of_date' => $as_of_date,
            'fiscal_period_id' => $fiscal_period_id
        ]);
    }
    
    /**
     * Get account details with transaction history
     */
    private function getAccountDetails() {
        $account_code = $_GET['account_code'] ?? '';
        $start_date = $_GET['start_date'] ?? null;
        $end_date = $_GET['end_date'] ?? null;
        
        if (empty($account_code)) {
            $this->errorResponse('Account code is required');
        }
        
        $code_esc = mysqli_real_escape_string($this->conn, $account_code);
        
        // Get account info
        $acc_result = mysqli_query($this->conn, 
            "SELECT * FROM chart_of_accounts WHERE account_code = '$code_esc' AND is_active = 1");
        if (!$acc_result || mysqli_num_rows($acc_result) == 0) {
            $this->errorResponse('Account not found', 404);
        }
        $account = mysqli_fetch_assoc($acc_result);
        
        // Build date filter
        $date_filter = "";
        if ($start_date && $end_date) {
            $start_esc = mysqli_real_escape_string($this->conn, $start_date);
            $end_esc = mysqli_real_escape_string($this->conn, $end_date);
            $date_filter = "AND gl.voucher_date BETWEEN '$start_esc' AND '$end_esc'";
        }
        
        // Get opening balance (before start_date)
        $opening_balance = 0;
        if ($start_date) {
            $opening_balance = $this->ledgerService->getAccountBalance($account_code, date('Y-m-d', strtotime($start_date . ' -1 day')));
        } else {
            // Get balance from beginning
            $opening_result = mysqli_query($this->conn, 
                "SELECT 
                    SUM(CASE WHEN gl.entry_type = 'DEBIT' THEN gl.amount ELSE 0 END) as total_debits,
                    SUM(CASE WHEN gl.entry_type = 'CREDIT' THEN gl.amount ELSE 0 END) as total_credits
                 FROM general_ledger gl
                 WHERE gl.account_id = {$account['id']} AND gl.is_closed = 0 AND gl.voucher_date < '$start_esc'");
            if ($opening_result && mysqli_num_rows($opening_result) > 0) {
                $opening_row = mysqli_fetch_assoc($opening_result);
                $debits = floatval($opening_row['total_debits'] ?? 0);
                $credits = floatval($opening_row['total_credits'] ?? 0);
                
                if (in_array($account['account_type'], ['Asset', 'Expense'])) {
                    $opening_balance = $debits - $credits;
                } else {
                    $opening_balance = $credits - $debits;
                }
            }
        }
        
        // Get transactions
        $params = $this->getPaginationParams();
        $limit = $params['limit'];
        $offset = $params['offset'];
        
        $result = mysqli_query($this->conn, 
            "SELECT gl.*, u.username as created_by_name
             FROM general_ledger gl
             LEFT JOIN users u ON gl.created_by = u.id
             WHERE gl.account_id = {$account['id']} AND gl.is_closed = 0 $date_filter
             ORDER BY gl.voucher_date DESC, gl.id DESC
             LIMIT $limit OFFSET $offset");
        
        $transactions = [];
        $running_balance = $opening_balance;
        
        while ($row = mysqli_fetch_assoc($result)) {
            $amount = floatval($row['amount']);
            
            // Calculate running balance
            if ($row['entry_type'] === 'DEBIT') {
                if (in_array($account['account_type'], ['Asset', 'Expense'])) {
                    $running_balance += $amount;
                } else {
                    $running_balance -= $amount;
                }
            } else {
                if (in_array($account['account_type'], ['Asset', 'Expense'])) {
                    $running_balance -= $amount;
                } else {
                    $running_balance += $amount;
                }
            }
            
            $transactions[] = [
                'id' => intval($row['id']),
                'voucher_number' => $row['voucher_number'],
                'voucher_date' => $row['voucher_date'],
                'entry_type' => $row['entry_type'],
                'amount' => $amount,
                'description' => $row['description'],
                'reference_type' => $row['reference_type'],
                'reference_id' => $row['reference_id'],
                'running_balance' => $running_balance,
                'created_by_name' => $row['created_by_name'],
                'created_at' => $row['created_at']
            ];
        }
        
        // Get current balance
        $current_balance = $this->ledgerService->getAccountBalance($account_code, $end_date);
        
        $countResult = mysqli_query($this->conn, 
            "SELECT COUNT(*) as total FROM general_ledger WHERE account_id = {$account['id']} AND is_closed = 0 $date_filter");
        $total = mysqli_fetch_assoc($countResult)['total'];
        
        $this->paginatedResponse([
            'account' => $account,
            'opening_balance' => $opening_balance,
            'current_balance' => $current_balance,
            'transactions' => $transactions
        ], $total, $params['page'], $params['limit']);
    }
    
    /**
     * Get GL entries with filtering
     */
    private function getEntries() {
        $params = $this->getPaginationParams();
        $limit = $params['limit'];
        $offset = $params['offset'];
        
        $voucher_number = $_GET['voucher_number'] ?? null;
        $account_code = $_GET['account_code'] ?? null;
        $start_date = $_GET['start_date'] ?? null;
        $end_date = $_GET['end_date'] ?? null;
        $reference_type = $_GET['reference_type'] ?? null;
        $reference_id = $_GET['reference_id'] ?? null;
        
        $where = "WHERE gl.is_closed = 0";
        
        if ($voucher_number) {
            $voucher_esc = mysqli_real_escape_string($this->conn, $voucher_number);
            $where .= " AND gl.voucher_number = '$voucher_esc'";
        }
        
        if ($account_code) {
            $code_esc = mysqli_real_escape_string($this->conn, $account_code);
            $where .= " AND coa.account_code = '$code_esc'";
        }
        
        if ($start_date && $end_date) {
            $start_esc = mysqli_real_escape_string($this->conn, $start_date);
            $end_esc = mysqli_real_escape_string($this->conn, $end_date);
            $where .= " AND gl.voucher_date BETWEEN '$start_esc' AND '$end_esc'";
        }
        
        if ($reference_type) {
            $ref_type_esc = mysqli_real_escape_string($this->conn, $reference_type);
            $where .= " AND gl.reference_type = '$ref_type_esc'";
        }
        
        if ($reference_id) {
            $ref_id_esc = intval($reference_id);
            $where .= " AND gl.reference_id = $ref_id_esc";
        }
        
        $result = mysqli_query($this->conn, 
            "SELECT gl.*, coa.account_code, coa.account_name, coa.account_type, u.username as created_by_name
             FROM general_ledger gl
             JOIN chart_of_accounts coa ON gl.account_id = coa.id
             LEFT JOIN users u ON gl.created_by = u.id
             $where
             ORDER BY gl.voucher_date DESC, gl.voucher_number DESC, gl.id DESC
             LIMIT $limit OFFSET $offset");
        
        $entries = [];
        while ($row = mysqli_fetch_assoc($result)) {
            $entries[] = [
                'id' => intval($row['id']),
                'voucher_number' => $row['voucher_number'],
                'voucher_date' => $row['voucher_date'],
                'account_code' => $row['account_code'],
                'account_name' => $row['account_name'],
                'account_type' => $row['account_type'],
                'entry_type' => $row['entry_type'],
                'amount' => floatval($row['amount']),
                'description' => $row['description'],
                'reference_type' => $row['reference_type'],
                'reference_id' => $row['reference_id'],
                'fiscal_period_id' => $row['fiscal_period_id'],
                'created_by_name' => $row['created_by_name'],
                'created_at' => $row['created_at']
            ];
        }
        
        $countResult = mysqli_query($this->conn, 
            "SELECT COUNT(*) as total FROM general_ledger gl JOIN chart_of_accounts coa ON gl.account_id = coa.id $where");
        $total = mysqli_fetch_assoc($countResult)['total'];
        
        $this->paginatedResponse($entries, $total, $params['page'], $params['limit']);
    }
    
    /**
     * Get account activity summary
     */
    private function getAccountActivity() {
        $account_code = $_GET['account_code'] ?? '';
        $period = $_GET['period'] ?? 'month'; // month, quarter, year
        
        if (empty($account_code)) {
            $this->errorResponse('Account code is required');
        }
        
        $code_esc = mysqli_real_escape_string($this->conn, $account_code);
        
        // Get account
        $acc_result = mysqli_query($this->conn, 
            "SELECT id, account_type FROM chart_of_accounts WHERE account_code = '$code_esc' AND is_active = 1");
        if (!$acc_result || mysqli_num_rows($acc_result) == 0) {
            $this->errorResponse('Account not found', 404);
        }
        $account = mysqli_fetch_assoc($acc_result);
        
        // Calculate date range based on period
        $end_date = date('Y-m-d');
        switch ($period) {
            case 'month':
                $start_date = date('Y-m-01');
                break;
            case 'quarter':
                $quarter = ceil(date('n') / 3);
                $start_date = date('Y-m-d', mktime(0, 0, 0, ($quarter - 1) * 3 + 1, 1, date('Y')));
                break;
            case 'year':
                $start_date = date('Y-01-01');
                break;
            default:
                $start_date = date('Y-m-01');
        }
        
        $result = mysqli_query($this->conn, 
            "SELECT 
                DATE(gl.voucher_date) as transaction_date,
                COUNT(*) as transaction_count,
                SUM(CASE WHEN gl.entry_type = 'DEBIT' THEN gl.amount ELSE 0 END) as total_debits,
                SUM(CASE WHEN gl.entry_type = 'CREDIT' THEN gl.amount ELSE 0 END) as total_credits
             FROM general_ledger gl
             WHERE gl.account_id = {$account['id']} AND gl.is_closed = 0 
             AND gl.voucher_date BETWEEN '$start_date' AND '$end_date'
             GROUP BY DATE(gl.voucher_date)
             ORDER BY transaction_date DESC");
        
        $activity = [];
        while ($row = mysqli_fetch_assoc($result)) {
            $debits = floatval($row['total_debits'] ?? 0);
            $credits = floatval($row['total_credits'] ?? 0);
            
            if (in_array($account['account_type'], ['Asset', 'Expense'])) {
                $net_change = $debits - $credits;
            } else {
                $net_change = $credits - $debits;
            }
            
            $activity[] = [
                'date' => $row['transaction_date'],
                'transaction_count' => intval($row['transaction_count']),
                'debits' => $debits,
                'credits' => $credits,
                'net_change' => $net_change
            ];
        }
        
        $this->successResponse([
            'account_code' => $account_code,
            'period' => $period,
            'start_date' => $start_date,
            'end_date' => $end_date,
            'activity' => $activity
        ]);
    }
    
    /**
     * Get account balance history over time
     */
    private function getAccountBalanceHistory() {
        $account_code = $_GET['account_code'] ?? '';
        $start_date = $_GET['start_date'] ?? null;
        $end_date = $_GET['end_date'] ?? date('Y-m-d');
        $period = $_GET['period'] ?? 'day'; // day, week, month
        
        if (empty($account_code)) {
            $this->errorResponse('Account code is required');
        }
        
        $code_esc = mysqli_real_escape_string($this->conn, $account_code);
        
        // Get account
        $acc_result = mysqli_query($this->conn, 
            "SELECT id, account_type FROM chart_of_accounts WHERE account_code = '$code_esc' AND is_active = 1");
        if (!$acc_result || mysqli_num_rows($acc_result) == 0) {
            $this->errorResponse('Account not found', 404);
        }
        $account = mysqli_fetch_assoc($acc_result);
        
        // Build date filter
        $date_filter = "";
        if ($start_date) {
            $start_esc = mysqli_real_escape_string($this->conn, $start_date);
            $date_filter = "AND gl.voucher_date >= '$start_esc'";
        }
        $end_esc = mysqli_real_escape_string($this->conn, $end_date);
        $date_filter .= " AND gl.voucher_date <= '$end_esc'";
        
        // Group by period
        $group_by = "DATE(gl.voucher_date)";
        switch ($period) {
            case 'week':
                $group_by = "YEARWEEK(gl.voucher_date)";
                break;
            case 'month':
                $group_by = "DATE_FORMAT(gl.voucher_date, '%Y-%m')";
                break;
        }
        
        $result = mysqli_query($this->conn, 
            "SELECT 
                $group_by as period,
                SUM(CASE WHEN gl.entry_type = 'DEBIT' THEN gl.amount ELSE 0 END) as total_debits,
                SUM(CASE WHEN gl.entry_type = 'CREDIT' THEN gl.amount ELSE 0 END) as total_credits
             FROM general_ledger gl
             WHERE gl.account_id = {$account['id']} AND gl.is_closed = 0 $date_filter
             GROUP BY $group_by
             ORDER BY period ASC");
        
        $history = [];
        $running_balance = 0;
        
        // Get opening balance
        if ($start_date) {
            $running_balance = $this->ledgerService->getAccountBalance($account_code, date('Y-m-d', strtotime($start_date . ' -1 day')));
        }
        
        while ($row = mysqli_fetch_assoc($result)) {
            $debits = floatval($row['total_debits'] ?? 0);
            $credits = floatval($row['total_credits'] ?? 0);
            
            if (in_array($account['account_type'], ['Asset', 'Expense'])) {
                $period_change = $debits - $credits;
            } else {
                $period_change = $credits - $debits;
            }
            
            $running_balance += $period_change;
            
            $history[] = [
                'period' => $row['period'],
                'debits' => $debits,
                'credits' => $credits,
                'period_change' => $period_change,
                'running_balance' => $running_balance
            ];
        }
        
        $this->successResponse([
            'account_code' => $account_code,
            'account_type' => $account['account_type'],
            'period' => $period,
            'start_date' => $start_date,
            'end_date' => $end_date,
            'opening_balance' => $this->ledgerService->getAccountBalance($account_code, $start_date ? date('Y-m-d', strtotime($start_date . ' -1 day')) : null),
            'closing_balance' => $running_balance,
            'history' => $history
        ]);
    }
}

?>
