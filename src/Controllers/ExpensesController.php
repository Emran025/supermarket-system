<?php

require_once __DIR__ . '/Controller.php';
require_once __DIR__ . '/../Services/LedgerService.php';
require_once __DIR__ . '/../Services/ChartOfAccountsMappingService.php';
require_once __DIR__ . '/../Services/PermissionService.php';

class ExpensesController extends Controller
{
    private $ledgerService;
    private $coaMapping;

    public function __construct()
    {
        parent::__construct();
        $this->ledgerService = new LedgerService();
        $this->coaMapping = new ChartOfAccountsMappingService();
    }

    public function handle()
    {
        if (!is_logged_in()) {
            $this->errorResponse('Unauthorized', 401);
        }

        PermissionService::requirePermission('expenses', 'view');

        $method = $_SERVER['REQUEST_METHOD'];

        if ($method === 'GET') {
            $this->getExpenses();
        } elseif ($method === 'POST') {
            $this->createExpense();
        } elseif ($method === 'PUT') {
            $this->updateExpense();
        } elseif ($method === 'DELETE') {
            $this->deleteExpense();
        }
    }

    private function getExpenses()
    {
        $params = $this->getPaginationParams();
        $limit = $params['limit'];
        $offset = $params['offset'];
        $search = isset($_GET['search']) ? trim($_GET['search']) : '';

        $whereClause = "";
        if (!empty($search)) {
            $searchSafe = mysqli_real_escape_string($this->conn, $search);
            $whereClause = "WHERE category LIKE '%$searchSafe%' OR description LIKE '%$searchSafe%' OR amount LIKE '%$searchSafe%'";
        }

        // Total count
        $countSql = "SELECT COUNT(*) as total FROM expenses $whereClause";
        $countResult = mysqli_query($this->conn, $countSql);
        $total = mysqli_fetch_assoc($countResult)['total'];

        $sql = "
            SELECT e.*, u.username as recorder_name
            FROM expenses e
            LEFT JOIN users u ON e.user_id = u.id
            $whereClause
            ORDER BY e.expense_date DESC, e.id DESC
            LIMIT $limit OFFSET $offset
        ";

        $result = mysqli_query($this->conn, $sql);
        if (!$result) {
            $this->errorResponse(mysqli_error($this->conn));
            return;
        }

        $expenses = [];
        while ($row = mysqli_fetch_assoc($result)) {
            $expenses[] = $row;
        }
        $this->paginatedResponse($expenses, $total, $params['page'], $params['limit']);
    }

