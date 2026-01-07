<?php

require_once __DIR__ . '/Controller.php';
require_once __DIR__ . '/../Services/LedgerService.php';
require_once __DIR__ . '/../Services/ChartOfAccountsMappingService.php';
require_once __DIR__ . '/../Services/PermissionService.php';

/**
 * RecurringTransactionsController
 * Handles recurring transactions (rent, salaries, subscriptions, etc.)
 */
class RecurringTransactionsController extends Controller {
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

        PermissionService::requirePermission('recurring_transactions', 'view');
        
        $method = $_SERVER['REQUEST_METHOD'];
        
        if ($method === 'GET') {
            $this->getRecurringTransactions();
        } elseif ($method === 'POST') {
            $action = $_GET['action'] ?? 'create';
            if ($action === 'process') {
                PermissionService::requirePermission('recurring_transactions', 'create'); // Or separate 'execute'
                $this->processRecurringTransactions();
            } else {
                PermissionService::requirePermission('recurring_transactions', 'create');
                $this->createRecurringTransaction();
            }
        } elseif ($method === 'PUT') {
            PermissionService::requirePermission('recurring_transactions', 'edit');
            $this->updateRecurringTransaction();
        } elseif ($method === 'DELETE') {
            PermissionService::requirePermission('recurring_transactions', 'delete');
            $this->deleteRecurringTransaction();
        }
    }
    
    private function getRecurringTransactions() {
        $params = $this->getPaginationParams();
        $limit = $params['limit'];
        $offset = $params['offset'];
        $status = $_GET['status'] ?? null;
        
        $where = "WHERE 1=1";
        if ($status) {
            $status_esc = mysqli_real_escape_string($this->conn, $status);
            $where .= " AND status = '$status_esc'";
        }
        
        $result = mysqli_query($this->conn, 
            "SELECT rt.*, coa.account_name as debit_account_name, coa2.account_name as credit_account_name,
                    u.username as created_by_name
             FROM recurring_transactions rt
             LEFT JOIN chart_of_accounts coa ON rt.debit_account_code = coa.account_code
             LEFT JOIN chart_of_accounts coa2 ON rt.credit_account_code = coa2.account_code
             LEFT JOIN users u ON rt.created_by = u.id
             $where
             ORDER BY rt.next_due_date ASC, rt.id DESC
             LIMIT $limit OFFSET $offset");
        
        $transactions = [];
        while ($row = mysqli_fetch_assoc($result)) {
            $transactions[] = $row;
        }
        
        $countResult = mysqli_query($this->conn, "SELECT COUNT(*) as total FROM recurring_transactions $where");
        $total = mysqli_fetch_assoc($countResult)['total'];
        
        $this->paginatedResponse($transactions, $total, $params['page'], $params['limit']);
    }
    
    private function createRecurringTransaction() {
        $data = $this->getJsonInput();
        
        $description = mysqli_real_escape_string($this->conn, $data['description'] ?? '');
        $debit_account_code = mysqli_real_escape_string($this->conn, $data['debit_account_code'] ?? '');
        $credit_account_code = mysqli_real_escape_string($this->conn, $data['credit_account_code'] ?? '');
        $amount = floatval($data['amount'] ?? 0);
        $frequency = mysqli_real_escape_string($this->conn, $data['frequency'] ?? 'monthly'); // daily, weekly, monthly, quarterly, yearly
        $start_date = mysqli_real_escape_string($this->conn, $data['start_date'] ?? date('Y-m-d'));
        $end_date = !empty($data['end_date']) ? mysqli_real_escape_string($this->conn, $data['end_date']) : null;
        $auto_process = isset($data['auto_process']) ? intval($data['auto_process']) : 0;
        
        if (empty($description) || empty($debit_account_code) || empty($credit_account_code) || $amount <= 0) {
            $this->errorResponse('Description, debit account, credit account, and positive amount required');
        }
        
        // Validate accounts
        $acc_result = mysqli_query($this->conn, 
            "SELECT id FROM chart_of_accounts WHERE account_code IN ('$debit_account_code', '$credit_account_code') AND is_active = 1");
        if (!$acc_result || mysqli_num_rows($acc_result) < 2) {
            $this->errorResponse('Invalid account codes');
        }
        
        // Calculate next due date
        $next_due_date = $this->calculateNextDueDate($start_date, $frequency);
        
        $user_id = $_SESSION['user_id'];
        
        $stmt = mysqli_prepare($this->conn, 
            "INSERT INTO recurring_transactions (description, debit_account_code, credit_account_code, amount, frequency, start_date, end_date, next_due_date, auto_process, status, created_by) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)");
        mysqli_stmt_bind_param($stmt, "sssdssssii", 
            $description, $debit_account_code, $credit_account_code, $amount, $frequency, 
            $start_date, $end_date, $next_due_date, $auto_process, $user_id);
        
        if (mysqli_stmt_execute($stmt)) {
            $id = mysqli_insert_id($this->conn);
            mysqli_stmt_close($stmt);
            
            log_operation('CREATE', 'recurring_transactions', $id, null, $data);
            $this->successResponse(['id' => $id, 'next_due_date' => $next_due_date]);
        } else {
            mysqli_stmt_close($stmt);
            $this->errorResponse('Failed to create recurring transaction');
        }
    }
    
    private function updateRecurringTransaction() {
        $data = $this->getJsonInput();
        $id = intval($data['id'] ?? 0);
        
        $description = mysqli_real_escape_string($this->conn, $data['description'] ?? '');
        $amount = floatval($data['amount'] ?? 0);
        $status = mysqli_real_escape_string($this->conn, $data['status'] ?? '');
        
        if (!empty($status) && !in_array($status, ['active', 'paused', 'completed'])) {
            $this->errorResponse('Invalid status');
        }
        
        $updates = [];
        $params = [];
        $types = "";
        
        if (!empty($description)) {
            $updates[] = "description = ?";
            $params[] = $description;
            $types .= "s";
        }
        
        if ($amount > 0) {
            $updates[] = "amount = ?";
            $params[] = $amount;
            $types .= "d";
        }
        
        if (!empty($status)) {
            $updates[] = "status = ?";
            $params[] = $status;
            $types .= "s";
        }
        
        if (empty($updates)) {
            $this->errorResponse('No fields to update');
        }
        
        $params[] = $id;
        $types .= "i";
        
        $sql = "UPDATE recurring_transactions SET " . implode(", ", $updates) . " WHERE id = ?";
        $stmt = mysqli_prepare($this->conn, $sql);
        mysqli_stmt_bind_param($stmt, $types, ...$params);
        
        if (mysqli_stmt_execute($stmt)) {
            mysqli_stmt_close($stmt);
            log_operation('UPDATE', 'recurring_transactions', $id, null, $data);
            $this->successResponse();
        } else {
            mysqli_stmt_close($stmt);
            $this->errorResponse('Failed to update recurring transaction');
        }
    }
    
    private function deleteRecurringTransaction() {
        $id = intval($_GET['id'] ?? 0);
        
        $stmt = mysqli_prepare($this->conn, "DELETE FROM recurring_transactions WHERE id = ?");
        mysqli_stmt_bind_param($stmt, "i", $id);
        
        if (mysqli_stmt_execute($stmt)) {
            mysqli_stmt_close($stmt);
            log_operation('DELETE', 'recurring_transactions', $id);
            $this->successResponse();
        } else {
            mysqli_stmt_close($stmt);
            $this->errorResponse('Failed to delete recurring transaction');
        }
    }
    
    private function processRecurringTransactions() {
        $date = $_GET['date'] ?? date('Y-m-d');
        $date_esc = mysqli_real_escape_string($this->conn, $date);
        
        // Get all active recurring transactions due on or before the date
        $result = mysqli_query($this->conn, 
            "SELECT * FROM recurring_transactions 
             WHERE status = 'active' 
             AND next_due_date <= '$date_esc'
             AND (end_date IS NULL OR end_date >= '$date_esc')");
        
        $processed = [];
        $errors = [];
        
        mysqli_begin_transaction($this->conn);
        
        try {
            while ($row = mysqli_fetch_assoc($result)) {
                try {
                    // Create journal entry
                    $voucher_number = $this->ledgerService->getNextVoucherNumber('REC');
                    $gl_entries = [
                        [
                            'account_code' => $row['debit_account_code'],
                            'entry_type' => 'DEBIT',
                            'amount' => floatval($row['amount']),
                            'description' => $row['description'] . " - " . $date
                        ],
                        [
                            'account_code' => $row['credit_account_code'],
                            'entry_type' => 'CREDIT',
                            'amount' => floatval($row['amount']),
                            'description' => $row['description'] . " - " . $date
                        ]
                    ];
                    
                    $this->ledgerService->postTransaction($gl_entries, 'recurring_transactions', $row['id'], $voucher_number, $date);
                    
                    // Calculate next due date
                    $next_due_date = $this->calculateNextDueDate($row['next_due_date'], $row['frequency']);
                    
                    // Update recurring transaction
                    $stmt = mysqli_prepare($this->conn, 
                        "UPDATE recurring_transactions SET last_processed_date = ?, next_due_date = ?, processed_count = processed_count + 1 WHERE id = ?");
                    mysqli_stmt_bind_param($stmt, "ssi", $date, $next_due_date, $row['id']);
                    mysqli_stmt_execute($stmt);
                    mysqli_stmt_close($stmt);
                    
                    // Check if end date reached
                    if ($row['end_date'] && $next_due_date > $row['end_date']) {
                        $stmt = mysqli_prepare($this->conn, "UPDATE recurring_transactions SET status = 'completed' WHERE id = ?");
                        mysqli_stmt_bind_param($stmt, "i", $row['id']);
                        mysqli_stmt_execute($stmt);
                        mysqli_stmt_close($stmt);
                    }
                    
                    $processed[] = [
                        'id' => $row['id'],
                        'description' => $row['description'],
                        'voucher_number' => $voucher_number,
                        'amount' => floatval($row['amount'])
                    ];
                } catch (Exception $e) {
                    $errors[] = [
                        'id' => $row['id'],
                        'description' => $row['description'],
                        'error' => $e->getMessage()
                    ];
                }
            }
            
            mysqli_commit($this->conn);
            log_operation('PROCESS', 'recurring_transactions', null, null, ['date' => $date, 'processed' => count($processed)]);
            $this->successResponse([
                'processed' => $processed,
                'errors' => $errors,
                'date' => $date
            ]);
        } catch (Exception $e) {
            mysqli_rollback($this->conn);
            $this->errorResponse($e->getMessage());
        }
    }
    
    private function calculateNextDueDate($current_date, $frequency) {
        $date = new DateTime($current_date);
        
        switch ($frequency) {
            case 'daily':
                $date->modify('+1 day');
                break;
            case 'weekly':
                $date->modify('+1 week');
                break;
            case 'monthly':
                $date->modify('+1 month');
                break;
            case 'quarterly':
                $date->modify('+3 months');
                break;
            case 'yearly':
                $date->modify('+1 year');
                break;
            default:
                $date->modify('+1 month');
        }
        
        return $date->format('Y-m-d');
    }
}

?>
