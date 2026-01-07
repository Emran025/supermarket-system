<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Database;
use App\Models\Operations\Invoice;
use App\Models\Finance\JournalEntry;
use App\Models\Finance\JournalEntryLine;
use App\Helpers\CurrencyHelper; // Assuming this exists as per previous context
use Exception;
use PDOException;

class SalesService
{
    // Define standard Account Codes (In a real app, these would come from Config or DB)
    private const ACC_CASH = 1010;
    private const ACC_AR = 1100;
    private const ACC_SALES_REVENUE = 4000;
    private const ACC_VAT_PAYABLE = 2100;

    public function __construct(
        private Invoice $invoiceModel,
        private JournalEntry $journalEntryModel,
        private JournalEntryLine $journalEntryLineModel
    ) {}

    /**
     * Create a new Invoice and corresponding GL entries atomically.
     * 
     * @param array $data Invoice data including items
     * @return int Invoice ID
     * @throws Exception
     */
    public function createInvoice(array $data): int
    {
        $db = Database::getInstance();
        $conn = $db->getConnection();

        try {
            $conn->beginTransaction();

            // 1. Calculate Totals
            $subtotal = 0;
            $items = $data['items'] ?? [];
            
            foreach ($items as $item) {
                // In a real scenario, fetch price from Product Model to prevent frontend tampering
                // For this example, we accept passed values but ensure math is correct
                $lineTotal = round($item['quantity'] * $item['unit_price'], 2);
                $subtotal += $lineTotal;
            }

            // Calculate Tax (15%)
            $vatRate = 0.15;
            $taxAmount = round($subtotal * $vatRate, 2);
            $totalAmount = $subtotal + $taxAmount;

            // 2. Create Invoice
            $invoiceId = (int) $this->invoiceModel->create([
                'invoice_number' => 'INV-' . time(), // Simple generator
                'user_id' => $data['user_id'] ?? null,
                'total_amount' => $totalAmount,
                'created_at' => date('Y-m-d H:i:s')
            ]);
            
            // Note: We would also save Invoice Items here to `invoice_items` table
            // Skipping strictly for the prompts constraint on "Invoice.php" vs full schema, 
            // but conceptually it happens here.

            // 3. Generate Double-Entry Journal Voucher
            $jeId = $this->journalEntryModel->createHeader(
                "Sales Invoice #" . $invoiceId,
                date('Y-m-d')
            );

            // Determine Debit Account (Cash or AR)
            $isCreditSale = isset($data['payment_method']) && $data['payment_method'] === 'credit';
            $debitAccount = $isCreditSale ? self::ACC_AR : self::ACC_CASH;

            // Debit: Cash/AR (Who owes/paid us?) -> Full Amount
            $this->journalEntryLineModel->create([
                'journal_entry_id' => $jeId,
                'account_id' => $debitAccount, // Assuming account_id maps to ID in chart_of_accounts, not Code.
                                               // In a real app we'd look up ID by Code.
                'debit' => $totalAmount,
                'credit' => 0
            ]);

            // Credit: Sales Revenue (Income) -> Net Amount
            $this->journalEntryLineModel->create([
                'journal_entry_id' => $jeId,
                'account_id' => self::ACC_SALES_REVENUE, 
                'debit' => 0,
                'credit' => $subtotal
            ]);

            // Credit: VAT Payable (Liability) -> Tax Component
            if ($taxAmount > 0) {
                $this->journalEntryLineModel->create([
                    'journal_entry_id' => $jeId,
                    'account_id' => self::ACC_VAT_PAYABLE, 
                    'debit' => 0,
                    'credit' => $taxAmount
                ]);
            }

            $conn->commit();
            return $invoiceId;

        } catch (Exception $e) {
            $conn->rollBack();
            // Log the specific error internally
            error_log("Invoice Creation Failed: " . $e->getMessage());
            // Re-throw a clean user-facing error
            throw new Exception("Failed to process invoice transaction.");
        }
    }
}
