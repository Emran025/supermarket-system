<?php

require_once __DIR__ . '/Controller.php';

class PurchasesController extends Controller {

    public function handle() {
        if (!is_logged_in()) {
            $this->errorResponse('Unauthorized', 401);
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

    private function getPurchases() {
        $params = $this->getPaginationParams();
        $limit = $params['limit'];
        $offset = $params['offset'];

        // Count total
        $countResult = mysqli_query($this->conn, "SELECT COUNT(*) as total FROM purchases");
        $total = mysqli_fetch_assoc($countResult)['total'];

        $result = mysqli_query($this->conn, "
            SELECT p.*, pr.name as product_name, pr.unit_price as product_unit_price, pr.unit_name, pr.sub_unit_name, u.username as recorder_name
            FROM purchases p
            JOIN products pr ON p.product_id = pr.id
            LEFT JOIN users u ON p.user_id = u.id
            ORDER BY p.purchase_date DESC, p.id DESC
            LIMIT $limit OFFSET $offset
        ");

        $purchases = [];
        while ($row = mysqli_fetch_assoc($result)) {
            $purchases[] = $row;
        }
        $this->paginatedResponse($purchases, $total, $params['page'], $params['limit']);
    }

    private function createPurchase() {
        $data = $this->getJsonInput();
        
        $product_id = intval($data['product_id'] ?? 0);
        $quantity = intval($data['quantity'] ?? 0);
        $total_invoice_price = floatval($data['invoice_price'] ?? 0);
        $unit_type = $data['unit_type'] ?? 'sub'; // 'main' or 'sub'
        $purchase_date = $data['purchase_date'] ?? date('Y-m-d H:i:s');
        
        // Get product details
        $result = mysqli_query($this->conn, "SELECT items_per_unit, minimum_profit_margin FROM products WHERE id = $product_id");
        $product = mysqli_fetch_assoc($result);
        
        if (!$product) {
            $this->errorResponse('Product not found', 404);
        }
        
        $items_per_unit = intval($product['items_per_unit']);
        $min_margin = floatval($product['minimum_profit_margin']);
        
        // Calculate actual quantity in sub-units
        $actual_quantity = ($unit_type === 'main') ? ($quantity * $items_per_unit) : $quantity;
        
        // Calculate price per item
        $price_per_item = ($actual_quantity > 0) ? ($total_invoice_price / $actual_quantity) : 0;
        
        // New selling price
        $new_unit_price = $price_per_item + $min_margin;
        
        mysqli_begin_transaction($this->conn);
        
        try {
            // Insert purchase
            $user_id = $_SESSION['user_id'];
            $stmt = mysqli_prepare($this->conn, "INSERT INTO purchases (product_id, quantity, invoice_price, purchase_date, unit_type, user_id) VALUES (?, ?, ?, ?, ?, ?)");
            mysqli_stmt_bind_param($stmt, "iidssi", $product_id, $quantity, $total_invoice_price, $purchase_date, $unit_type, $user_id);
            mysqli_stmt_execute($stmt);

            $purchase_id = mysqli_insert_id($this->conn);
            mysqli_stmt_close($stmt);
            
            // Update product stock and unit price
            $stmt = mysqli_prepare($this->conn, "UPDATE products SET stock_quantity = stock_quantity + ?, unit_price = ? WHERE id = ?");
            mysqli_stmt_bind_param($stmt, "idi", $actual_quantity, $new_unit_price, $product_id);
            mysqli_stmt_execute($stmt);
            mysqli_stmt_close($stmt);
            
            mysqli_commit($this->conn);
            log_operation('CREATE', 'purchases', $purchase_id, null, $data);
            $this->successResponse(['id' => $purchase_id, 'new_unit_price' => $new_unit_price]);

        } catch (Exception $e) {
            mysqli_rollback($this->conn);
            $this->errorResponse($e->getMessage());
        }
    }

    private function updatePurchase() {
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
            $stmt = mysqli_prepare($this->conn, "UPDATE purchases SET product_id = ?, quantity = ?, invoice_price = ?, purchase_date = ?, unit_type = ? WHERE id = ?");
            mysqli_stmt_bind_param($stmt, "iidssi", $product_id, $quantity, $invoice_price, $purchase_date, $unit_type, $id);
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

    private function deletePurchase() {
        $id = intval($_GET['id'] ?? 0);
        
        $result = mysqli_query($this->conn, "
            SELECT p.product_id, p.quantity, p.purchase_date, p.unit_type, pr.items_per_unit 
            FROM purchases p 
            JOIN products pr ON p.product_id = pr.id 
            WHERE p.id = $id
        ");
        $purchase = mysqli_fetch_assoc($result);
        
        if ($purchase) {
            if (time() - strtotime($purchase['purchase_date']) > 86400) {
                $this->errorResponse('لا يمكن حذف المشتريات بعد مرور 24 ساعة', 403);
            }
        }
        
        mysqli_begin_transaction($this->conn);
        try {
            $stmt = mysqli_prepare($this->conn, "DELETE FROM purchases WHERE id = ?");
            mysqli_stmt_bind_param($stmt, "i", $id);
            mysqli_stmt_execute($stmt);
            mysqli_stmt_close($stmt);
            
            if ($purchase) {
                $actual_qty = ($purchase['unit_type'] === 'main') ? (intval($purchase['quantity']) * intval($purchase['items_per_unit'])) : intval($purchase['quantity']);
                mysqli_query($this->conn, "UPDATE products SET stock_quantity = stock_quantity - $actual_qty WHERE id = " . intval($purchase['product_id']));
            }
            
            mysqli_commit($this->conn);
            log_operation('DELETE', 'purchases', $id);
            $this->successResponse();

        } catch (Exception $e) {
            mysqli_rollback($this->conn);
            $this->errorResponse($e->getMessage());
        }
    }
}
