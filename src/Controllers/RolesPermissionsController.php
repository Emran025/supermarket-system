<?php

require_once __DIR__ . '/Controller.php';
require_once __DIR__ . '/../Services/PermissionService.php';

/**
 * RolesPermissionsController
 * Manages roles and their permissions (admin only)
 */
class RolesPermissionsController extends Controller {

    public function handle() {
        if (!is_logged_in()) {
            $this->errorResponse('Unauthorized', 401);
        }

        // Only admin can manage roles and permissions
        PermissionService::requirePermission('roles_permissions', 'view');

        $action = $_GET['action'] ?? '';
        $method = $_SERVER['REQUEST_METHOD'];

        if ($method === 'GET') {
            if ($action === 'roles') {
                $this->getRoles();
            } elseif ($action === 'modules') {
                $this->getModules();
            } elseif ($action === 'role_permissions') {
                $this->getRolePermissions();
            } else {
                $this->getRoles();
            }
        } elseif ($method === 'POST') {
            if ($action === 'create_role') {
                PermissionService::requirePermission('roles_permissions', 'create');
                $this->createRole();
            } elseif ($action === 'update_permissions') {
                PermissionService::requirePermission('roles_permissions', 'edit');
                $this->updatePermissions();
            }
        } elseif ($method === 'PUT') {
            PermissionService::requirePermission('roles_permissions', 'edit');
            $this->updateRole();
        } elseif ($method === 'DELETE') {
            PermissionService::requirePermission('roles_permissions', 'delete');
            $this->deleteRole();
        }
    }

