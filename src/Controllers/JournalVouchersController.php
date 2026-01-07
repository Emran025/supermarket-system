<?php

require_once __DIR__ . '/Controller.php';
require_once __DIR__ . '/../Services/LedgerService.php';
require_once __DIR__ . '/../Services/ChartOfAccountsMappingService.php';

class JournalVouchersController extends Controller
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
            $this->getJournalVouchers();
        } elseif ($method === 'POST') {
            $this->createJournalVoucher();
        } elseif ($method === 'PUT') {
            $this->updateJournalVoucher();
        } elseif ($method === 'DELETE') {
            $this->deleteJournalVoucher();
        }
    }

    private function getJournalVouchers()
    {
        $params = $this->getPaginationParams();
        $limit = $params['limit'];
        $offset = $params['offset'];
        $voucher_number = $_GET['voucher_number'] ?? null;

        $where = "WHERE 1=1";
        if ($voucher_number) {
            $voucher_esc = mysqli_real_escape_string($this->conn, $voucher_number);
            $where .= " AND voucher_number = '$voucher_esc'";
        }

        // Count total
        $countResult = mysqli_query(
            $this->conn,
            "SELECT COUNT(DISTINCT voucher_number) as total 
             FROM journal_vouchers $where"
        );
        $total = mysqli_fetch_assoc($countResult)['total'];

        // Get vouchers with entry details
        $result = mysqli_query(
            $this->conn,
            "SELECT jv.*, 
                    u.username as created_by_name,
                    GROUP_CONCAT(
                        CONCAT(coa.account_code, ':', coa.account_name, ':', jv.entry_type, ':', jv.amount) 
                        SEPARATOR '|'
                    ) as entries_summary
             FROM journal_vouchers jv
             LEFT JOIN users u ON jv.created_by = u.id
             LEFT JOIN chart_of_accounts coa ON jv.account_id = coa.id
             $where
             GROUP BY jv.voucher_number, jv.voucher_date, jv.description, jv.created_by, jv.created_at
             ORDER BY jv.voucher_date DESC, jv.voucher_number DESC
             LIMIT $limit OFFSET $offset"
        );

        $vouchers = [];
        while ($row = mysqli_fetch_assoc($result)) {
            // Get full entry details for each voucher
            $voucher_esc = mysqli_real_escape_string($this->conn, $row['voucher_number']);
            $entries_result = mysqli_query(
                $this->conn,
                "SELECT jv.*, coa.account_code, coa.account_name, coa.account_type
                 FROM journal_vouchers jv
                 JOIN chart_of_accounts coa ON jv.account_id = coa.id
                 WHERE jv.voucher_number = '$voucher_esc'
                 ORDER BY jv.id"
            );

            $entries = [];
            while ($entry = mysqli_fetch_assoc($entries_result)) {
                $entries[] = [
                    'account_code' => $entry['account_code'],
                    'account_name' => $entry['account_name'],
                    'account_type' => $entry['account_type'],
                    'entry_type' => $entry['entry_type'],
                    'amount' => floatval($entry['amount']),
                    'description' => $entry['description']
                ];
            }

            $vouchers[] = [
                'voucher_number' => $row['voucher_number'],
                'voucher_date' => $row['voucher_date'],
                'description' => $row['description'],
                'created_by_name' => $row['created_by_name'],
                'created_at' => $row['created_at'],
                'entries' => $entries
            ];
        }

        $this->paginatedResponse($vouchers, $total, $params['page'], $params['limit']);
    }

    private function createJournalVoucher()
    {
        $data = $this->getJsonInput();

        $voucher_date = mysqli_real_escape_string($this->conn, $data['voucher_date'] ?? date('Y-m-d'));
        $description = mysqli_real_escape_string($this->conn, $data['description'] ?? '');
        $entries = $data['entries'] ?? [];

        if (empty($entries) || count($entries) < 2) {
            $this->errorResponse('At least two entries required for double-entry accounting');
        }

        if (empty($description)) {
            $this->errorResponse('Description is required');
        }

        // Validate entries
        $total_debits = 0;
        $total_credits = 0;
        $validated_entries = [];

        foreach ($entries as $entry) {
            $account_code = mysqli_real_escape_string($this->conn, $entry['account_code'] ?? '');
            $entry_type = strtoupper($entry['entry_type'] ?? '');
            $amount = floatval($entry['amount'] ?? 0);
            $entry_description = mysqli_real_escape_string($this->conn, $entry['description'] ?? '');

            if (empty($account_code) || !in_array($entry_type, ['DEBIT', 'CREDIT']) || $amount <= 0) {
                $this->errorResponse('Invalid entry: account_code, entry_type (DEBIT/CREDIT), and positive amount required');
            }

            // Validate account exists
            $acc_result = mysqli_query(
                $this->conn,
                "SELECT id FROM chart_of_accounts WHERE account_code = '$account_code' AND is_active = 1"
            );
            if (!$acc_result || mysqli_num_rows($acc_result) == 0) {
                $this->errorResponse("Account code '$account_code' not found or inactive");
            }
            $acc_row = mysqli_fetch_assoc($acc_result);

            $validated_entries[] = [
                'account_id' => intval($acc_row['id']),
                'account_code' => $account_code,
                'entry_type' => $entry_type,
                'amount' => $amount,
                'description' => $entry_description ?: $description
            ];

            if ($entry_type === 'DEBIT') {
                $total_debits += $amount;
            } else {
                $total_credits += $amount;
            }
        }

        // Validate debits equal credits
        if (abs($total_debits - $total_credits) > 0.01) {
            $this->errorResponse("Debits ($total_debits) must equal Credits ($total_credits)");
        }

        mysqli_begin_transaction($this->conn);

        try {
            // Generate voucher number
            $voucher_number = $this->ledgerService->getNextVoucherNumber('JV');
            $user_id = $_SESSION['user_id'];

            // Insert journal voucher entries
            foreach ($validated_entries as $entry) {
                $stmt = mysqli_prepare(
                    $this->conn,
                    "INSERT INTO journal_vouchers (voucher_number, voucher_date, account_id, entry_type, amount, description, created_by) 
                     VALUES (?, ?, ?, ?, ?, ?, ?)"
                );
                mysqli_stmt_bind_param(
                    $stmt,
                    "ssisdsi",
                    $voucher_number,
                    $voucher_date,
                    $entry['account_id'],
                    $entry['entry_type'],
                    $entry['amount'],
                    $entry['description'],
                    $user_id
                );
                mysqli_stmt_execute($stmt);
                mysqli_stmt_close($stmt);
            }

            // Post to General Ledger
            $gl_entries = [];
            foreach ($validated_entries as $entry) {
                $gl_entries[] = [
                    'account_code' => $entry['account_code'],
                    'entry_type' => $entry['entry_type'],
                    'amount' => $entry['amount'],
                    'description' => $entry['description']
                ];
            }

            $this->ledgerService->postTransaction($gl_entries, 'journal_vouchers', null, $voucher_number, $voucher_date);

            mysqli_commit($this->conn);
            log_operation('CREATE', 'journal_vouchers', null, null, $data);
            $this->successResponse(['voucher_number' => $voucher_number]);
        } catch (Exception $e) {
            mysqli_rollback($this->conn);
            $this->errorResponse($e->getMessage());
        }
    }

    private function updateJournalVoucher()
    {
        // Journal vouchers are typically immutable for audit purposes
        // This could allow updating description or adding notes, but not amounts
        $this->errorResponse('Journal vouchers cannot be modified after posting. Create a reversing entry instead.', 403);
    }

    private function deleteJournalVoucher()
    {
        // Journal vouchers should not be deleted, only reversed
        $voucher_number = $_GET['voucher_number'] ?? '';

        if (empty($voucher_number)) {
            $this->errorResponse('Voucher number is required');
        }

        // Check if already reversed
        $check_reversed = mysqli_query(
            $this->conn,
            "SELECT COUNT(*) as count FROM general_ledger 
             WHERE voucher_number = '" . mysqli_real_escape_string($this->conn, $voucher_number) . "' 
             AND description LIKE '%Reversal%'"
        );
        $reversed_row = mysqli_fetch_assoc($check_reversed);

        if ($reversed_row['count'] > 0) {
            $this->errorResponse('Journal voucher has already been reversed', 400);
        }

        // Reverse the journal voucher
        try {
            $this->ledgerService->reverseTransaction($voucher_number, "إلغاء قيد يومية رقم $voucher_number");
            log_operation('REVERSE', 'journal_vouchers', null, null, ['voucher_number' => $voucher_number]);
            $this->successResponse(['message' => 'Journal voucher reversed successfully']);
        } catch (Exception $e) {
            $this->errorResponse($e->getMessage());
        }
    }
}
