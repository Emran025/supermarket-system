<?php
namespace App\Middleware;

class AuthMiddleware {
    public function handle() {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }

        if (!isset($_SESSION['user_id'])) {
            http_response_code(401);
            echo json_encode(['error' => 'Unauthorized']);
            exit;
        }
    }

    public function requireRole($role) {
        $this->handle();
        // Check using the new role_key session variable
        if (($_SESSION['role_key'] ?? '') !== $role && ($_SESSION['role_key'] ?? '') !== 'admin') {
             http_response_code(403);
             echo json_encode(['success' => false, 'error' => 'Forbidden']);
             exit;
        }
    }

    public function requirePermission($module, $action = 'view') {
        $this->handle();
        require_once __DIR__ . '/../Services/PermissionService.php';
        \PermissionService::requirePermission($module, $action);
    }
}
