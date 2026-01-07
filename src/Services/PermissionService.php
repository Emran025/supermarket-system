<?php

/**
 * PermissionService - Dynamic Database-Driven RBAC Implementation
 * 
 * Philosophy: Load permissions from database, cache in session
 * Allows admin to manage roles and permissions through UI
 */
class PermissionService {
    
    /**
     * Load permissions for a given role from database
     * @param int $role_id - Role ID from roles table
     * @return array - Permission matrix
     */
    public static function loadPermissions($role_id) {
        $conn = get_db_connection();
        
        // Query permissions for this role
        $stmt = mysqli_prepare($conn, "
            SELECT 
                m.module_key,
                rp.can_view,
                rp.can_create,
                rp.can_edit,
                rp.can_delete
            FROM role_permissions rp
            INNER JOIN modules m ON rp.module_id = m.id
            WHERE rp.role_id = ? AND m.is_active = 1
        ");
        
        mysqli_stmt_bind_param($stmt, "i", $role_id);
        mysqli_stmt_execute($stmt);
        $result = mysqli_stmt_get_result($stmt);
        
        $permissions = [];
        
        while ($row = mysqli_fetch_assoc($result)) {
            $permissions[$row['module_key']] = [
                'view' => (bool)$row['can_view'],
                'create' => (bool)$row['can_create'],
                'edit' => (bool)$row['can_edit'],
                'delete' => (bool)$row['can_delete']
            ];
        }
        
        mysqli_stmt_close($stmt);
        
        // Check if this is admin role (wildcard access)
        $role_stmt = mysqli_prepare($conn, "SELECT role_key FROM roles WHERE id = ?");
        mysqli_stmt_bind_param($role_stmt, "i", $role_id);
        mysqli_stmt_execute($role_stmt);
        $role_result = mysqli_stmt_get_result($role_stmt);
        $role_data = mysqli_fetch_assoc($role_result);
        mysqli_stmt_close($role_stmt);
        
        // If admin, add wildcard permission
        if ($role_data && $role_data['role_key'] === 'admin') {
            $permissions['*'] = [
                'view' => true,
                'create' => true,
                'edit' => true,
                'delete' => true
            ];
        }
        
        return $permissions;
    }
    
    /**
     * Load permissions by role key (for backward compatibility)
     * @param string $role_key - Role key (admin, cashier, etc.)
     * @return array - Permission matrix
     */
    public static function loadPermissionsByKey($role_key) {
        $conn = get_db_connection();
        
        $stmt = mysqli_prepare($conn, "SELECT id FROM roles WHERE role_key = ? AND is_active = 1");
        mysqli_stmt_bind_param($stmt, "s", $role_key);
        mysqli_stmt_execute($stmt);
        $result = mysqli_stmt_get_result($stmt);
        $role = mysqli_fetch_assoc($result);
        mysqli_stmt_close($stmt);
        
        if (!$role) {
            // Fallback: return empty permissions
            return [];
        }
        
        return self::loadPermissions($role['id']);
    }
    
    /**
     * Check if current user can perform action on module
     * @param string $module - Module key (e.g., 'sales', 'users')
     * @param string $action - Action type (view, create, edit, delete)
     * @return bool - True if allowed, false otherwise
     */
    public static function can($module, $action = 'view') {
        // Check if permissions are loaded in session
        if (!isset($_SESSION['permissions'])) {
            return false;
        }
        
        $permissions = $_SESSION['permissions'];
        
        // Check for admin wildcard (full access)
        if (isset($permissions['*'])) {
            return $permissions['*'][$action] ?? false;
        }
        
        // Check module-specific permission
        if (isset($permissions[$module])) {
            return $permissions[$module][$action] ?? false;
        }
        
        // Default deny (if module not in permission list)
        return false;
    }
    
    /**
     * Require permission or exit with 403
     * @param string $module - Module key
     * @param string $action - Action type (view, create, edit, delete)
     */
    public static function requirePermission($module, $action = 'view') {
        if (!self::can($module, $action)) {
            http_response_code(403);
            echo json_encode([
                'success' => false, 
                'message' => 'Access denied. You do not have permission to ' . $action . ' ' . $module . '.'
            ]);
            exit;
        }
    }
    
    /**
     * Get all permissions for current user (for debugging/frontend)
     * @return array - Full permission matrix
     */
    public static function getAllPermissions() {
        return $_SESSION['permissions'] ?? [];
    }
    
    /**
     * Check if current user has a specific role
     * @param string $role_key - Role key to check
     * @return bool
     */
    public static function hasRole($role_key) {
        if (!isset($_SESSION['role_key'])) {
            return false;
        }
        return $_SESSION['role_key'] === $role_key;
    }
    
    /**
     * Check if current user is admin
     * @return bool
     */
    public static function isAdmin() {
        return self::hasRole('admin');
    }
    
    /**
     * Get all active roles (for dropdowns)
     * @return array - Array of roles
     */
    public static function getAllRoles() {
        $conn = get_db_connection();
        
        $result = mysqli_query($conn, "
            SELECT id, role_key, role_name_ar, role_name_en, description, is_system
            FROM roles 
            WHERE is_active = 1 
            ORDER BY 
                CASE role_key 
                    WHEN 'admin' THEN 1 
                    WHEN 'manager' THEN 2 
                    WHEN 'accountant' THEN 3 
                    WHEN 'cashier' THEN 4 
                    ELSE 5 
                END,
                role_name_ar ASC
        ");
        
        $roles = [];
        while ($row = mysqli_fetch_assoc($result)) {
            $roles[] = $row;
        }
        
        return $roles;
    }
    
    /**
     * Get all active modules (for permission management)
     * @return array - Array of modules grouped by category
     */
    public static function getAllModules() {
        $conn = get_db_connection();
        
        $result = mysqli_query($conn, "
            SELECT id, module_key, module_name_ar, module_name_en, category, icon, sort_order
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
        
        return $modules;
    }
    
    /**
     * Get permissions for a specific role
     * @param int $role_id - Role ID
     * @return array - Array of module permissions
     */
    public static function getRolePermissions($role_id) {
        $conn = get_db_connection();
        
        $stmt = mysqli_prepare($conn, "
            SELECT 
                m.id as module_id,
                m.module_key,
                m.module_name_ar,
                m.module_name_en,
                m.category,
                COALESCE(rp.can_view, 0) as can_view,
                COALESCE(rp.can_create, 0) as can_create,
                COALESCE(rp.can_edit, 0) as can_edit,
                COALESCE(rp.can_delete, 0) as can_delete
            FROM modules m
            LEFT JOIN role_permissions rp ON m.id = rp.module_id AND rp.role_id = ?
            WHERE m.is_active = 1
            ORDER BY m.sort_order ASC, m.module_name_ar ASC
        ");
        
        mysqli_stmt_bind_param($stmt, "i", $role_id);
        mysqli_stmt_execute($stmt);
        $result = mysqli_stmt_get_result($stmt);
        
        $permissions = [];
        while ($row = mysqli_fetch_assoc($result)) {
            $permissions[] = $row;
        }
        
        mysqli_stmt_close($stmt);
        
        return $permissions;
    }
    
    /**
     * Update permissions for a role
     * @param int $role_id - Role ID
     * @param array $permissions - Array of module permissions
     * @return bool - Success status
     */
    public static function updateRolePermissions($role_id, $permissions) {
        $conn = get_db_connection();
        
        mysqli_begin_transaction($conn);
        
        try {
            // Delete existing permissions for this role
            $delete_stmt = mysqli_prepare($conn, "DELETE FROM role_permissions WHERE role_id = ?");
            mysqli_stmt_bind_param($delete_stmt, "i", $role_id);
            mysqli_stmt_execute($delete_stmt);
            mysqli_stmt_close($delete_stmt);
            
            // Insert new permissions
            $insert_stmt = mysqli_prepare($conn, "
                INSERT INTO role_permissions 
                (role_id, module_id, can_view, can_create, can_edit, can_delete, created_by) 
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ");
            
            $user_id = $_SESSION['user_id'] ?? null;
            
            foreach ($permissions as $perm) {
                $module_id = intval($perm['module_id']);
                $can_view = isset($perm['can_view']) ? 1 : 0;
                $can_create = isset($perm['can_create']) ? 1 : 0;
                $can_edit = isset($perm['can_edit']) ? 1 : 0;
                $can_delete = isset($perm['can_delete']) ? 1 : 0;
                
                // Only insert if at least one permission is granted
                if ($can_view || $can_create || $can_edit || $can_delete) {
                    mysqli_stmt_bind_param(
                        $insert_stmt, 
                        "iiiiiii", 
                        $role_id, 
                        $module_id, 
                        $can_view, 
                        $can_create, 
                        $can_edit, 
                        $can_delete,
                        $user_id
                    );
                    mysqli_stmt_execute($insert_stmt);
                }
            }
            
            mysqli_stmt_close($insert_stmt);
            mysqli_commit($conn);
            
            return true;
        } catch (Exception $e) {
            mysqli_rollback($conn);
            error_log("Failed to update role permissions: " . $e->getMessage());
            return false;
        }
    }
}
