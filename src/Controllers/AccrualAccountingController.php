<?php

require_once __DIR__ . '/Controller.php';
require_once __DIR__ . '/../Services/LedgerService.php';
require_once __DIR__ . '/../Services/ChartOfAccountsMappingService.php';

class AccrualAccountingController extends Controller
{
    private $ledgerService;
    private $coaMapping;

    public function __construct()
    {
        parent::__construct();
        $this->ledgerService = new LedgerService();
        $this->coaMapping = new ChartOfAccountsMappingService();
    }

    public function handle()
    {
        if (!is_logged_in()) {
            $this->errorResponse('Unauthorized', 401);
        }

        $method = $_SERVER['REQUEST_METHOD'];
        $module = $_GET['module'] ?? '';

        if ($method === 'GET') {
            if ($module === 'payroll') {
                $this->getPayrollEntries();
            } elseif ($module === 'prepayments') {
                $this->getPrepayments();
            } elseif ($module === 'unearned_revenue') {
                $this->getUnearnedRevenue();
            } else {
                $this->errorResponse('Invalid module');
            }
        } elseif ($method === 'POST') {
            if ($module === 'payroll') {
                $this->createPayrollEntry();
            } elseif ($module === 'prepayments') {
                $this->createPrepayment();
            } elseif ($module === 'unearned_revenue') {
                $this->createUnearnedRevenue();
            } else {
                $this->errorResponse('Invalid module');
            }
        } elseif ($method === 'PUT') {
            if ($module === 'payroll') {
                $this->processPayroll();
            } elseif ($module === 'prepayments') {
                $this->amortizePrepayment();
            } elseif ($module === 'unearned_revenue') {
                $this->recognizeRevenue();
            } else {
                $this->errorResponse('Invalid module');
            }
        }
    }

    // ========== PAYROLL ==========

    private function getPayrollEntries()
    {
        $params = $this->getPaginationParams();
        $limit = $params['limit'];
        $offset = $params['offset'];

        $result = mysqli_query(
            $this->conn,
            "SELECT p.*, u.username as created_by_name
             FROM payroll_entries p
             LEFT JOIN users u ON p.created_by = u.id
             ORDER BY p.payroll_date DESC, p.id DESC
             LIMIT $limit OFFSET $offset"
        );

        $entries = [];
        while ($row = mysqli_fetch_assoc($result)) {
            // Map database fields to frontend expected fields
            $row['gross_pay'] = floatval($row['salary_amount'] ?? 0);
            $row['deductions'] = 0; // Not stored in current schema
            $row['net_pay'] = floatval($row['salary_amount'] ?? 0);
            $entries[] = $row;
        }

        $countResult = mysqli_query($this->conn, "SELECT COUNT(*) as total FROM payroll_entries");
        $total = mysqli_fetch_assoc($countResult)['total'];

        $this->paginatedResponse($entries, $total, $params['page'], $params['limit']);
    }

