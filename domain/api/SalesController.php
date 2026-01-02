<?php

require_once __DIR__ . '/Controller.php';

class SalesController extends Controller {

    public function handle() {
        if (!is_logged_in()) {
            $this->errorResponse('Unauthorized', 401);
        }

        $action = $_GET['action'] ?? ''; // 'invoices' or 'invoice_details'
        $method = $_SERVER['REQUEST_METHOD'];

        if ($action === 'invoice_details' && $method === 'GET') {
            $this->getInvoiceDetails();
        } else {
            if ($method === 'GET') {
                $this->getInvoices();
            } elseif ($method === 'POST') {
                $this->createInvoice();
            } elseif ($method === 'DELETE') {
                $this->deleteInvoice();
            }
        }
    }

    private function getInvoices() {
        $params = $this->getPaginationParams();
        $limit = $params['limit'];
        $offset = $params['offset'];

        // Count total
        $countResult = mysqli_query($this->conn, "SELECT COUNT(*) as total FROM invoices");
        $total = mysqli_fetch_assoc($countResult)['total'];

        $result = mysqli_query($this->conn, "
            SELECT i.*, COUNT(ii.id) as item_count, u.username as salesperson_name
            FROM invoices i
            LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
            LEFT JOIN users u ON i.user_id = u.id
            GROUP BY i.id
            ORDER BY i.created_at DESC
            LIMIT $limit OFFSET $offset
        ");

        $invoices = [];
        while ($row = mysqli_fetch_assoc($result)) {
            $invoices[] = $row;
        }
        $this->paginatedResponse($invoices, $total, $params['page'], $params['limit']);
    }

    private function getInvoiceDetails() {
        $invoice_id = intval($_GET['id'] ?? 0);
        
        $result = mysqli_query($this->conn, "SELECT * FROM invoices WHERE id = $invoice_id");
        $invoice = mysqli_fetch_assoc($result);
        
        if (!$invoice) {
            $this->errorResponse('Invoice not found', 404);
        }
        
        $result = mysqli_query($this->conn, "
            SELECT ii.*, p.name as product_name
            FROM invoice_items ii
            JOIN products p ON ii.product_id = p.id
            WHERE ii.invoice_id = $invoice_id
        ");
        $items = [];
        while ($row = mysqli_fetch_assoc($result)) {
            $items[] = $row;
        }
        
        $invoice['items'] = $items;
        $this->successResponse(['data' => $invoice]);
    }

    private function createInvoice() {
        $data = $this->getJsonInput();
        $invoice_number = mysqli_real_escape_string($this->conn, $data['invoice_number'] ?? '');
        $items = $data['items'] ?? [];
        
        if (empty($items)) {
            $this->errorResponse('Invoice must have at least one item', 400);
        }
        
        mysqli_begin_transaction($this->conn);
        
        try {
            $total = 0;
            foreach ($items as $item) {
                $subtotal = floatval($item['quantity']) * floatval($item['unit_price']);
                $total += $subtotal;
            }
            
            $user_id = $_SESSION['user_id'];
            $stmt = mysqli_prepare($this->conn, "INSERT INTO invoices (invoice_number, total_amount, user_id) VALUES (?, ?, ?)");
            mysqli_stmt_bind_param($stmt, "sdi", $invoice_number, $total, $user_id);
            mysqli_stmt_execute($stmt);
            $invoice_id = mysqli_insert_id($this->conn);
            mysqli_stmt_close($stmt);

            
            foreach ($items as $item) {
                $product_id = intval($item['product_id']);
                $quantity = intval($item['quantity']);
                $unit_price = floatval($item['unit_price']);
                $subtotal = $quantity * $unit_price;
                
                $stmt = mysqli_prepare($this->conn, "INSERT INTO invoice_items (invoice_id, product_id, quantity, unit_price, subtotal) VALUES (?, ?, ?, ?, ?)");
                mysqli_stmt_bind_param($stmt, "iiidd", $invoice_id, $product_id, $quantity, $unit_price, $subtotal);
                mysqli_stmt_execute($stmt);
                mysqli_stmt_close($stmt);
                
                $stmt = mysqli_prepare($this->conn, "UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?");
                mysqli_stmt_bind_param($stmt, "ii", $quantity, $product_id);
                mysqli_stmt_execute($stmt);
                mysqli_stmt_close($stmt);
            }
            
            mysqli_commit($this->conn);
            log_operation('CREATE', 'invoices', $invoice_id, null, $data);
            $this->successResponse(['id' => $invoice_id, 'invoice_number' => $invoice_number]);

        } catch (Exception $e) {
            mysqli_rollback($this->conn);
            $this->errorResponse($e->getMessage());
        }
    }

    private function deleteInvoice() {
        $id = intval($_GET['id'] ?? 0);
        
        $result = mysqli_query($this->conn, "SELECT created_at FROM invoices WHERE id = $id");
        $row = mysqli_fetch_assoc($result);
        if ($row) {
            $invoice_time = strtotime($row['created_at']);
            $hours_passed = (time() - $invoice_time) / 3600;
            if ($hours_passed > 48) {
                $this->errorResponse('Cannot delete invoice after 48 hours', 403);
            }
        }
        
        $result = mysqli_query($this->conn, "SELECT product_id, quantity FROM invoice_items WHERE invoice_id = $id");
        $items = [];
        while ($row = mysqli_fetch_assoc($result)) {
            $items[] = $row;
        }
        
        mysqli_begin_transaction($this->conn);
        
        try {
            $stmt = mysqli_prepare($this->conn, "DELETE FROM invoices WHERE id = ?");
            mysqli_stmt_bind_param($stmt, "i", $id);
            mysqli_stmt_execute($stmt);
            mysqli_stmt_close($stmt);
            
            foreach ($items as $item) {
                $stmt = mysqli_prepare($this->conn, "UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?");
                mysqli_stmt_bind_param($stmt, "ii", $item['quantity'], $item['product_id']);
                mysqli_stmt_execute($stmt);
                mysqli_stmt_close($stmt);
            }
            
            mysqli_commit($this->conn);
            log_operation('DELETE', 'invoices', $id);
            $this->successResponse();

        } catch (Exception $e) {
            mysqli_rollback($this->conn);
            $this->errorResponse($e->getMessage());
        }
    }
}
