<?php

require_once __DIR__ . '/Controller.php';
require_once __DIR__ . '/../Services/LedgerService.php';
require_once __DIR__ . '/../Services/ChartOfAccountsMappingService.php';
require_once __DIR__ . '/../Services/PermissionService.php';

class PeriodicInventoryController extends Controller
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

        PermissionService::requirePermission('products', 'view');

        $method = $_SERVER['REQUEST_METHOD'];

        if ($method === 'GET') {
            $this->getInventoryCounts();
        } elseif ($method === 'POST') {
            $this->createInventoryCount();
        } elseif ($method === 'PUT') {
            $this->processPeriodicInventory();
        }
    }

    private function getInventoryCounts()
    {
        $params = $this->getPaginationParams();
        $limit = $params['limit'];
        $offset = $params['offset'];
        $period_id = $_GET['period_id'] ?? null;

        $where = "WHERE 1=1";
        if ($period_id) {
            $period_esc = intval($period_id);
            $where .= " AND fiscal_period_id = $period_esc";
        }

        $result = mysqli_query(
            $this->conn,
            "SELECT ic.*, p.name as product_name, fp.period_name, u.username as counted_by_name
             FROM inventory_counts ic
             LEFT JOIN products p ON ic.product_id = p.id
             LEFT JOIN fiscal_periods fp ON ic.fiscal_period_id = fp.id
             LEFT JOIN users u ON ic.counted_by = u.id
             $where
             ORDER BY ic.count_date DESC, ic.id DESC
             LIMIT $limit OFFSET $offset"
        );

        $counts = [];
        while ($row = mysqli_fetch_assoc($result)) {
            $counts[] = $row;
        }

        $countResult = mysqli_query($this->conn, "SELECT COUNT(*) as total FROM inventory_counts $where");
        $total = mysqli_fetch_assoc($countResult)['total'];

        $this->paginatedResponse($counts, $total, $params['page'], $params['limit']);
    }

    private function createInventoryCount()
    {
        $data = $this->getJsonInput();

        $product_id = intval($data['product_id'] ?? 0);
        $counted_quantity = intval($data['counted_quantity'] ?? 0);
        $count_date = mysqli_real_escape_string($this->conn, $data['count_date'] ?? date('Y-m-d'));
        $fiscal_period_id = intval($data['fiscal_period_id'] ?? 0);
        $notes = mysqli_real_escape_string($this->conn, $data['notes'] ?? '');

        if ($product_id <= 0 || $counted_quantity < 0) {
            $this->errorResponse('Valid product ID and non-negative quantity required');
        }

        if ($fiscal_period_id <= 0) {
            $this->errorResponse('Fiscal period is required');
        }

        $user_id = $_SESSION['user_id'];

        // Get current book quantity
        $result = mysqli_query($this->conn, "SELECT stock_quantity FROM products WHERE id = $product_id");
        $product = mysqli_fetch_assoc($result);
        if (!$product) {
            $this->errorResponse('Product not found', 404);
        }

        $book_quantity = intval($product['stock_quantity']);
        $variance = $counted_quantity - $book_quantity;

        $stmt = mysqli_prepare(
            $this->conn,
            "INSERT INTO inventory_counts (product_id, fiscal_period_id, count_date, book_quantity, counted_quantity, variance, notes, counted_by) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        );
        mysqli_stmt_bind_param($stmt, "iisiiisi", $product_id, $fiscal_period_id, $count_date, $book_quantity, $counted_quantity, $variance, $notes, $user_id);

        if (mysqli_stmt_execute($stmt)) {
            $id = mysqli_insert_id($this->conn);
            mysqli_stmt_close($stmt);

            log_operation('CREATE', 'inventory_counts', $id, null, $data);
            $this->successResponse([
                'id' => $id,
                'book_quantity' => $book_quantity,
                'variance' => $variance
            ]);
        } else {
            mysqli_stmt_close($stmt);
            $this->errorResponse('Failed to create inventory count');
        }
    }

    private function processPeriodicInventory()
    {
        $data = $this->getJsonInput();
        $fiscal_period_id = intval($data['fiscal_period_id'] ?? 0);

        if ($fiscal_period_id <= 0) {
            $this->errorResponse('Fiscal period is required');
        }

        // Get all inventory counts for this period
        $result = mysqli_query(
            $this->conn,
            "SELECT ic.*, p.weighted_average_cost, p.name as product_name
             FROM inventory_counts ic
             JOIN products p ON ic.product_id = p.id
             WHERE ic.fiscal_period_id = $fiscal_period_id AND ic.is_processed = 0"
        );

        $counts = [];
        while ($row = mysqli_fetch_assoc($result)) {
            $counts[] = $row;
        }

        if (empty($counts)) {
            $this->errorResponse('No unprocessed inventory counts found for this period');
        }

        mysqli_begin_transaction($this->conn);

        try {
            $accounts = $this->coaMapping->getStandardAccounts();
            $total_cogs_adjustment = 0;

            foreach ($counts as $count) {
                $product_id = intval($count['product_id']);
                $book_qty = intval($count['book_quantity']);
                $counted_qty = intval($count['counted_quantity']);
                $variance = intval($count['variance']);
                $unit_cost = floatval($count['weighted_average_cost'] ?? 0);

                // Calculate COGS adjustment
                // For periodic inventory: COGS = Beginning Inventory + Purchases - Ending Inventory
                // Variance = Counted - Book, so if variance is negative, we have shrinkage (increase COGS)
                // If variance is positive, we have overage (decrease COGS)
                $cogs_adjustment = - ($variance * $unit_cost); // Negative variance = positive COGS

                // Update product stock to match counted quantity
                $stmt = mysqli_prepare($this->conn, "UPDATE products SET stock_quantity = ? WHERE id = ?");
                mysqli_stmt_bind_param($stmt, "ii", $counted_qty, $product_id);
                mysqli_stmt_execute($stmt);
                mysqli_stmt_close($stmt);

                // Mark count as processed
                $stmt = mysqli_prepare($this->conn, "UPDATE inventory_counts SET is_processed = 1, processed_at = NOW() WHERE id = ?");
                mysqli_stmt_bind_param($stmt, "i", $count['id']);
                mysqli_stmt_execute($stmt);
                mysqli_stmt_close($stmt);

                // Post adjustment to GL if variance exists
                if (abs($variance) > 0 && abs($cogs_adjustment) > 0.01) {
                    $voucher_number = $this->ledgerService->getNextVoucherNumber('INV');

                    if ($cogs_adjustment > 0) {
                        // Shrinkage: Debit COGS, Credit Inventory
                        $gl_entries = [
                            [
                                'account_code' => $accounts['cogs'],
                                'entry_type' => 'DEBIT',
                                'amount' => abs($cogs_adjustment),
                                'description' => "تسوية جرد دوري - نقص - " . $count['product_name']
                            ],
                            [
                                'account_code' => $accounts['inventory'],
                                'entry_type' => 'CREDIT',
                                'amount' => abs($cogs_adjustment),
                                'description' => "تسوية جرد دوري - نقص - " . $count['product_name']
                            ]
                        ];
                    } else {
                        // Overage: Debit Inventory, Credit COGS (reversal)
                        $gl_entries = [
                            [
                                'account_code' => $accounts['inventory'],
                                'entry_type' => 'DEBIT',
                                'amount' => abs($cogs_adjustment),
                                'description' => "تسوية جرد دوري - زيادة - " . $count['product_name']
                            ],
                            [
                                'account_code' => $accounts['cogs'],
                                'entry_type' => 'CREDIT',
                                'amount' => abs($cogs_adjustment),
                                'description' => "تسوية جرد دوري - زيادة - " . $count['product_name']
                            ]
                        ];
                    }

                    $this->ledgerService->postTransaction($gl_entries, 'inventory_counts', $count['id'], $voucher_number);
                    $total_cogs_adjustment += $cogs_adjustment;
                }
            }

            mysqli_commit($this->conn);
            log_operation('UPDATE', 'inventory_counts', null, null, ['fiscal_period_id' => $fiscal_period_id, 'total_adjustment' => $total_cogs_adjustment]);
            $this->successResponse([
                'message' => 'Periodic inventory processed successfully',
                'products_adjusted' => count($counts),
                'total_cogs_adjustment' => $total_cogs_adjustment
            ]);
        } catch (Exception $e) {
            mysqli_rollback($this->conn);
            $this->errorResponse($e->getMessage());
        }
    }
}