    /**
     * Get all roles
     */
    private function getRoles() {
        $result = mysqli_query($this->conn, "
            SELECT 
                r.id, 
                r.role_key, 
                r.role_name_ar, 
                r.role_name_en, 
                r.description, 
                r.is_system, 
                r.is_active,
                r.created_at,
                u.username as created_by_name,
                (SELECT COUNT(*) FROM users WHERE role_id = r.id) as user_count
            FROM roles r
            LEFT JOIN users u ON r.created_by = u.id
            ORDER BY 
                CASE r.role_key 
                    WHEN 'admin' THEN 1 
                    WHEN 'manager' THEN 2 
                    WHEN 'accountant' THEN 3 
                    WHEN 'cashier' THEN 4 
                    ELSE 5 
                END,
                r.role_name_ar ASC
        ");

        $roles = [];
        while ($row = mysqli_fetch_assoc($result)) {
            $roles[] = $row;
        }

        $this->successResponse(['data' => $roles]);
    }

    /**
     * Get all modules grouped by category
     */
    private function getModules() {
        $result = mysqli_query($this->conn, "
            SELECT 
                id, 
                module_key, 
                module_name_ar, 
                module_name_en, 
                category, 
                icon, 
                sort_order
            FROM modules
            WHERE is_active = 1
            ORDER BY sort_order ASC, module_name_ar ASC
        ");

        $modules = [];
        while ($row = mysqli_fetch_assoc($result)) {
            $category = $row['category'] ?? 'other';
            if (!isset($modules[$category])) {
                $modules[$category] = [];
            }
            $modules[$category][] = $row;
        }

        $this->successResponse(['data' => $modules]);
    }

    /**
     * Get permissions for a specific role
     */
    private function getRolePermissions() {
        $role_id = intval($_GET['role_id'] ?? 0);

        if ($role_id <= 0) {
            $this->errorResponse('Invalid role ID', 400);
        }

        $permissions = PermissionService::getRolePermissions($role_id);

        $this->successResponse(['data' => $permissions]);
    }

    /**
     * Create a new role
     */
    private function createRole() {
        $data = $this->getJsonInput();

        $role_key = mysqli_real_escape_string($this->conn, $data['role_key'] ?? '');
        $role_name_ar = mysqli_real_escape_string($this->conn, $data['role_name_ar'] ?? '');
        $role_name_en = mysqli_real_escape_string($this->conn, $data['role_name_en'] ?? '');
        $description = mysqli_real_escape_string($this->conn, $data['description'] ?? '');

        if (empty($role_key) || empty($role_name_ar)) {
            $this->errorResponse('Role key and Arabic name are required', 400);
        }

        // Validate role_key format (lowercase, alphanumeric, underscores only)
        if (!preg_match('/^[a-z0-9_]+$/', $role_key)) {
            $this->errorResponse('Role key must be lowercase alphanumeric with underscores only', 400);
        }

        // Check if role_key already exists
        $check_stmt = mysqli_prepare($this->conn, "SELECT id FROM roles WHERE role_key = ?");
        mysqli_stmt_bind_param($check_stmt, "s", $role_key);
        mysqli_stmt_execute($check_stmt);
        $check_result = mysqli_stmt_get_result($check_stmt);
        
        if (mysqli_num_rows($check_result) > 0) {
            $this->errorResponse('Role key already exists', 400);
        }
        mysqli_stmt_close($check_stmt);

        $user_id = $_SESSION['user_id'];

        $stmt = mysqli_prepare($this->conn, "
            INSERT INTO roles (role_key, role_name_ar, role_name_en, description, is_system, is_active, created_by)
            VALUES (?, ?, ?, ?, 0, 1, ?)
        ");
        mysqli_stmt_bind_param($stmt, "ssssi", $role_key, $role_name_ar, $role_name_en, $description, $user_id);

        if (mysqli_stmt_execute($stmt)) {
            $role_id = mysqli_insert_id($this->conn);
            mysqli_stmt_close($stmt);

            log_operation('CREATE', 'roles', $role_id, null, $data);
            $this->successResponse(['id' => $role_id], 'Role created successfully');
        } else {
            mysqli_stmt_close($stmt);
            $this->errorResponse('Failed to create role');
        }
    }

    /**
     * Update role information
     */
    private function updateRole() {
        $data = $this->getJsonInput();

        $role_id = intval($data['id'] ?? 0);
        $role_name_ar = mysqli_real_escape_string($this->conn, $data['role_name_ar'] ?? '');
        $role_name_en = mysqli_real_escape_string($this->conn, $data['role_name_en'] ?? '');
        $description = mysqli_real_escape_string($this->conn, $data['description'] ?? '');
        $is_active = isset($data['is_active']) ? intval($data['is_active']) : 1;

        if ($role_id <= 0 || empty($role_name_ar)) {
            $this->errorResponse('Role ID and Arabic name are required', 400);
        }

        // Check if role is system role (cannot modify role_key)
        $check_stmt = mysqli_prepare($this->conn, "SELECT is_system, role_key FROM roles WHERE id = ?");
        mysqli_stmt_bind_param($check_stmt, "i", $role_id);
        mysqli_stmt_execute($check_stmt);
        $check_result = mysqli_stmt_get_result($check_stmt);
        $role = mysqli_fetch_assoc($check_result);
        mysqli_stmt_close($check_stmt);

        if (!$role) {
            $this->errorResponse('Role not found', 404);
        }

        $stmt = mysqli_prepare($this->conn, "
            UPDATE roles 
            SET role_name_ar = ?, role_name_en = ?, description = ?, is_active = ?
            WHERE id = ?
        ");
        mysqli_stmt_bind_param($stmt, "sssii", $role_name_ar, $role_name_en, $description, $is_active, $role_id);

        if (mysqli_stmt_execute($stmt)) {
            mysqli_stmt_close($stmt);
            log_operation('UPDATE', 'roles', $role_id, null, $data);
            $this->successResponse([], 'Role updated successfully');
        } else {
            mysqli_stmt_close($stmt);
            $this->errorResponse('Failed to update role');
        }
    }

    /**
     * Delete a role (only non-system roles)
     */
    private function deleteRole() {
        $data = $this->getJsonInput();
        $role_id = intval($data['id'] ?? 0);

        if ($role_id <= 0) {
            $this->errorResponse('Invalid role ID', 400);
        }

        // Check if role is system role
        $check_stmt = mysqli_prepare($this->conn, "SELECT is_system, role_key FROM roles WHERE id = ?");
        mysqli_stmt_bind_param($check_stmt, "i", $role_id);
        mysqli_stmt_execute($check_stmt);
        $check_result = mysqli_stmt_get_result($check_stmt);
        $role = mysqli_fetch_assoc($check_result);
        mysqli_stmt_close($check_stmt);

        if (!$role) {
            $this->errorResponse('Role not found', 404);
        }

        if ($role['is_system']) {
            $this->errorResponse('Cannot delete system role', 403);
        }

        // Check if role has users
        $user_check = mysqli_query($this->conn, "SELECT COUNT(*) as count FROM users WHERE role_id = $role_id");
        $user_count = mysqli_fetch_assoc($user_check)['count'];

        if ($user_count > 0) {
            $this->errorResponse('Cannot delete role with assigned users. Reassign users first.', 400);
        }

        // Delete role (cascade will delete permissions)
        $stmt = mysqli_prepare($this->conn, "DELETE FROM roles WHERE id = ?");
        mysqli_stmt_bind_param($stmt, "i", $role_id);

        if (mysqli_stmt_execute($stmt)) {
            mysqli_stmt_close($stmt);
            log_operation('DELETE', 'roles', $role_id, null, ['role_key' => $role['role_key']]);
            $this->successResponse([], 'Role deleted successfully');
        } else {
            mysqli_stmt_close($stmt);
            $this->errorResponse('Failed to delete role');
        }
    }

    /**
     * Update permissions for a role
     */
    private function updatePermissions() {
        $data = $this->getJsonInput();

        $role_id = intval($data['role_id'] ?? 0);
        $permissions = $data['permissions'] ?? [];

        if ($role_id <= 0) {
            $this->errorResponse('Invalid role ID', 400);
        }

        if (!is_array($permissions)) {
            $this->errorResponse('Permissions must be an array', 400);
        }

        $success = PermissionService::updateRolePermissions($role_id, $permissions);

        if ($success) {
            log_operation('UPDATE', 'role_permissions', $role_id, null, ['permissions_count' => count($permissions)]);
            $this->successResponse([], 'Permissions updated successfully');
        } else {
            $this->errorResponse('Failed to update permissions');
        }
    }
}
