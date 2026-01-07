<?php

require_once __DIR__ . '/Controller.php';
require_once __DIR__ . '/../Services/PermissionService.php';

class CategoriesController extends Controller {

    public function handle() {
        if (!is_logged_in()) {
            $this->errorResponse('Unauthorized', 401);
        }

        PermissionService::requirePermission('products', 'view');

        $method = $_SERVER['REQUEST_METHOD'];

        if ($method === 'GET') {
            $this->getCategories();
        } elseif ($method === 'POST') {
            PermissionService::requirePermission('products', 'create');
            $this->createCategory();
        }
    }

    private function getCategories() {
        $result = mysqli_query($this->conn, "
            SELECT c.*, u.username as creator_name 
            FROM categories c 
            LEFT JOIN users u ON c.created_by = u.id 
            ORDER BY c.name ASC
        ");
        $categories = [];
        while ($row = mysqli_fetch_assoc($result)) {
            $categories[] = $row;
        }
        $this->successResponse(['data' => $categories]);
    }


    private function createCategory() {
        $data = $this->getJsonInput();
        $name = mysqli_real_escape_string($this->conn, $data['name'] ?? '');
        
        if (empty($name)) {
            $this->errorResponse('Category name is required', 400);
        }
        
        $user_id = $_SESSION['user_id'];
        $stmt = mysqli_prepare($this->conn, "INSERT INTO categories (name, created_by) VALUES (?, ?)");
        mysqli_stmt_bind_param($stmt, "si", $name, $user_id);

        
        if (mysqli_stmt_execute($stmt)) {
            $cat_id = mysqli_insert_id($this->conn);
            log_operation('CREATE', 'categories', $cat_id, null, $data);
            $this->successResponse(['id' => $cat_id]);
        } else {
            $this->errorResponse(mysqli_error($this->conn));
        }

    }
}
