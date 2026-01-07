<?php

require_once __DIR__ . '/Controller.php';
require_once __DIR__ . '/../Services/LedgerService.php';
require_once __DIR__ . '/../Services/InventoryCostingService.php';
require_once __DIR__ . '/../Services/ChartOfAccountsMappingService.php';
require_once __DIR__ . '/../Services/PermissionService.php';

class PurchasesController extends Controller
{
    private $ledgerService;
    private $costingService;
    private $coaMapping;

    public function __construct()
    {
        parent::__construct();
        $this->ledgerService = new LedgerService();
        $this->costingService = new InventoryCostingService();
        $this->coaMapping = new ChartOfAccountsMappingService();
    }

    public function handle()
    {
        if (!is_logged_in()) {
            $this->errorResponse('Unauthorized', 401);
        }

        PermissionService::requirePermission('purchases', 'view');

        // Handle Purchase Requests
        if (isset($_GET['action']) && $_GET['action'] === 'requests') {
            $this->handleRequests();
            return;
        }

        // Handle Purchase Approvals
        if (isset($_GET['action']) && $_GET['action'] === 'approve') {
            $this->approvePurchase();
            return;
        }

        $method = $_SERVER['REQUEST_METHOD'];

        if ($method === 'GET') {
            $this->getPurchases();
        } elseif ($method === 'POST') {
            $this->createPurchase();
        } elseif ($method === 'PUT') {
            $this->updatePurchase();
        } elseif ($method === 'DELETE') {
            $this->deletePurchase();
        }
    }

    private function getApprovalThreshold()
    {
        // Get approval threshold from settings, default to 10000
        $result = mysqli_query($this->conn, "SELECT value FROM settings WHERE `key` = 'purchase_approval_threshold'");
        if ($result && mysqli_num_rows($result) > 0) {
            $row = mysqli_fetch_assoc($result);
            return floatval($row['value'] ?? 10000);
        }
        return 10000; // Default threshold
    }

