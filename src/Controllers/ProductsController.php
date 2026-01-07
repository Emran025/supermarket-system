<?php

require_once __DIR__ . '/Controller.php';
require_once __DIR__ . '/../Services/PermissionService.php';

class ProductsController extends Controller {

    public function handle() {
        if (!is_logged_in()) {
            $this->errorResponse('Unauthorized', 401);
        }

        PermissionService::requirePermission('products', 'view');

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
        $search = isset($_GET['search']) ? trim($_GET['search']) : '';
        
        $params = $this->getPaginationParams();
        $limit = $params['limit'];
        $offset = $params['offset'];
        
        // Build Where Clause
        $whereClause = "";
        $types = "";
        $queryParams = [];
        
        if (!empty($search)) {
            $whereClause = "WHERE p.name LIKE ? OR p.category LIKE ? OR p.description LIKE ? OR p.id LIKE ?";
            $searchTerm = "%$search%";
            $types .= "ssss";
            $queryParams[] = $searchTerm;
            $queryParams[] = $searchTerm;
            $queryParams[] = $searchTerm;
            $queryParams[] = $searchTerm;
        }

        // Count total
        $countSql = "SELECT COUNT(*) as total FROM products p $whereClause";
        $stmtCount = mysqli_prepare($this->conn, $countSql);
        if (!empty($queryParams)) {
            mysqli_stmt_bind_param($stmtCount, $types, ...$queryParams);
        }
        mysqli_stmt_execute($stmtCount);
        $countResult = mysqli_stmt_get_result($stmtCount);
        $total = mysqli_fetch_assoc($countResult)['total'];
        mysqli_stmt_close($stmtCount);

        if ($include_purchase_price) {
            $sql = "
                SELECT p.*, u.username as creator_name,
                       (SELECT invoice_price FROM purchases WHERE product_id = p.id ORDER BY purchase_date DESC LIMIT 1) as latest_purchase_price
                FROM products p
                LEFT JOIN users u ON p.created_by = u.id
                $whereClause
                ORDER BY p.id DESC
                LIMIT ? OFFSET ?
            ";
        } else {
            $sql = "
                SELECT p.*, u.username as creator_name 
                FROM products p 
                LEFT JOIN users u ON p.created_by = u.id 
                $whereClause
                ORDER BY p.id DESC 
                LIMIT ? OFFSET ?
            ";
        }

        $stmt = mysqli_prepare($this->conn, $sql);
        $types .= "ii";
        $queryParams[] = $limit;
        $queryParams[] = $offset;
        
        mysqli_stmt_bind_param($stmt, $types, ...$queryParams);
        mysqli_stmt_execute($stmt);
        $result = mysqli_stmt_get_result($stmt);
        
        $products = [];
        while ($row = mysqli_fetch_assoc($result)) {
            $products[] = $row;
        }
        mysqli_stmt_close($stmt);
        
        $this->paginatedResponse($products, $total, $params['page'], $params['limit']);
    }

    private function createProduct() {
        PermissionService::requirePermission('products', 'create');
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
        PermissionService::requirePermission('products', 'edit');
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
        PermissionService::requirePermission('products', 'delete');
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