    private function createExpense()
    {
        PermissionService::requirePermission('expenses', 'create');
        $data = $this->getJsonInput();

        $category = $data['category'] ?? '';
        $amount = floatval($data['amount'] ?? 0);
        $expense_date = $data['expense_date'] ?? date('Y-m-d');
        $description = $data['description'] ?? '';
        $payment_type = $data['payment_type'] ?? 'cash';
        $supplier_id = isset($data['supplier_id']) ? intval($data['supplier_id']) : null;

        // FIN-003: Use Chart of Accounts instead of hardcoded categories
        $accounts = $this->coaMapping->getStandardAccounts();
        $account_code = $data['account_code'] ?? $accounts['operating_expenses']; // Default to Operating Expenses
        $user_id = $_SESSION['user_id'];

        if (empty($category) || $amount <= 0) {
            $this->errorResponse('Category and positive amount required');
        }

        if ($payment_type === 'credit' && !$supplier_id) {
            $this->errorResponse('Supplier is required for credit expenses');
        }

        // Validate account code exists in COA
        if ($account_code) {
            $acc_result = mysqli_query($this->conn, "SELECT id, account_type FROM chart_of_accounts WHERE account_code = '" . mysqli_real_escape_string($this->conn, $account_code) . "' AND is_active = 1");
            if (!$acc_result || mysqli_num_rows($acc_result) == 0) {
                $this->errorResponse('Invalid account code. Please select a valid account from Chart of Accounts');
            }
            $acc_row = mysqli_fetch_assoc($acc_result);
            if ($acc_row['account_type'] !== 'Expense') {
                $this->errorResponse('Account code must be an Expense account');
            }
        }

        mysqli_begin_transaction($this->conn);

        try {
            $stmt = mysqli_prepare($this->conn, "INSERT INTO expenses (category, account_code, amount, expense_date, description, user_id, payment_type, supplier_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
            mysqli_stmt_bind_param($stmt, "ssdssssi", $category, $account_code, $amount, $expense_date, $description, $user_id, $payment_type, $supplier_id);
            mysqli_stmt_execute($stmt);
            $id = mysqli_insert_id($this->conn);
            mysqli_stmt_close($stmt);

            // If credit, record in AP transactions
            if ($payment_type === 'credit' && $supplier_id) {
                $ap_stmt = mysqli_prepare(
                    $this->conn,
                    "INSERT INTO ap_transactions (supplier_id, type, amount, description, reference_type, reference_id, created_by) 
                     VALUES (?, 'invoice', ?, ?, 'expenses', ?, ?)"
                );
                $ap_desc = "مصروف مستحق: $category - $description";
                mysqli_stmt_bind_param($ap_stmt, "idsiii", $supplier_id, $amount, $ap_desc, $id, $user_id);
                mysqli_stmt_execute($ap_stmt);
                mysqli_stmt_close($ap_stmt);

                // Update supplier balance
                mysqli_query($this->conn, "UPDATE ap_suppliers SET current_balance = current_balance + $amount WHERE id = $supplier_id");
            }

            // Post to General Ledger - Double Entry
            $voucher_number = $this->ledgerService->getNextVoucherNumber('EXP');
            
            $credit_account = ($payment_type === 'credit') ? $accounts['accounts_payable'] : $accounts['cash'];

            $gl_entries = [
                [
                    'account_code' => $account_code, // Expense account from COA
                    'entry_type' => 'DEBIT',
                    'amount' => $amount,
                    'description' => "$category - $description"
                ],
                [
                    'account_code' => $credit_account,
                    'entry_type' => 'CREDIT',
                    'amount' => $amount,
                    'description' => ($payment_type === 'credit' ? "إلتزام لمورد - $category" : "دفع مصروف نقدأ - $category")
                ]
            ];

            $this->ledgerService->postTransaction($gl_entries, 'expenses', $id, $voucher_number, $expense_date);

            mysqli_commit($this->conn);
            log_operation('CREATE', 'expenses', $id, null, $data);
            $this->successResponse(['id' => $id, 'voucher_number' => $voucher_number]);
        } catch (Exception $e) {
            mysqli_rollback($this->conn);
            $this->errorResponse($e->getMessage());
        }
    }

    private function updateExpense()
    {
        PermissionService::requirePermission('expenses', 'edit');
        $data = $this->getJsonInput();
        $id = intval($data['id'] ?? 0);

        $category = $data['category'] ?? '';
        $amount = floatval($data['amount'] ?? 0);
        $expense_date = $data['expense_date'] ?? date('Y-m-d H:i:s');
        $description = $data['description'] ?? '';
        $account_code = $data['account_code'] ?? null;
        $payment_type = $data['payment_type'] ?? 'cash';
        $supplier_id = isset($data['supplier_id']) ? intval($data['supplier_id']) : null;

        if (empty($category) || $amount <= 0) {
            $this->errorResponse('Category and positive amount required');
        }

        if ($payment_type === 'credit' && !$supplier_id) {
            $this->errorResponse('Supplier is required for credit expenses');
        }

        // Validate account code if provided
        if ($account_code) {
            $acc_result = mysqli_query($this->conn, "SELECT id, account_type FROM chart_of_accounts WHERE account_code = '" . mysqli_real_escape_string($this->conn, $account_code) . "' AND is_active = 1");
            if (!$acc_result || mysqli_num_rows($acc_result) == 0) {
                $this->errorResponse('Invalid account code');
            }
            $acc_row = mysqli_fetch_assoc($acc_result);
            if ($acc_row['account_type'] !== 'Expense') {
                $this->errorResponse('Account code must be an Expense account');
            }
        }

        // Get old values for logging and reversal
        $old_res = mysqli_query($this->conn, "SELECT * FROM expenses WHERE id = $id");
        $old_data = mysqli_fetch_assoc($old_res);

        if (!$old_data) {
            $this->errorResponse('Expense not found');
        }

        mysqli_begin_transaction($this->conn);

        try {
            // 1. Revert OLD AP impact
            if ($old_data['payment_type'] === 'credit' && $old_data['supplier_id']) {
                $old_amount = floatval($old_data['amount']);
                $old_sup_id = intval($old_data['supplier_id']);
                mysqli_query($this->conn, "UPDATE ap_suppliers SET current_balance = current_balance - $old_amount WHERE id = $old_sup_id");
                mysqli_query($this->conn, "DELETE FROM ap_transactions WHERE reference_type = 'expenses' AND reference_id = $id");
            }

            // 2. Apply NEW AP impact
            if ($payment_type === 'credit' && $supplier_id) {
                $ap_stmt = mysqli_prepare(
                    $this->conn,
                    "INSERT INTO ap_transactions (supplier_id, type, amount, description, reference_type, reference_id, created_by) 
                     VALUES (?, 'invoice', ?, ?, 'expenses', ?, ?)"
                );
                $ap_desc = "تعديل مصروف مستحق: $category - $description";
                $user_id = $_SESSION['user_id'];
                mysqli_stmt_bind_param($ap_stmt, "idsiii", $supplier_id, $amount, $ap_desc, $id, $user_id);
                mysqli_stmt_execute($ap_stmt);
                mysqli_stmt_close($ap_stmt);

                // Update supplier balance
                mysqli_query($this->conn, "UPDATE ap_suppliers SET current_balance = current_balance + $amount WHERE id = $supplier_id");
            }

            // 3. Update the expense record
            $stmt = mysqli_prepare($this->conn, "UPDATE expenses SET category = ?, account_code = ?, amount = ?, expense_date = ?, description = ?, payment_type = ?, supplier_id = ? WHERE id = ?");
            mysqli_stmt_bind_param($stmt, "ssdssssi", $category, $account_code, $amount, $expense_date, $description, $payment_type, $supplier_id, $id);
            mysqli_stmt_execute($stmt);
            mysqli_stmt_close($stmt);

            mysqli_commit($this->conn);
            log_operation('UPDATE', 'expenses', $id, $old_data, $data);
            $this->successResponse();
        } catch (Exception $e) {
            mysqli_rollback($this->conn);
            $this->errorResponse('Failed to update expense: ' . $e->getMessage());
        }
    }

    private function deleteExpense()
    {
        PermissionService::requirePermission('expenses', 'delete');
        $id = intval($_GET['id'] ?? 0);

        // Get old values for logging and reversal
        $old_res = mysqli_query($this->conn, "SELECT * FROM expenses WHERE id = $id");
        $old_data = mysqli_fetch_assoc($old_res);

        if (!$old_data) {
            $this->errorResponse('Expense not found');
        }

        mysqli_begin_transaction($this->conn);

        try {
            // 1. If credit, reverse AP transaction and balance
            if ($old_data['payment_type'] === 'credit' && $old_data['supplier_id']) {
                $amount = floatval($old_data['amount']);
                $supplier_id = intval($old_data['supplier_id']);
                
                // Update supplier balance
                mysqli_query($this->conn, "UPDATE ap_suppliers SET current_balance = current_balance - $amount WHERE id = $supplier_id");
                
                // Delete AP transaction
                mysqli_query($this->conn, "DELETE FROM ap_transactions WHERE reference_type = 'expenses' AND reference_id = $id");
            }

            // 2. Delete the expense
            $stmt = mysqli_prepare($this->conn, "DELETE FROM expenses WHERE id = ?");
            mysqli_stmt_bind_param($stmt, "i", $id);
            mysqli_stmt_execute($stmt);
            mysqli_stmt_close($stmt);

            mysqli_commit($this->conn);
            log_operation('DELETE', 'expenses', $id, $old_data);
            $this->successResponse();
        } catch (Exception $e) {
            mysqli_rollback($this->conn);
            $this->errorResponse('Failed to delete expense: ' . $e->getMessage());
        }
    }
}