    public function approvePurchase()
    {
        $data = $this->getJsonInput();
        $purchase_id = intval($data['id'] ?? 0);

        // Check permissions (replaces manual manager/admin check)
        PermissionService::requirePermission('purchases', 'edit'); 

        $result = mysqli_query($this->conn, "SELECT * FROM purchases WHERE id = $purchase_id");
        $purchase = mysqli_fetch_assoc($result);

        if (!$purchase) {
            $this->errorResponse('Purchase not found', 404);
        }

        if ($purchase['approval_status'] === 'approved') {
            $this->errorResponse('Purchase already approved', 400);
        }

        mysqli_begin_transaction($this->conn);

        try {
            // Update approval status
            $stmt = mysqli_prepare(
                $this->conn,
                "UPDATE purchases SET approval_status = 'approved', approved_by = ?, approved_at = NOW() WHERE id = ?"
            );
            mysqli_stmt_bind_param($stmt, "ii", $user_id, $purchase_id);
            mysqli_stmt_execute($stmt);
            mysqli_stmt_close($stmt);

            // Process the purchase (post to GL, update stock, etc.)
            // This logic should mirror the createPurchase logic but for an existing purchase
            $product_id = intval($purchase['product_id']);
            $quantity = intval($purchase['quantity']);
            $total_invoice_price = floatval($purchase['invoice_price']);
            $unit_type = $purchase['unit_type'];
            $supplier_id = intval($purchase['supplier_id'] ?? 0);
            $payment_type = $purchase['payment_type'] ?? 'credit';
            $vat_rate = floatval($purchase['vat_rate'] ?? 0);
            $vat_amount = floatval($purchase['vat_amount'] ?? 0);

            // Get product details
            $prod_result = mysqli_query($this->conn, "SELECT items_per_unit FROM products WHERE id = $product_id");
            $product = mysqli_fetch_assoc($prod_result);
            $items_per_unit = intval($product['items_per_unit']);
            $actual_quantity = ($unit_type === 'main') ? ($quantity * $items_per_unit) : $quantity;
            $unit_cost = $total_invoice_price / $actual_quantity;
            $subtotal = $total_invoice_price / (1 + ($vat_rate / 100));

            // Record in inventory costing
            $this->costingService->recordPurchase($product_id, $purchase_id, $actual_quantity, $unit_cost, $total_invoice_price, 'FIFO');

            // Update product stock
            $stmt = mysqli_prepare($this->conn, "UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?");
            mysqli_stmt_bind_param($stmt, "ii", $actual_quantity, $product_id);
            mysqli_stmt_execute($stmt);
            mysqli_stmt_close($stmt);

            // Post to General Ledger
            $accounts = $this->coaMapping->getStandardAccounts();
            $gl_entries = [];

            if ($payment_type === 'cash') {
                $gl_entries[] = [
                    'account_code' => $accounts['inventory'],
                    'entry_type' => 'DEBIT',
                    'amount' => $subtotal,
                    'description' => "شراء نقدي - فاتورة رقم " . $purchase['voucher_number']
                ];
                $gl_entries[] = [
                    'account_code' => $accounts['cash'],
                    'entry_type' => 'CREDIT',
                    'amount' => $subtotal,
                    'description' => "دفع نقدي - فاتورة شراء رقم " . $purchase['voucher_number']
                ];
            } else {
                $gl_entries[] = [
                    'account_code' => $accounts['inventory'],
                    'entry_type' => 'DEBIT',
                    'amount' => $subtotal,
                    'description' => "شراء آجل - فاتورة رقم " . $purchase['voucher_number']
                ];
                $gl_entries[] = [
                    'account_code' => $accounts['accounts_payable'],
                    'entry_type' => 'CREDIT',
                    'amount' => $subtotal,
                    'description' => "ذمم دائنة - فاتورة شراء رقم " . $purchase['voucher_number']
                ];
            }

            if ($vat_amount > 0) {
                $gl_entries[] = [
                    'account_code' => $accounts['input_vat'],
                    'entry_type' => 'DEBIT',
                    'amount' => $vat_amount,
                    'description' => "ضريبة القيمة المضافة - مدخلات - فاتورة رقم " . $purchase['voucher_number']
                ];
                $gl_entries[1]['amount'] += $vat_amount;
            }

            $this->ledgerService->postTransaction($gl_entries, 'purchases', $purchase_id, $purchase['voucher_number']);

            // Post to AP if credit purchase
            if ($payment_type === 'credit' && $supplier_id > 0) {
                $ap_sql = "INSERT INTO ap_transactions (supplier_id, type, amount, description, reference_type, reference_id, created_by) VALUES (?, 'invoice', ?, ?, 'purchases', ?, ?)";
                $desc = "فاتورة شراء رقم " . $purchase['voucher_number'];
                $stmt = mysqli_prepare($this->conn, $ap_sql);
                mysqli_stmt_bind_param($stmt, "idsii", $supplier_id, $total_invoice_price, $desc, $purchase_id, $user_id);
                mysqli_stmt_execute($stmt);
                mysqli_stmt_close($stmt);

                $this->updateSupplierBalance($supplier_id);
            }

            mysqli_commit($this->conn);
            log_operation('UPDATE', 'purchases', $purchase_id, null, ['action' => 'approve']);
            $this->successResponse(['message' => 'Purchase approved and processed successfully']);
        } catch (Exception $e) {
            mysqli_rollback($this->conn);
            $this->errorResponse($e->getMessage());
        }
    }

