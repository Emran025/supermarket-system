<?php

require_once __DIR__ . '/Controller.php';

class UsersController extends Controller {

    public function handle() {
        if (!is_logged_in()) {
            $this->errorResponse('Unauthorized', 401);
        }

        $action = $_GET['action'] ?? '';
        $method = $_SERVER['REQUEST_METHOD'];

        if ($action === 'users') {
            // Only admin can manage users
            if (!$this->isAdmin()) {
                $this->errorResponse('Forbidden', 403);
            }

            if ($method === 'GET') {
                $this->getUsers();
            } elseif ($method === 'POST') {
                $this->createUser();
            } elseif ($method === 'PUT') {
                $this->updateUser(); // For deactivation/role change
            }
        } elseif ($action === 'change_password') {
            $this->changePassword();
        } elseif ($action === 'my_sessions') {
            $this->getMySessions();
        } elseif ($action === 'manager_list') {
            $this->getManagerList();
        }
    }

    private function getManagerList() {
        $result = mysqli_query($this->conn, "SELECT id, username, role FROM users WHERE is_active = 1 ORDER BY username ASC");
        $users = [];
        while ($row = mysqli_fetch_assoc($result)) {
            $users[] = $row;
        }
        $this->successResponse(['data' => $users]);
    }

    private function isAdmin() {
        if (!isset($_SESSION['user_id'])) return false;
        $user_id = $_SESSION['user_id'];
        $stmt = mysqli_prepare($this->conn, "SELECT role FROM users WHERE id = ?");
        mysqli_stmt_bind_param($stmt, "i", $user_id);
        mysqli_stmt_execute($stmt);
        $result = mysqli_stmt_get_result($stmt);
        $user = mysqli_fetch_assoc($result);
        return ($user && $user['role'] === 'admin');
    }

    private function getUsers() {
        $params = $this->getPaginationParams();
        $limit = $params['limit'];
        $offset = $params['offset'];

        // Count total
        $countResult = mysqli_query($this->conn, "SELECT COUNT(*) as total FROM users");
        $total = mysqli_fetch_assoc($countResult)['total'];

        $sql = "SELECT u.id, u.username, u.role, u.is_active, u.created_at, u.manager_id, m.username as manager_name, c.username as creator_name
                FROM users u 
                LEFT JOIN users m ON u.manager_id = m.id 
                LEFT JOIN users c ON u.created_by = c.id
                ORDER BY u.created_at DESC
                LIMIT $limit OFFSET $offset";

        $result = mysqli_query($this->conn, $sql);
        $users = [];
        while ($row = mysqli_fetch_assoc($result)) {
            $users[] = $row;
        }
        $this->paginatedResponse($users, $total, $params['page'], $params['limit']);
    }

    private function createUser() {
        $data = $this->getJsonInput();
        $username = mysqli_real_escape_string($this->conn, $data['username'] ?? '');
        $password = $data['password'] ?? '';
        $role = mysqli_real_escape_string($this->conn, $data['role'] ?? 'sales');
        $manager_id = isset($data['manager_id']) && !empty($data['manager_id']) ? intval($data['manager_id']) : null;

        if (empty($username) || empty($password)) {
            $this->errorResponse('Username and password are required', 400);
        }

        // Check if username exists
        $check = mysqli_query($this->conn, "SELECT id FROM users WHERE username = '$username'");
        if (mysqli_num_rows($check) > 0) {
            $this->errorResponse('Username already exists', 400);
        }

        $hashed_password = password_hash($password, PASSWORD_DEFAULT);
        $current_user_id = $_SESSION['user_id'];
        
        $sql = "INSERT INTO users (username, password, role, is_active, manager_id, created_by) VALUES (?, ?, ?, 1, ?, ?)";
        $stmt = mysqli_prepare($this->conn, $sql);
        mysqli_stmt_bind_param($stmt, "sssi i", $username, $hashed_password, $role, $manager_id, $current_user_id);

        
        if (mysqli_stmt_execute($stmt)) {
            $new_user_id = mysqli_insert_id($this->conn);
            log_operation('CREATE', 'users', $new_user_id, null, ['username' => $username, 'role' => $role]);
            $this->successResponse(['id' => $new_user_id]);
        } else {
            $this->errorResponse(mysqli_error($this->conn));
        }

    }