    private function createPayrollEntry()
    {
        $data = $this->getJsonInput();

        // Map frontend fields to database fields
        $gross_pay = floatval($data['gross_pay'] ?? $data['salary_amount'] ?? 0);
        $deductions = floatval($data['deductions'] ?? 0);
        $net_pay = $gross_pay - $deductions;
        $employee_name = mysqli_real_escape_string($this->conn, $data['employee_name'] ?? $data['description'] ?? 'Payroll');
        $payroll_date = mysqli_real_escape_string($this->conn, $data['payroll_date'] ?? date('Y-m-d'));
        $description = mysqli_real_escape_string($this->conn, $data['description'] ?? 'كشف مرتب شهري');

        if (empty($employee_name) || $gross_pay <= 0) {
            $this->errorResponse('Employee name and positive gross pay required');
        }

        $user_id = $_SESSION['user_id'];

        mysqli_begin_transaction($this->conn);

        try {
            // Create payroll entry (accrued liability)
            $stmt = mysqli_prepare(
                $this->conn,
                "INSERT INTO payroll_entries (employee_name, salary_amount, payroll_date, description, status, created_by) 
                 VALUES (?, ?, ?, ?, 'accrued', ?)"
            );
            mysqli_stmt_bind_param($stmt, "sdssi", $employee_name, $gross_pay, $payroll_date, $description, $user_id);
            mysqli_stmt_execute($stmt);
            $id = mysqli_insert_id($this->conn);
            mysqli_stmt_close($stmt);

            // Post to GL: Debit Salary Expense, Credit Salaries Payable
            $accounts = $this->coaMapping->getStandardAccounts();
            $salary_expense_account = $this->coaMapping->getAccountCode('Expense', 'مرتبات') ?? $accounts['operating_expenses'];
            $salaries_payable_account = $this->coaMapping->getAccountCode('Liability', 'مرتبات') ?? '2130'; // Default if not exists

            // Create Salaries Payable account if it doesn't exist
            $check_ap = mysqli_query(
                $this->conn,
                "SELECT account_code FROM chart_of_accounts WHERE account_code = '2130' AND is_active = 1"
            );
            if (!$check_ap || mysqli_num_rows($check_ap) == 0) {
                mysqli_query(
                    $this->conn,
                    "INSERT INTO chart_of_accounts (account_code, account_name, account_type) 
                     VALUES ('2130', 'المرتبات المستحقة', 'Liability')"
                );
            }

            $voucher_number = $this->ledgerService->getNextVoucherNumber('PAY');
            $gl_entries = [
                [
                    'account_code' => $salary_expense_account,
                    'entry_type' => 'DEBIT',
                    'amount' => $gross_pay,
                    'description' => "مرتب مستحق - $employee_name"
                ],
                [
                    'account_code' => $salaries_payable_account,
                    'entry_type' => 'CREDIT',
                    'amount' => $net_pay,
                    'description' => "مرتب مستحق - $employee_name"
                ]
            ];

            $this->ledgerService->postTransaction($gl_entries, 'payroll_entries', $id, $voucher_number, $payroll_date);

            mysqli_commit($this->conn);
            log_operation('CREATE', 'payroll_entries', $id, null, $data);
            $this->successResponse(['id' => $id, 'voucher_number' => $voucher_number]);
        } catch (Exception $e) {
            mysqli_rollback($this->conn);
            $this->errorResponse($e->getMessage());
        }
    }

    private function processPayroll()
    {
        $data = $this->getJsonInput();
        $id = intval($data['id'] ?? 0);
        $payment_date = mysqli_real_escape_string($this->conn, $data['payment_date'] ?? date('Y-m-d'));

        $result = mysqli_query($this->conn, "SELECT * FROM payroll_entries WHERE id = $id");
        $payroll = mysqli_fetch_assoc($result);

        if (!$payroll) {
            $this->errorResponse('Payroll entry not found', 404);
        }

        if ($payroll['status'] === 'paid') {
            $this->errorResponse('Payroll already processed', 400);
        }

        mysqli_begin_transaction($this->conn);

        try {
            // Update status to paid
            $stmt = mysqli_prepare(
                $this->conn,
                "UPDATE payroll_entries SET status = 'paid', payment_date = ?, paid_at = NOW() WHERE id = ?"
            );
            mysqli_stmt_bind_param($stmt, "si", $payment_date, $id);
            mysqli_stmt_execute($stmt);
            mysqli_stmt_close($stmt);

            // Post payment: Debit Salaries Payable, Credit Cash
            $accounts = $this->coaMapping->getStandardAccounts();
            $salaries_payable_account = $this->coaMapping->getAccountCode('Liability', 'مرتبات') ?? '2130';
            $salary_amount = floatval($payroll['salary_amount']);

            $voucher_number = $this->ledgerService->getNextVoucherNumber('PAY');
            $gl_entries = [
                [
                    'account_code' => $salaries_payable_account,
                    'entry_type' => 'DEBIT',
                    'amount' => $salary_amount,
                    'description' => "دفع مرتب - " . $payroll['employee_name']
                ],
                [
                    'account_code' => $accounts['cash'],
                    'entry_type' => 'CREDIT',
                    'amount' => $salary_amount,
                    'description' => "دفع مرتب - " . $payroll['employee_name']
                ]
            ];

            $this->ledgerService->postTransaction($gl_entries, 'payroll_entries', $id, $voucher_number, $payment_date);

            mysqli_commit($this->conn);
            log_operation('UPDATE', 'payroll_entries', $id, null, $data);
            $this->successResponse(['message' => 'Payroll processed successfully']);
        } catch (Exception $e) {
            mysqli_rollback($this->conn);
            $this->errorResponse($e->getMessage());
        }
    }

    // ========== PREPAYMENTS ==========

