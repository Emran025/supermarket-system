<?php

require_once __DIR__ . '/../config/db.php';

/**
 * LedgerService - Handles double-entry accounting operations
 */
class LedgerService
{
    private $conn;

    public function __construct()
    {
        $this->conn = get_db_connection();
    }

    /**
     * Generate next voucher number for a document type
     */
    public function getNextVoucherNumber($document_type)
    {
        mysqli_begin_transaction($this->conn);

        try {
            $type_esc = mysqli_real_escape_string($this->conn, $document_type);
            $result = mysqli_query($this->conn, "SELECT current_number, prefix, format FROM document_sequences WHERE document_type = '$type_esc' FOR UPDATE");

            if (!$result || mysqli_num_rows($result) == 0) {
                // Create default sequence if not exists
                mysqli_query($this->conn, "INSERT INTO document_sequences (document_type, prefix, current_number, format) VALUES ('$type_esc', '$type_esc', 0, '{PREFIX}-{NUMBER}')");
                $result = mysqli_query($this->conn, "SELECT current_number, prefix, format FROM document_sequences WHERE document_type = '$type_esc' FOR UPDATE");
            }

            $row = mysqli_fetch_assoc($result);
            $current_number = intval($row['current_number']) + 1;
            $prefix = $row['prefix'];
            $format = $row['format'];

            // Update sequence
            mysqli_query($this->conn, "UPDATE document_sequences SET current_number = $current_number WHERE document_type = '$type_esc'");

            mysqli_commit($this->conn);

            // Format voucher number
            $voucher_number = str_replace(['{PREFIX}', '{NUMBER}'], [$prefix, str_pad($current_number, 6, '0', STR_PAD_LEFT)], $format);

            return $voucher_number;
        } catch (Exception $e) {
            mysqli_rollback($this->conn);
            error_log("Failed to generate voucher number: " . $e->getMessage());
            throw $e;
        }
    }

    /**
     * Post a double-entry transaction to the General Ledger
     * 
     * @param array $entries Array of entries, each with: account_code, entry_type (DEBIT/CREDIT), amount, description
     * @param string $reference_type Table name (e.g., 'invoices', 'purchases')
     * @param int $reference_id Record ID in reference table
     * @param string|null $voucher_number Optional voucher number (will be generated if not provided)
     * @param string|null $voucher_date Optional date (defaults to today)
     * @return string Voucher number
     */
    public function postTransaction($entries, $reference_type = null, $reference_id = null, $voucher_number = null, $voucher_date = null)
    {
        if (empty($entries) || count($entries) < 2) {
            throw new Exception("At least two entries required for double-entry accounting");
        }

        // Validate that debits equal credits
        $total_debits = 0;
        $total_credits = 0;

        foreach ($entries as $entry) {
            if (!isset($entry['account_code']) || !isset($entry['entry_type']) || !isset($entry['amount'])) {
                throw new Exception("Each entry must have account_code, entry_type, and amount");
            }

            $entry_type = strtoupper($entry['entry_type']);
            if ($entry_type !== 'DEBIT' && $entry_type !== 'CREDIT') {
                throw new Exception("Entry type must be DEBIT or CREDIT");
            }

            $amount = floatval($entry['amount']);
            if ($amount <= 0) {
                throw new Exception("Amount must be positive");
            }

            if ($entry_type === 'DEBIT') {
                $total_debits += $amount;
            } else {
                $total_credits += $amount;
            }
        }

        if (abs($total_debits - $total_credits) > 0.01) { // Allow small floating point differences
            throw new Exception("Debits ($total_debits) must equal Credits ($total_credits)");
        }

        // Get or generate voucher number
        if (!$voucher_number) {
            $voucher_number = $this->getNextVoucherNumber('VOU');
        }

        if (!$voucher_date) {
            $voucher_date = date('Y-m-d');
        }

        // Get current fiscal period
        $fiscal_period_id = $this->getCurrentFiscalPeriod();

        // Check if period is locked
        if ($fiscal_period_id) {
            $period_result = mysqli_query(
                $this->conn,
                "SELECT is_locked, is_closed FROM fiscal_periods WHERE id = $fiscal_period_id"
            );
            if ($period_result && mysqli_num_rows($period_result) > 0) {
                $period = mysqli_fetch_assoc($period_result);
                if (intval($period['is_locked'] ?? 0) == 1) {
                    throw new Exception("Cannot post transactions to a locked fiscal period");
                }
                if (intval($period['is_closed'] ?? 0) == 1) {
                    throw new Exception("Cannot post transactions to a closed fiscal period");
                }
            }
        }

        $user_id = $_SESSION['user_id'] ?? null;

        mysqli_begin_transaction($this->conn);

        try {
            foreach ($entries as $entry) {
                $account_code = mysqli_real_escape_string($this->conn, $entry['account_code']);
                $entry_type = strtoupper($entry['entry_type']);
                $amount = floatval($entry['amount']);
                $description = isset($entry['description']) ? mysqli_real_escape_string($this->conn, $entry['description']) : '';

                // Get account ID
                $acc_result = mysqli_query($this->conn, "SELECT id FROM chart_of_accounts WHERE account_code = '$account_code' AND is_active = 1");
                if (!$acc_result || mysqli_num_rows($acc_result) == 0) {
                    throw new Exception("Account code '$account_code' not found or inactive");
                }
                $account_row = mysqli_fetch_assoc($acc_result);
                $account_id = intval($account_row['id']);

                // Insert GL entry
                $ref_type = $reference_type ? mysqli_real_escape_string($this->conn, $reference_type) : null;
                $ref_id = $reference_id ? intval($reference_id) : null;

                $stmt = mysqli_prepare(
                    $this->conn,
                    "INSERT INTO general_ledger (voucher_number, voucher_date, account_id, entry_type, amount, description, reference_type, reference_id, fiscal_period_id, created_by) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
                );
                mysqli_stmt_bind_param(
                    $stmt,
                    "ssisdsiiii",
                    $voucher_number,
                    $voucher_date,
                    $account_id,
                    $entry_type,
                    $amount,
                    $description,
                    $ref_type,
                    $ref_id,
                    $fiscal_period_id,
                    $user_id
                );
                mysqli_stmt_execute($stmt);
                mysqli_stmt_close($stmt);
            }

            mysqli_commit($this->conn);
            return $voucher_number;
        } catch (Exception $e) {
            mysqli_rollback($this->conn);
            error_log("Failed to post transaction: " . $e->getMessage());
            throw $e;
        }
    }

