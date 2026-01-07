<?php

require_once __DIR__ . '/Controller.php';
require_once __DIR__ . '/../Services/LedgerService.php';
require_once __DIR__ . '/../Services/ChartOfAccountsMappingService.php';

class FiscalPeriodsController extends Controller
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

        if ($method === 'GET') {
            $action = $_GET['action'] ?? '';
            if ($action === 'lock') {
                $this->lockPeriod();
            } elseif ($action === 'unlock') {
                $this->unlockPeriod();
            } else {
                $this->getPeriods();
            }
        } elseif ($method === 'POST') {
            $this->createPeriod();
        } elseif ($method === 'PUT') {
            $action = $_GET['action'] ?? 'close';
            if ($action === 'close') {
                $this->closePeriod();
            } elseif ($action === 'lock') {
                $this->lockPeriod();
            } elseif ($action === 'unlock') {
                $this->unlockPeriod();
            }
        }
    }

    private function getPeriods()
    {
        $result = mysqli_query(
            $this->conn,
            "SELECT fp.*, u.username as closed_by_name 
             FROM fiscal_periods fp 
             LEFT JOIN users u ON fp.closed_by = u.id 
             ORDER BY fp.start_date DESC"
        );

        $periods = [];
        while ($row = mysqli_fetch_assoc($result)) {
            $periods[] = $row;
        }

        $this->successResponse(['data' => $periods]);
    }

    private function createPeriod()
    {
        $data = $this->getJsonInput();

        $period_name = mysqli_real_escape_string($this->conn, $data['period_name'] ?? '');
        $start_date = mysqli_real_escape_string($this->conn, $data['start_date'] ?? '');
        $end_date = mysqli_real_escape_string($this->conn, $data['end_date'] ?? '');

        if (empty($period_name) || empty($start_date) || empty($end_date)) {
            $this->errorResponse('Period name, start date, and end date are required');
        }

        if (strtotime($start_date) >= strtotime($end_date)) {
            $this->errorResponse('End date must be after start date');
        }

        $stmt = mysqli_prepare(
            $this->conn,
            "INSERT INTO fiscal_periods (period_name, start_date, end_date) VALUES (?, ?, ?)"
        );
        mysqli_stmt_bind_param($stmt, "sss", $period_name, $start_date, $end_date);

        if (mysqli_stmt_execute($stmt)) {
            $id = mysqli_insert_id($this->conn);
            log_operation('CREATE', 'fiscal_periods', $id, null, $data);
            $this->successResponse(['id' => $id]);
        } else {
            $this->errorResponse('Failed to create fiscal period');
        }
    }

    private function closePeriod()
    {
        $data = $this->getJsonInput();
        $id = intval($data['id'] ?? 0);

        if ($id <= 0) {
            $this->errorResponse('Invalid period ID');
        }

        // Check if period is already closed
        $result = mysqli_query($this->conn, "SELECT is_closed FROM fiscal_periods WHERE id = $id");
        $row = mysqli_fetch_assoc($result);

        if (!$row) {
            $this->errorResponse('Period not found');
        }

        if ($row['is_closed']) {
            $this->errorResponse('Period is already closed');
        }

        mysqli_begin_transaction($this->conn);

        try {
            // Mark all GL entries in this period as closed
            mysqli_query(
                $this->conn,
                "UPDATE general_ledger SET is_closed = 1 WHERE fiscal_period_id = $id"
            );

            // Close the period
            $user_id = $_SESSION['user_id'];
            $stmt = mysqli_prepare(
                $this->conn,
                "UPDATE fiscal_periods SET is_closed = 1, closed_at = NOW(), closed_by = ? WHERE id = ?"
            );
            mysqli_stmt_bind_param($stmt, "ii", $user_id, $id);
            mysqli_stmt_execute($stmt);
            mysqli_stmt_close($stmt);

            // FIN-004: Calculate net income and properly close income/expense accounts
            $net_income = $this->calculatePeriodNetIncome($id);

            // Close all Revenue and Expense accounts by transferring to Retained Earnings
            // This is done by creating closing entries
            if (abs($net_income) > 0.01) {
                $voucher_number = $this->ledgerService->getNextVoucherNumber('VOU');

                // Get all revenue and expense account balances for the period
                $revenue_result = mysqli_query(
                    $this->conn,
                    "SELECT coa.account_code, 
                            SUM(CASE WHEN gl.entry_type = 'CREDIT' THEN gl.amount ELSE -gl.amount END) as balance
                     FROM general_ledger gl
                     JOIN chart_of_accounts coa ON gl.account_id = coa.id
                     WHERE gl.fiscal_period_id = $id AND coa.account_type = 'Revenue' AND gl.is_closed = 0
                     GROUP BY coa.id, coa.account_code
                     HAVING ABS(balance) > 0.01"
                );

                $expense_result = mysqli_query(
                    $this->conn,
                    "SELECT coa.account_code, 
                            SUM(CASE WHEN gl.entry_type = 'DEBIT' THEN gl.amount ELSE -gl.amount END) as balance
                     FROM general_ledger gl
                     JOIN chart_of_accounts coa ON gl.account_id = coa.id
                     WHERE gl.fiscal_period_id = $id AND coa.account_type = 'Expense' AND gl.is_closed = 0
                     GROUP BY coa.id, coa.account_code
                     HAVING ABS(balance) > 0.01"
                );

                $closing_entries = [];
                $total_revenue = 0;
                $total_expenses = 0;

                // Close revenue accounts: Debit revenue accounts (to zero them), Credit retained earnings
                while ($row = mysqli_fetch_assoc($revenue_result)) {
                    $balance = floatval($row['balance']);
                    if ($balance > 0) {
                        $closing_entries[] = [
                            'account_code' => $row['account_code'],
                            'entry_type' => 'DEBIT',
                            'amount' => $balance,
                            'description' => "إغلاق الفترة - إيرادات"
                        ];
                        $total_revenue += $balance;
                    }
                }

                // Close expense accounts: Credit expense accounts (to zero them), Debit retained earnings
                while ($row = mysqli_fetch_assoc($expense_result)) {
                    $balance = floatval($row['balance']);
                    if ($balance > 0) {
                        $closing_entries[] = [
                            'account_code' => $row['account_code'],
                            'entry_type' => 'CREDIT',
                            'amount' => $balance,
                            'description' => "إغلاق الفترة - مصروفات"
                        ];
                        $total_expenses += $balance;
                    }
                }

                // Net income = Revenue - Expenses
                // Add retained earnings entry to balance: Credit RE for revenue, Debit RE for expenses
                $net_income = $total_revenue - $total_expenses;
                if (abs($net_income) > 0.01) {
                    $accounts = $this->coaMapping->getStandardAccounts();
                    if ($net_income > 0) {
                        // Profit: Credit retained earnings
                        $closing_entries[] = [
                            'account_code' => $accounts['retained_earnings'],
                            'entry_type' => 'CREDIT',
                            'amount' => $net_income,
                            'description' => "إضافة الأرباح المحتجزة - صافي الربح"
                        ];
                    } else {
                        // Loss: Debit retained earnings
                        $closing_entries[] = [
                            'account_code' => $accounts['retained_earnings'],
                            'entry_type' => 'DEBIT',
                            'amount' => abs($net_income),
                            'description' => "خصم من الأرباح المحتجزة - صافي الخسارة"
                        ];
                    }
                }

                if (!empty($closing_entries)) {
                    $this->ledgerService->postTransaction($closing_entries, 'fiscal_periods', $id, $voucher_number);
                }
            }

            mysqli_commit($this->conn);
            log_operation('UPDATE', 'fiscal_periods', $id, null, ['action' => 'close', 'net_income' => $net_income]);
            $this->successResponse(['net_income' => $net_income]);
        } catch (Exception $e) {
            mysqli_rollback($this->conn);
            $this->errorResponse($e->getMessage());
        }
    }

    private function calculatePeriodNetIncome($period_id)
    {
        // Calculate revenue
        $rev_result = mysqli_query(
            $this->conn,
            "SELECT SUM(CASE WHEN entry_type = 'CREDIT' THEN amount ELSE -amount END) as total 
             FROM general_ledger gl 
             JOIN chart_of_accounts coa ON gl.account_id = coa.id 
             WHERE gl.fiscal_period_id = $period_id AND coa.account_type = 'Revenue'"
        );
        $rev_row = mysqli_fetch_assoc($rev_result);
        $revenue = floatval($rev_row['total'] ?? 0);

        // Calculate expenses
        $exp_result = mysqli_query(
            $this->conn,
            "SELECT SUM(CASE WHEN entry_type = 'DEBIT' THEN amount ELSE -amount END) as total 
             FROM general_ledger gl 
             JOIN chart_of_accounts coa ON gl.account_id = coa.id 
             WHERE gl.fiscal_period_id = $period_id AND coa.account_type = 'Expense'"
        );
        $exp_row = mysqli_fetch_assoc($exp_result);
        $expenses = floatval($exp_row['total'] ?? 0);

        return $revenue - $expenses;
    }

    /**
     * Lock period to prevent modifications
     */
    private function lockPeriod()
    {
        $data = $this->getJsonInput();
        $id = intval($data['id'] ?? 0);

        if ($id <= 0) {
            $this->errorResponse('Invalid period ID');
        }

        // Check if period exists
        $result = mysqli_query($this->conn, "SELECT * FROM fiscal_periods WHERE id = $id");
        $period = mysqli_fetch_assoc($result);

        if (!$period) {
            $this->errorResponse('Period not found', 404);
        }

        if (intval($period['is_locked'] ?? 0) == 1) {
            $this->errorResponse('Period is already locked');
        }

        $user_id = $_SESSION['user_id'];

        $stmt = mysqli_prepare(
            $this->conn,
            "UPDATE fiscal_periods SET is_locked = 1, locked_at = NOW(), locked_by = ? WHERE id = ?"
        );
        mysqli_stmt_bind_param($stmt, "ii", $user_id, $id);

        if (mysqli_stmt_execute($stmt)) {
            mysqli_stmt_close($stmt);
            log_operation('UPDATE', 'fiscal_periods', $id, null, ['action' => 'lock']);
            $this->successResponse(['message' => 'Period locked successfully']);
        } else {
            mysqli_stmt_close($stmt);
            $this->errorResponse('Failed to lock period');
        }
    }

    /**
     * Unlock period to allow modifications
     */
    private function unlockPeriod()
    {
        $data = $this->getJsonInput();
        $id = intval($data['id'] ?? 0);

        if ($id <= 0) {
            $this->errorResponse('Invalid period ID');
        }

        // Check user permissions (only admin/manager can unlock)
        $user_id = $_SESSION['user_id'];
        $user_result = mysqli_query($this->conn, "SELECT role FROM users WHERE id = $user_id");
        $user = mysqli_fetch_assoc($user_result);

        if (!in_array($user['role'] ?? '', ['admin', 'manager'])) {
            $this->errorResponse('Only managers and admins can unlock periods', 403);
        }

        // Check if period exists
        $result = mysqli_query($this->conn, "SELECT * FROM fiscal_periods WHERE id = $id");
        $period = mysqli_fetch_assoc($result);

        if (!$period) {
            $this->errorResponse('Period not found', 404);
        }

        if (intval($period['is_locked'] ?? 0) == 0) {
            $this->errorResponse('Period is not locked');
        }

        // Cannot unlock closed periods
        if (intval($period['is_closed'] ?? 0) == 1) {
            $this->errorResponse('Cannot unlock closed periods', 403);
        }

        $stmt = mysqli_prepare(
            $this->conn,
            "UPDATE fiscal_periods SET is_locked = 0, locked_at = NULL, locked_by = NULL WHERE id = ?"
        );
        mysqli_stmt_bind_param($stmt, "i", $id);

        if (mysqli_stmt_execute($stmt)) {
            mysqli_stmt_close($stmt);
            log_operation('UPDATE', 'fiscal_periods', $id, null, ['action' => 'unlock']);
            $this->successResponse(['message' => 'Period unlocked successfully']);
        } else {
            mysqli_stmt_close($stmt);
            $this->errorResponse('Failed to unlock period');
        }
    }
}
