<?php

require_once __DIR__ . '/db.php';

/**
 * InventoryCostingService - Handles inventory costing and COGS calculations
 */
class InventoryCostingService {
    private $conn;
    
    public function __construct() {
        $this->conn = get_db_connection();
    }
    
    /**
     * Record purchase in inventory costing
     */
    public function recordPurchase($product_id, $purchase_id, $quantity, $unit_cost, $total_cost, $costing_method = 'FIFO') {
        $stmt = mysqli_prepare($this->conn, 
            "INSERT INTO inventory_costing (product_id, purchase_id, quantity, unit_cost, total_cost, costing_method, reference_type, reference_id) 
             VALUES (?, ?, ?, ?, ?, ?, 'purchases', ?)");
        mysqli_stmt_bind_param($stmt, "iiiddsi", $product_id, $purchase_id, $quantity, $unit_cost, $total_cost, $costing_method, $purchase_id);
        mysqli_stmt_execute($stmt);
        $costing_id = mysqli_insert_id($this->conn);
        mysqli_stmt_close($stmt);
        
        // Update weighted average cost
        $this->updateWeightedAverageCost($product_id);
        
        return $costing_id;
    }
    
    /**
     * Calculate COGS for a sale using FIFO method
     */
    public function calculateCOGS_FIFO($product_id, $quantity) {
        $remaining_qty = $quantity;
        $total_cogs = 0;
        $costing_records = [];
        
        // Get unsold inventory in FIFO order (oldest first)
        $result = mysqli_query($this->conn, 
            "SELECT id, quantity, unit_cost, total_cost 
             FROM inventory_costing 
             WHERE product_id = $product_id AND is_sold = 0 
             ORDER BY transaction_date ASC, id ASC");
        
        while (($row = mysqli_fetch_assoc($result)) && $remaining_qty > 0) {
            $available_qty = intval($row['quantity']);
            $unit_cost = floatval($row['unit_cost']);
            $costing_id = intval($row['id']);
            
            if ($available_qty <= $remaining_qty) {
                // Use entire batch
                $total_cogs += floatval($row['total_cost']);
                $remaining_qty -= $available_qty;
                $costing_records[] = ['id' => $costing_id, 'quantity' => $available_qty];
            } else {
                // Use partial batch
                $partial_cost = $remaining_qty * $unit_cost;
                $total_cogs += $partial_cost;
                
                // Update the record to split it
                $new_qty = $available_qty - $remaining_qty;
                $new_total = $new_qty * $unit_cost;
                
                mysqli_query($this->conn, 
                    "UPDATE inventory_costing SET quantity = $new_qty, total_cost = $new_total WHERE id = $costing_id");
                
                // Create new record for sold portion
                mysqli_query($this->conn, 
                    "INSERT INTO inventory_costing (product_id, quantity, unit_cost, total_cost, is_sold, reference_type, reference_id) 
                     VALUES ($product_id, $remaining_qty, $unit_cost, $partial_cost, 1, 'sales', 0)");
                
                $costing_records[] = ['id' => $costing_id, 'quantity' => $remaining_qty];
                $remaining_qty = 0;
            }
        }
        
        if ($remaining_qty > 0) {
            // Not enough inventory - use weighted average as fallback
            $wac = $this->getWeightedAverageCost($product_id);
            $fallback_cost = $remaining_qty * $wac;
            $total_cogs += $fallback_cost;
        }
        
        // Mark records as sold
        foreach ($costing_records as $record) {
            mysqli_query($this->conn, 
                "UPDATE inventory_costing SET is_sold = 1, sold_at = NOW() WHERE id = {$record['id']}");
        }
        
        return $total_cogs;
    }
    
    /**
     * Calculate COGS using Weighted Average method
     */
    public function calculateCOGS_WeightedAverage($product_id, $quantity) {
        $wac = $this->getWeightedAverageCost($product_id);
        $total_cogs = $quantity * $wac;
        
        // Mark inventory as sold (proportionally)
        $result = mysqli_query($this->conn, 
            "SELECT id, quantity FROM inventory_costing 
             WHERE product_id = $product_id AND is_sold = 0 
             ORDER BY transaction_date ASC");
        
        $remaining_qty = $quantity;
        while (($row = mysqli_fetch_assoc($result)) && $remaining_qty > 0) {
            $available_qty = intval($row['quantity']);
            $costing_id = intval($row['id']);
            
            if ($available_qty <= $remaining_qty) {
                mysqli_query($this->conn, 
                    "UPDATE inventory_costing SET is_sold = 1, sold_at = NOW() WHERE id = $costing_id");
                $remaining_qty -= $available_qty;
            } else {
                // Split the record
                $new_qty = $available_qty - $remaining_qty;
                $new_total = $new_qty * $wac;
                
                mysqli_query($this->conn, 
                    "UPDATE inventory_costing SET quantity = $new_qty, total_cost = $new_total WHERE id = $costing_id");
                
                mysqli_query($this->conn, 
                    "INSERT INTO inventory_costing (product_id, quantity, unit_cost, total_cost, is_sold, reference_type, reference_id) 
                     VALUES ($product_id, $remaining_qty, $wac, $remaining_qty * $wac, 1, 'sales', 0)");
                
                $remaining_qty = 0;
            }
        }
        
        return $total_cogs;
    }
    
    /**
     * Update weighted average cost for a product
     */
    private function updateWeightedAverageCost($product_id) {
        $result = mysqli_query($this->conn, 
            "SELECT SUM(quantity) as total_qty, SUM(total_cost) as total_cost 
             FROM inventory_costing 
             WHERE product_id = $product_id AND is_sold = 0");
        
        $row = mysqli_fetch_assoc($result);
        $total_qty = floatval($row['total_qty'] ?? 0);
        $total_cost = floatval($row['total_cost'] ?? 0);
        
        if ($total_qty > 0) {
            $wac = $total_cost / $total_qty;
            mysqli_query($this->conn, 
                "UPDATE products SET weighted_average_cost = $wac WHERE id = $product_id");
        }
    }
    
    /**
     * Get weighted average cost for a product
     */
    public function getWeightedAverageCost($product_id) {
        $result = mysqli_query($this->conn, 
            "SELECT weighted_average_cost FROM products WHERE id = $product_id");
        $row = mysqli_fetch_assoc($result);
        return floatval($row['weighted_average_cost'] ?? 0);
    }
    
    /**
     * Get current inventory value
     */
    public function getInventoryValue($product_id = null) {
        if ($product_id) {
            $filter = "WHERE product_id = $product_id AND is_sold = 0";
        } else {
            $filter = "WHERE is_sold = 0";
        }
        
        $result = mysqli_query($this->conn, 
            "SELECT SUM(total_cost) as total_value 
             FROM inventory_costing 
             $filter");
        
        $row = mysqli_fetch_assoc($result);
        return floatval($row['total_value'] ?? 0);
    }
}

?>
