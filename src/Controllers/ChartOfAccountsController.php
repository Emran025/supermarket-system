<?php

require_once __DIR__ . '/Controller.php';
require_once __DIR__ . '/../Services/LedgerService.php';

/**
 * Chart of Accounts Controller
 * FIN-003: Provides dynamic Chart of Accounts for expense/revenue categorization
 */
class ChartOfAccountsController extends Controller
{
    private $ledgerService;

    public function __construct()
    {
        parent::__construct();
        $this->ledgerService = new LedgerService();
    }

    public function handle()
    {
        if (!is_logged_in()) {
            $this->errorResponse('Unauthorized', 401);
        }

        $method = $_SERVER['REQUEST_METHOD'];
        $action = $_GET['action'] ?? '';

        if ($method === 'GET') {
            if ($action === 'balances') {
                $this->getAccountBalances();
            } else {
                $this->getAccounts();
            }
        } elseif ($method === 'POST') {
            $this->createAccount();
        } elseif ($method === 'PUT') {
            $this->updateAccount();
        } elseif ($method === 'DELETE') {
            $this->deleteAccount();
        }
    }

    private function getAccounts()
    {
        $account_type = $_GET['type'] ?? null; // Filter by type: Asset, Liability, Equity, Revenue, Expense
        $parent_id = isset($_GET['parent_id']) ? intval($_GET['parent_id']) : null;

        $where = "WHERE is_active = 1";
        if ($account_type) {
            $type_esc = mysqli_real_escape_string($this->conn, $account_type);
            $where .= " AND account_type = '$type_esc'";
        }
        if ($parent_id !== null) {
            $where .= " AND parent_id " . ($parent_id === 0 ? "IS NULL" : "= $parent_id");
        }

        $result = mysqli_query(
            $this->conn,
            "SELECT coa.*, 
                    (SELECT COUNT(*) FROM chart_of_accounts WHERE parent_id = coa.id AND is_active = 1) as child_count
             FROM chart_of_accounts coa
             $where
             ORDER BY account_code ASC"
        );

        $accounts = [];
        while ($row = mysqli_fetch_assoc($result)) {
            $accounts[] = $row;
        }

        $this->successResponse(['data' => $accounts]);
    }

    private function createAccount()
    {
        $data = $this->getJsonInput();

        $account_code = mysqli_real_escape_string($this->conn, $data['account_code'] ?? '');
        $account_name = mysqli_real_escape_string($this->conn, $data['account_name'] ?? '');
        $account_type = mysqli_real_escape_string($this->conn, $data['account_type'] ?? '');
        $parent_id = isset($data['parent_id']) ? intval($data['parent_id']) : null;
        $description = isset($data['description']) ? mysqli_real_escape_string($this->conn, $data['description']) : null;

        if (empty($account_code) || empty($account_name) || empty($account_type)) {
            $this->errorResponse('Account code, name, and type are required');
        }

        // Validate account type
        $valid_types = ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'];
        if (!in_array($account_type, $valid_types)) {
            $this->errorResponse('Invalid account type. Must be one of: ' . implode(', ', $valid_types));
        }

        // Check if account code already exists
        $check = mysqli_query($this->conn, "SELECT id FROM chart_of_accounts WHERE account_code = '$account_code'");
        if (mysqli_num_rows($check) > 0) {
            $this->errorResponse('Account code already exists');
        }

        $stmt = mysqli_prepare(
            $this->conn,
            "INSERT INTO chart_of_accounts (account_code, account_name, account_type, parent_id, description) 
             VALUES (?, ?, ?, ?, ?)"
        );
        mysqli_stmt_bind_param($stmt, "sssis", $account_code, $account_name, $account_type, $parent_id, $description);

        if (mysqli_stmt_execute($stmt)) {
            $id = mysqli_insert_id($this->conn);
            log_operation('CREATE', 'chart_of_accounts', $id, null, $data);
            $this->successResponse(['id' => $id]);
        } else {
            $this->errorResponse('Failed to create account');
        }
    }

    private function updateAccount()
    {
        $data = $this->getJsonInput();
        $id = intval($data['id'] ?? 0);

        $account_name = isset($data['account_name']) ? mysqli_real_escape_string($this->conn, $data['account_name']) : null;
        $description = isset($data['description']) ? mysqli_real_escape_string($this->conn, $data['description']) : null;
        $is_active = isset($data['is_active']) ? intval($data['is_active']) : null;

        $updates = [];
        $params = [];
        $types = '';

        if ($account_name !== null) {
            $updates[] = "account_name = ?";
            $params[] = $account_name;
            $types .= 's';
        }
        if ($description !== null) {
            $updates[] = "description = ?";
            $params[] = $description;
            $types .= 's';
        }
        if ($is_active !== null) {
            $updates[] = "is_active = ?";
            $params[] = $is_active;
            $types .= 'i';
        }

        if (empty($updates)) {
            $this->errorResponse('No fields to update');
        }

        $params[] = $id;
        $types .= 'i';

        $sql = "UPDATE chart_of_accounts SET " . implode(', ', $updates) . " WHERE id = ?";
        $stmt = mysqli_prepare($this->conn, $sql);
        mysqli_stmt_bind_param($stmt, $types, ...$params);

        if (mysqli_stmt_execute($stmt)) {
            log_operation('UPDATE', 'chart_of_accounts', $id, null, $data);
            $this->successResponse();
        } else {
            $this->errorResponse('Failed to update account');
        }
    }

