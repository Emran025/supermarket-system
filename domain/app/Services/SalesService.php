<?php

namespace App\Services;

use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Product;
use App\Models\ArCustomer;
use App\Models\ArTransaction;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class SalesService
{
    private LedgerService $ledgerService;
    private ChartOfAccountsMappingService $coaService;

    public function __construct(
        LedgerService $ledgerService,
        ChartOfAccountsMappingService $coaService
    ) {
        $this->ledgerService = $ledgerService;
        $this->coaService = $coaService;
    }

    public function createInvoice(array $data): int
    {
        return DB::transaction(function () use ($data) {
            // Extract data
            $invoiceNumber = $data['invoice_number'] ?? 'INV-' . time();
            $paymentType = $data['payment_type'] ?? 'cash';
            $customerId = $data['customer_id'] ?? null;
            $userId = $data['user_id'] ?? auth()->id() ?? session('user_id');
            $amountPaid = (float)($data['amount_paid'] ?? 0);
            $discountAmount = (float)($data['discount_amount'] ?? 0);
            $items = $data['items'] ?? [];

            if (empty($items)) {
                throw new \Exception("Invoice must have items");
            }

            if ($paymentType === 'credit' && !$customerId) {
                throw new \Exception("Customer is required for credit sales");
            }

            // Calculate totals and validate stock
            $subtotal = 0;
            $totalVat = 0;
            $totalCost = 0;
            $processedItems = [];

            foreach ($items as $item) {
                $productId = (int)$item['product_id'];
                $quantity = (int)$item['quantity'];
                $unitPrice = (float)$item['unit_price'];

                $product = Product::findOrFail($productId);

                // Check stock
                if ($product->stock_quantity < $quantity) {
                    throw new \Exception("Insufficient stock for product: {$product->name}");
                }

                $lineTotal = $quantity * $unitPrice;
                $subtotal += $lineTotal;

                // Get cost for COGS
                $costPrice = $product->weighted_average_cost ?? 0;
                $totalCost += ($quantity * $costPrice);

                $processedItems[] = [
                    'product_id' => $productId,
                    'quantity' => $quantity,
                    'unit_price' => $unitPrice,
                    'line_total' => $lineTotal,
                    'cost_price' => $costPrice,
                ];

                // Update stock
                $product->decrement('stock_quantity', $quantity);
            }

            $vatRate = isset($data['vat_rate']) ? (float)$data['vat_rate'] / 100 : 0.15; // Default 15% if not provided
            $taxableAmount = $subtotal - $discountAmount;
            $vatAmount = round($taxableAmount * $vatRate, 2);
            $totalAmount = $taxableAmount + $vatAmount;

            // Default amount_paid for cash sales
            if ($paymentType === 'cash' && (!isset($data['amount_paid']) || $data['amount_paid'] === null)) {
                $amountPaid = $totalAmount;
            }

            // Create invoice header
            $invoice = Invoice::create([
                'invoice_number' => $invoiceNumber,
                'total_amount' => $totalAmount,
                'subtotal' => $subtotal,
                'vat_rate' => $vatRate,
                'vat_amount' => $vatAmount,
                'discount_amount' => $discountAmount,
                'amount_paid' => $amountPaid,
                'payment_type' => $paymentType,
                'customer_id' => $customerId,
                'user_id' => $userId,
            ]);

            // Insert invoice items
            foreach ($processedItems as $item) {
                InvoiceItem::create([
                    'invoice_id' => $invoice->id,
                    'product_id' => $item['product_id'],
                    'quantity' => $item['quantity'],
                    'unit_price' => $item['unit_price'],
                    'subtotal' => $item['line_total'],
                ]);
            }

            // Update customer balance (if credit)
            if ($paymentType === 'credit' && $customerId) {
                $netDue = $totalAmount - $amountPaid;
                if ($netDue > 0) {
                    ArTransaction::create([
                        'customer_id' => $customerId,
                        'type' => 'invoice',
                        'amount' => $netDue,
                        'description' => "Invoice #$invoiceNumber",
                        'reference_type' => 'invoices',
                        'reference_id' => $invoice->id,
                        'created_by' => $userId,
                    ]);

                    ArCustomer::where('id', $customerId)
                        ->increment('current_balance', $netDue);
                }
            }

            // GL Entries
            $glEntries = [];

            // Revenue (Credit)
            $glEntries[] = [
                'account_code' => $this->coaService->getStandardAccounts()['sales_revenue'],
                'entry_type' => 'CREDIT',
                'amount' => $subtotal,
                'description' => "Sales Revenue - Invoice #$invoiceNumber"
            ];

            // VAT Payable (Credit)
            if ($vatAmount > 0) {
                $glEntries[] = [
                    'account_code' => $this->coaService->getStandardAccounts()['output_vat'],
                    'entry_type' => 'CREDIT',
                    'amount' => $vatAmount,
                    'description' => "VAT Output - Invoice #$invoiceNumber"
                ];
            }

            // Debit Side (Cash + AR)
            if ($amountPaid > 0) {
                $glEntries[] = [
                    'account_code' => $this->coaService->getStandardAccounts()['cash'],
                    'entry_type' => 'DEBIT',
                    'amount' => $amountPaid,
                    'description' => "Cash Received - Invoice #$invoiceNumber"
                ];
            }

            $amountDue = $totalAmount - $amountPaid;
            if ($amountDue > 0.01) {
                $glEntries[] = [
                    'account_code' => $this->coaService->getStandardAccounts()['accounts_receivable'],
                    'entry_type' => 'DEBIT',
                    'amount' => $amountDue,
                    'description' => "Accounts Receivable - Invoice #$invoiceNumber"
                ];
            }

            // COGS (Debit) and Inventory (Credit)
            if ($totalCost > 0) {
                $glEntries[] = [
                    'account_code' => $this->coaService->getStandardAccounts()['cost_of_goods_sold'],
                    'entry_type' => 'DEBIT',
                    'amount' => $totalCost,
                    'description' => "Cost of Goods Sold - Invoice #$invoiceNumber"
                ];

                $glEntries[] = [
                    'account_code' => $this->coaService->getStandardAccounts()['inventory'],
                    'entry_type' => 'CREDIT',
                    'amount' => $totalCost,
                    'description' => "Inventory usage - Invoice #$invoiceNumber"
                ];
            }

            // Sales Discount (Debit)
            if ($discountAmount > 0) {
                $glEntries[] = [
                    'account_code' => $this->coaService->getStandardAccounts()['sales_discount'],
                    'entry_type' => 'DEBIT',
                    'amount' => $discountAmount,
                    'description' => "Sales Discount - Invoice #$invoiceNumber"
                ];
            }

            // Post GL
            $this->ledgerService->postTransaction(
                $glEntries,
                'invoices',
                $invoice->id,
                null,
                now()->format('Y-m-d')
            );

            return $invoice->id;
        });
    }

    public function deleteInvoice(int $invoiceId): void
    {
        DB::transaction(function () use ($invoiceId) {
            $invoice = Invoice::with('items')->findOrFail($invoiceId);

            // Return stock
            foreach ($invoice->items as $item) {
                Product::where('id', $item->product_id)
                    ->increment('stock_quantity', $item->quantity);
            }

            // Reverse AR if credit
            if ($invoice->payment_type === 'credit' && $invoice->customer_id) {
                $netDue = $invoice->total_amount - $invoice->amount_paid;
                if ($netDue > 0) {
                    ArCustomer::where('id', $invoice->customer_id)
                        ->decrement('current_balance', $netDue);

                    ArTransaction::where('reference_type', 'invoices')
                        ->where('reference_id', $invoiceId)
                        ->delete();
                }
            }

            // Delete invoice items and invoice
            $invoice->items()->delete();
            $invoice->delete();
        });
    }
}

