<?php

require_once __DIR__ . '/Controller.php';

class ProductsController extends Controller {

    public function handle() {
        if (!is_logged_in()) {
            $this->errorResponse('Unauthorized', 401);
        }

        $method = $_SERVER['REQUEST_METHOD'];

        if ($method === 'GET') {
            $this->getProducts();
        } elseif ($method === 'POST') {
            $this->createProduct();
        } elseif ($method === 'PUT') {
            $this->updateProduct();
        } elseif ($method === 'DELETE') {
            $this->deleteProduct();
        }
    }

    private function getProducts() {
        $include_purchase_price = isset($_GET['include_purchase_price']) && $_GET['include_purchase_price'] == '1';
        $params = $this->getPaginationParams();
        $limit = $params['limit'];
        $offset = $params['offset'];
        
        // Count total
        $countResult = mysqli_query($this->conn, "SELECT COUNT(*) as total FROM products");
        $total = mysqli_fetch_assoc($countResult)['total'];

        if ($include_purchase_price) {
            $sql = "
                SELECT p.*, u.username as creator_name,
                       (SELECT invoice_price FROM purchases WHERE product_id = p.id ORDER BY purchase_date DESC LIMIT 1) as latest_purchase_price
                FROM products p
                LEFT JOIN users u ON p.created_by = u.id
                ORDER BY p.id DESC
                LIMIT $limit OFFSET $offset
            ";
        } else {
            $sql = "
                SELECT p.*, u.username as creator_name 
                FROM products p 
                LEFT JOIN users u ON p.created_by = u.id 
                ORDER BY p.id DESC 
                LIMIT $limit OFFSET $offset
            ";
        }

        
        $result = mysqli_query($this->conn, $sql);
        $products = [];
        while ($row = mysqli_fetch_assoc($result)) {
            $products[] = $row;
        }
        
        $this->paginatedResponse($products, $total, $params['page'], $params['limit']);
    }

    private function createProduct() {
        $data = $this->getJsonInput();
        
        $name = mysqli_real_escape_string($this->conn, $data['name'] ?? '');
        $description = mysqli_real_escape_string($this->conn, $data['description'] ?? '');
        $category = mysqli_real_escape_string($this->conn, $data['category'] ?? '');
        $unit_price = floatval($data['unit_price'] ?? 0);
        $min_margin = floatval($data['minimum_profit_margin'] ?? 0);
        $stock = intval($data['stock_quantity'] ?? 0);
        $unit_name = mysqli_real_escape_string($this->conn, $data['unit_name'] ?? 'كرتون');
        $items_per_unit = intval($data['items_per_unit'] ?? 1);
        $sub_unit_name = mysqli_real_escape_string($this->conn, $data['sub_unit_name'] ?? 'حبة');
        $user_id = $_SESSION['user_id'];
        
        $stmt = mysqli_prepare($this->conn, "INSERT INTO products (name, description, category, unit_price, minimum_profit_margin, stock_quantity, unit_name, items_per_unit, sub_unit_name, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        mysqli_stmt_bind_param($stmt, "sssddisisi", $name, $description, $category, $unit_price, $min_margin, $stock, $unit_name, $items_per_unit, $sub_unit_name, $user_id);

        
        if (mysqli_stmt_execute($stmt)) {
            $product_id = mysqli_insert_id($this->conn);
            log_operation('CREATE', 'products', $product_id, null, $data);
            $this->successResponse(['id' => $product_id]);
        } else {
            $this->errorResponse(mysqli_error($this->conn));
        }

    }

    private function updateProduct() {
        $data = $this->getJsonInput();
        
        $id = intval($data['id'] ?? 0);
        $name = mysqli_real_escape_string($this->conn, $data['name'] ?? '');
        $description = mysqli_real_escape_string($this->conn, $data['description'] ?? '');
        $category = mysqli_real_escape_string($this->conn, $data['category'] ?? '');
        $unit_price = floatval($data['unit_price'] ?? 0);
        $min_margin = floatval($data['minimum_profit_margin'] ?? 0);
        $stock = intval($data['stock_quantity'] ?? 0);
        $unit_name = mysqli_real_escape_string($this->conn, $data['unit_name'] ?? 'كرتون');
        $items_per_unit = intval($data['items_per_unit'] ?? 1);
        $sub_unit_name = mysqli_real_escape_string($this->conn, $data['sub_unit_name'] ?? 'حبة');
        
        $stmt = mysqli_prepare($this->conn, "UPDATE products SET name = ?, description = ?, category = ?, unit_price = ?, minimum_profit_margin = ?, stock_quantity = ?, unit_name = ?, items_per_unit = ?, sub_unit_name = ? WHERE id = ?");
        mysqli_stmt_bind_param($stmt, "sssddisisi", $name, $description, $category, $unit_price, $min_margin, $stock, $unit_name, $items_per_unit, $sub_unit_name, $id);
        
        if (mysqli_stmt_execute($stmt)) {
            log_operation('UPDATE', 'products', $id, null, $data);
            $this->successResponse();
        } else {
            $this->errorResponse(mysqli_error($this->conn));
        }

    }

    private function deleteProduct() {
        $id = intval($_GET['id'] ?? 0);
        
        $stmt = mysqli_prepare($this->conn, "DELETE FROM products WHERE id = ?");
        mysqli_stmt_bind_param($stmt, "i", $id);
        
        if (mysqli_stmt_execute($stmt)) {
            log_operation('DELETE', 'products', $id);
            $this->successResponse();
        } else {
            $this->errorResponse(mysqli_error($this->conn));
        }

    }
}