    private function updateUser() {
        $data = $this->getJsonInput();
        $id = intval($data['id'] ?? 0);
        $role = mysqli_real_escape_string($this->conn, $data['role'] ?? '');
        $is_active = isset($data['is_active']) ? intval($data['is_active']) : null;
        $manager_id = isset($data['manager_id']) ? ($data['manager_id'] ? intval($data['manager_id']) : null) : -1; // -1 as sentinel for "no change" if key not present, but for now assuming frontend sends full object or specific keys.
        // Actually safe way: check if key exists.
        
        // Don't allow modifying self role/status to avoid lockout (basic protection)
        if ($id == $_SESSION['user_id']) {
             $this->errorResponse('Cannot modify your own account status/role', 403);
        }

        if ($manager_id !== -1 && $manager_id == $id) {
            $this->errorResponse('User cannot be their own manager', 400);
        }

        $updates = [];
        $types = "";
        $params = [];

        if ($role) {
            $updates[] = "role = ?";
            $types .= "s";
            $params[] = $role;
        }
        if ($is_active !== null) {
            $updates[] = "is_active = ?";
            $types .= "i";
            $params[] = $is_active;
        }
        if (array_key_exists('manager_id', $data)) {
             $updates[] = "manager_id = ?";
             $types .= "i";
             // Use variable for binding reference/value
             $mgr_val = empty($data['manager_id']) ? null : intval($data['manager_id']);
             if ($mgr_val == $id) {
                 $this->errorResponse('User cannot be their own manager', 400);
             }
             $params[] = $mgr_val;
        }

        if (empty($updates)) {
            $this->errorResponse('No changes provided', 400);
        }

        $params[] = $id;
        $types .= "i";
        
        $sql = "UPDATE users SET " . implode(", ", $updates) . " WHERE id = ?";
        $stmt = mysqli_prepare($this->conn, $sql);
        mysqli_stmt_bind_param($stmt, $types, ...$params);
        
        if (mysqli_stmt_execute($stmt)) {
            log_operation('UPDATE', 'users', $id, null, $data);
            $this->successResponse();
        } else {
            $this->errorResponse(mysqli_error($this->conn));
        }

    }

    private function changePassword() {
        $this->requireMethod('POST');
        $data = $this->getJsonInput();
        $user_id = $_SESSION['user_id'];
        
        $current_password = $data['current_password'] ?? '';
        $new_password = $data['new_password'] ?? '';
        
        if (empty($current_password) || empty($new_password)) {
            $this->errorResponse('All fields are required', 400);
        }
        
        // Verify current password
        $stmt = mysqli_prepare($this->conn, "SELECT password FROM users WHERE id = ?");
        mysqli_stmt_bind_param($stmt, "i", $user_id);
        mysqli_stmt_execute($stmt);
        $result = mysqli_stmt_get_result($stmt);
        $user = mysqli_fetch_assoc($result);
        
        if (!password_verify($current_password, $user['password'])) {
            $this->errorResponse('Incorrect current password', 400);
        }
        
        $hashed_password = password_hash($new_password, PASSWORD_DEFAULT);
        $stmt = mysqli_prepare($this->conn, "UPDATE users SET password = ? WHERE id = ?");
        mysqli_stmt_bind_param($stmt, "si", $hashed_password, $user_id);
        
        if (mysqli_stmt_execute($stmt)) {
            $this->successResponse([], 'Password changed successfully');
        } else {
            $this->errorResponse(mysqli_error($this->conn));
        }
    }

    private function getMySessions() {
        $this->requireMethod('GET');
        $user_id = $_SESSION['user_id'];
        $params = $this->getPaginationParams();
        $limit = $params['limit'];
        $offset = $params['offset'];

        // Count total
        $countResult = mysqli_query($this->conn, "SELECT COUNT(*) as total FROM sessions WHERE user_id = $user_id");
        $total = mysqli_fetch_assoc($countResult)['total'];
        
        $result = mysqli_query($this->conn, "SELECT id, ip_address, user_agent, created_at, expires_at, session_token FROM sessions WHERE user_id = $user_id ORDER BY created_at DESC LIMIT $limit OFFSET $offset");
        
        $sessions = [];
        $current_token = $_SESSION['session_token'] ?? '';
        
        while ($row = mysqli_fetch_assoc($result)) {
            $row['is_current'] = ($row['session_token'] === $current_token);
            unset($row['session_token']); // Don't expose tokens
            $sessions[] = $row;
        }
        
        $this->paginatedResponse($sessions, $total, $params['page'], $params['limit']);
    }
}
