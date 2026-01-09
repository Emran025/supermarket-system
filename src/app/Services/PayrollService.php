<?php

namespace App\Services;

use App\Models\Employee;
use App\Models\PayrollCycle;
use App\Models\PayrollItem;
use App\Models\GeneralLedger;
use App\Models\ChartOfAccount;
use App\Models\PayrollTransaction;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class PayrollService
{
    protected $accountService;
    protected $mappingService;
    protected $ledgerService;

    public function __construct(
        EmployeeAccountService $accountService, 
        ChartOfAccountsMappingService $mappingService,
        LedgerService $ledgerService
    ) {
        $this->accountService = $accountService;
        $this->mappingService = $mappingService;
        $this->ledgerService = $ledgerService;
    }

    /**
     * Get the next approver for a user
     */
    public function getNextApprover($userId)
    {
        $employee = Employee::where('user_id', $userId)->first();
        if ($employee && $employee->manager_id) {
            $manager = Employee::find($employee->manager_id);
            return $manager ? $manager->user_id : null;
        }
        return null; // No manager found, could be GM or Admin
    }

    /**
     * Generate a payroll cycle (Salary, Bonus, Incentive, etc.)
     */
    public function generatePayroll($data, $user)
    {
        $type = $data['cycle_type'] ?? 'salary';
        $nature = $data['payment_nature'] ?? 'salary'; 
        
        DB::beginTransaction();
        try {
            // Find initial approver
            $nextApproverId = $this->getNextApprover($user->id);
            $status = $nextApproverId ? 'pending_approval' : 'approved';

            $cycle = PayrollCycle::create([
                'cycle_name' => $data['cycle_name'] ?? ($nature === 'salary' ? "Payroll " . Carbon::parse($data['period_start'])->format('F Y') : "Special Payment: " . ucfirst($nature)),
                'cycle_type' => $nature,
                'description' => $data['description'] ?? null,
                'period_start' => $data['period_start'] ?? now()->startOfMonth(),
                'period_end' => $data['period_end'] ?? now()->endOfMonth(),
                'payment_date' => $data['payment_date'] ?? now(),
                'status' => 'draft',
                'current_approver_id' => null,
                'approval_trail' => [],
                'created_by' => $user->id
            ]);

            // Targeting logic
            $query = Employee::where('is_active', true);
            
            if (($data['target_type'] ?? 'all') === 'selected') {
                $query->whereIn('id', $data['employee_ids'] ?? []);
            } elseif (($data['target_type'] ?? 'all') === 'excluded') {
                $query->whereNotIn('id', $data['employee_ids'] ?? []);
            }

            if ($nature === 'salary') {
                $query->where('employment_status', 'active');
            }

            $employees = $query->get();

            $totalGross = 0;
            $totalDeductions = 0;
            $totalNet = 0;

            foreach ($employees as $employee) {
                if ($nature === 'salary') {
                    $baseSalary = $employee->base_salary;
                    $allowances = $employee->allowances()->where('is_active', true)->sum('amount');
                    $deductions = $employee->deductions()->where('is_active', true)->sum('amount');
                } else {
                    $baseSalary = $data['base_amount'] ?? 0;
                    if (isset($data['individual_amounts'][$employee->id])) {
                        $baseSalary = $data['individual_amounts'][$employee->id];
                    }
                    $allowances = 0;
                    $deductions = 0;
                }

                $gross = $baseSalary + $allowances;
                $net = $gross - $deductions;

                PayrollItem::create([
                    'payroll_cycle_id' => $cycle->id,
                    'employee_id' => $employee->id,
                    'base_salary' => $baseSalary,
                    'total_allowances' => $allowances,
                    'total_deductions' => $deductions,
                    'gross_salary' => $gross,
                    'net_salary' => $net,
                    'status' => 'active'
                ]);

                $totalGross += $gross;
                $totalDeductions += $deductions;
                $totalNet += $net;
            }

            $cycle->update([
                'total_gross' => $totalGross,
                'total_deductions' => $totalDeductions,
                'total_net' => $totalNet
            ]);

            // If no manager, we leave it as draft for the user to confirm/approve themselves
            // or we could auto-approve if they are admin.
            // Requirement says "it should remain pending... until it reaches gm".
            
            DB::commit();
            return $cycle;

        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    public function approvePayroll($id, $user)
    {
        $cycle = PayrollCycle::findOrFail($id);
        
        // Authorization check
        if ($cycle->current_approver_id && $cycle->current_approver_id != $user->id) {
            throw new \Exception("You are not the current authorized approver for this cycle.");
        }

        if ($cycle->status === 'draft' && $cycle->created_by == $user->id) {
            // Creator approving their own draft to start workflow
            $nextApproverId = $this->getNextApprover($user->id);
            if ($nextApproverId) {
                $cycle->update([
                    'status' => 'pending_approval',
                    'current_approver_id' => $nextApproverId
                ]);
                return $cycle;
            }
        }

        DB::beginTransaction();
        try {
            // Update trail
            $trail = $cycle->approval_trail ?? [];
            $trail[] = [
                'user_id' => $user->id,
                'user_name' => $user->full_name,
                'action' => 'approved',
                'timestamp' => now()->toDateTimeString()
            ];

            // Find next approver
            $nextApproverId = $this->getNextApprover($user->id);

            if ($nextApproverId) {
                // Move to next level
                $cycle->update([
                    'status' => 'pending_approval',
                    'current_approver_id' => $nextApproverId,
                    'approval_trail' => $trail
                ]);
            } else {
                // Final approval reached
                $cycle->update([
                    'status' => 'approved',
                    'current_approver_id' => null,
                    'approval_trail' => $trail,
                    'approved_by' => $user->id,
                    'approved_at' => now()
                ]);
                
                // Generate GL Entries
                $this->createAccrualEntries($cycle, $user);
            }

            DB::commit();
            return $cycle;
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    protected function createAccrualEntries($cycle, $user)
    {
        $mappings = $this->mappingService->getStandardAccounts();
        $entryDate = $cycle->period_end ?? now()->format('Y-m-d');
        $glEntries = [];

        // Debit Expense
        $glEntries[] = [
            'account_code' => $mappings['salaries_expense'],
            'entry_type' => 'DEBIT',
            'amount' => $cycle->total_gross,
            'description' => "Payroll Accrual (" . ucfirst($cycle->cycle_type) . "): " . $cycle->cycle_name
        ];

        // Credit Payable
        $glEntries[] = [
            'account_code' => $mappings['salaries_payable'],
            'entry_type' => 'CREDIT',
            'amount' => $cycle->total_net,
            'description' => "Payroll Payable (" . ucfirst($cycle->cycle_type) . "): " . $cycle->cycle_name
        ];

        if ($cycle->total_deductions > 0) {
            $glEntries[] = [
                'account_code' => $mappings['accounts_payable'],
                'entry_type' => 'CREDIT',
                'amount' => $cycle->total_deductions,
                'description' => "Payroll Deductions Liability: " . $cycle->cycle_name
            ];
        }

        $this->ledgerService->postTransaction(
            $glEntries,
            'payroll_cycle',
            $cycle->id,
            'PAY-ACCR-' . $cycle->id,
            $entryDate
        );
    }

    public function processPayment($id, $paymentAccountId = null)
    {
        $cycle = PayrollCycle::with('items')->findOrFail($id);
        if ($cycle->status !== 'approved') {
            throw new \Exception("Payroll cycle must be fully approved before payment.");
        }

        DB::beginTransaction();
        try {
            // We'll update the status at the end using updateCycleStatus logic
            // $cycle->update(['status' => 'paid']); 
            
            $mappings = $this->mappingService->getStandardAccounts();
            
            $salaryPayableAccount = ChartOfAccount::where('account_code', $mappings['salaries_payable'])->first();
            $cashAccount = $paymentAccountId ? ChartOfAccount::find($paymentAccountId) : ChartOfAccount::where('account_code', $mappings['cash'])->first();

            if ($salaryPayableAccount && $cashAccount) {
                $glEntries = [
                    [
                        'account_code' => $mappings['salaries_payable'],
                        'entry_type' => 'DEBIT',
                        'amount' => $cycle->total_net,
                        'description' => "Payroll Payment (" . ucfirst($cycle->cycle_type) . "): " . $cycle->cycle_name
                    ],
                    [
                        'account_code' => $cashAccount->account_code,
                        'entry_type' => 'CREDIT',
                        'amount' => $cycle->total_net,
                        'description' => "Payroll Payment (" . ucfirst($cycle->cycle_type) . "): " . $cycle->cycle_name
                    ]
                ];

                $this->ledgerService->postTransaction(
                    $glEntries,
                    'payroll_cycle',
                    $cycle->id,
                    'PAY-PMT-' . $cycle->id,
                    $cycle->payment_date ?? now()->format('Y-m-d')
                );
            }

            foreach($cycle->items as $item) {
                if ($item->status !== 'active') continue;

                // Calculate already paid
                $alreadyPaid = PayrollTransaction::where('payroll_item_id', $item->id)
                    ->where('transaction_type', 'payment')
                    ->sum('amount');

                $remaining = $item->net_salary - $alreadyPaid;

                if ($remaining > 0.01) {
                    PayrollTransaction::create([
                        'payroll_item_id' => $item->id,
                        'employee_id' => $item->employee_id,
                        'amount' => $remaining,
                        'transaction_type' => 'payment',
                        'transaction_date' => $cycle->payment_date ?? now(),
                        'notes' => "Full Payment (Remainder) for cycle " . $cycle->cycle_name,
                        'created_by' => auth()->id() ?? 1
                    ]);
                }
            }

            DB::commit();
            $this->checkAndSetPaidStatus($cycle->id);
            return $cycle->fresh(['items']);
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    public function createPaymentJournalEntry($payrollItem, $amount, $transactionId, $paymentAccountId = null)
    {
        $mappings = $this->mappingService->getStandardAccounts();
        
        $salaryPayableAccount = ChartOfAccount::where('account_code', $mappings['salaries_payable'])->first();
        $cashAccount = $paymentAccountId ? ChartOfAccount::find($paymentAccountId) : ChartOfAccount::where('account_code', $mappings['cash'])->first();

        if (!$salaryPayableAccount || !$cashAccount) {
            throw new \Exception("Required accounts (Payable or Cash) not found in mapping");
        }

        $voucherNumber = 'PAY-IND-' . $payrollItem->id . '-' . $transactionId;

        $glEntries = [
            [
                'account_code' => $mappings['salaries_payable'],
                'entry_type' => 'DEBIT',
                'amount' => $amount,
                'description' => "Individual Salary Payment - " . ($payrollItem->employee->full_name ?? 'Employee')
            ],
            [
                'account_code' => $cashAccount->account_code,
                'entry_type' => 'CREDIT',
                'amount' => $amount,
                'description' => "Individual Salary Payment - " . ($payrollItem->employee->full_name ?? 'Employee')
            ]
        ];

        $this->ledgerService->postTransaction(
            $glEntries,
            'payroll_transaction',
            $transactionId,
            $voucherNumber,
            now()->format('Y-m-d')
        );
    }

    public function toggleItemStatus($itemId)
    {
        $item = PayrollItem::findOrFail($itemId);
        $item->status = $item->status === 'active' ? 'on_hold' : 'active';
        $item->save();
        return $item;
    }

    public function updatePayrollItem($itemId, $data)
    {
        $item = PayrollItem::findOrFail($itemId);
        $item->update([
            'base_salary' => $data['base_salary'],
            'total_allowances' => $data['total_allowances'],
            'total_deductions' => $data['total_deductions'],
            'gross_salary' => $data['base_salary'] + $data['total_allowances'],
            'net_salary' => ($data['base_salary'] + $data['total_allowances']) - $data['total_deductions'],
            'notes' => $data['notes'] ?? $item->notes
        ]);

        // Update cycle totals
        $cycle = $item->payrollCycle;
        $items = $cycle->items;
        $cycle->update([
            'total_gross' => $items->sum('gross_salary'),
            'total_deductions' => $items->sum('total_deductions'),
            'total_net' => $items->sum('net_salary')
        ]);

        return $item;
    }
    public function checkAndSetPaidStatus($cycleId)
    {
        $cycle = PayrollCycle::with('items')->findOrFail($cycleId);
        if ($cycle->status !== 'approved' && $cycle->status !== 'paid') return;

        $items = $cycle->items;
        $allPaid = true;

        foreach ($items as $item) {
            if ($item->status === 'on_hold') continue;
            
            $paidTotal = PayrollTransaction::where('payroll_item_id', $item->id)
                ->where('transaction_type', 'payment')
                ->sum('amount');

            if ($paidTotal < $item->net_salary - 0.01) {
                $allPaid = false;
                break;
            }
        }

        if ($allPaid && $cycle->status === 'approved') {
            $cycle->update(['status' => 'paid']);
        } elseif (!$allPaid && $cycle->status === 'paid') {
            $cycle->update(['status' => 'approved']);
        }
    }
}