    private function getPrepayments()
    {
        $params = $this->getPaginationParams();
        $limit = $params['limit'];
        $offset = $params['offset'];

        $result = mysqli_query(
            $this->conn,
            "SELECT p.*, u.username as created_by_name,
                    p.payment_date as prepayment_date,
                    p.amortization_periods as months
             FROM prepayments p
             LEFT JOIN users u ON p.created_by = u.id
             ORDER BY p.payment_date DESC, p.id DESC
             LIMIT $limit OFFSET $offset"
        );

        $prepayments = [];
        while ($row = mysqli_fetch_assoc($result)) {
            // Calculate remaining unamortized amount
            $amortized = floatval($row['amortized_amount'] ?? 0);
            $row['remaining_amount'] = floatval($row['total_amount']) - $amortized;
            $prepayments[] = $row;
        }

        $countResult = mysqli_query($this->conn, "SELECT COUNT(*) as total FROM prepayments");
        $total = mysqli_fetch_assoc($countResult)['total'];

        $this->paginatedResponse($prepayments, $total, $params['page'], $params['limit']);
    }

    private function createPrepayment()
    {
        $data = $this->getJsonInput();

        $description = mysqli_real_escape_string($this->conn, $data['description'] ?? '');
        $total_amount = floatval($data['total_amount'] ?? 0);
        $payment_date = mysqli_real_escape_string($this->conn, $data['prepayment_date'] ?? $data['payment_date'] ?? date('Y-m-d'));
        $expense_account_code = mysqli_real_escape_string($this->conn, $data['expense_account_code'] ?? '');
        $amortization_periods = intval($data['months'] ?? $data['amortization_periods'] ?? 1);

        if (empty($expense_account_code)) {
            // Get default expense account
            $accounts = $this->coaMapping->getStandardAccounts();
            $expense_account_code = $accounts['operating_expenses'] ?? '5200';
        }

        if (empty($description) || $total_amount <= 0) {
            $this->errorResponse('Description and positive amount required');
        }

        $user_id = $_SESSION['user_id'];

        mysqli_begin_transaction($this->conn);

        try {
            // Create prepayment record
            $stmt = mysqli_prepare(
                $this->conn,
                "INSERT INTO prepayments (description, total_amount, payment_date, expense_account_code, amortization_periods, created_by) 
                 VALUES (?, ?, ?, ?, ?, ?)"
            );
            mysqli_stmt_bind_param($stmt, "sdssii", $description, $total_amount, $payment_date, $expense_account_code, $amortization_periods, $user_id);
            mysqli_stmt_execute($stmt);
            $id = mysqli_insert_id($this->conn);
            mysqli_stmt_close($stmt);

            // Post to GL: Debit Prepaid Expenses (Asset), Credit Cash
            $accounts = $this->coaMapping->getStandardAccounts();
            $prepaid_account = $this->coaMapping->getAccountCode('Asset', 'مدفوعات مقدمة') ?? '1140';

            // Create Prepaid Expenses account if it doesn't exist
            $check_prepaid = mysqli_query(
                $this->conn,
                "SELECT account_code FROM chart_of_accounts WHERE account_code = '1140' AND is_active = 1"
            );
            if (!$check_prepaid || mysqli_num_rows($check_prepaid) == 0) {
                mysqli_query(
                    $this->conn,
                    "INSERT INTO chart_of_accounts (account_code, account_name, account_type) 
                     VALUES ('1140', 'مدفوعات مقدمة', 'Asset')"
                );
            }

            $voucher_number = $this->ledgerService->getNextVoucherNumber('PRE');
            $gl_entries = [
                [
                    'account_code' => $prepaid_account,
                    'entry_type' => 'DEBIT',
                    'amount' => $total_amount,
                    'description' => "مدفوعات مقدمة - $description"
                ],
                [
                    'account_code' => $accounts['cash'],
                    'entry_type' => 'CREDIT',
                    'amount' => $total_amount,
                    'description' => "دفع مقدمة - $description"
                ]
            ];

            $this->ledgerService->postTransaction($gl_entries, 'prepayments', $id, $voucher_number, $payment_date);

            mysqli_commit($this->conn);
            log_operation('CREATE', 'prepayments', $id, null, $data);
            $this->successResponse(['id' => $id, 'voucher_number' => $voucher_number]);
        } catch (Exception $e) {
            mysqli_rollback($this->conn);
            $this->errorResponse($e->getMessage());
        }
    }

