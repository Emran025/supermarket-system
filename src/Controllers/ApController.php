<?php

require_once __DIR__ . '/Controller.php';
require_once __DIR__ . '/../Services/LedgerService.php';
require_once __DIR__ . '/../Services/ChartOfAccountsMappingService.php';

class ApController extends Controller
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

        $action = $_GET['action'] ?? 'suppliers';
        $method = $_SERVER['REQUEST_METHOD'];

        if ($action === 'suppliers') {
            if ($method === 'GET') {
                $this->getSuppliers();
            } elseif ($method === 'POST') {
                $this->createSupplier();
            } elseif ($method === 'PUT') {
                $this->updateSupplier();
            } elseif ($method === 'DELETE') {
                $this->deleteSupplier();
            }
        } elseif ($action === 'transactions') {
            if ($method === 'GET') {
                $this->getTransactions();
            } elseif ($method === 'POST') {
                $this->createTransaction();
            }
        } elseif ($action === 'payments') {
            if ($method === 'POST') {
                $this->recordPayment();
            }
        } elseif ($action === 'ledger') {
            if ($method === 'GET') {
                $this->getSupplierLedger();
            }
        }
    }

    private function getSuppliers()
    {
        $params = $this->getPaginationParams();
        $limit = $params['limit'];
        $offset = $params['offset'];
        $search = isset($_GET['search']) ? trim($_GET['search']) : '';

        $whereClause = "";
        if (!empty($search)) {
            $searchSafe = mysqli_real_escape_string($this->conn, $search);
            $whereClause = "WHERE name LIKE '%$searchSafe%' OR phone LIKE '%$searchSafe%'";
        }

        $countSql = "SELECT COUNT(*) as total FROM ap_suppliers $whereClause";
        $countResult = mysqli_query($this->conn, $countSql);
        $total = mysqli_fetch_assoc($countResult)['total'];

        $sql = "
            SELECT s.*, u.username as creator_name
            FROM ap_suppliers s
            LEFT JOIN users u ON s.created_by = u.id
            $whereClause
            ORDER BY s.name ASC
            LIMIT $limit OFFSET $offset
        ";

        $result = mysqli_query($this->conn, $sql);
        $suppliers = [];
        while ($row = mysqli_fetch_assoc($result)) {
            $suppliers[] = $row;
        }

        $this->paginatedResponse($suppliers, $total, $params['page'], $params['limit']);
    }

    private function createSupplier()
    {
        $data = $this->getJsonInput();

        $name = mysqli_real_escape_string($this->conn, $data['name'] ?? '');
        $phone = mysqli_real_escape_string($this->conn, $data['phone'] ?? '');
        $email = mysqli_real_escape_string($this->conn, $data['email'] ?? '');
        $address = mysqli_real_escape_string($this->conn, $data['address'] ?? '');
        $tax_number = mysqli_real_escape_string($this->conn, $data['tax_number'] ?? '');
        $credit_limit = floatval($data['credit_limit'] ?? 0);
        $payment_terms = intval($data['payment_terms'] ?? 30);
        $user_id = $_SESSION['user_id'];

        if (empty($name)) {
            $this->errorResponse('Supplier name is required');
        }

        $stmt = mysqli_prepare(
            $this->conn,
            "INSERT INTO ap_suppliers (name, phone, email, address, tax_number, credit_limit, payment_terms, created_by) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        );
        mysqli_stmt_bind_param($stmt, "sssssddi", $name, $phone, $email, $address, $tax_number, $credit_limit, $payment_terms, $user_id);

        if (mysqli_stmt_execute($stmt)) {
            $id = mysqli_insert_id($this->conn);
            log_operation('CREATE', 'ap_suppliers', $id, null, $data);
            $this->successResponse(['id' => $id]);
        } else {
            $this->errorResponse('Failed to create supplier');
        }
    }

    private function updateSupplier()
    {
        $data = $this->getJsonInput();
        $id = intval($data['id'] ?? 0);

        $name = mysqli_real_escape_string($this->conn, $data['name'] ?? '');
        $phone = mysqli_real_escape_string($this->conn, $data['phone'] ?? '');
        $email = mysqli_real_escape_string($this->conn, $data['email'] ?? '');
        $address = mysqli_real_escape_string($this->conn, $data['address'] ?? '');
        $tax_number = mysqli_real_escape_string($this->conn, $data['tax_number'] ?? '');
        $credit_limit = floatval($data['credit_limit'] ?? 0);
        $payment_terms = intval($data['payment_terms'] ?? 30);

        if (empty($name)) {
            $this->errorResponse('Supplier name is required');
        }

        $old_res = mysqli_query($this->conn, "SELECT * FROM ap_suppliers WHERE id = $id");
        $old_data = mysqli_fetch_assoc($old_res);

        $stmt = mysqli_prepare(
            $this->conn,
            "UPDATE ap_suppliers SET name = ?, phone = ?, email = ?, address = ?, tax_number = ?, credit_limit = ?, payment_terms = ? WHERE id = ?"
        );
        mysqli_stmt_bind_param($stmt, "sssssddi", $name, $phone, $email, $address, $tax_number, $credit_limit, $payment_terms, $id);

        if (mysqli_stmt_execute($stmt)) {
            log_operation('UPDATE', 'ap_suppliers', $id, $old_data, $data);
            $this->successResponse();
        } else {
            $this->errorResponse('Failed to update supplier');
        }
    }

    private function deleteSupplier()
    {
        $id = intval($_GET['id'] ?? 0);

        $old_res = mysqli_query($this->conn, "SELECT * FROM ap_suppliers WHERE id = $id");
        $old_data = mysqli_fetch_assoc($old_res);

        $stmt = mysqli_prepare($this->conn, "DELETE FROM ap_suppliers WHERE id = ?");
        mysqli_stmt_bind_param($stmt, "i", $id);

        if (mysqli_stmt_execute($stmt)) {
            log_operation('DELETE', 'ap_suppliers', $id, $old_data);
            $this->successResponse();
        } else {
            $this->errorResponse('Failed to delete supplier');
        }
    }

    private function getTransactions()
    {
        $supplier_id = intval($_GET['supplier_id'] ?? 0);

        if ($supplier_id <= 0) {
            $this->errorResponse('Supplier ID is required');
        }

        $result = mysqli_query(
            $this->conn,
            "SELECT t.*, u.username as creator_name 
             FROM ap_transactions t 
             LEFT JOIN users u ON t.created_by = u.id 
             WHERE t.supplier_id = $supplier_id AND t.is_deleted = 0 
             ORDER BY t.transaction_date DESC"
        );

        $transactions = [];
        while ($row = mysqli_fetch_assoc($result)) {
            $transactions[] = $row;
        }

        $this->successResponse(['data' => $transactions]);
    }

    private function createTransaction()
    {
        $data = $this->getJsonInput();

        $supplier_id = intval($data['supplier_id'] ?? 0);
        $type = mysqli_real_escape_string($this->conn, $data['type'] ?? 'invoice');
        $amount = floatval($data['amount'] ?? 0);
        $description = mysqli_real_escape_string($this->conn, $data['description'] ?? '');
        $reference_type = mysqli_real_escape_string($this->conn, $data['reference_type'] ?? '');
        $reference_id = intval($data['reference_id'] ?? 0);
        $user_id = $_SESSION['user_id'];

        if ($supplier_id <= 0 || $amount <= 0) {
            $this->errorResponse('Valid supplier ID and positive amount required');
        }

        $stmt = mysqli_prepare(
            $this->conn,
            "INSERT INTO ap_transactions (supplier_id, type, amount, description, reference_type, reference_id, created_by) 
             VALUES (?, ?, ?, ?, ?, ?, ?)"
        );
        mysqli_stmt_bind_param($stmt, "isdsisi", $supplier_id, $type, $amount, $description, $reference_type, $reference_id, $user_id);

        if (mysqli_stmt_execute($stmt)) {
            $id = mysqli_insert_id($this->conn);
            $this->updateSupplierBalance($supplier_id);
            log_operation('CREATE', 'ap_transactions', $id, null, $data);
            $this->successResponse(['id' => $id]);
        } else {
            $this->errorResponse('Failed to create transaction');
        }
    }

    private function recordPayment()
    {
        $data = $this->getJsonInput();

        $supplier_id = intval($data['supplier_id'] ?? 0);
        $amount = floatval($data['amount'] ?? 0);
        $description = mysqli_real_escape_string($this->conn, $data['description'] ?? '');
        $user_id = $_SESSION['user_id'];

        if ($supplier_id <= 0 || $amount <= 0) {
            $this->errorResponse('Valid supplier ID and positive amount required');
        }

        mysqli_begin_transaction($this->conn);

        try {
            // Record payment in AP transactions
            $stmt = mysqli_prepare(
                $this->conn,
                "INSERT INTO ap_transactions (supplier_id, type, amount, description, created_by) 
                 VALUES (?, 'payment', ?, ?, ?)"
            );
            mysqli_stmt_bind_param($stmt, "idsi", $supplier_id, $amount, $description, $user_id);
            mysqli_stmt_execute($stmt);
            $transaction_id = mysqli_insert_id($this->conn);
            mysqli_stmt_close($stmt);

            // Update supplier balance
            $this->updateSupplierBalance($supplier_id);

            // Post to General Ledger
            $accounts = $this->coaMapping->getStandardAccounts();
            $voucher_number = $this->ledgerService->getNextVoucherNumber('VOU');

            $gl_entries = [
                [
                    'account_code' => $accounts['accounts_payable'],
                    'entry_type' => 'DEBIT',
                    'amount' => $amount,
                    'description' => "دفع للمورد - $description"
                ],
                [
                    'account_code' => $accounts['cash'],
                    'entry_type' => 'CREDIT',
                    'amount' => $amount,
                    'description' => "دفع نقدي للمورد"
                ]
            ];

            $this->ledgerService->postTransaction($gl_entries, 'ap_transactions', $transaction_id, $voucher_number);

            mysqli_commit($this->conn);
            log_operation('CREATE', 'ap_transactions', $transaction_id, null, $data);
            $this->successResponse(['id' => $transaction_id, 'voucher_number' => $voucher_number]);
        } catch (Exception $e) {
            mysqli_rollback($this->conn);
            $this->errorResponse($e->getMessage());
        }
    }

    private function updateSupplierBalance($supplier_id)
    {
        $sql = "
            UPDATE ap_suppliers 
            SET current_balance = (
                SELECT COALESCE(SUM(
                    CASE 
                        WHEN type = 'invoice' THEN amount 
                        WHEN type IN ('payment', 'return') THEN -amount 
                        ELSE 0 
                    END
                ), 0)
                FROM ap_transactions 
                WHERE supplier_id = ? AND is_deleted = 0
            ) 
            WHERE id = ?
        ";
        $stmt = mysqli_prepare($this->conn, $sql);
        mysqli_stmt_bind_param($stmt, "ii", $supplier_id, $supplier_id);
        mysqli_stmt_execute($stmt);
        mysqli_stmt_close($stmt);
    }

    /**
     * Get supplier ledger with transaction history and aging
     */
    private function getSupplierLedger()
    {
        $supplier_id = intval($_GET['supplier_id'] ?? 0);

        if ($supplier_id <= 0) {
            $this->errorResponse('Supplier ID is required');
        }

        $params = $this->getPaginationParams();
        $limit = $params['limit'];
        $offset = $params['offset'];

        // Get supplier info
        $supplier_result = mysqli_query($this->conn, "SELECT * FROM ap_suppliers WHERE id = $supplier_id");
        $supplier = mysqli_fetch_assoc($supplier_result);

        if (!$supplier) {
            $this->errorResponse('Supplier not found', 404);
        }

        // Get transactions
        $result = mysqli_query(
            $this->conn,
            "SELECT t.*, u.username as created_by_name
             FROM ap_transactions t
             LEFT JOIN users u ON t.created_by = u.id
             WHERE t.supplier_id = $supplier_id AND t.is_deleted = 0
             ORDER BY t.transaction_date DESC, t.id DESC
             LIMIT $limit OFFSET $offset"
        );

        $transactions = [];
        $running_balance = floatval($supplier['current_balance']);

        while ($row = mysqli_fetch_assoc($result)) {
            $amount = floatval($row['amount']);

            // Calculate running balance (reverse order for display)
            if ($row['type'] === 'invoice') {
                $running_balance -= $amount; // Going backwards
            } else {
                $running_balance += $amount;
            }

            // Calculate days outstanding
            $days_outstanding = (time() - strtotime($row['transaction_date'])) / 86400;

            $transactions[] = [
                'id' => intval($row['id']),
                'type' => $row['type'],
                'amount' => $amount,
                'description' => $row['description'],
                'transaction_date' => $row['transaction_date'],
                'reference_type' => $row['reference_type'],
                'reference_id' => $row['reference_id'],
                'running_balance' => $running_balance,
                'days_outstanding' => intval($days_outstanding),
                'created_by_name' => $row['created_by_name'],
                'created_at' => $row['created_at']
            ];
        }

        // Calculate aging buckets
        $as_of_date = date('Y-m-d');
        $aging_result = mysqli_query(
            $this->conn,
            "SELECT 
                SUM(CASE WHEN transaction_date >= DATE_SUB('$as_of_date', INTERVAL 30 DAY) THEN amount ELSE 0 END) as current,
                SUM(CASE WHEN transaction_date >= DATE_SUB('$as_of_date', INTERVAL 60 DAY) 
                         AND transaction_date < DATE_SUB('$as_of_date', INTERVAL 30 DAY) THEN amount ELSE 0 END) as days_30_60,
                SUM(CASE WHEN transaction_date >= DATE_SUB('$as_of_date', INTERVAL 90 DAY) 
                         AND transaction_date < DATE_SUB('$as_of_date', INTERVAL 60 DAY) THEN amount ELSE 0 END) as days_60_90,
                SUM(CASE WHEN transaction_date < DATE_SUB('$as_of_date', INTERVAL 90 DAY) THEN amount ELSE 0 END) as over_90
             FROM ap_transactions
             WHERE supplier_id = $supplier_id AND type = 'invoice' AND is_deleted = 0"
        );

        $aging = mysqli_fetch_assoc($aging_result);

        $countResult = mysqli_query(
            $this->conn,
            "SELECT COUNT(*) as total FROM ap_transactions WHERE supplier_id = $supplier_id AND is_deleted = 0"
        );
        $total = mysqli_fetch_assoc($countResult)['total'];

        $this->paginatedResponse([
            'supplier' => $supplier,
            'transactions' => array_reverse($transactions), // Reverse to show chronological order
            'aging' => [
                'current' => floatval($aging['current'] ?? 0),
                'days_30_60' => floatval($aging['days_30_60'] ?? 0),
                'days_60_90' => floatval($aging['days_60_90'] ?? 0),
                'over_90' => floatval($aging['over_90'] ?? 0),
                'total' => floatval($supplier['current_balance'])
            ]
        ], $total, $params['page'], $params['limit']);
    }
}