    private function handleRequests()
    {

        $method = $_SERVER['REQUEST_METHOD'];

        if ($method === 'GET') {
            $query = "
                SELECT pr.*, 
                       COALESCE(p.name, pr.product_name) as display_name,
                       u.username as requester 
                FROM purchase_requests pr 
                LEFT JOIN products p ON pr.product_id = p.id 
                LEFT JOIN users u ON pr.user_id = u.id 
                ORDER BY pr.created_at DESC
            ";
            $res = mysqli_query($this->conn, $query);
            $requests = [];
            while ($row = mysqli_fetch_assoc($res)) {
                $requests[] = $row;
            }
            $this->successResponse(['data' => $requests]);
        } elseif ($method === 'POST') {
            $data = $this->getJsonInput();
            $product_id = !empty($data['product_id']) ? intval($data['product_id']) : NULL;
            $product_name = $data['product_name'] ?? NULL;
            $quantity = intval($data['quantity'] ?? 1);
            $notes = $data['notes'] ?? '';
            $user_id = $_SESSION['user_id'];

            if (!$product_id && !$product_name) {
                $this->errorResponse('Product ID or Name required');
            }

            $stmt = mysqli_prepare($this->conn, "INSERT INTO purchase_requests (product_id, product_name, quantity, user_id, notes) VALUES (?, ?, ?, ?, ?)");
            mysqli_stmt_bind_param($stmt, "isiis", $product_id, $product_name, $quantity, $user_id, $notes);

            if (mysqli_stmt_execute($stmt)) {
                $this->successResponse(['message' => 'Request created']);
            } else {
                $this->errorResponse('Failed to create request');
            }
        } elseif ($method === 'PUT') {
            // Handle status update (e.g. mark as completed)
            $data = $this->getJsonInput();
            $id = intval($data['id']);
            $status = $data['status']; // 'completed', 'pending'

            $stmt = mysqli_prepare($this->conn, "UPDATE purchase_requests SET status = ? WHERE id = ?");
            mysqli_stmt_bind_param($stmt, "si", $status, $id);
            mysqli_stmt_execute($stmt);
            $this->successResponse();
        }
    }



    private function getPurchases()
    {
        $params = $this->getPaginationParams();
        $limit = $params['limit'];
        $offset = $params['offset'];
        $search = isset($_GET['search']) ? trim($_GET['search']) : '';

        $whereClause = "WHERE p.is_reversed = 0 ";
        $joinClause = "JOIN products pr ON p.product_id = pr.id LEFT JOIN users u ON p.user_id = u.id LEFT JOIN users approver ON p.approved_by = approver.id";

        // Filter by approval status if requested
        $approval_status = $_GET['approval_status'] ?? null;
        if ($approval_status) {
            $status_esc = mysqli_real_escape_string($this->conn, $approval_status);
            $whereClause .= "AND p.approval_status = '$status_esc' ";
        }

        if (!empty($search)) {
            $searchSafe = mysqli_real_escape_string($this->conn, $search);
            $whereClause .= "AND (pr.name LIKE '%$searchSafe%' OR p.id LIKE '%$searchSafe%' OR u.username LIKE '%$searchSafe%')";
        }

        // Count total
        $countSql = "SELECT COUNT(*) as total FROM purchases p $joinClause $whereClause";
        $countResult = mysqli_query($this->conn, $countSql);
        $total = mysqli_fetch_assoc($countResult)['total'];

        $sql = "
            SELECT p.*, pr.name as product_name, pr.unit_price as product_unit_price, pr.unit_name, pr.sub_unit_name, 
                   u.username as recorder_name, approver.username as approver_name
            FROM purchases p
            $joinClause
            $whereClause
            ORDER BY p.purchase_date DESC, p.id DESC
            LIMIT $limit OFFSET $offset
        ";

        $result = mysqli_query($this->conn, $sql);
        if (!$result) {
            $this->errorResponse(mysqli_error($this->conn));
            return;
        }

        $purchases = [];
        while ($row = mysqli_fetch_assoc($result)) {
            $purchases[] = $row;
        }
        $this->paginatedResponse($purchases, $total, $params['page'], $params['limit']);
    }

