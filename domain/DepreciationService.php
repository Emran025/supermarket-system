<?php

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/LedgerService.php';

/**
 * DepreciationService - Handles automated asset depreciation
 */
class DepreciationService {
    private $conn;
    private $ledgerService;
    
    public function __construct() {
        $this->conn = get_db_connection();
        $this->ledgerService = new LedgerService();
    }
    
    /**
     * Calculate and record depreciation for all active assets
     * Should be run monthly
     */
    public function calculateMonthlyDepreciation($fiscal_period_id = null) {
        // Get all active assets with depreciation rate > 0
        $result = mysqli_query($this->conn, 
            "SELECT id, name, value, purchase_date, depreciation_rate 
             FROM assets 
             WHERE status = 'active' AND depreciation_rate > 0");
        
        $depreciations = [];
        
        while ($asset = mysqli_fetch_assoc($result)) {
            $asset_id = intval($asset['id']);
            $annual_rate = floatval($asset['depreciation_rate']);
            $purchase_value = floatval($asset['value']);
            
            // Calculate monthly depreciation
            $monthly_rate = $annual_rate / 12;
            $monthly_depreciation = $purchase_value * ($monthly_rate / 100);
            
            // Get accumulated depreciation
            $acc_result = mysqli_query($this->conn, 
                "SELECT COALESCE(MAX(accumulated_depreciation), 0) as acc_dep 
                 FROM asset_depreciation 
                 WHERE asset_id = $asset_id");
            $acc_row = mysqli_fetch_assoc($acc_result);
            $accumulated = floatval($acc_row['acc_dep'] ?? 0);
            
            // Calculate new accumulated and book value
            $new_accumulated = $accumulated + $monthly_depreciation;
            $book_value = $purchase_value - $new_accumulated;
            
            // Don't depreciate below zero
            if ($book_value < 0) {
                $monthly_depreciation = $accumulated > 0 ? ($purchase_value - $accumulated) : 0;
                $new_accumulated = $purchase_value;
                $book_value = 0;
            }
            
            if ($monthly_depreciation > 0) {
                $depreciation_date = date('Y-m-d');
                
                mysqli_begin_transaction($this->conn);
                
                try {
                    // Record depreciation
                    $user_id = $_SESSION['user_id'] ?? null;
                    $stmt = mysqli_prepare($this->conn, 
                        "INSERT INTO asset_depreciation (asset_id, depreciation_date, depreciation_amount, accumulated_depreciation, book_value, fiscal_period_id, created_by) 
                         VALUES (?, ?, ?, ?, ?, ?, ?)");
                    mysqli_stmt_bind_param($stmt, "isdddi", $asset_id, $depreciation_date, $monthly_depreciation, $new_accumulated, $book_value, $fiscal_period_id, $user_id);
                    mysqli_stmt_execute($stmt);
                    mysqli_stmt_close($stmt);
                    
                    // Post to General Ledger
                    $voucher_number = $this->ledgerService->getNextVoucherNumber('VOU');
                    
                    $gl_entries = [
                        [
                            'account_code' => '5300', // Depreciation Expense
                            'entry_type' => 'DEBIT',
                            'amount' => $monthly_depreciation,
                            'description' => "إهلاك - {$asset['name']}"
                        ],
                        [
                            'account_code' => '1220', // Accumulated Depreciation
                            'entry_type' => 'CREDIT',
                            'amount' => $monthly_depreciation,
                            'description' => "مخصص إهلاك - {$asset['name']}"
                        ]
                    ];
                    
                    $this->ledgerService->postTransaction($gl_entries, 'asset_depreciation', mysqli_insert_id($this->conn), $voucher_number, $depreciation_date);
                    
                    mysqli_commit($this->conn);
                    
                    $depreciations[] = [
                        'asset_id' => $asset_id,
                        'asset_name' => $asset['name'],
                        'depreciation_amount' => $monthly_depreciation,
                        'book_value' => $book_value
                    ];
                } catch (Exception $e) {
                    mysqli_rollback($this->conn);
                    error_log("Failed to record depreciation for asset $asset_id: " . $e->getMessage());
                }
            }
        }
        
        return $depreciations;
    }
    
    /**
     * Get current book value for an asset
     */
    public function getAssetBookValue($asset_id) {
        $result = mysqli_query($this->conn, 
            "SELECT value, 
                    (SELECT COALESCE(MAX(accumulated_depreciation), 0) FROM asset_depreciation WHERE asset_id = $asset_id) as acc_dep
             FROM assets 
             WHERE id = $asset_id");
        
        if ($result && mysqli_num_rows($result) > 0) {
            $row = mysqli_fetch_assoc($result);
            $purchase_value = floatval($row['value']);
            $accumulated = floatval($row['acc_dep']);
            return $purchase_value - $accumulated;
        }
        
        return 0;
    }
}

?>
