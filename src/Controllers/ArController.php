<?php

require_once __DIR__ . '/Controller.php';
require_once __DIR__ . '/../Services/LedgerService.php';
require_once __DIR__ . '/../Services/ChartOfAccountsMappingService.php';
require_once __DIR__ . '/../Services/PermissionService.php';

class ArController extends Controller
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

        PermissionService::requirePermission('ar_customers', 'view');

        $action = $_GET['action'] ?? 'ar_customers';
        $method = $_SERVER['REQUEST_METHOD'];

        if ($action === 'ar_customers') {
            if ($method === 'GET') {
                $this->getCustomers();
            } elseif ($method === 'POST') {
                PermissionService::requirePermission('ar_customers', 'create');
                $this->createCustomer();
            } elseif ($method === 'PUT') {
                PermissionService::requirePermission('ar_customers', 'edit');
                $this->updateCustomer();
            } elseif ($method === 'DELETE') {
                PermissionService::requirePermission('ar_customers', 'delete');
                $this->deleteCustomer();
            }
        } elseif ($action === 'ar_ledger') {
            if ($method === 'GET') {
                $this->getLedger();
            } elseif ($method === 'POST') {
                $sub_action = $_GET['sub_action'] ?? 'create';
                if ($sub_action === 'restore') {
                    $this->restoreTransaction();
                } else {
                    $this->createTransaction();
                }
            } elseif ($method === 'DELETE') {
                $this->deleteTransaction();
            } elseif ($method === 'PUT') {
                $this->updateTransaction();
            }
        } elseif ($action === 'customer_statement') {
            if ($method === 'GET') {
                $this->getCustomerStatement();
            }
        }
    }

    // --- Customer Methods ---

    private function getCustomers()
    {
        $search = isset($_GET['search']) ? trim($_GET['search']) : '';
        $params = $this->getPaginationParams();
        $limit = $params['limit'];
        $offset = $params['offset'];

        $whereClause = "";
        if (!empty($search)) {
            $searchSafe = mysqli_real_escape_string($this->conn, $search);
            $whereClause = "WHERE name LIKE '%$searchSafe%' OR phone LIKE '%$searchSafe%' OR tax_number LIKE '%$searchSafe%'";
        }

        // If specific ID requested (for header details)
        if (isset($_GET['id'])) {
            $id = intval($_GET['id']);
            $whereClause = "WHERE id = $id";
            // Override limit for single fetch
            $limit = 1;
            $offset = 0;
        }

        // Count
        $countSql = "SELECT COUNT(*) as total FROM ar_customers $whereClause";
        $countResult = mysqli_query($this->conn, $countSql);
        $total = ($countResult && mysqli_num_rows($countResult) > 0) ? mysqli_fetch_assoc($countResult)['total'] : 0;

        // Fetch
        $sql = "SELECT * FROM ar_customers $whereClause ORDER BY name ASC LIMIT $limit OFFSET $offset";
        $result = mysqli_query($this->conn, $sql);

        $customers = [];
        if ($result && mysqli_num_rows($result) > 0) {
            while ($row = mysqli_fetch_assoc($result)) {
                $customers[] = $row;
            }
        }

        $this->paginatedResponse($customers, $total, $params['page'], $params['limit']);
    }

    private function createCustomer()
    {
        $data = $this->getJsonInput();

        $name = mysqli_real_escape_string($this->conn, $data['name'] ?? '');
        $phone = mysqli_real_escape_string($this->conn, $data['phone'] ?? '');
        $email = mysqli_real_escape_string($this->conn, $data['email'] ?? '');
        $address = mysqli_real_escape_string($this->conn, $data['address'] ?? '');
        $tax_number = mysqli_real_escape_string($this->conn, $data['tax_number'] ?? '');
        $user_id = $_SESSION['user_id'];

        if (empty($name)) {
            $this->errorResponse('Customer name is required', 400);
        }

        // Check for duplicates (Name or Phone)
        $checkSql = "SELECT id FROM ar_customers WHERE name = '$name'";
        if (!empty($phone)) {
            $checkSql .= " OR phone = '$phone'";
        }
        $checkResult = mysqli_query($this->conn, $checkSql);
        if (mysqli_num_rows($checkResult) > 0) {
            // Provide a warning or specific error? 
            // Spec says "alert the user when a potential match is detected".
            // Ideally frontend checks logic for suggestions. Backend enforced uniqueness if reasonable.
            // Let's not error but return logic handled by frontend suggestion search. 
            // But if they proceed to Create, we prevent exact duplicates? 
            // "Prevent the creation of duplicate customer accounts"
            $this->errorResponse('Customer with this name or phone already exists', 409);
        }

        $stmt = mysqli_prepare($this->conn, "INSERT INTO ar_customers (name, phone, email, address, tax_number, created_by) VALUES (?, ?, ?, ?, ?, ?)");
        mysqli_stmt_bind_param($stmt, "sssssi", $name, $phone, $email, $address, $tax_number, $user_id);

        if (mysqli_stmt_execute($stmt)) {
            $id = mysqli_insert_id($this->conn);
            log_operation('CREATE', 'ar_customers', $id, null, $data);
            $this->successResponse(['id' => $id]);
        } else {
            $this->errorResponse(mysqli_error($this->conn));
        }
    }

    private function updateCustomer()
    {
        $data = $this->getJsonInput();
        $id = intval($data['id'] ?? 0);

        $name = mysqli_real_escape_string($this->conn, $data['name'] ?? '');
        $phone = mysqli_real_escape_string($this->conn, $data['phone'] ?? '');
        $email = mysqli_real_escape_string($this->conn, $data['email'] ?? '');
        $address = mysqli_real_escape_string($this->conn, $data['address'] ?? '');
        $tax_number = mysqli_real_escape_string($this->conn, $data['tax_number'] ?? '');

        if (empty($name)) {
            $this->errorResponse('Name is required', 400);
        }

        $stmt = mysqli_prepare($this->conn, "UPDATE ar_customers SET name = ?, phone = ?, email = ?, address = ?, tax_number = ? WHERE id = ?");
        mysqli_stmt_bind_param($stmt, "sssssi", $name, $phone, $email, $address, $tax_number, $id);

        if (mysqli_stmt_execute($stmt)) {
            log_operation('UPDATE', 'ar_customers', $id, null, $data);
            $this->successResponse();
        } else {
            $this->errorResponse(mysqli_error($this->conn));
        }
    }

    private function deleteCustomer()
    {
        $id = intval($_GET['id'] ?? 0);

        // Check for transactions
        $checkSql = "SELECT COUNT(*) as count FROM ar_transactions WHERE customer_id = $id AND is_deleted = 0";
        $checkRes = mysqli_query($this->conn, $checkSql);
        $count = mysqli_fetch_assoc($checkRes)['count'];

        if ($count > 0) {
            $this->errorResponse('Cannot delete customer with active transactions', 400);
        }

        $stmt = mysqli_prepare($this->conn, "DELETE FROM ar_customers WHERE id = ?");
        mysqli_stmt_bind_param($stmt, "i", $id);

        if (mysqli_stmt_execute($stmt)) {
            log_operation('DELETE', 'ar_customers', $id);
            $this->successResponse();
        } else {
            $this->errorResponse(mysqli_error($this->conn));
        }
    }

    // --- Ledger/Transaction Methods ---

    private function getLedger()
    {
        $customer_id = intval($_GET['customer_id'] ?? 0);
        if ($customer_id === 0) {
            $this->errorResponse('Customer ID required', 400);
        }

        $params = $this->getPaginationParams();
        $limit = $params['limit'];
        $offset = $params['offset'];

        // Filters
        $search = isset($_GET['search']) ? mysqli_real_escape_string($this->conn, trim($_GET['search'])) : '';
        $type = isset($_GET['type']) ? mysqli_real_escape_string($this->conn, trim($_GET['type'])) : '';
        $date_from = isset($_GET['date_from']) ? mysqli_real_escape_string($this->conn, trim($_GET['date_from'])) : '';
        $date_to = isset($_GET['date_to']) ? mysqli_real_escape_string($this->conn, trim($_GET['date_to'])) : '';
        $show_deleted = isset($_GET['show_deleted']) && $_GET['show_deleted'] === 'true';

        $whereClause = "WHERE customer_id = $customer_id";
        if (!$show_deleted) {
            $whereClause .= " AND is_deleted = 0";
        }

        if (!empty($search)) {
            $whereClause .= " AND (description LIKE '%$search%' OR amount LIKE '%$search%')";
        }
        if (!empty($type)) {
            $whereClause .= " AND type = '$type'";
        }
        if (!empty($date_from)) {
            $whereClause .= " AND transaction_date >= '$date_from 00:00:00'";
        }
        if (!empty($date_to)) {
            $whereClause .= " AND transaction_date <= '$date_to 23:59:59'";
        }

        // Aggregation Stats
        $statsSql = "
            SELECT 
                SUM(CASE WHEN type = 'invoice' THEN amount ELSE 0 END) as total_debit,
                SUM(CASE WHEN type IN ('payment', 'return') THEN amount ELSE 0 END) as total_credit,
                COUNT(*) as transaction_count
            FROM ar_transactions 
            $whereClause
        ";
        $statsResult = mysqli_query($this->conn, $statsSql);
        $stats = mysqli_fetch_assoc($statsResult);
        $stats['balance'] = $stats['total_debit'] - $stats['total_credit'];


        // Fetch Rows
        $sql = "SELECT * FROM ar_transactions $whereClause ORDER BY transaction_date DESC LIMIT $limit OFFSET $offset";
        $result = mysqli_query($this->conn, $sql);

        $transactions = [];
        while ($row = mysqli_fetch_assoc($result)) {
            // Include details about the reference if needed (e.g. invoice items count?)
            // Requirement says "Sales entries must include full transactional details".
            // We can fetch them separately or click to view. 
            // "Clicking on any sales record to view the complete transaction information" -> Separate view/modal via invoice_id.
            $transactions[] = $row;
        }

        // Count for pagination
        $countSql = "SELECT COUNT(*) as total FROM ar_transactions $whereClause";
        $countRes = mysqli_query($this->conn, $countSql);
        $total = ($countRes && mysqli_num_rows($countRes) > 0) ? mysqli_fetch_assoc($countRes)['total'] : 0;

        $this->successResponse([
            'data' => $transactions,
            'pagination' => [
                'current_page' => $params['page'],
                'per_page' => $limit,
                'total_records' => $total,
                'total_pages' => ceil($total / $limit)
            ],
            'stats' => $stats
        ]);
    }

    private function createTransaction()
    {
        $data = $this->getJsonInput();

        $customer_id = intval($data['customer_id'] ?? 0);
        $type = mysqli_real_escape_string($this->conn, $data['type'] ?? 'payment'); // Usually 'payment' for manual entry
        $amount = floatval($data['amount'] ?? 0);
        $description = mysqli_real_escape_string($this->conn, $data['description'] ?? '');
        $date = mysqli_real_escape_string($this->conn, $data['date'] ?? date('Y-m-d H:i:s'));
        $user_id = $_SESSION['user_id'];

        if ($customer_id === 0 || $amount <= 0) {
            $this->errorResponse('Invalid data', 400);
        }

        mysqli_begin_transaction($this->conn);
        try {
            $stmt = mysqli_prepare($this->conn, "INSERT INTO ar_transactions (customer_id, type, amount, description, transaction_date, created_by) VALUES (?, ?, ?, ?, ?, ?)");
            mysqli_stmt_bind_param($stmt, "isdssi", $customer_id, $type, $amount, $description, $date, $user_id);
            mysqli_stmt_execute($stmt);
            $id = mysqli_insert_id($this->conn);

            // Update customer balance
            $this->updateCustomerBalance($customer_id);

            mysqli_commit($this->conn);
            log_operation('CREATE', 'ar_transactions', $id, null, $data);
            $this->successResponse(['id' => $id]);
        } catch (Exception $e) {
            mysqli_rollback($this->conn);
            $this->errorResponse($e->getMessage());
        }
    }

    private function deleteTransaction()
    {
        // Soft Delete
        $id = intval($_GET['id'] ?? 0);

        $stmt = mysqli_prepare($this->conn, "UPDATE ar_transactions SET is_deleted = 1, deleted_at = NOW() WHERE id = ?");
        mysqli_stmt_bind_param($stmt, "i", $id);

        if (mysqli_stmt_execute($stmt)) {
            // Update balance
            $res = mysqli_query($this->conn, "SELECT customer_id FROM ar_transactions WHERE id = $id");
            $row = mysqli_fetch_assoc($res);
            if ($row) $this->updateCustomerBalance($row['customer_id']);

            log_operation('DELETE', 'ar_transactions', $id); // Soft delete logged
            $this->successResponse();
        } else {
            $this->errorResponse(mysqli_error($this->conn));
        }
    }

    private function restoreTransaction()
    {
        $data = $this->getJsonInput();
        $id = intval($data['id'] ?? 0);

        $stmt = mysqli_prepare($this->conn, "UPDATE ar_transactions SET is_deleted = 0, deleted_at = NULL WHERE id = ?");
        mysqli_stmt_bind_param($stmt, "i", $id);

        if (mysqli_stmt_execute($stmt)) {
            // Update balance
            $res = mysqli_query($this->conn, "SELECT customer_id FROM ar_transactions WHERE id = $id");
            $row = mysqli_fetch_assoc($res);
            if ($row) $this->updateCustomerBalance($row['customer_id']);

            log_operation('RESTORE', 'ar_transactions', $id);
            $this->successResponse();
        } else {
            $this->errorResponse(mysqli_error($this->conn));
        }
    }

    private function updateTransaction()
    {
        $data = $this->getJsonInput();
        $id = intval($data['id'] ?? 0);
        $amount = floatval($data['amount'] ?? 0);
        $description = mysqli_real_escape_string($this->conn, $data['description'] ?? '');

        // Check time constraint (24-48h)
        $checkRes = mysqli_query($this->conn, "SELECT created_at, customer_id FROM ar_transactions WHERE id = $id");
        $row = mysqli_fetch_assoc($checkRes);
        if (!$row) $this->errorResponse('Transaction not found', 404);

        $created_time = strtotime($row['created_at']);
        if (time() - $created_time > 48 * 3600) {
            $this->errorResponse('Cannot edit transaction after 48 hours', 403);
        }

        mysqli_begin_transaction($this->conn);
        try {
            $stmt = mysqli_prepare($this->conn, "UPDATE ar_transactions SET amount = ?, description = ? WHERE id = ?");
            mysqli_stmt_bind_param($stmt, "dsi", $amount, $description, $id);
            mysqli_stmt_execute($stmt);

            $this->updateCustomerBalance($row['customer_id']);

            mysqli_commit($this->conn);
            log_operation('UPDATE', 'ar_transactions', $id, null, $data);
            $this->successResponse();
        } catch (Exception $e) {
            mysqli_rollback($this->conn);
            $this->errorResponse($e->getMessage());
        }
    }

    private function updateCustomerBalance($customer_id)
    {
        $sql = "
            UPDATE ar_customers 
            SET current_balance = (
                SELECT COALESCE(SUM(
                    CASE 
                        WHEN type = 'invoice' THEN amount 
                        WHEN type IN ('payment', 'return') THEN -amount 
                        ELSE 0 
                    END
                ), 0)
                FROM ar_transactions 
                WHERE customer_id = ? AND is_deleted = 0
            ) 
            WHERE id = ?
        ";
        $stmt = mysqli_prepare($this->conn, $sql);
        mysqli_stmt_bind_param($stmt, "ii", $customer_id, $customer_id);
        mysqli_stmt_execute($stmt);
        mysqli_stmt_close($stmt);
    }

    /**
     * Get customer statement with aging analysis
     */
    private function getCustomerStatement()
    {
        $customer_id = intval($_GET['customer_id'] ?? 0);
        $start_date = $_GET['start_date'] ?? null;
        $end_date = $_GET['end_date'] ?? date('Y-m-d');

        if ($customer_id <= 0) {
            $this->errorResponse('Customer ID is required');
        }

        // Get customer info
        $customer_result = mysqli_query($this->conn, "SELECT * FROM ar_customers WHERE id = $customer_id");
        $customer = mysqli_fetch_assoc($customer_result);

        if (!$customer) {
            $this->errorResponse('Customer not found', 404);
        }

        // Build date filter
        $date_filter = "";
        if ($start_date) {
            $start_esc = mysqli_real_escape_string($this->conn, $start_date);
            $date_filter = "AND t.transaction_date >= '$start_esc'";
        }
        $end_esc = mysqli_real_escape_string($this->conn, $end_date);
        $date_filter .= " AND t.transaction_date <= '$end_esc'";

        // Get opening balance
        $opening_balance = 0;
        if ($start_date) {
            $opening_result = mysqli_query(
                $this->conn,
                "SELECT 
                    SUM(CASE WHEN type = 'invoice' THEN amount ELSE 0 END) as total_debit,
                    SUM(CASE WHEN type IN ('payment', 'return') THEN amount ELSE 0 END) as total_credit
                 FROM ar_transactions
                 WHERE customer_id = $customer_id AND is_deleted = 0 AND transaction_date < '$start_esc'"
            );
            if ($opening_result && mysqli_num_rows($opening_result) > 0) {
                $opening_row = mysqli_fetch_assoc($opening_result);
                $opening_balance = floatval($opening_row['total_debit'] ?? 0) - floatval($opening_row['total_credit'] ?? 0);
            }
        }

        // Get transactions
        $result = mysqli_query(
            $this->conn,
            "SELECT t.*, u.username as created_by_name,
                    i.invoice_number, i.total_amount as invoice_total
             FROM ar_transactions t
             LEFT JOIN users u ON t.created_by = u.id
             LEFT JOIN invoices i ON t.reference_type = 'invoices' AND t.reference_id = i.id
             WHERE t.customer_id = $customer_id AND t.is_deleted = 0 $date_filter
             ORDER BY t.transaction_date ASC, t.id ASC"
        );

        $transactions = [];
        $running_balance = $opening_balance;

        while ($row = mysqli_fetch_assoc($result)) {
            $amount = floatval($row['amount']);

            if ($row['type'] === 'invoice') {
                $running_balance += $amount;
            } else {
                $running_balance -= $amount;
            }

            // Calculate days outstanding for invoices
            $days_outstanding = null;
            if ($row['type'] === 'invoice') {
                $days_outstanding = (time() - strtotime($row['transaction_date'])) / 86400;
            }

            $transactions[] = [
                'id' => intval($row['id']),
                'type' => $row['type'],
                'amount' => $amount,
                'description' => $row['description'],
                'transaction_date' => $row['transaction_date'],
                'reference_type' => $row['reference_type'],
                'reference_id' => $row['reference_id'],
                'invoice_number' => $row['invoice_number'],
                'invoice_total' => $row['invoice_total'] ? floatval($row['invoice_total']) : null,
                'running_balance' => $running_balance,
                'days_outstanding' => $days_outstanding ? intval($days_outstanding) : null,
                'created_by_name' => $row['created_by_name']
            ];
        }

        // Calculate aging
        $aging_result = mysqli_query(
            $this->conn,
            "SELECT 
                SUM(CASE WHEN transaction_date >= DATE_SUB('$end_esc', INTERVAL 30 DAY) THEN amount ELSE 0 END) as current,
                SUM(CASE WHEN transaction_date >= DATE_SUB('$end_esc', INTERVAL 60 DAY) 
                         AND transaction_date < DATE_SUB('$end_esc', INTERVAL 30 DAY) THEN amount ELSE 0 END) as days_30_60,
                SUM(CASE WHEN transaction_date >= DATE_SUB('$end_esc', INTERVAL 90 DAY) 
                         AND transaction_date < DATE_SUB('$end_esc', INTERVAL 60 DAY) THEN amount ELSE 0 END) as days_60_90,
                SUM(CASE WHEN transaction_date < DATE_SUB('$end_esc', INTERVAL 90 DAY) THEN amount ELSE 0 END) as over_90
             FROM ar_transactions
             WHERE customer_id = $customer_id AND type = 'invoice' AND is_deleted = 0
             AND transaction_date <= '$end_esc'"
        );

        $aging = mysqli_fetch_assoc($aging_result);

        $this->successResponse([
            'customer' => $customer,
            'period' => [
                'start_date' => $start_date,
                'end_date' => $end_date
            ],
            'opening_balance' => $opening_balance,
            'closing_balance' => $running_balance,
            'transactions' => $transactions,
            'aging' => [
                'current' => floatval($aging['current'] ?? 0),
                'days_30_60' => floatval($aging['days_30_60'] ?? 0),
                'days_60_90' => floatval($aging['days_60_90'] ?? 0),
                'over_90' => floatval($aging['over_90'] ?? 0),
                'total' => floatval($customer['current_balance'])
            ]
        ]);
    }
}
