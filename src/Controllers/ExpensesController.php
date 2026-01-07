<?php

require_once __DIR__ . '/Controller.php';
require_once __DIR__ . '/../Services/LedgerService.php';
require_once __DIR__ . '/../Services/ChartOfAccountsMappingService.php';

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
        $data = $this->getJsonInput();

        $category = $data['category'] ?? '';
        $amount = floatval($data['amount'] ?? 0);
        $expense_date = $data['expense_date'] ?? date('Y-m-d');
        $description = $data['description'] ?? '';
        // FIN-003: Use Chart of Accounts instead of hardcoded categories
        $accounts = $this->coaMapping->getStandardAccounts();
        $account_code = $data['account_code'] ?? $accounts['operating_expenses']; // Default to Operating Expenses
        $user_id = $_SESSION['user_id'];

        if (empty($category) || $amount <= 0) {
            $this->errorResponse('Category and positive amount required');
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
            $stmt = mysqli_prepare($this->conn, "INSERT INTO expenses (category, account_code, amount, expense_date, description, user_id) VALUES (?, ?, ?, ?, ?, ?)");
            mysqli_stmt_bind_param($stmt, "ssdssi", $category, $account_code, $amount, $expense_date, $description, $user_id);
            mysqli_stmt_execute($stmt);
            $id = mysqli_insert_id($this->conn);
            mysqli_stmt_close($stmt);

            // Post to General Ledger - Double Entry
            $voucher_number = $this->ledgerService->getNextVoucherNumber('EXP');

            $accounts = $this->coaMapping->getStandardAccounts();
            $gl_entries = [
                [
                    'account_code' => $account_code, // Expense account from COA
                    'entry_type' => 'DEBIT',
                    'amount' => $amount,
                    'description' => "$category - $description"
                ],
                [
                    'account_code' => $accounts['cash'], // Cash
                    'entry_type' => 'CREDIT',
                    'amount' => $amount,
                    'description' => "دفع مصروف - $category"
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
        $data = $this->getJsonInput();
        $id = intval($data['id'] ?? 0);

        $category = $data['category'] ?? '';
        $amount = floatval($data['amount'] ?? 0);
        $expense_date = $data['expense_date'] ?? date('Y-m-d H:i:s');
        $description = $data['description'] ?? '';
        $account_code = $data['account_code'] ?? null;

        if (empty($category) || $amount <= 0) {
            $this->errorResponse('Category and positive amount required');
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

        // Get old values for logging
        $old_res = mysqli_query($this->conn, "SELECT * FROM expenses WHERE id = $id");
        $old_data = mysqli_fetch_assoc($old_res);

        $stmt = mysqli_prepare($this->conn, "UPDATE expenses SET category = ?, account_code = ?, amount = ?, expense_date = ?, description = ? WHERE id = ?");
        mysqli_stmt_bind_param($stmt, "ssdssi", $category, $account_code, $amount, $expense_date, $description, $id);

        if (mysqli_stmt_execute($stmt)) {
            log_operation('UPDATE', 'expenses', $id, $old_data, $data);
            $this->successResponse();
        } else {
            $this->errorResponse('Failed to update expense');
        }
    }

    private function deleteExpense()
    {
        $id = intval($_GET['id'] ?? 0);

        // Get old values for logging
        $old_res = mysqli_query($this->conn, "SELECT * FROM expenses WHERE id = $id");
        $old_data = mysqli_fetch_assoc($old_res);

        $stmt = mysqli_prepare($this->conn, "DELETE FROM expenses WHERE id = ?");
        mysqli_stmt_bind_param($stmt, "i", $id);

        if (mysqli_stmt_execute($stmt)) {
            log_operation('DELETE', 'expenses', $id, $old_data);
            $this->successResponse();
        } else {
            $this->errorResponse('Failed to delete expense');
        }
    }
}