    private function amortizePrepayment()
    {
        $data = $this->getJsonInput();
        $id = intval($data['id'] ?? 0);
        $amortization_date = mysqli_real_escape_string($this->conn, $data['amortization_date'] ?? date('Y-m-d'));
        $amount = floatval($data['amount'] ?? 0);

        $result = mysqli_query($this->conn, "SELECT * FROM prepayments WHERE id = $id");
        $prepayment = mysqli_fetch_assoc($result);

        if (!$prepayment) {
            $this->errorResponse('Prepayment not found', 404);
        }

        $remaining = floatval($prepayment['total_amount']) - floatval($prepayment['amortized_amount'] ?? 0);
        if ($amount > $remaining) {
            $this->errorResponse("Amount exceeds remaining unamortized balance ($remaining)");
        }

        mysqli_begin_transaction($this->conn);

        try {
            // Update amortized amount
            $new_amortized = floatval($prepayment['amortized_amount'] ?? 0) + $amount;
            $stmt = mysqli_prepare(
                $this->conn,
                "UPDATE prepayments SET amortized_amount = ? WHERE id = ?"
            );
            mysqli_stmt_bind_param($stmt, "di", $new_amortized, $id);
            mysqli_stmt_execute($stmt);
            mysqli_stmt_close($stmt);

            // Post amortization: Debit Expense, Credit Prepaid Expenses
            $prepaid_account = $this->coaMapping->getAccountCode('Asset', 'مدفوعات مقدمة') ?? '1140';
            $expense_account = $prepayment['expense_account_code'];

            $voucher_number = $this->ledgerService->getNextVoucherNumber('AMO');
            $gl_entries = [
                [
                    'account_code' => $expense_account,
                    'entry_type' => 'DEBIT',
                    'amount' => $amount,
                    'description' => "استهلاك مدفوعات مقدمة - " . $prepayment['description']
                ],
                [
                    'account_code' => $prepaid_account,
                    'entry_type' => 'CREDIT',
                    'amount' => $amount,
                    'description' => "استهلاك مدفوعات مقدمة - " . $prepayment['description']
                ]
            ];

            $this->ledgerService->postTransaction($gl_entries, 'prepayments', $id, $voucher_number, $amortization_date);

            mysqli_commit($this->conn);
            log_operation('UPDATE', 'prepayments', $id, null, $data);
            $this->successResponse(['message' => 'Prepayment amortized successfully']);
        } catch (Exception $e) {
            mysqli_rollback($this->conn);
            $this->errorResponse($e->getMessage());
        }
    }

    // ========== UNEARNED REVENUE ==========

    private function getUnearnedRevenue()
    {
        $params = $this->getPaginationParams();
        $limit = $params['limit'];
        $offset = $params['offset'];

        $result = mysqli_query(
            $this->conn,
            "SELECT u.*, usr.username as created_by_name,
                    u.received_date as receipt_date,
                    u.revenue_account_code,
                    1 as months
             FROM unearned_revenue u
             LEFT JOIN users usr ON u.created_by = usr.id
             ORDER BY u.received_date DESC, u.id DESC
             LIMIT $limit OFFSET $offset"
        );

        $revenues = [];
        while ($row = mysqli_fetch_assoc($result)) {
            $recognized = floatval($row['recognized_amount'] ?? 0);
            $row['remaining_amount'] = floatval($row['total_amount']) - $recognized;
            $revenues[] = $row;
        }

        $countResult = mysqli_query($this->conn, "SELECT COUNT(*) as total FROM unearned_revenue");
        $total = mysqli_fetch_assoc($countResult)['total'];

        $this->paginatedResponse($revenues, $total, $params['page'], $params['limit']);
    }