    /**
     * Get current active fiscal period
     */
    private function getCurrentFiscalPeriod()
    {
        $result = mysqli_query(
            $this->conn,
            "SELECT id FROM fiscal_periods WHERE is_closed = 0 AND CURDATE() BETWEEN start_date AND end_date ORDER BY start_date DESC LIMIT 1"
        );

        if ($result && mysqli_num_rows($result) > 0) {
            $row = mysqli_fetch_assoc($result);
            return intval($row['id']);
        }

        return null;
    }

    /**
     * Get account balance for a specific account
     */
    public function getAccountBalance($account_code, $as_of_date = null)
    {
        $account_code_esc = mysqli_real_escape_string($this->conn, $account_code);

        // Get account
        $acc_result = mysqli_query($this->conn, "SELECT id, account_type FROM chart_of_accounts WHERE account_code = '$account_code_esc'");
        if (!$acc_result || mysqli_num_rows($acc_result) == 0) {
            return 0;
        }
        $account = mysqli_fetch_assoc($acc_result);
        $account_id = intval($account['id']);
        $account_type = $account['account_type'];

        // Build date filter
        $date_filter = "";
        if ($as_of_date) {
            $date_esc = mysqli_real_escape_string($this->conn, $as_of_date);
            $date_filter = "AND voucher_date <= '$date_esc'";
        }

        // Calculate balance based on account type
        // Assets and Expenses: Debit increases, Credit decreases
        // Liabilities, Equity, Revenue: Credit increases, Debit decreases
        $result = mysqli_query(
            $this->conn,
            "SELECT 
                SUM(CASE WHEN entry_type = 'DEBIT' THEN amount ELSE 0 END) as total_debits,
                SUM(CASE WHEN entry_type = 'CREDIT' THEN amount ELSE 0 END) as total_credits
             FROM general_ledger 
             WHERE account_id = $account_id AND is_closed = 0 $date_filter"
        );

        $row = mysqli_fetch_assoc($result);
        $debits = floatval($row['total_debits'] ?? 0);
        $credits = floatval($row['total_credits'] ?? 0);

        if (in_array($account_type, ['Asset', 'Expense'])) {
            return $debits - $credits;
        } else {
            return $credits - $debits;
        }
    }

    /**
     * Reverse a transaction (create reversing entries)
     */
    public function reverseTransaction($voucher_number, $description = null)
    {
        // Get original entries
        $voucher_esc = mysqli_real_escape_string($this->conn, $voucher_number);
        $result = mysqli_query(
            $this->conn,
            "SELECT account_id, entry_type, amount, description 
             FROM general_ledger 
             WHERE voucher_number = '$voucher_esc'"
        );

        if (!$result || mysqli_num_rows($result) == 0) {
            throw new Exception("Voucher not found");
        }

        $entries = [];
        while ($row = mysqli_fetch_assoc($result)) {
            // Get account code
            $acc_result = mysqli_query($this->conn, "SELECT account_code FROM chart_of_accounts WHERE id = {$row['account_id']}");
            $acc_row = mysqli_fetch_assoc($acc_result);

            // Reverse entry type
            $reversed_type = $row['entry_type'] === 'DEBIT' ? 'CREDIT' : 'DEBIT';

            $entries[] = [
                'account_code' => $acc_row['account_code'],
                'entry_type' => $reversed_type,
                'amount' => floatval($row['amount']),
                'description' => $description ?: ("Reversal of " . $row['description'])
            ];
        }

        return $this->postTransaction($entries, 'general_ledger', null, null, date('Y-m-d'));
    }
}
