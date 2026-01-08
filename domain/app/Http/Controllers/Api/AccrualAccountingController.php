<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PayrollEntry;
use App\Models\Prepayment;
use App\Models\UnearnedRevenue;
use App\Services\PermissionService;
use App\Services\LedgerService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class AccrualAccountingController extends Controller
{
    use BaseApiController;

    private LedgerService $ledgerService;

    public function __construct(LedgerService $ledgerService)
    {
        $this->ledgerService = $ledgerService;
    }

    public function index(Request $request): JsonResponse
    {
        PermissionService::requirePermission('accrual_accounting', 'view');

        $module = $request->query('module');
        $limit = $request->query('limit', 20);

        if ($module === 'payroll') {
            $data = PayrollEntry::orderBy('payroll_date', 'desc')->paginate($limit);
        } elseif ($module === 'prepayments') {
            $data = Prepayment::orderBy('prepayment_date', 'desc')->paginate($limit);
        } elseif ($module === 'unearned_revenue') {
            $data = UnearnedRevenue::orderBy('receipt_date', 'desc')->paginate($limit);
        } else {
            return $this->errorResponse('Invalid module');
        }

        return response()->json([
            'success' => true,
            'data' => $data->items(),
            'total' => $data->total(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        PermissionService::requirePermission('accrual_accounting', 'create');
        $module = $request->query('module');
        
        $coaService = app(\App\Services\ChartOfAccountsMappingService::class);
        $accounts = $coaService->getStandardAccounts();

        if ($module === 'payroll') {
            $validated = $request->validate([
                'payroll_date' => 'required|date',
                'gross_pay' => 'required|numeric',
                'deductions' => 'nullable|numeric',
                'description' => 'nullable|string',
            ]);
            $validated['net_pay'] = $validated['gross_pay'] - ($validated['deductions'] ?? 0);
            $entry = PayrollEntry::create($validated);
            
            // Post to GL
            // Debit Salaries Expense, Credit Salaries Payable
            $salaryExpense = $coaService->getAccountCode('Expense', 'مرتبات') ?? $accounts['operating_expenses'];
            $salariesPayable = $coaService->getAccountCode('Liability', 'مرتبات') ?? '2130';

            $this->ledgerService->postTransaction([
                ['account_code' => $salaryExpense, 'entry_type' => 'DEBIT', 'amount' => $validated['gross_pay'], 'description' => $validated['description']],
                ['account_code' => $salariesPayable, 'entry_type' => 'CREDIT', 'amount' => $validated['net_pay'], 'description' => $validated['description']],
            ], 'payroll_entries', $entry->id, null, $validated['payroll_date']);

            return $this->successResponse(['id' => $entry->id]);

        } elseif ($module === 'prepayments') {
            $validated = $request->validate([
                'prepayment_date' => 'required|date',
                'total_amount' => 'required|numeric',
                'months' => 'required|integer',
                'description' => 'required|string',
                'expense_account_code' => 'nullable|string',
            ]);
            $entry = Prepayment::create($validated);
            
            // Post to GL: Debit Prepaid Expenses (Asset), Credit Cash
            $prepaidAccount = $coaService->getAccountCode('Asset', 'مدفوعات مقدمة') ?? '1140';
            $cashAccount = $accounts['cash'];

            $this->ledgerService->postTransaction([
                ['account_code' => $prepaidAccount, 'entry_type' => 'DEBIT', 'amount' => $validated['total_amount'], 'description' => $validated['description']],
                ['account_code' => $cashAccount, 'entry_type' => 'CREDIT', 'amount' => $validated['total_amount'], 'description' => $validated['description']],
            ], 'prepayments', $entry->id, null, $validated['prepayment_date']);

            return $this->successResponse(['id' => $entry->id]);

        } elseif ($module === 'unearned_revenue') {
            $validated = $request->validate([
                'receipt_date' => 'required|date',
                'total_amount' => 'required|numeric',
                'months' => 'required|integer',
                'description' => 'required|string',
                'revenue_account_code' => 'nullable|string',
            ]);
            $entry = UnearnedRevenue::create($validated);
            
            // Post to GL: Debit Cash, Credit Unearned Revenue (Liability)
            $cashAccount = $accounts['cash'];
            $unearnedAccount = $coaService->getAccountCode('Liability', 'إيرادات غير مكتسبة') ?? '2120';

            $this->ledgerService->postTransaction([
                ['account_code' => $cashAccount, 'entry_type' => 'DEBIT', 'amount' => $validated['total_amount'], 'description' => $validated['description']],
                ['account_code' => $unearnedAccount, 'entry_type' => 'CREDIT', 'amount' => $validated['total_amount'], 'description' => $validated['description']],
            ], 'unearned_revenue', $entry->id, null, $validated['receipt_date']);

            return $this->successResponse(['id' => $entry->id]);
        }

        return $this->errorResponse('Invalid module');
    }


    public function update(Request $request): JsonResponse
    {
        PermissionService::requirePermission('accrual_accounting', 'edit');
        $module = $request->query('module');
        $id = $request->input('id');

        // Using ChartOfAccountsMappingService to get account codes
        // We need to inject or instantiate it. Since it's not injected in the constructor in original code (my bad, I missed it in scan), 
        // I should instantiate it or rely on a helper if available, but instantiation is safe here.
        $coaService = app(\App\Services\ChartOfAccountsMappingService::class);
        $accounts = $coaService->getStandardAccounts();

        if ($module === 'payroll') {
             // Process Payroll Payment
             $entry = PayrollEntry::findOrFail($id);
             
             if ($entry->status === 'paid') {
                 return $this->errorResponse('Payroll already processed', 400);
             }

             $paymentDate = $request->input('payment_date', now()->format('Y-m-d'));
             
             DB::beginTransaction();
             try {
                $entry->update([
                    'status' => 'paid',
                    'payment_date' => $paymentDate,
                    'paid_at' => now()
                ]);

                // Post Payment: Debit Salaries Payable, Credit Cash
                // Codes: Liability 'مرتبات' (Salaries Payable), Asset 'cash'
                $payableAccount = $coaService->getAccountCode('Liability', 'مرتبات') ?? '2130';
                $cashAccount = $accounts['cash'];
                
                $voucherNumber = $this->ledgerService->getNextVoucherNumber('PAY');
                
                $this->ledgerService->postTransaction([
                    ['account_code' => $payableAccount, 'entry_type' => 'DEBIT', 'amount' => $entry->salary_amount, 'description' => "Payroll Payment - $entry->employee_name"],
                    ['account_code' => $cashAccount, 'entry_type' => 'CREDIT', 'amount' => $entry->salary_amount, 'description' => "Payroll Payment - $entry->employee_name"],
                ], 'payroll_entries', $entry->id, $voucherNumber, $paymentDate);

                DB::commit();
                return $this->successResponse(['message' => 'Payroll processed successfully']);
             } catch (\Exception $e) {
                 DB::rollBack();
                 return $this->errorResponse($e->getMessage(), 500);
             }

        } elseif ($module === 'prepayments') {
            $prepayment = Prepayment::findOrFail($id);
            $amortization_date = $request->input('amortization_date', now()->format('Y-m-d'));
            
            // Allow manual amount if provided, else calc straight line
            $amount = $request->input('amount') ? floatval($request->input('amount')) : ($prepayment->total_amount / ($prepayment->months > 0 ? $prepayment->months : 1));

            if ($prepayment->amortized_amount + $amount > $prepayment->total_amount + 0.01) {
                return $this->errorResponse('Already fully amortized');
            }

            $prepayment->increment('amortized_amount', $amount);
            
            // Post Amortization: Debit Expense, Credit Prepaid Expenses
            $expenseAccount = $prepayment->expense_account_code ?? $accounts['operating_expenses'];
            // Prepaid account usually 1140 or dynamically found
            $prepaidAccount = $coaService->getAccountCode('Asset', 'مدفوعات مقدمة') ?? '1140';

            $this->ledgerService->postTransaction([
                ['account_code' => $expenseAccount, 'entry_type' => 'DEBIT', 'amount' => $amount, 'description' => 'Amortization: ' . $prepayment->description],
                ['account_code' => $prepaidAccount, 'entry_type' => 'CREDIT', 'amount' => $amount, 'description' => 'Amortization: ' . $prepayment->description],
            ], 'prepayments', $prepayment->id, null, $amortization_date);

            return $this->successResponse();

        } elseif ($module === 'unearned_revenue') {
            $unearned = UnearnedRevenue::findOrFail($id);
            $recognition_date = $request->input('recognition_date', now()->format('Y-m-d'));
            $amount = $request->input('amount') ? floatval($request->input('amount')) : ($unearned->total_amount / ($unearned->months > 0 ? $unearned->months : 1));

            if ($unearned->recognized_amount + $amount > $unearned->total_amount + 0.01) {
                return $this->errorResponse('Already fully recognized');
            }

            $unearned->increment('recognized_amount', $amount);
            
            // Post Recognition: Debit Unearned Revenue, Credit Revenue
            $unearnedAccount = $coaService->getAccountCode('Liability', 'إيرادات غير مكتسبة') ?? '2120';
            $revenueAccount = $unearned->revenue_account_code ?? $accounts['sales_revenue'];

            $this->ledgerService->postTransaction([
                ['account_code' => $unearnedAccount, 'entry_type' => 'DEBIT', 'amount' => $amount, 'description' => 'Recognition: ' . $unearned->description],
                ['account_code' => $revenueAccount, 'entry_type' => 'CREDIT', 'amount' => $amount, 'description' => 'Recognition: ' . $unearned->description],
            ], 'unearned_revenue', $unearned->id, null, $recognition_date);

            return $this->successResponse();
        }

        return $this->errorResponse('Invalid module or action');
    }

}