    private function createUnearnedRevenue()
    {
        $data = $this->getJsonInput();

        $description = mysqli_real_escape_string($this->conn, $data['description'] ?? '');
        $total_amount = floatval($data['total_amount'] ?? 0);
        $received_date = mysqli_real_escape_string($this->conn, $data['receipt_date'] ?? $data['received_date'] ?? date('Y-m-d'));
        $revenue_account_code = mysqli_real_escape_string($this->conn, $data['revenue_account_code'] ?? '');
        $months = intval($data['months'] ?? 1);

        if (empty($description) || $total_amount <= 0) {
            $this->errorResponse('Description and positive amount required');
        }

        if (empty($revenue_account_code)) {
            // Get default revenue account
            $accounts = $this->coaMapping->getStandardAccounts();
            $revenue_account_code = $accounts['sales_revenue'] ?? '4100';
        }

        $user_id = $_SESSION['user_id'];

        mysqli_begin_transaction($this->conn);

        try {
            // Create unearned revenue record
            $stmt = mysqli_prepare(
                $this->conn,
                "INSERT INTO unearned_revenue (description, total_amount, received_date, revenue_account_code, created_by) 
                 VALUES (?, ?, ?, ?, ?)"
            );
            mysqli_stmt_bind_param($stmt, "sdssi", $description, $total_amount, $received_date, $revenue_account_code, $user_id);
            mysqli_stmt_execute($stmt);
            $id = mysqli_insert_id($this->conn);
            mysqli_stmt_close($stmt);

            // Post to GL: Debit Cash, Credit Unearned Revenue (Liability)
            $accounts = $this->coaMapping->getStandardAccounts();
            $unearned_account = $this->coaMapping->getAccountCode('Liability', 'إيرادات غير مكتسبة') ?? '2120';

            // Create Unearned Revenue account if it doesn't exist
            $check_unearned = mysqli_query(
                $this->conn,
                "SELECT account_code FROM chart_of_accounts WHERE account_code = '2120' AND is_active = 1"
            );
            if (!$check_unearned || mysqli_num_rows($check_unearned) == 0) {
                mysqli_query(
                    $this->conn,
                    "INSERT INTO chart_of_accounts (account_code, account_name, account_type) 
                     VALUES ('2120', 'إيرادات غير مكتسبة', 'Liability')"
                );
            }

            $voucher_number = $this->ledgerService->getNextVoucherNumber('UNE');
            $gl_entries = [
                [
                    'account_code' => $accounts['cash'],
                    'entry_type' => 'DEBIT',
                    'amount' => $total_amount,
                    'description' => "إيراد غير مكتسب - $description"
                ],
                [
                    'account_code' => $unearned_account,
                    'entry_type' => 'CREDIT',
                    'amount' => $total_amount,
                    'description' => "إيراد غير مكتسب - $description"
                ]
            ];

            $this->ledgerService->postTransaction($gl_entries, 'unearned_revenue', $id, $voucher_number, $received_date);

            mysqli_commit($this->conn);
            log_operation('CREATE', 'unearned_revenue', $id, null, $data);
            $this->successResponse(['id' => $id, 'voucher_number' => $voucher_number]);
        } catch (Exception $e) {
            mysqli_rollback($this->conn);
            $this->errorResponse($e->getMessage());
        }
    }

    private function recognizeRevenue()
    {
        $data = $this->getJsonInput();
        $id = intval($data['id'] ?? 0);
        $recognition_date = mysqli_real_escape_string($this->conn, $data['recognition_date'] ?? date('Y-m-d'));
        $amount = floatval($data['amount'] ?? 0);

        $result = mysqli_query($this->conn, "SELECT * FROM unearned_revenue WHERE id = $id");
        $unearned = mysqli_fetch_assoc($result);

        if (!$unearned) {
            $this->errorResponse('Unearned revenue not found', 404);
        }

        $remaining = floatval($unearned['total_amount']) - floatval($unearned['recognized_amount'] ?? 0);
        if ($amount > $remaining) {
            $this->errorResponse("Amount exceeds remaining unrecognized balance ($remaining)");
        }

        mysqli_begin_transaction($this->conn);

        try {
            // Update recognized amount
            $new_recognized = floatval($unearned['recognized_amount'] ?? 0) + $amount;
            $stmt = mysqli_prepare(
                $this->conn,
                "UPDATE unearned_revenue SET recognized_amount = ? WHERE id = ?"
            );
            mysqli_stmt_bind_param($stmt, "di", $new_recognized, $id);
            mysqli_stmt_execute($stmt);
            mysqli_stmt_close($stmt);

            // Post recognition: Debit Unearned Revenue, Credit Revenue
            $unearned_account = $this->coaMapping->getAccountCode('Liability', 'إيرادات غير مكتسبة') ?? '2120';
            $revenue_account = $unearned['revenue_account_code'];

            $voucher_number = $this->ledgerService->getNextVoucherNumber('REC');
            $gl_entries = [
                [
                    'account_code' => $unearned_account,
                    'entry_type' => 'DEBIT',
                    'amount' => $amount,
                    'description' => "تحقق إيراد - " . $unearned['description']
                ],
                [
                    'account_code' => $revenue_account,
                    'entry_type' => 'CREDIT',
                    'amount' => $amount,
                    'description' => "تحقق إيراد - " . $unearned['description']
                ]
            ];

            $this->ledgerService->postTransaction($gl_entries, 'unearned_revenue', $id, $voucher_number, $recognition_date);

            mysqli_commit($this->conn);
            log_operation('UPDATE', 'unearned_revenue', $id, null, $data);
            $this->successResponse(['message' => 'Revenue recognized successfully']);
        } catch (Exception $e) {
            mysqli_rollback($this->conn);
            $this->errorResponse($e->getMessage());
        }
    }
}
