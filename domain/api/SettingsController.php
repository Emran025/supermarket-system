<?php

require_once __DIR__ . '/Controller.php';

class SettingsController extends Controller {

    public function handle() {
        if (!is_logged_in()) {
            $this->errorResponse('Unauthorized', 401);
        }

        $method = $_SERVER['REQUEST_METHOD'];

        if ($method === 'GET') {
            $this->getSettings();
        } elseif ($method === 'POST') {
            // Only admin can update settings
            if ($_SESSION['role'] !== 'admin') {
                $this->errorResponse('Forbidden', 403);
            }
            $this->updateSettings();
        }
    }

    private function getSettings() {
        $result = mysqli_query($this->conn, "SELECT setting_key, setting_value FROM settings");
        $settings = [];
        while ($row = mysqli_fetch_assoc($result)) {
            $settings[$row['setting_key']] = $row['setting_value'];
        }
        $this->successResponse(['data' => $settings]);
    }

    private function updateSettings() {
        $data = $this->getJsonInput();
        
        mysqli_begin_transaction($this->conn);
        try {
            foreach ($data as $key => $value) {
                $key_esc = mysqli_real_escape_string($this->conn, $key);
                $val_esc = mysqli_real_escape_string($this->conn, $value);
                
                $stmt = mysqli_prepare($this->conn, "INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?");
                mysqli_stmt_bind_param($stmt, "sss", $key_esc, $val_esc, $val_esc);
                mysqli_stmt_execute($stmt);
                mysqli_stmt_close($stmt);
            }
            
            mysqli_commit($this->conn);
            log_operation('UPDATE', 'settings', null, null, $data);
            $this->successResponse([], 'Settings updated successfully');
        } catch (Exception $e) {
            mysqli_rollback($this->conn);
            $this->errorResponse($e->getMessage());
        }
    }
}
