<?php

require_once __DIR__ . '/Controller.php';
require_once __DIR__ . '/../Services/LedgerService.php';
require_once __DIR__ . '/../Services/ChartOfAccountsMappingService.php';
require_once __DIR__ . '/../Services/PermissionService.php';

class RevenuesController extends Controller
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

        PermissionService::requirePermission('revenues', 'view');

        $method = $_SERVER['REQUEST_METHOD'];

        if ($method === 'GET') {
            $this->getRevenues();
        } elseif ($method === 'POST') {
            PermissionService::requirePermission('revenues', 'create');
            $this->createRevenue();
        } elseif ($method === 'PUT') {
            PermissionService::requirePermission('revenues', 'edit');
            $this->updateRevenue();
        } elseif ($method === 'DELETE') {
            PermissionService::requirePermission('revenues', 'delete');
            $this->deleteRevenue();
        }
    }

    private function getRevenues()
    {
        $params = $this->getPaginationParams();
        $limit = $params['limit'];
        $offset = $params['offset'];
        $search = isset($_GET['search']) ? trim($_GET['search']) : '';

        $whereClause = "";
        if (!empty($search)) {
            $searchSafe = mysqli_real_escape_string($this->conn, $search);
            $whereClause = "WHERE source LIKE '%$searchSafe%' OR description LIKE '%$searchSafe%'";
        }

        // Total count
        $countSql = "SELECT COUNT(*) as total FROM revenues $whereClause";
        $countResult = mysqli_query($this->conn, $countSql);
        $total = mysqli_fetch_assoc($countResult)['total'];

        $sql = "
            SELECT r.*, u.username as recorder_name
            FROM revenues r
            LEFT JOIN users u ON r.user_id = u.id
            $whereClause
            ORDER BY r.revenue_date DESC, r.id DESC
            LIMIT $limit OFFSET $offset
        ";

        $result = mysqli_query($this->conn, $sql);
        if (!$result) {
            $this->errorResponse(mysqli_error($this->conn));
            return;
        }

        $revenues = [];
        while ($row = mysqli_fetch_assoc($result)) {
            $revenues[] = $row;
        }
        $this->paginatedResponse($revenues, $total, $params['page'], $params['limit']);
    }

    private function createRevenue()
    {
        $data = $this->getJsonInput();

        $source = $data['source'] ?? '';
        $amount = floatval($data['amount'] ?? 0);
        $revenue_date = $data['revenue_date'] ?? date('Y-m-d');
        $description = $data['description'] ?? '';
        $accounts = $this->coaMapping->getStandardAccounts();
        $account_code = $data['account_code'] ?? $accounts['other_revenue']; // Default to Other Revenues
        $user_id = $_SESSION['user_id'];

        if (empty($source) || $amount <= 0) {
            $this->errorResponse('Source and positive amount required');
        }

        mysqli_begin_transaction($this->conn);

        try {
            $stmt = mysqli_prepare($this->conn, "INSERT INTO revenues (source, amount, revenue_date, description, user_id) VALUES (?, ?, ?, ?, ?)");
            mysqli_stmt_bind_param($stmt, "sdssi", $source, $amount, $revenue_date, $description, $user_id);
            mysqli_stmt_execute($stmt);
            $id = mysqli_insert_id($this->conn);
            mysqli_stmt_close($stmt);

            // Post to General Ledger - Double Entry
            $voucher_number = $this->ledgerService->getNextVoucherNumber('REV');

            $accounts = $this->coaMapping->getStandardAccounts();
            $gl_entries = [
                [
                    'account_code' => $accounts['cash'], // Cash
                    'entry_type' => 'DEBIT',
                    'amount' => $amount,
                    'description' => "إيراد - $source"
                ],
                [
                    'account_code' => $account_code, // Revenue account
                    'entry_type' => 'CREDIT',
                    'amount' => $amount,
                    'description' => "$source - $description"
                ]
            ];

            $this->ledgerService->postTransaction($gl_entries, 'revenues', $id, $voucher_number, $revenue_date);

            mysqli_commit($this->conn);
            log_operation('CREATE', 'revenues', $id, null, $data);
            $this->successResponse(['id' => $id, 'voucher_number' => $voucher_number]);
        } catch (Exception $e) {
            mysqli_rollback($this->conn);
            $this->errorResponse($e->getMessage());
        }
    }

    private function updateRevenue()
    {
        $data = $this->getJsonInput();
        $id = intval($data['id'] ?? 0);

        $source = $data['source'] ?? '';
        $amount = floatval($data['amount'] ?? 0);
        $revenue_date = $data['revenue_date'] ?? date('Y-m-d H:i:s');
        $description = $data['description'] ?? '';

        if (empty($source) || $amount <= 0) {
            $this->errorResponse('Source and positive amount required');
        }

        // Get old values for logging
        $old_res = mysqli_query($this->conn, "SELECT * FROM revenues WHERE id = $id");
        $old_data = mysqli_fetch_assoc($old_res);

        $stmt = mysqli_prepare($this->conn, "UPDATE revenues SET source = ?, amount = ?, revenue_date = ?, description = ? WHERE id = ?");
        mysqli_stmt_bind_param($stmt, "sdssi", $source, $amount, $revenue_date, $description, $id);

        if (mysqli_stmt_execute($stmt)) {
            log_operation('UPDATE', 'revenues', $id, $old_data, $data);
            $this->successResponse();
        } else {
            $this->errorResponse('Failed to update revenue');
        }
    }

    private function deleteRevenue()
    {
        $id = intval($_GET['id'] ?? 0);

        // Get old values for logging
        $old_res = mysqli_query($this->conn, "SELECT * FROM revenues WHERE id = $id");
        $old_data = mysqli_fetch_assoc($old_res);

        $stmt = mysqli_prepare($this->conn, "DELETE FROM revenues WHERE id = ?");
        mysqli_stmt_bind_param($stmt, "i", $id);

        if (mysqli_stmt_execute($stmt)) {
            log_operation('DELETE', 'revenues', $id, $old_data);
            $this->successResponse();
        } else {
            $this->errorResponse('Failed to delete revenue');
        }
    }
}