    private function deleteAccount()
    {
        $id = intval($_GET['id'] ?? 0);

        // Check if account has children
        $check = mysqli_query($this->conn, "SELECT COUNT(*) as count FROM chart_of_accounts WHERE parent_id = $id AND is_active = 1");
        $row = mysqli_fetch_assoc($check);
        if ($row['count'] > 0) {
            $this->errorResponse('Cannot delete account with child accounts. Deactivate it instead.');
        }

        // Check if account has GL entries
        $gl_check = mysqli_query($this->conn, "SELECT COUNT(*) as count FROM general_ledger WHERE account_id = $id");
        $gl_row = mysqli_fetch_assoc($gl_check);
        if ($gl_row['count'] > 0) {
            // Soft delete by deactivating
            mysqli_query($this->conn, "UPDATE chart_of_accounts SET is_active = 0 WHERE id = $id");
            log_operation('UPDATE', 'chart_of_accounts', $id, null, ['action' => 'deactivate']);
            $this->successResponse(['message' => 'Account deactivated (has GL entries)']);
        } else {
            // Hard delete if no GL entries
            $stmt = mysqli_prepare($this->conn, "DELETE FROM chart_of_accounts WHERE id = ?");
            mysqli_stmt_bind_param($stmt, "i", $id);

            if (mysqli_stmt_execute($stmt)) {
                log_operation('DELETE', 'chart_of_accounts', $id);
                $this->successResponse();
            } else {
                $this->errorResponse('Failed to delete account');
            }
        }
    }

    /**
     * Get account balances summary for all accounts
     */
    private function getAccountBalances()
    {
        $as_of_date = $_GET['as_of_date'] ?? null;
        $account_type = $_GET['account_type'] ?? null;

        $where = "WHERE coa.is_active = 1";
        if ($account_type) {
            $type_esc = mysqli_real_escape_string($this->conn, $account_type);
            $where .= " AND coa.account_type = '$type_esc'";
        }

        $date_filter = "";
        if ($as_of_date) {
            $date_esc = mysqli_real_escape_string($this->conn, $as_of_date);
            $date_filter = "AND gl.voucher_date <= '$date_esc'";
        }

        $result = mysqli_query(
            $this->conn,
            "SELECT coa.id, coa.account_code, coa.account_name, coa.account_type, coa.parent_id,
                    SUM(CASE WHEN gl.entry_type = 'DEBIT' THEN gl.amount ELSE 0 END) as total_debits,
                    SUM(CASE WHEN gl.entry_type = 'CREDIT' THEN gl.amount ELSE 0 END) as total_credits
             FROM chart_of_accounts coa
             LEFT JOIN general_ledger gl ON coa.id = gl.account_id AND gl.is_closed = 0 $date_filter
             $where
             GROUP BY coa.id, coa.account_code, coa.account_name, coa.account_type, coa.parent_id
             ORDER BY coa.account_code"
        );

        $accounts = [];
        $totals_by_type = [];

        while ($row = mysqli_fetch_assoc($result)) {
            $debits = floatval($row['total_debits'] ?? 0);
            $credits = floatval($row['total_credits'] ?? 0);
            $account_type = $row['account_type'];

            // Calculate balance
            if (in_array($account_type, ['Asset', 'Expense'])) {
                $balance = $debits - $credits;
            } else {
                $balance = $credits - $debits;
            }

            $account_data = [
                'id' => intval($row['id']),
                'account_code' => $row['account_code'],
                'account_name' => $row['account_name'],
                'account_type' => $account_type,
                'parent_id' => $row['parent_id'] ? intval($row['parent_id']) : null,
                'total_debits' => $debits,
                'total_credits' => $credits,
                'balance' => $balance
            ];

            $accounts[] = $account_data;

            // Aggregate by type
            if (!isset($totals_by_type[$account_type])) {
                $totals_by_type[$account_type] = ['debits' => 0, 'credits' => 0, 'balance' => 0];
            }
            $totals_by_type[$account_type]['debits'] += $debits;
            $totals_by_type[$account_type]['credits'] += $credits;
            $totals_by_type[$account_type]['balance'] += $balance;
        }

        $this->successResponse([
            'accounts' => $accounts,
            'totals_by_type' => $totals_by_type,
            'as_of_date' => $as_of_date
        ]);
    }
}
