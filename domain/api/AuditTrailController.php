<?php

require_once __DIR__ . '/Controller.php';

/**
 * AuditTrailController
 * Provides comprehensive audit trail querying and reporting
 */
class AuditTrailController extends Controller {
    
    public function handle() {
        if (!is_logged_in()) {
            $this->errorResponse('Unauthorized', 401);
        }
        
        $method = $_SERVER['REQUEST_METHOD'];
        
        if ($method === 'GET') {
            $this->getAuditTrail();
        } else {
            $this->errorResponse('Method Not Allowed', 405);
        }
    }
    
    private function getAuditTrail() {
        $params = $this->getPaginationParams();
        $limit = $params['limit'];
        $offset = $params['offset'];
        
        // Filters
        $table_name = $_GET['table_name'] ?? null;
        $record_id = $_GET['record_id'] ?? null;
        $user_id = $_GET['user_id'] ?? null;
        $operation = $_GET['operation'] ?? null;
        $start_date = $_GET['start_date'] ?? null;
        $end_date = $_GET['end_date'] ?? null;
        
        // Build WHERE clause for main query (with alias)
        $where = "WHERE 1=1";
        $whereCount = "WHERE 1=1"; // For COUNT query without alias
        
        if ($table_name) {
            $table_esc = mysqli_real_escape_string($this->conn, $table_name);
            $where .= " AND t.table_name = '$table_esc'";
            $whereCount .= " AND table_name = '$table_esc'";
        }
        
        if ($record_id) {
            $record_esc = intval($record_id);
            $where .= " AND t.record_id = $record_esc";
            $whereCount .= " AND record_id = $record_esc";
        }
        
        if ($user_id) {
            $user_esc = intval($user_id);
            $where .= " AND t.user_id = $user_esc";
            $whereCount .= " AND user_id = $user_esc";
        }
        
        if ($operation) {
            $op_esc = mysqli_real_escape_string($this->conn, $operation);
            $where .= " AND t.operation = '$op_esc'";
            $whereCount .= " AND operation = '$op_esc'";
        }
        
        if ($start_date) {
            $start_esc = mysqli_real_escape_string($this->conn, $start_date);
            $where .= " AND t.created_at >= '$start_esc'";
            $whereCount .= " AND created_at >= '$start_esc'";
        }
        
        if ($end_date) {
            $end_esc = mysqli_real_escape_string($this->conn, $end_date);
            $where .= " AND t.created_at <= '$end_esc 23:59:59'";
            $whereCount .= " AND created_at <= '$end_esc 23:59:59'";
        }
        
        $result = mysqli_query($this->conn, 
            "SELECT t.*, u.username as user_name
             FROM telescope t
             LEFT JOIN users u ON t.user_id = u.id
             $where
             ORDER BY t.created_at DESC
             LIMIT $limit OFFSET $offset");
        
        $audit_logs = [];
        while ($row = mysqli_fetch_assoc($result)) {
            // Parse JSON fields
            $old_values = json_decode($row['old_values'] ?? '{}', true);
            $new_values = json_decode($row['new_values'] ?? '{}', true);
            
            $audit_logs[] = [
                'id' => intval($row['id']),
                'user_id' => intval($row['user_id']),
                'user_name' => $row['user_name'],
                'operation' => $row['operation'],
                'table_name' => $row['table_name'],
                'record_id' => $row['record_id'] ? intval($row['record_id']) : null,
                'old_values' => $old_values,
                'new_values' => $new_values,
                'ip_address' => $row['ip_address'],
                'user_agent' => $row['user_agent'],
                'created_at' => $row['created_at']
            ];
        }
        
        $countResult = mysqli_query($this->conn, "SELECT COUNT(*) as total FROM telescope $whereCount");
        $total = mysqli_fetch_assoc($countResult)['total'];
        
        // Get summary statistics
        $statsResult = mysqli_query($this->conn, 
            "SELECT 
                operation,
                COUNT(*) as count
             FROM telescope
             $whereCount
             GROUP BY operation");
        
        $stats = [];
        while ($stat_row = mysqli_fetch_assoc($statsResult)) {
            $stats[$stat_row['operation']] = intval($stat_row['count']);
        }
        
        $this->paginatedResponse([
            'logs' => $audit_logs,
            'statistics' => $stats
        ], $total, $params['page'], $params['limit']);
    }
}

?>