    private function createPurchase()
    {
        PermissionService::requirePermission('purchases', 'create');
        $data = $this->getJsonInput();

        $product_id = intval($data['product_id'] ?? 0);
        $quantity = intval($data['quantity'] ?? 0);
        $total_invoice_price = floatval($data['invoice_price'] ?? 0);
        $unit_type = $data['unit_type'] ?? 'sub'; // 'main' or 'sub'
        $purchase_date = $data['purchase_date'] ?? date('Y-m-d H:i:s');
        $supplier_id = intval($data['supplier_id'] ?? 0);
        $vat_rate = floatval($data['vat_rate'] ?? 0.00);
        $payment_type = mysqli_real_escape_string($this->conn, $data['payment_type'] ?? 'credit'); // credit or cash

        // Get product details
        $result = mysqli_query($this->conn, "SELECT items_per_unit, minimum_profit_margin, weighted_average_cost FROM products WHERE id = $product_id");
        $product = mysqli_fetch_assoc($result);

        if (!$product) {
            $this->errorResponse('Product not found', 404);
        }

        $items_per_unit = intval($product['items_per_unit']);
        $min_margin = floatval($product['minimum_profit_margin']);

        // Calculate actual quantity in sub-units
        $actual_quantity = ($unit_type === 'main') ? ($quantity * $items_per_unit) : $quantity;

        if ($actual_quantity <= 0) {
            $this->errorResponse('Quantity must be greater than zero');
        }

        // Calculate unit cost
        $unit_cost = $total_invoice_price / $actual_quantity;

        // Calculate VAT
        $subtotal = $total_invoice_price / (1 + ($vat_rate / 100));
        $vat_amount = $total_invoice_price - $subtotal;

        // Calculate new selling price using Moving Weighted Average Cost (MWAC)
        $old_wac = floatval($product['weighted_average_cost'] ?? 0);
        $old_stock = mysqli_query($this->conn, "SELECT COALESCE(SUM(quantity), 0) as total FROM inventory_costing WHERE product_id = $product_id AND is_sold = 0");
        $old_stock_row = mysqli_fetch_assoc($old_stock);
        $old_stock_qty = floatval($old_stock_row['total'] ?? 0);

        if ($old_stock_qty > 0 && $old_wac > 0) {
            // Moving Weighted Average: (old_cost * old_qty + new_cost * new_qty) / (old_qty + new_qty)
            $new_wac = (($old_wac * $old_stock_qty) + ($unit_cost * $actual_quantity)) / ($old_stock_qty + $actual_quantity);
        } else {
            $new_wac = $unit_cost;
        }

        // New selling price = MWAC + margin
        $new_unit_price = $new_wac + $min_margin;

        // Check if approval is required based on purchase amount
        $approval_threshold = $this->getApprovalThreshold();
        $requires_approval = $total_invoice_price > $approval_threshold;
        $approval_status = 'pending';
        $approved_by = null;

        // Check if current user is manager/admin (can auto-approve)
        $current_user_id = $_SESSION['user_id'];
        $user_result = mysqli_query($this->conn, "SELECT role FROM users WHERE id = $current_user_id");
        $user = mysqli_fetch_assoc($user_result);
        $user_role = $user['role'] ?? 'sales';

        if ($requires_approval && in_array($user_role, ['admin', 'manager'])) {
            // Manager/admin can auto-approve
            $approval_status = 'approved';
            $approved_by = $current_user_id;
        } elseif (!$requires_approval) {
            // Below threshold, no approval needed
            $approval_status = 'approved';
            $approved_by = $current_user_id;
        }

        mysqli_begin_transaction($this->conn);

        try {
            // Generate voucher number
            $voucher_number = $this->ledgerService->getNextVoucherNumber('PUR');

            // Insert purchase
            $user_id = $_SESSION['user_id'];
            $production_date = !empty($data['production_date']) ? $data['production_date'] : NULL;
            $expiry_date = !empty($data['expiry_date']) ? $data['expiry_date'] : NULL;

            $stmt = mysqli_prepare($this->conn, "INSERT INTO purchases (product_id, quantity, invoice_price, purchase_date, unit_type, user_id, production_date, expiry_date, supplier_id, voucher_number, vat_rate, vat_amount, approval_status, approved_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
            $approved_by_null = $approved_by ? $approved_by : null;
            mysqli_stmt_bind_param($stmt, "iidssissiisddss", $product_id, $quantity, $total_invoice_price, $purchase_date, $unit_type, $user_id, $production_date, $expiry_date, $supplier_id, $voucher_number, $vat_rate, $vat_amount, $approval_status, $approved_by_null);
            mysqli_stmt_execute($stmt);

            $purchase_id = mysqli_insert_id($this->conn);
            mysqli_stmt_close($stmt);

            // Only process purchase if approved
            if ($approval_status !== 'approved') {
                mysqli_commit($this->conn);
                log_operation('CREATE', 'purchases', $purchase_id, null, $data);
                $this->successResponse([
                    'id' => $purchase_id,
                    'voucher_number' => $voucher_number,
                    'approval_status' => $approval_status,
                    'message' => 'Purchase created and pending approval'
                ]);
                return;
            }

            // Record in inventory costing
            $this->costingService->recordPurchase($product_id, $purchase_id, $actual_quantity, $unit_cost, $total_invoice_price, 'FIFO');

            // Update product stock and weighted average cost
            $stmt = mysqli_prepare($this->conn, "UPDATE products SET stock_quantity = stock_quantity + ?, weighted_average_cost = ?, unit_price = ? WHERE id = ?");
            mysqli_stmt_bind_param($stmt, "iddi", $actual_quantity, $new_wac, $new_unit_price, $product_id);
            mysqli_stmt_execute($stmt);
            mysqli_stmt_close($stmt);

            // Post to General Ledger - Double Entry
            $accounts = $this->coaMapping->getStandardAccounts();
            $gl_entries = [];

            if ($payment_type === 'cash') {
                // Cash Purchase: Debit Inventory, Credit Cash
                $gl_entries[] = [
                    'account_code' => $accounts['inventory'],
                    'entry_type' => 'DEBIT',
                    'amount' => $subtotal,
                    'description' => "شراء نقدي - فاتورة رقم $voucher_number"
                ];

                $gl_entries[] = [
                    'account_code' => $accounts['cash'],
                    'entry_type' => 'CREDIT',
                    'amount' => $subtotal,
                    'description' => "دفع نقدي - فاتورة شراء رقم $voucher_number"
                ];
            } else {
                // Credit Purchase: Debit Inventory, Credit Accounts Payable
                $gl_entries[] = [
                    'account_code' => $accounts['inventory'],
                    'entry_type' => 'DEBIT',
                    'amount' => $subtotal,
                    'description' => "شراء آجل - فاتورة رقم $voucher_number"
                ];

                $gl_entries[] = [
                    'account_code' => $accounts['accounts_payable'],
                    'entry_type' => 'CREDIT',
                    'amount' => $subtotal,
                    'description' => "ذمم دائنة - فاتورة شراء رقم $voucher_number"
                ];
            }

            // Debit Input VAT (if applicable)
            if ($vat_amount > 0) {
                $gl_entries[] = [
                    'account_code' => $accounts['input_vat'],
                    'entry_type' => 'DEBIT',
                    'amount' => $vat_amount,
                    'description' => "ضريبة القيمة المضافة - مدخلات - فاتورة رقم $voucher_number"
                ];

                // Adjust credit side
                if ($payment_type === 'cash') {
                    $gl_entries[1]['amount'] += $vat_amount; // Add VAT to cash payment
                } else {
                    $gl_entries[1]['amount'] += $vat_amount; // Add VAT to AP
                }
            }

            $this->ledgerService->postTransaction($gl_entries, 'purchases', $purchase_id, $voucher_number);

            // Post to Accounts Payable if credit purchase
            if ($payment_type === 'credit' && $supplier_id > 0) {
                $ap_sql = "INSERT INTO ap_transactions (supplier_id, type, amount, description, reference_type, reference_id, created_by) VALUES (?, 'invoice', ?, ?, 'purchases', ?, ?)";
                $desc = "فاتورة شراء رقم " . $voucher_number;
                $stmt = mysqli_prepare($this->conn, $ap_sql);
                mysqli_stmt_bind_param($stmt, "idsii", $supplier_id, $total_invoice_price, $desc, $purchase_id, $user_id);
                mysqli_stmt_execute($stmt);
                mysqli_stmt_close($stmt);

                // Update supplier balance
                $this->updateSupplierBalance($supplier_id);
            }

            mysqli_commit($this->conn);
            log_operation('CREATE', 'purchases', $purchase_id, null, $data);
            $this->successResponse(['id' => $purchase_id, 'new_unit_price' => $new_unit_price, 'weighted_average_cost' => $new_wac, 'voucher_number' => $voucher_number]);
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

    private function updatePurchase()
    {
        PermissionService::requirePermission('purchases', 'edit');
        $data = $this->getJsonInput();
        $id = intval($data['id'] ?? 0);

        // Check if 24 hours have passed
        $result = mysqli_query($this->conn, "SELECT purchase_date FROM purchases WHERE id = $id");
        $row = mysqli_fetch_assoc($result);
        if ($row) {
            $purchase_time = strtotime($row['purchase_date']);
            $hours_passed = (time() - $purchase_time) / 3600;
            if ($hours_passed > 24) {
                $this->errorResponse('Cannot edit purchase after 24 hours', 403);
            }
        }

        $product_id = intval($data['product_id'] ?? 0);
        $quantity = intval($data['quantity'] ?? 0);
        $invoice_price = floatval($data['invoice_price'] ?? 0);
        $purchase_date = $data['purchase_date'] ?? date('Y-m-d H:i:s');
        $unit_type = $data['unit_type'] ?? 'sub';

        // Get old purchase data
        $result = mysqli_query($this->conn, "
            SELECT p.product_id, p.quantity, p.unit_type, pr.items_per_unit, pr.minimum_profit_margin 
            FROM purchases p 
            JOIN products pr ON p.product_id = pr.id 
            WHERE p.id = $id
        ");
        $old = mysqli_fetch_assoc($result);

        mysqli_begin_transaction($this->conn);

        try {
            // Update purchase
            $production_date = !empty($data['production_date']) ? $data['production_date'] : NULL;
            $expiry_date = !empty($data['expiry_date']) ? $data['expiry_date'] : NULL;

            $stmt = mysqli_prepare($this->conn, "UPDATE purchases SET product_id = ?, quantity = ?, invoice_price = ?, purchase_date = ?, unit_type = ?, production_date = ?, expiry_date = ? WHERE id = ?");
            mysqli_stmt_bind_param($stmt, "iidssssi", $product_id, $quantity, $invoice_price, $purchase_date, $unit_type, $production_date, $expiry_date, $id);
            mysqli_stmt_execute($stmt);
            mysqli_stmt_close($stmt);

            if ($old) {
                // ... (Logic to reverse old stock and apply new stock)
                // This logic is complex, copying directly from original file is safest

                $old_product_id = $old['product_id'];
                $old_quantity = intval($old['quantity']);
                $old_unit_type = $old['unit_type'];
                $old_items_per_unit = intval($old['items_per_unit']);

                $old_actual_qty = ($old_unit_type === 'main') ? ($old_quantity * $old_items_per_unit) : $old_quantity;

                $stmt = mysqli_prepare($this->conn, "UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?");
                mysqli_stmt_bind_param($stmt, "ii", $old_actual_qty, $old_product_id);
                mysqli_stmt_execute($stmt);
                mysqli_stmt_close($stmt);

                $result = mysqli_query($this->conn, "SELECT items_per_unit, minimum_profit_margin FROM products WHERE id = $product_id");
                $new_prod = mysqli_fetch_assoc($result);
                $new_items_per_unit = intval($new_prod['items_per_unit']);

                $new_actual_qty = ($unit_type === 'main') ? ($quantity * $new_items_per_unit) : $quantity;

                $price_per_item = ($new_actual_qty > 0) ? ($invoice_price / $new_actual_qty) : 0;
                $new_unit_price = $price_per_item + floatval($new_prod['minimum_profit_margin']);

                $stmt = mysqli_prepare($this->conn, "UPDATE products SET stock_quantity = stock_quantity + ?, unit_price = ? WHERE id = ?");
                mysqli_stmt_bind_param($stmt, "idi", $new_actual_qty, $new_unit_price, $product_id);
                mysqli_stmt_execute($stmt);
                mysqli_stmt_close($stmt);
            }

            mysqli_commit($this->conn);
            log_operation('UPDATE', 'purchases', $id, null, $data);
            $this->successResponse();
        } catch (Exception $e) {
            mysqli_rollback($this->conn);
            $this->errorResponse($e->getMessage());
        }
    }

    private function deletePurchase()
    {
        PermissionService::requirePermission('purchases', 'delete');
        $id = intval($_GET['id'] ?? 0);

        // Get purchase details
        $result = mysqli_query($this->conn, "
            SELECT p.*, p.voucher_number, pr.items_per_unit 
            FROM purchases p 
            JOIN products pr ON p.product_id = pr.id 
            WHERE p.id = $id
        ");
        $purchase = mysqli_fetch_assoc($result);

        if (!$purchase) {
            $this->errorResponse('Purchase not found', 404);
        }

        // Check if already reversed
        if (intval($purchase['is_reversed'] ?? 0) == 1) {
            $this->errorResponse('Purchase has already been reversed', 400);
        }

        $voucher_number = $purchase['voucher_number'] ?? null;

        mysqli_begin_transaction($this->conn);
        try {
            // Mark purchase as reversed (soft delete)
            $user_id = $_SESSION['user_id'] ?? null;
            $stmt = mysqli_prepare($this->conn, "UPDATE purchases SET is_reversed = 1, reversed_at = NOW(), reversed_by = ? WHERE id = ?");
            mysqli_stmt_bind_param($stmt, "ii", $user_id, $id);
            mysqli_stmt_execute($stmt);
            mysqli_stmt_close($stmt);

            // Reverse stock
            if ($purchase) {
                $actual_qty = ($purchase['unit_type'] === 'main') ? (intval($purchase['quantity']) * intval($purchase['items_per_unit'])) : intval($purchase['quantity']);
                $stmt = mysqli_prepare($this->conn, "UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?");
                mysqli_stmt_bind_param($stmt, "ii", $actual_qty, $purchase['product_id']);
                mysqli_stmt_execute($stmt);
                mysqli_stmt_close($stmt);
            }

            // Reverse GL entries if voucher number exists
            if ($voucher_number) {
                try {
                    $this->ledgerService->reverseTransaction($voucher_number, "إلغاء فاتورة شراء رقم " . ($voucher_number ?? $id));
                } catch (Exception $e) {
                    error_log("Failed to reverse GL entries: " . $e->getMessage());
                    // Continue with reversal even if GL reversal fails
                }
            }

            // Mark AP transactions as reversed (soft delete)
            $stmt = mysqli_prepare($this->conn, "UPDATE ap_transactions SET is_deleted = 1 WHERE reference_type = 'purchases' AND reference_id = ?");
            mysqli_stmt_bind_param($stmt, "i", $id);
            mysqli_stmt_execute($stmt);
            mysqli_stmt_close($stmt);

            mysqli_commit($this->conn);
            log_operation('REVERSE', 'purchases', $id, null, ['voucher_number' => $voucher_number]);
            $this->successResponse(['message' => 'Purchase reversed successfully']);
        } catch (Exception $e) {
            mysqli_rollback($this->conn);
            $this->errorResponse($e->getMessage());
        }
    }
}
