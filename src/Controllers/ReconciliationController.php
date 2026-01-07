<?php

require_once __DIR__ . '/Controller.php';
require_once __DIR__ . '/../Services/LedgerService.php';
require_once __DIR__ . '/../Services/ChartOfAccountsMappingService.php';

class ReconciliationController extends Controller {
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
        
        if ($method === 'GET') {
            $this->getReconciliations();
        } elseif ($method === 'POST') {
            $this->createReconciliation();
        } elseif ($method === 'PUT') {
            $this->updateReconciliation();
        }
    }
    
    private function getReconciliations() {
        $account_code = $_GET['account_code'] ?? null;
        $status = $_GET['status'] ?? null;
        
        $where = "WHERE 1=1";
        if ($account_code) {
            $code_esc = mysqli_real_escape_string($this->conn, $account_code);
            $where .= " AND account_code = '$code_esc'";
        }
        if ($status) {
            $status_esc = mysqli_real_escape_string($this->conn, $status);
            $where .= " AND status = '$status_esc'";
        }
        
        $result = mysqli_query($this->conn, 
            "SELECT r.*, coa.account_name, u.username as reconciled_by_name
             FROM reconciliations r
             LEFT JOIN chart_of_accounts coa ON r.account_code = coa.account_code
             LEFT JOIN users u ON r.reconciled_by = u.id
             $where
             ORDER BY r.reconciliation_date DESC");
        
        $reconciliations = [];
        while ($row = mysqli_fetch_assoc($result)) {
            $reconciliations[] = $row;
        }
        
        $this->successResponse(['data' => $reconciliations]);
    }
    
    private function createReconciliation() {
        $data = $this->getJsonInput();
        
        $account_code = mysqli_real_escape_string($this->conn, $data['account_code'] ?? '');
        $physical_balance = floatval($data['physical_balance'] ?? 0);
        $reconciliation_date = mysqli_real_escape_string($this->conn, $data['reconciliation_date'] ?? date('Y-m-d'));
        $notes = mysqli_real_escape_string($this->conn, $data['notes'] ?? '');
        
        if (empty($account_code)) {
            $this->errorResponse('Account code is required');
        }
        
        // Validate account exists
        $acc_result = mysqli_query($this->conn, 
            "SELECT id, account_type FROM chart_of_accounts WHERE account_code = '$account_code' AND is_active = 1");
        if (!$acc_result || mysqli_num_rows($acc_result) == 0) {
            $this->errorResponse('Invalid account code');
        }
        
        // Get ledger balance
        $ledger_balance = $this->ledgerService->getAccountBalance($account_code, $reconciliation_date);
        
        // Calculate difference
        $difference = $physical_balance - $ledger_balance;
        
        // Determine status
        $status = abs($difference) < 0.01 ? 'reconciled' : 'unreconciled';
        
        $user_id = $_SESSION['user_id'];
        
        $stmt = mysqli_prepare($this->conn, 
            "INSERT INTO reconciliations (account_code, reconciliation_date, ledger_balance, physical_balance, difference, status, notes, reconciled_by) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
        mysqli_stmt_bind_param($stmt, "ssdddsds", 
            $account_code, $reconciliation_date, $ledger_balance, $physical_balance, $difference, $status, $notes, $user_id);
        
        if (mysqli_stmt_execute($stmt)) {
            $id = mysqli_insert_id($this->conn);
            mysqli_stmt_close($stmt);
            
            log_operation('CREATE', 'reconciliations', $id, null, $data);
            $this->successResponse([
                'id' => $id,
                'ledger_balance' => $ledger_balance,
                'difference' => $difference,
                'status' => $status
            ]);
        } else {
            mysqli_stmt_close($stmt);
            $this->errorResponse('Failed to create reconciliation');
        }
    }
    
    private function updateReconciliation() {
        $data = $this->getJsonInput();
        $id = intval($data['id'] ?? 0);
        
        $status = mysqli_real_escape_string($this->conn, $data['status'] ?? '');
        $adjustment_notes = mysqli_real_escape_string($this->conn, $data['adjustment_notes'] ?? '');
        
        if (empty($status) || !in_array($status, ['reconciled', 'unreconciled', 'adjusted'])) {
            $this->errorResponse('Invalid status');
        }
        
        // Get reconciliation details
        $result = mysqli_query($this->conn, "SELECT * FROM reconciliations WHERE id = $id");
        $reconciliation = mysqli_fetch_assoc($result);
        
        if (!$reconciliation) {
            $this->errorResponse('Reconciliation not found', 404);
        }
        
        mysqli_begin_transaction($this->conn);
        
        try {
            // Update reconciliation status
            $stmt = mysqli_prepare($this->conn, 
                "UPDATE reconciliations SET status = ?, adjustment_notes = ?, updated_at = NOW() WHERE id = ?");
            mysqli_stmt_bind_param($stmt, "ssi", $status, $adjustment_notes, $id);
            mysqli_stmt_execute($stmt);
            mysqli_stmt_close($stmt);
            
            // If status is 'adjusted' and there's a difference, create adjustment journal entry
            if ($status === 'adjusted' && abs(floatval($reconciliation['difference'])) > 0.01) {
                $accounts = $this->coaMapping->getStandardAccounts();
                $difference = floatval($reconciliation['difference']);
                $account_code = $reconciliation['account_code'];
                
                // Create adjustment entry
                $voucher_number = $this->ledgerService->getNextVoucherNumber('ADJ');
                $adjustment_entries = [];
                
                if ($difference > 0) {
                    // Physical balance is higher: Debit the account, Credit adjustment account
                    $adjustment_entries[] = [
                        'account_code' => $account_code,
                        'entry_type' => 'DEBIT',
                        'amount' => abs($difference),
                        'description' => "تسوية - فرق جرد نقدي - " . $adjustment_notes
                    ];
                    // Use a suspense/adjustment account (create if doesn't exist)
                    $adj_account = $accounts['operating_expenses']; // Temporary, should be a dedicated adjustment account
                    $adjustment_entries[] = [
                        'account_code' => $adj_account,
                        'entry_type' => 'CREDIT',
                        'amount' => abs($difference),
                        'description' => "تسوية - فرق جرد نقدي"
                    ];
                } else {
                    // Physical balance is lower: Credit the account, Debit adjustment account
                    $adjustment_entries[] = [
                        'account_code' => $account_code,
                        'entry_type' => 'CREDIT',
                        'amount' => abs($difference),
                        'description' => "تسوية - فرق جرد نقدي - " . $adjustment_notes
                    ];
                    $adj_account = $accounts['operating_expenses'];
                    $adjustment_entries[] = [
                        'account_code' => $adj_account,
                        'entry_type' => 'DEBIT',
                        'amount' => abs($difference),
                        'description' => "تسوية - فرق جرد نقدي"
                    ];
                }
                
                $this->ledgerService->postTransaction($adjustment_entries, 'reconciliations', $id, $voucher_number);
            }
            
            mysqli_commit($this->conn);
            log_operation('UPDATE', 'reconciliations', $id, null, $data);
            $this->successResponse(['message' => 'Reconciliation updated']);
        } catch (Exception $e) {
            mysqli_rollback($this->conn);
            $this->errorResponse($e->getMessage());
        }
    }
}

?>
