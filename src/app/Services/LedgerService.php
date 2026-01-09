<?php

namespace App\Services;

use App\Models\DocumentSequence;
use App\Models\ChartOfAccount;
use App\Models\GeneralLedger;
use App\Models\FiscalPeriod;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class LedgerService
{
    public function getNextVoucherNumber(string $documentType): string
    {
        return DB::transaction(function () use ($documentType) {
            $sequence = DocumentSequence::where('document_type', $documentType)
                ->lockForUpdate()
                ->first();

            if (!$sequence) {
                // Create default sequence
                $sequence = DocumentSequence::create([
                    'document_type' => $documentType,
                    'prefix' => $documentType,
                    'current_number' => 0,
                    'format' => '{PREFIX}-{NUMBER}',
                ]);
            }

            $currentNumber = $sequence->current_number + 1;
            $sequence->update(['current_number' => $currentNumber]);

            // Format voucher number
            $voucherNumber = str_replace(
                ['{PREFIX}', '{NUMBER}'],
                [$sequence->prefix, str_pad($currentNumber, 6, '0', STR_PAD_LEFT)],
                $sequence->format
            );

            return $voucherNumber;
        });
    }

    public function postTransaction(
        array $entries,
        ?string $referenceType = null,
        ?int $referenceId = null,
        ?string $voucherNumber = null,
        ?string $voucherDate = null
    ): string {
        if (empty($entries) || count($entries) < 2) {
            throw new \Exception("At least two entries required for double-entry accounting");
        }

        // Validate debits equal credits
        $totalDebits = 0;
        $totalCredits = 0;

        foreach ($entries as $entry) {
            if (!isset($entry['account_code']) || !isset($entry['entry_type']) || !isset($entry['amount'])) {
                throw new \Exception("Each entry must have account_code, entry_type, and amount");
            }

            $entryType = strtoupper($entry['entry_type']);
            if ($entryType !== 'DEBIT' && $entryType !== 'CREDIT') {
                throw new \Exception("Entry type must be DEBIT or CREDIT");
            }

            $amount = (float)$entry['amount'];
            if ($amount <= 0) {
                throw new \Exception("Amount must be positive");
            }

            if ($entryType === 'DEBIT') {
                $totalDebits += $amount;
            } else {
                $totalCredits += $amount;
            }
        }

        if (abs($totalDebits - $totalCredits) > 0.01) {
            throw new \Exception("Debits ($totalDebits) must equal Credits ($totalCredits)");
        }

        // Get or generate voucher number
        if (!$voucherNumber) {
            $voucherNumber = $this->getNextVoucherNumber('VOU');
        }

        if (!$voucherDate) {
            $voucherDate = now()->format('Y-m-d');
        }

        // Get current fiscal period
        $fiscalPeriodId = $this->getCurrentFiscalPeriod();

        // Check if period is locked
        if ($fiscalPeriodId) {
            $period = FiscalPeriod::find($fiscalPeriodId);
            if ($period) {
                if ($period->is_locked) {
                    throw new \Exception("Cannot post transactions to a locked fiscal period");
                }
                if ($period->is_closed) {
                    throw new \Exception("Cannot post transactions to a closed fiscal period");
                }
            }
        }

        $userId = auth()->id() ?? session('user_id');

        return DB::transaction(function () use ($entries, $voucherNumber, $voucherDate, $referenceType, $referenceId, $fiscalPeriodId, $userId) {
            foreach ($entries as $entry) {
                $account = ChartOfAccount::where('account_code', $entry['account_code'])->first();
                if (!$account) {
                    throw new \Exception("Account not found: {$entry['account_code']}");
                }

                // Check if account is a summary account (has children)
                if (config('accounting.prevent_posting_to_parent_accounts', true)) {
                    $hasChildren = ChartOfAccount::where('parent_id', $account->id)->exists();
                    if ($hasChildren) {
                        throw new \Exception("Cannot post to a summary account (header): {$account->account_name} ({$account->account_code})");
                    }
                }

                GeneralLedger::create([
                    'voucher_number' => $voucherNumber,
                    'voucher_date' => $voucherDate,
                    'account_id' => $account->id,
                    'entry_type' => strtoupper($entry['entry_type']),
                    'amount' => $entry['amount'],
                    'description' => $entry['description'] ?? '',
                    'reference_type' => $referenceType,
                    'reference_id' => $referenceId,
                    'fiscal_period_id' => $fiscalPeriodId,
                    'created_by' => $userId,
                ]);
            }

            return $voucherNumber;
        });
    }

    private function getCurrentFiscalPeriod(): ?int
    {
        $period = FiscalPeriod::where('is_closed', false)
            ->where('start_date', '<=', now())
            ->where('end_date', '>=', now())
            ->first();

        return $period?->id;
    }

    /**
     * Get account balance for a specific account
     * 
     * @param string $accountCode Account code to get balance for
     * @param string|null $asOfDate Optional date to calculate balance as of (Y-m-d format)
     * @return float Account balance
     */
    public function getAccountBalance(string $accountCode, ?string $asOfDate = null): float
    {
        $account = ChartOfAccount::where('account_code', $accountCode)->first();
        
        if (!$account) {
            return 0;
        }

        $query = GeneralLedger::where('account_id', $account->id)
            ->where('is_closed', false);

        if ($asOfDate) {
            $query->where('voucher_date', '<=', $asOfDate);
        }

        $totals = $query->selectRaw('
            SUM(CASE WHEN entry_type = "DEBIT" THEN amount ELSE 0 END) as total_debits,
            SUM(CASE WHEN entry_type = "CREDIT" THEN amount ELSE 0 END) as total_credits
        ')->first();

        $debits = (float)($totals->total_debits ?? 0);
        $credits = (float)($totals->total_credits ?? 0);

        // Asset and Expense accounts have debit balances
        if (in_array($account->account_type, ['Asset', 'Expense'])) {
            return $debits - $credits;
        }
        
        // Liability, Equity, and Revenue accounts have credit balances
        return $credits - $debits;
    }

    /**
     * Reverse a transaction by creating reversing entries
     * 
     * @param string $voucherNumber Voucher number to reverse
     * @param string|null $description Description for reversal entries
     * @return string New voucher number for reversal
     */
    public function reverseTransaction(string $voucherNumber, ?string $description = null): string
    {
        $entries = GeneralLedger::where('voucher_number', $voucherNumber)
            ->with('account')
            ->get();

        if ($entries->isEmpty()) {
            throw new \Exception("Voucher not found: $voucherNumber");
        }

        $reversalEntries = [];
        
        foreach ($entries as $entry) {
            // Reverse entry type (DEBIT becomes CREDIT and vice versa)
            $reversedType = $entry->entry_type === 'DEBIT' ? 'CREDIT' : 'DEBIT';
            
            $reversalEntries[] = [
                'account_code' => $entry->account->account_code,
                'entry_type' => $reversedType,
                'amount' => $entry->amount,
                'description' => $description ?? "Reversal of {$entry->description}"
            ];
        }

        // Post reversal transaction
        return $this->postTransaction(
            $reversalEntries,
            'general_ledger',
            null,
            null,
            now()->format('Y-m-d')
        );
    }

    /**
     * Get trial balance data for all accounts
     * 
     * @param string|null $asOfDate Optional date to calculate balances as of (Y-m-d format)
     * @return array Trial balance data with debits and credits
     */
    public function getTrialBalanceData(?string $asOfDate = null): array
    {
        $accounts = ChartOfAccount::where('is_active', true)
            ->orderBy('account_code')
            ->get();

        $trialBalance = [];
        $totalDebits = 0;
        $totalCredits = 0;

        foreach ($accounts as $account) {
            $query = GeneralLedger::where('account_id', $account->id)
                ->where('is_closed', false);

            if ($asOfDate) {
                $query->where('voucher_date', '<=', $asOfDate);
            }

            $totals = $query->selectRaw('
                SUM(CASE WHEN entry_type = "DEBIT" THEN amount ELSE 0 END) as debits,
                SUM(CASE WHEN entry_type = "CREDIT" THEN amount ELSE 0 END) as credits
            ')->first();

            $debits = (float)($totals->debits ?? 0);
            $credits = (float)($totals->credits ?? 0);

            // Calculate balance based on account type
            $balance = 0;
            $debitBalance = 0;
            $creditBalance = 0;

            if (in_array($account->account_type, ['Asset', 'Expense'])) {
                $balance = $debits - $credits;
                if ($balance > 0) {
                    $debitBalance = $balance;
                } else {
                    $creditBalance = abs($balance);
                }
            } else {
                $balance = $credits - $debits;
                if ($balance > 0) {
                    $creditBalance = $balance;
                } else {
                    $debitBalance = abs($balance);
                }
            }

            // Only include accounts with activity
            if ($debits > 0 || $credits > 0) {
                $trialBalance[] = [
                    'account_code' => $account->account_code,
                    'account_name' => $account->account_name,
                    'account_type' => $account->account_type,
                    'debit_balance' => $debitBalance,
                    'credit_balance' => $creditBalance,
                ];

                $totalDebits += $debitBalance;
                $totalCredits += $creditBalance;
            }
        }

        return [
            'accounts' => $trialBalance,
            'total_debits' => $totalDebits,
            'total_credits' => $totalCredits,
            'is_balanced' => abs($totalDebits - $totalCredits) < 0.01,
        ];
    }
}

