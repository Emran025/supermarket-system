<?php

require_once __DIR__ . '/Controller.php';
require_once __DIR__ . '/../Services/PermissionService.php';

class DashboardController extends Controller {

    public function handle() {
        if (!is_logged_in()) {
            $this->errorResponse('Unauthorized', 401);
        }

        PermissionService::requirePermission('dashboard', 'view');
        
        $this->requireMethod('GET');
        
        if (isset($_GET['detail']) && $_GET['detail'] === 'low_stock') {
            $this->getLowStockDetails();
            return;
        }

        if (isset($_GET['detail']) && $_GET['detail'] === 'expiring_soon') {
            $this->getExpiringDetails();
            return;
        }
        
        // Admin sees all, Sales sees limited? Or same dashboard for now?
        // Let's return general stats.
        
        $stats = [
            'total_sales' => 0,
            'total_products' => 0,
            'low_stock_products' => 0,
            'expiring_products' => 0,
            'todays_sales' => 0,
            'total_expenses' => 0,
            'todays_expenses' => 0,
            'total_revenues' => 0,
            'todays_revenues' => 0,
            'total_assets' => 0,
            'sales_breakdown' => [
                'cash' => ['value' => 0, 'count' => 0],
                'credit' => ['value' => 0, 'count' => 0]
            ],
            'today_breakdown' => [
                'cash' => 0,
                'credit' => 0
            ]
        ];
        
        // Total Sales (All time)
        $res = mysqli_query($this->conn, "SELECT SUM(total_amount) as total FROM invoices");
        $row = mysqli_fetch_assoc($res);
        $stats['total_sales'] = floatval($row['total'] ?? 0);

        // Sales Breakdown (Cash vs Credit)
        $res = mysqli_query($this->conn, "
            SELECT 
                payment_type, 
                SUM(total_amount) as total_value, 
                COUNT(*) as total_count 
            FROM invoices 
            GROUP BY payment_type
        ");
        while ($row = mysqli_fetch_assoc($res)) {
            $type = $row['payment_type'] ?: 'cash'; // Default to cash if null
            if (isset($stats['sales_breakdown'][$type])) {
                $stats['sales_breakdown'][$type]['value'] = floatval($row['total_value']);
                $stats['sales_breakdown'][$type]['count'] = intval($row['total_count']);
            }
        }
        
        // Total Products
        $res = mysqli_query($this->conn, "SELECT COUNT(*) as total FROM products");
        $row = mysqli_fetch_assoc($res);
        $stats['total_products'] = intval($row['total']);
        
        // Low Stock (< 10)
        $res = mysqli_query($this->conn, "SELECT COUNT(*) as total FROM products WHERE stock_quantity < 10");
        $row = mysqli_fetch_assoc($res);
        $stats['low_stock_products'] = intval($row['total']);

        // Expiring Soon (Next 30 days)
        $res = mysqli_query($this->conn, "SELECT COUNT(DISTINCT product_id) as total FROM purchases WHERE expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)");
        $row = mysqli_fetch_assoc($res);
        $stats['expiring_products'] = intval($row['total'] ?? 0);
        
        // Today's Sales
        $today = date('Y-m-d');
        $res = mysqli_query($this->conn, "SELECT SUM(total_amount) as total FROM invoices WHERE DATE(created_at) = '$today'");
        $row = mysqli_fetch_assoc($res);
        $stats['todays_sales'] = floatval($row['total'] ?? 0);

        // Today's Breakdown
        $res = mysqli_query($this->conn, "SELECT payment_type, SUM(total_amount) as total FROM invoices WHERE DATE(created_at) = '$today' GROUP BY payment_type");
        while ($row = mysqli_fetch_assoc($res)) {
            $type = $row['payment_type'] ?: 'cash';
            if (isset($stats['today_breakdown'][$type])) {
                $stats['today_breakdown'][$type] = floatval($row['total']);
            }
        }
        
        // Expenses Stats
        $res = mysqli_query($this->conn, "SELECT SUM(amount) as total FROM expenses");
        $row = mysqli_fetch_assoc($res);
        $stats['total_expenses'] = floatval($row['total'] ?? 0);

        $res = mysqli_query($this->conn, "SELECT SUM(amount) as total FROM expenses WHERE DATE(expense_date) = '$today'");
        $row = mysqli_fetch_assoc($res);
        $stats['todays_expenses'] = floatval($row['total'] ?? 0);

        // Revenues Stats
        $res = mysqli_query($this->conn, "SELECT SUM(amount) as total FROM revenues");
        $row = mysqli_fetch_assoc($res);
        $stats['total_revenues'] = floatval($row['total'] ?? 0);

        $res = mysqli_query($this->conn, "SELECT SUM(amount) as total FROM revenues WHERE DATE(revenue_date) = '$today'");
        $row = mysqli_fetch_assoc($res);
        $stats['todays_revenues'] = floatval($row['total'] ?? 0);

        // Assets Stats
        $res = mysqli_query($this->conn, "SELECT SUM(value) as total FROM assets WHERE status = 'active'");
        $row = mysqli_fetch_assoc($res);
        $stats['total_assets'] = floatval($row['total'] ?? 0);
        
        // Recent Activities (Last 5 invoices)
        $recent_sales = [];
        $res = mysqli_query($this->conn, "SELECT id, invoice_number, total_amount, created_at FROM invoices ORDER BY created_at DESC LIMIT 5");
        while ($row = mysqli_fetch_assoc($res)) {
            $recent_sales[] = $row;
        }
        $stats['recent_sales'] = $recent_sales;
        
        $this->successResponse(['data' => $stats]);
    }

    private function getLowStockDetails() {
        // Fetch low stock items with category info
        $query = "SELECT id, name, category, stock_quantity, unit_name, sub_unit_name, items_per_unit, description FROM products WHERE stock_quantity < 10 ORDER BY stock_quantity ASC";
        $res = mysqli_query($this->conn, $query);
        
        if (!$res) {
            $this->errorResponse('Database error: ' . mysqli_error($this->conn));
            return;
        }

        $products = [];
        while ($row = mysqli_fetch_assoc($res)) {
            $products[] = $row;
        }
        
        $this->successResponse(['data' => $products]);
    }

    private function getExpiringDetails() {
        $query = "
            SELECT p.id, p.name, p.category, pur.expiry_date, pur.quantity, p.unit_name, p.sub_unit_name, pur.unit_type
            FROM purchases pur
            JOIN products p ON pur.product_id = p.id
            WHERE pur.expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
            ORDER BY pur.expiry_date ASC
        ";
        $res = mysqli_query($this->conn, $query);
        
        if (!$res) {
            $this->errorResponse('Database error: ' . mysqli_error($this->conn));
            return;
        }

        $items = [];
        while ($row = mysqli_fetch_assoc($res)) {
            $items[] = $row;
        }
        
        $this->successResponse(['data' => $items]);
    }
}
