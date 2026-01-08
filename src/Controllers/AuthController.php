<?php

require_once __DIR__ . '/Controller.php';

class AuthController extends Controller {
    
    public function handle() {
        $action = $_GET['action'] ?? '';
        
        if ($action === 'login') {
            $this->login();
        } elseif ($action === 'logout') {
            $this->logout();
        } elseif ($action === 'check') {
            $this->check();
        } else {
            $this->errorResponse('Invalid action', 400);
        }
    }

    private function login() {
        $this->requireMethod('POST');
        $data = $this->getJsonInput();
        
        $username = $data['username'] ?? '';
        $password = $data['password'] ?? '';
        
        if (empty($username) || empty($password)) {
            $this->errorResponse('Username and password are required', 400);
        }
        
        $result = login($username, $password);
        if ($result['success']) {
            $user_id = $_SESSION['user_id'];
            log_operation('LOGIN', 'users', $user_id);
            
            $userData = $this->getUserSessionData($user_id);
            $this->successResponse([
                'user' => $userData,
                'permissions' => $userData['permissions']
            ], 'Login successful');
        } else {
            $this->errorResponse($result['message'], 401);
        }
    }

    private function logout() {
        $this->requireMethod('POST');
        $user_id = $_SESSION['user_id'] ?? null;
        destroy_session();
        if ($user_id) {
            log_operation('LOGOUT', 'users', $user_id);
        }
        $this->successResponse();

    }

    private function check() {
        $this->requireMethod('GET');
        if (is_logged_in()) {
            $user_id = $_SESSION['user_id'];
            $userData = $this->getUserSessionData($user_id);
            $this->successResponse([
                'user' => $userData,
                'permissions' => $userData['permissions'], // For backward compatibility if any
                'authenticated' => true
            ]);
        } else {
            $this->errorResponse('Unauthorized', 401);
        }
    }

    private function getUserSessionData($user_id) {
        $stmt = mysqli_prepare($this->conn, "
            SELECT u.id, u.username, COALESCE(u.full_name, u.username) as full_name, u.role_id, r.role_key, r.role_name_ar, r.role_name_en
            FROM users u
            LEFT JOIN roles r ON u.role_id = r.id
            WHERE u.id = ?
        ");
        mysqli_stmt_bind_param($stmt, "i", $user_id);
        mysqli_stmt_execute($stmt);
        $result = mysqli_stmt_get_result($stmt);
        $user = mysqli_fetch_assoc($result);

        // Transform permissions from session map to array of objects for frontend
        $permissionsMap = $_SESSION['permissions'] ?? [];
        $formattedPermissions = [];
        
        foreach ($permissionsMap as $module => $perms) {
            $formattedPermissions[] = [
                'module' => $module,
                'can_view' => (bool)($perms['view'] ?? false),
                'can_create' => (bool)($perms['create'] ?? false),
                'can_edit' => (bool)($perms['edit'] ?? false),
                'can_delete' => (bool)($perms['delete'] ?? false)
            ];
        }

        $user['permissions'] = $formattedPermissions;
        
        // Add role key for backward compatibility
        $user['role'] = $user['role_key'] ?? 'cashier';

        return $user;
    }
}
