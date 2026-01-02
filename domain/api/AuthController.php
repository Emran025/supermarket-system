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
            log_operation('LOGIN', 'users', $_SESSION['user_id']);
            $this->successResponse([], 'Login successful');
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
            
            // Return user info including role
            $user_id = $_SESSION['user_id'];
            $stmt = mysqli_prepare($this->conn, "SELECT username, role FROM users WHERE id = ?");
            mysqli_stmt_bind_param($stmt, "i", $user_id);
            mysqli_stmt_execute($stmt);
            $result = mysqli_stmt_get_result($stmt);
            $user = mysqli_fetch_assoc($result);

            $this->successResponse(['user' => $user]);
        } else {
            $this->errorResponse('Unauthorized', 401);
        }
    }
}
