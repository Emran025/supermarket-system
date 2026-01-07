<?php

require_once __DIR__ . '/Controller.php';
require_once __DIR__ . '/../LedgerService.php';
require_once __DIR__ . '/../InventoryCostingService.php';
require_once __DIR__ . '/../ChartOfAccountsMappingService.php';

class SalesController extends Controller {
    private $ledgerService;
    private $costingService;
    private $coaMapping;
    
    public function __construct() {
        parent::__construct();
        $this->ledgerService = new LedgerService();
        $this->costingService = new InventoryCostingService();
        $this->coaMapping = new ChartOfAccountsMappingService();
    }

    public function handle() {
        if (!is_logged_in()) {
            $this->errorResponse('Unauthorized', 401);
        }

        $action = $_GET['action'] ?? ''; // 'invoices' or 'invoice_details'
        $method = $_SERVER['REQUEST_METHOD'];

        if ($action === 'invoice_details' && $method === 'GET') {
            $this->getInvoiceDetails();
        } else {
            if ($method === 'GET') {
                $this->getInvoices();
            } elseif ($method === 'POST') {
                $this->createInvoice();
            } elseif ($method === 'DELETE') {
                $this->deleteInvoice();
            }
        }
    }

    private function getInvoices() {
        $params = $this->getPaginationParams();
        $limit = $params['limit'];
        $offset = $params['offset'];
        $payment_type = $_GET['payment_type'] ?? null;

        $where = " WHERE i.is_reversed = 0 ";
        if ($payment_type) {
            $type = mysqli_real_escape_string($this->conn, $payment_type);
            $where .= " AND i.payment_type = '$type' ";
        }

        // Count total
        $countResult = mysqli_query($this->conn, "SELECT COUNT(*) as total FROM invoices i $where");
        $total = mysqli_fetch_assoc($countResult)['total'];

        $result = mysqli_query($this->conn, "
            SELECT i.*, COUNT(ii.id) as item_count, u.username as salesperson_name, c.name as customer_name
            FROM invoices i
            LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
            LEFT JOIN users u ON i.user_id = u.id
            LEFT JOIN ar_customers c ON i.customer_id = c.id
            $where
            GROUP BY i.id
            ORDER BY i.created_at DESC
            LIMIT $limit OFFSET $offset
        ");

        $invoices = [];
        while ($row = mysqli_fetch_assoc($result)) {
            $invoices[] = $row;
        }
        $this->paginatedResponse($invoices, $total, $params['page'], $params['limit']);
    }

    private function getInvoiceDetails() {
        $invoice_id = intval($_GET['id'] ?? 0);
        
        $result = mysqli_query($this->conn, "
            SELECT i.*, c.name as customer_name, c.phone as customer_phone, c.tax_number as customer_tax
            FROM invoices i
            LEFT JOIN ar_customers c ON i.customer_id = c.id
            WHERE i.id = $invoice_id
        ");
        $invoice = mysqli_fetch_assoc($result);
        
        if (!$invoice) {
            $this->errorResponse('Invoice not found', 404);
        }
        
        $result = mysqli_query($this->conn, "
            SELECT ii.*, p.name as product_name
            FROM invoice_items ii
            JOIN products p ON ii.product_id = p.id
            WHERE ii.invoice_id = $invoice_id
        ");
        $items = [];
        while ($row = mysqli_fetch_assoc($result)) {
            $items[] = $row;
        }
        
        $invoice['items'] = $items;
        $this->successResponse(['data' => $invoice]);
    }

    private function createInvoice() {
        $data = $this->getJsonInput();
        $invoice_number = $data['invoice_number'] ?? '';
        $items = $data['items'] ?? [];
        $payment_type = mysqli_real_escape_string($this->conn, $data['payment_type'] ?? 'cash');
        $customer_id = intval($data['customer_id'] ?? 0);
        $vat_rate = floatval($data['vat_rate'] ?? 0.00);
        
        if ($payment_type === 'credit' && $customer_id === 0) {
            $this->errorResponse('Customer is required for credit sales', 400);
        }
        
        if (empty($items)) {
            $this->errorResponse('Invoice must have at least one item', 400);
        }
        
        mysqli_begin_transaction($this->conn);
        
        try {
            // Generate voucher number if not provided
            if (empty($invoice_number)) {
                $invoice_number = $this->ledgerService->getNextVoucherNumber('INV');
            }
            
            // Calculate subtotal and total
            $subtotal = 0;
            $total_cogs = 0;
            
            foreach ($items as $item) {
                $item_subtotal = floatval($item['quantity']) * floatval($item['unit_price']);
                $subtotal += $item_subtotal;
            }
            
            // Calculate VAT
            $vat_amount = $subtotal * ($vat_rate / 100);
            $total = $subtotal + $vat_amount;
            $amount_paid = floatval($data['amount_paid'] ?? ($payment_type === 'cash' ? $total : 0));

            $user_id = $_SESSION['user_id'];
            $voucher_number = $this->ledgerService->getNextVoucherNumber('VOU');
            
            // Insert invoice
            $stmt = mysqli_prepare($this->conn, "INSERT INTO invoices (invoice_number, voucher_number, total_amount, subtotal, vat_rate, vat_amount, user_id, payment_type, customer_id, amount_paid) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
            mysqli_stmt_bind_param($stmt, "ssdddddsid", $invoice_number, $voucher_number, $total, $subtotal, $vat_rate, $vat_amount, $user_id, $payment_type, $customer_id, $amount_paid);
            mysqli_stmt_execute($stmt);
            $invoice_id = mysqli_insert_id($this->conn);
            mysqli_stmt_close($stmt);

            // Process items and calculate COGS
            foreach ($items as $item) {
                $product_id = intval($item['product_id']);
                $quantity = intval($item['quantity']);
                $unit_price = floatval($item['unit_price']);
                $item_subtotal = $quantity * $unit_price;
                
                // Calculate COGS using FIFO
                $item_cogs = $this->costingService->calculateCOGS_FIFO($product_id, $quantity);
                $total_cogs += $item_cogs;
                
                $stmt = mysqli_prepare($this->conn, "INSERT INTO invoice_items (invoice_id, product_id, quantity, unit_price, subtotal) VALUES (?, ?, ?, ?, ?)");
                mysqli_stmt_bind_param($stmt, "iiidd", $invoice_id, $product_id, $quantity, $unit_price, $item_subtotal);
                mysqli_stmt_execute($stmt);
                mysqli_stmt_close($stmt);
                
                // Update stock
                $stmt = mysqli_prepare($this->conn, "UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?");
                mysqli_stmt_bind_param($stmt, "ii", $quantity, $product_id);
                mysqli_stmt_execute($stmt);
                mysqli_stmt_close($stmt);
            }

            // Post to General Ledger - Double Entry
            $gl_entries = [];
            
            $accounts = $this->coaMapping->getStandardAccounts();
            
            if ($payment_type === 'cash') {
                // Cash Sale: Debit Cash, Credit Sales Revenue
                $gl_entries[] = [
                    'account_code' => $accounts['cash'],
                    'entry_type' => 'DEBIT',
                    'amount' => $total,
                    'description' => "فاتورة مبيعات نقدية رقم $invoice_number"
                ];
            } else {
                // Credit Sale with partial payment:
                // - Debit AR for the outstanding amount (total - amount_paid)
                // - Debit Cash for the amount paid (if any)
                // - Credit Sales Revenue for subtotal
                // - Credit Output VAT for VAT amount
                $outstanding_amount = $total - $amount_paid;
                
                if ($outstanding_amount > 0) {
                    $gl_entries[] = [
                        'account_code' => $accounts['accounts_receivable'],
                        'entry_type' => 'DEBIT',
                        'amount' => $outstanding_amount,
                        'description' => "فاتورة مبيعات آجلة رقم $invoice_number (المبلغ المتبقي)"
                    ];
                }
                
                // If partial payment, debit cash
                if ($amount_paid > 0) {
                    $gl_entries[] = [
                        'account_code' => $accounts['cash'],
                        'entry_type' => 'DEBIT',
                        'amount' => $amount_paid,
                        'description' => "دفعة مقدمة من الفاتورة رقم $invoice_number"
                    ];
                }
            }
            
            // Credit Sales Revenue
            $gl_entries[] = [
                'account_code' => $accounts['sales_revenue'],
                'entry_type' => 'CREDIT',
                'amount' => $subtotal,
                'description' => "مبيعات - فاتورة رقم $invoice_number"
            ];
            
            // Credit Output VAT (if applicable)
            if ($vat_amount > 0) {
                $gl_entries[] = [
                    'account_code' => $accounts['output_vat'],
                    'entry_type' => 'CREDIT',
                    'amount' => $vat_amount,
                    'description' => "ضريبة القيمة المضافة - فاتورة رقم $invoice_number"
                ];
            }
            
            // Post sales transaction
            $this->ledgerService->postTransaction($gl_entries, 'invoices', $invoice_id, $voucher_number);
            
            // Post COGS transaction
            if ($total_cogs > 0) {
                $cogs_entries = [
                    [
                        'account_code' => $accounts['cogs'],
                        'entry_type' => 'DEBIT',
                        'amount' => $total_cogs,
                        'description' => "تكلفة البضاعة المباعة - فاتورة رقم $invoice_number"
                    ],
                    [
                        'account_code' => $accounts['inventory'],
                        'entry_type' => 'CREDIT',
                        'amount' => $total_cogs,
                        'description' => "تقليل المخزون - فاتورة رقم $invoice_number"
                    ]
                ];
                $this->ledgerService->postTransaction($cogs_entries, 'invoices', $invoice_id);
            }

            // If Credit Sale, Add to AR Ledger
            if ($payment_type === 'credit' && $customer_id > 0) {
                // 1. Add Invoice Transaction (Debit)
                $ar_sql = "INSERT INTO ar_transactions (customer_id, type, amount, description, reference_type, reference_id, created_by) VALUES (?, 'invoice', ?, ?, 'invoices', ?, ?)";
                $desc = "فاتورة مبيعات آجلة رقم " . $invoice_number;
                $stmt = mysqli_prepare($this->conn, $ar_sql);
                mysqli_stmt_bind_param($stmt, "idsii", $customer_id, $total, $desc, $invoice_id, $user_id);
                mysqli_stmt_execute($stmt);
                mysqli_stmt_close($stmt);

                // 2. Add Payment Transaction (Credit) if partial payment made
                if ($amount_paid > 0) {
                    $ar_pay_sql = "INSERT INTO ar_transactions (customer_id, type, amount, description, reference_type, reference_id, created_by) VALUES (?, 'payment', ?, ?, 'invoices', ?, ?)";
                    $pay_desc = "دفعة مقدمة من الفاتورة رقم " . $invoice_number;
                    $stmt = mysqli_prepare($this->conn, $ar_pay_sql);
                    mysqli_stmt_bind_param($stmt, "idsii", $customer_id, $amount_paid, $pay_desc, $invoice_id, $user_id);
                    mysqli_stmt_execute($stmt);
                    mysqli_stmt_close($stmt);
                }

                // Update Customer Balance
                $this->updateCustomerBalance($customer_id);
            }
            
            mysqli_commit($this->conn);
            log_operation('CREATE', 'invoices', $invoice_id, null, $data);
            $this->successResponse(['id' => $invoice_id, 'invoice_number' => $invoice_number, 'voucher_number' => $voucher_number]);

        } catch (Exception $e) {
            mysqli_rollback($this->conn);
            $this->errorResponse($e->getMessage());
        }
    }

    private function deleteInvoice() {
        $id = intval($_GET['id'] ?? 0);
        
        // Get invoice details
        $result = mysqli_query($this->conn, "SELECT i.*, i.voucher_number FROM invoices i WHERE i.id = $id");
        $invoice = mysqli_fetch_assoc($result);
        
        if (!$invoice) {
            $this->errorResponse('Invoice not found', 404);
        }
        
        // Check if already reversed
        $check_reversed = mysqli_query($this->conn, 
            "SELECT COUNT(*) as count FROM general_ledger WHERE reference_type = 'invoices' AND reference_id = $id AND description LIKE '%Reversal%'");
        $reversed_row = mysqli_fetch_assoc($check_reversed);
        if ($reversed_row['count'] > 0) {
            $this->errorResponse('Invoice has already been reversed', 400);
        }
        
        $customer_id = isset($invoice['customer_id']) ? intval($invoice['customer_id']) : 0;
        $voucher_number = $invoice['voucher_number'] ?? null;
        
        $result = mysqli_query($this->conn, "SELECT product_id, quantity FROM invoice_items WHERE invoice_id = $id");
        $items = [];
        while ($row = mysqli_fetch_assoc($result)) {
            $items[] = $row;
        }
        
        mysqli_begin_transaction($this->conn);
        
        try {
            // Mark invoice as reversed (soft delete)
            $user_id = $_SESSION['user_id'] ?? null;
            $stmt = mysqli_prepare($this->conn, "UPDATE invoices SET is_reversed = 1, reversed_at = NOW(), reversed_by = ? WHERE id = ?");
            mysqli_stmt_bind_param($stmt, "ii", $user_id, $id);
            mysqli_stmt_execute($stmt);
            mysqli_stmt_close($stmt);
            
            // Restore stock
            foreach ($items as $item) {
                $stmt = mysqli_prepare($this->conn, "UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?");
                mysqli_stmt_bind_param($stmt, "ii", $item['quantity'], $item['product_id']);
                mysqli_stmt_execute($stmt);
                mysqli_stmt_close($stmt);
            }

            // Reverse GL entries if voucher number exists
            if ($voucher_number) {
                try {
                    $this->ledgerService->reverseTransaction($voucher_number, "إلغاء فاتورة مبيعات رقم " . ($invoice['invoice_number'] ?? $id));
                } catch (Exception $e) {
                    error_log("Failed to reverse GL entries: " . $e->getMessage());
                    // Continue with reversal even if GL reversal fails
                }
            }

            // Mark AR transactions as reversed (soft delete)
            $stmt = mysqli_prepare($this->conn, "UPDATE ar_transactions SET is_deleted = 1 WHERE reference_type = 'invoices' AND reference_id = ?");
            mysqli_stmt_bind_param($stmt, "i", $id);
            mysqli_stmt_execute($stmt);
            mysqli_stmt_close($stmt);
            
            mysqli_commit($this->conn);
            log_operation('REVERSE', 'invoices', $id, null, ['voucher_number' => $voucher_number]);

            // Update Customer Balance if applicable
            if ($customer_id > 0) {
                $this->updateCustomerBalance($customer_id);
            }

            $this->successResponse(['message' => 'Invoice reversed successfully']);

        } catch (Exception $e) {
            mysqli_rollback($this->conn);
            $this->errorResponse($e->getMessage());
        }
    }

    private function updateCustomerBalance($customer_id) {
        // Helper to update balance (Duplicated from ArController, ideally shared in a Service/Model)
        $sql = "
            UPDATE ar_customers 
            SET current_balance = (
                SELECT COALESCE(SUM(
                    CASE 
                        WHEN type = 'invoice' THEN amount 
                        WHEN type IN ('payment', 'return') THEN -amount 
                        ELSE 0 
                    END
                ), 0)
                FROM ar_transactions 
                WHERE customer_id = ? AND is_deleted = 0
            ) 
            WHERE id = ?
        ";
        $stmt = mysqli_prepare($this->conn, $sql);
        mysqli_stmt_bind_param($stmt, "ii", $customer_id, $customer_id);
        mysqli_stmt_execute($stmt);
        mysqli_stmt_close($stmt);
    }
}
