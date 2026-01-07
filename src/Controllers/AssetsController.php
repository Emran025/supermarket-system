<?php

require_once __DIR__ . '/Controller.php';
require_once __DIR__ . '/../Services/LedgerService.php';
require_once __DIR__ . '/../Services/DepreciationService.php';

class AssetsController extends Controller
{
    private $ledgerService;
    private $depreciationService;

    public function __construct()
    {
        parent::__construct();
        $this->ledgerService = new LedgerService();
        $this->depreciationService = new DepreciationService();
    }

    public function handle()
    {
        if (!is_logged_in()) {
            $this->errorResponse('Unauthorized', 401);
        }

        $method = $_SERVER['REQUEST_METHOD'];
        $action = $_GET['action'] ?? '';

        // ALM-003: Depreciation automation endpoint
        if ($action === 'calculate_depreciation' && $method === 'POST') {
            $this->calculateDepreciation();
            return;
        }

        if ($method === 'GET') {
            $this->getAssets();
        } elseif ($method === 'POST') {
            $this->createAsset();
        } elseif ($method === 'PUT') {
            $this->updateAsset();
        } elseif ($method === 'DELETE') {
            $this->deleteAsset();
        }
    }

    private function getAssets()
    {
        $params = $this->getPaginationParams();
        $limit = $params['limit'];
        $offset = $params['offset'];
        $search = isset($_GET['search']) ? trim($_GET['search']) : '';

        $whereClause = "";
        if (!empty($search)) {
            $searchSafe = mysqli_real_escape_string($this->conn, $search);
            $whereClause = "WHERE name LIKE '%$searchSafe%' OR description LIKE '%$searchSafe%' OR status LIKE '%$searchSafe%'";
        }

        // Total count
        $countSql = "SELECT COUNT(*) as total FROM assets $whereClause";
        $countResult = mysqli_query($this->conn, $countSql);
        $total = mysqli_fetch_assoc($countResult)['total'];

        $sql = "
            SELECT a.*, u.username as recorder_name
            FROM assets a
            LEFT JOIN users u ON a.created_by = u.id
            $whereClause
            ORDER BY a.purchase_date DESC, a.id DESC
            LIMIT $limit OFFSET $offset
        ";

        $result = mysqli_query($this->conn, $sql);
        if (!$result) {
            $this->errorResponse(mysqli_error($this->conn));
            return;
        }

        $assets = [];
        while ($row = mysqli_fetch_assoc($result)) {
            $assets[] = $row;
        }
        $this->paginatedResponse($assets, $total, $params['page'], $params['limit']);
    }

    private function createAsset()
    {
        $data = $this->getJsonInput();

        $name = $data['name'] ?? '';
        $value = floatval($data['value'] ?? 0);
        $purchase_date = $data['purchase_date'] ?? date('Y-m-d');
        $depreciation_rate = floatval($data['depreciation_rate'] ?? 0);
        $description = $data['description'] ?? '';
        $status = $data['status'] ?? 'active';
        $user_id = $_SESSION['user_id'];

        if (empty($name) || $value <= 0) {
            $this->errorResponse('Asset name and positive value required');
        }

        mysqli_begin_transaction($this->conn);

        try {
            $stmt = mysqli_prepare($this->conn, "INSERT INTO assets (name, value, purchase_date, depreciation_rate, description, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)");
            mysqli_stmt_bind_param($stmt, "sdssssi", $name, $value, $purchase_date, $depreciation_rate, $description, $status, $user_id);
            mysqli_stmt_execute($stmt);
            $id = mysqli_insert_id($this->conn);
            mysqli_stmt_close($stmt);

            // Post to General Ledger - Double Entry
            $voucher_number = $this->ledgerService->getNextVoucherNumber('VOU');

            $gl_entries = [
                [
                    'account_code' => '1210', // Fixed Assets
                    'entry_type' => 'DEBIT',
                    'amount' => $value,
                    'description' => "شراء أصل ثابت - $name"
                ],
                [
                    'account_code' => '1110', // Cash (assuming cash purchase, could be AP)
                    'entry_type' => 'CREDIT',
                    'amount' => $value,
                    'description' => "دفع مقابل شراء أصل - $name"
                ]
            ];

            $this->ledgerService->postTransaction($gl_entries, 'assets', $id, $voucher_number, $purchase_date);

            mysqli_commit($this->conn);
            log_operation('CREATE', 'assets', $id, null, $data);
            $this->successResponse(['id' => $id, 'voucher_number' => $voucher_number]);
        } catch (Exception $e) {
            mysqli_rollback($this->conn);
            $this->errorResponse($e->getMessage());
        }
    }

    private function updateAsset()
    {
        $data = $this->getJsonInput();
        $id = intval($data['id'] ?? 0);

        $name = $data['name'] ?? '';
        $value = floatval($data['value'] ?? 0);
        $purchase_date = $data['purchase_date'] ?? date('Y-m-d');
        $depreciation_rate = floatval($data['depreciation_rate'] ?? 0);
        $description = $data['description'] ?? '';
        $status = $data['status'] ?? 'active';

        if (empty($name) || $value <= 0) {
            $this->errorResponse('Asset name and positive value required');
        }

        // Get old values for logging
        $old_res = mysqli_query($this->conn, "SELECT * FROM assets WHERE id = $id");
        $old_data = mysqli_fetch_assoc($old_res);

        $stmt = mysqli_prepare($this->conn, "UPDATE assets SET name = ?, value = ?, purchase_date = ?, depreciation_rate = ?, description = ?, status = ? WHERE id = ?");
        mysqli_stmt_bind_param($stmt, "sdssssi", $name, $value, $purchase_date, $depreciation_rate, $description, $status, $id);

        if (mysqli_stmt_execute($stmt)) {
            log_operation('UPDATE', 'assets', $id, $old_data, $data);
            $this->successResponse();
        } else {
            $this->errorResponse('Failed to update asset');
        }
    }

    private function deleteAsset()
    {
        $id = intval($_GET['id'] ?? 0);

        // Get old values for logging
        $old_res = mysqli_query($this->conn, "SELECT * FROM assets WHERE id = $id");
        $old_data = mysqli_fetch_assoc($old_res);

        $stmt = mysqli_prepare($this->conn, "DELETE FROM assets WHERE id = ?");
        mysqli_stmt_bind_param($stmt, "i", $id);

        if (mysqli_stmt_execute($stmt)) {
            log_operation('DELETE', 'assets', $id, $old_data);
            $this->successResponse();
        } else {
            $this->errorResponse('Failed to delete asset');
        }
    }

    /**
     * ALM-003: Calculate and record monthly depreciation for all active assets
     */
    private function calculateDepreciation()
    {
        $data = $this->getJsonInput();
        $fiscal_period_id = isset($data['fiscal_period_id']) ? intval($data['fiscal_period_id']) : null;

        try {
            $depreciations = $this->depreciationService->calculateMonthlyDepreciation($fiscal_period_id);

            $this->successResponse([
                'message' => 'Depreciation calculated successfully',
                'depreciations' => $depreciations,
                'count' => count($depreciations)
            ]);
        } catch (Exception $e) {
            $this->errorResponse('Failed to calculate depreciation: ' . $e->getMessage());
        }
    }
}
