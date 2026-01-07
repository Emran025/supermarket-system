<?php

require_once __DIR__ . '/Controller.php';
require_once __DIR__ . '/../Services/LedgerService.php';
require_once __DIR__ . '/../Services/ChartOfAccountsMappingService.php';

/**
 * BatchProcessingController
 * Handles batch processing of transactions (bulk operations)
 */
class BatchProcessingController extends Controller
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
        $action = $_GET['action'] ?? '';

        if ($method === 'GET') {
            if ($action === 'status') {
                $this->getBatchStatus();
            } else {
                $this->getBatches();
            }
        } elseif ($method === 'POST') {
            if ($action === 'journal_entries') {
                $this->processBatchJournalEntries();
            } elseif ($action === 'expenses') {
                $this->processBatchExpenses();
            } else {
                $this->errorResponse('Invalid batch action');
            }
        }
    }

    private function getBatches()
    {
        $params = $this->getPaginationParams();
        $limit = $params['limit'];
        $offset = $params['offset'];

        $result = mysqli_query(
            $this->conn,
            "SELECT b.*, u.username as created_by_name
             FROM batch_processing b
             LEFT JOIN users u ON b.created_by = u.id
             ORDER BY b.created_at DESC
             LIMIT $limit OFFSET $offset"
        );

        $batches = [];
        while ($row = mysqli_fetch_assoc($result)) {
            $batches[] = $row;
        }

        $countResult = mysqli_query($this->conn, "SELECT COUNT(*) as total FROM batch_processing");
        $total = mysqli_fetch_assoc($countResult)['total'];

        $this->paginatedResponse($batches, $total, $params['page'], $params['limit']);
    }

    private function getBatchStatus()
    {
        $batch_id = intval($_GET['batch_id'] ?? 0);

        if ($batch_id <= 0) {
            $this->errorResponse('Batch ID is required');
        }

        $result = mysqli_query(
            $this->conn,
            "SELECT b.*, 
                    COUNT(bi.id) as total_items,
                    SUM(CASE WHEN bi.status = 'success' THEN 1 ELSE 0 END) as successful_items,
                    SUM(CASE WHEN bi.status = 'error' THEN 1 ELSE 0 END) as failed_items
             FROM batch_processing b
             LEFT JOIN batch_items bi ON b.id = bi.batch_id
             WHERE b.id = $batch_id
             GROUP BY b.id"
        );

        $batch = mysqli_fetch_assoc($result);

        if (!$batch) {
            $this->errorResponse('Batch not found', 404);
        }

        // Get batch items
        $items_result = mysqli_query(
            $this->conn,
            "SELECT * FROM batch_items WHERE batch_id = $batch_id ORDER BY id ASC"
        );

        $items = [];
        while ($item = mysqli_fetch_assoc($items_result)) {
            $items[] = $item;
        }

        $this->successResponse([
            'batch' => $batch,
            'items' => $items
        ]);
    }

    private function processBatchJournalEntries()
    {
        $data = $this->getJsonInput();
        $entries = $data['entries'] ?? [];
        $batch_description = mysqli_real_escape_string($this->conn, $data['description'] ?? 'Batch Journal Entries');

        if (empty($entries)) {
            $this->errorResponse('Entries array is required');
        }

        $user_id = $_SESSION['user_id'];

        mysqli_begin_transaction($this->conn);

        try {
            // Create batch record
            $stmt = mysqli_prepare(
                $this->conn,
                "INSERT INTO batch_processing (batch_type, description, status, total_items, created_by) 
                 VALUES ('journal_entries', ?, 'processing', ?, ?)"
            );
            $total_items = count($entries);
            mysqli_stmt_bind_param($stmt, "sii", $batch_description, $total_items, $user_id);
            mysqli_stmt_execute($stmt);
            $batch_id = mysqli_insert_id($this->conn);
            mysqli_stmt_close($stmt);

            $successful = 0;
            $failed = 0;
            $errors = [];

            foreach ($entries as $index => $entry_data) {
                try {
                    $voucher_date = mysqli_real_escape_string($this->conn, $entry_data['voucher_date'] ?? date('Y-m-d'));
                    $description = mysqli_real_escape_string($this->conn, $entry_data['description'] ?? '');
                    $entry_lines = $entry_data['lines'] ?? [];

                    if (empty($entry_lines) || count($entry_lines) < 2) {
                        throw new Exception("At least two entry lines required");
                    }

                    // Validate and post transaction
                    $gl_entries = [];
                    foreach ($entry_lines as $line) {
                        $gl_entries[] = [
                            'account_code' => mysqli_real_escape_string($this->conn, $line['account_code']),
                            'entry_type' => strtoupper($line['entry_type']),
                            'amount' => floatval($line['amount']),
                            'description' => mysqli_real_escape_string($this->conn, $line['description'] ?? $description)
                        ];
                    }

                    $voucher_number = $this->ledgerService->postTransaction($gl_entries, 'batch_processing', $batch_id, null, $voucher_date);

                    // Record batch item
                    $stmt = mysqli_prepare(
                        $this->conn,
                        "INSERT INTO batch_items (batch_id, item_index, status, voucher_number, error_message) 
                         VALUES (?, ?, 'success', ?, NULL)"
                    );
                    mysqli_stmt_bind_param($stmt, "iis", $batch_id, $index, $voucher_number);
                    mysqli_stmt_execute($stmt);
                    mysqli_stmt_close($stmt);

                    $successful++;
                } catch (Exception $e) {
                    $failed++;
                    $error_msg = mysqli_real_escape_string($this->conn, $e->getMessage());

                    // Record failed item
                    $stmt = mysqli_prepare(
                        $this->conn,
                        "INSERT INTO batch_items (batch_id, item_index, status, voucher_number, error_message) 
                         VALUES (?, ?, 'error', NULL, ?)"
                    );
                    mysqli_stmt_bind_param($stmt, "iis", $batch_id, $index, $error_msg);
                    mysqli_stmt_execute($stmt);
                    mysqli_stmt_close($stmt);

                    $errors[] = [
                        'index' => $index,
                        'error' => $e->getMessage()
                    ];
                }
            }

            // Update batch status
            $status = ($failed == 0) ? 'completed' : 'partial';
            $stmt = mysqli_prepare(
                $this->conn,
                "UPDATE batch_processing SET status = ?, successful_items = ?, failed_items = ?, completed_at = NOW() WHERE id = ?"
            );
            mysqli_stmt_bind_param($stmt, "siii", $status, $successful, $failed, $batch_id);
            mysqli_stmt_execute($stmt);
            mysqli_stmt_close($stmt);

            mysqli_commit($this->conn);
            log_operation('CREATE', 'batch_processing', $batch_id, null, ['total' => $total_items, 'successful' => $successful, 'failed' => $failed]);

            $this->successResponse([
                'batch_id' => $batch_id,
                'total_items' => $total_items,
                'successful' => $successful,
                'failed' => $failed,
                'errors' => $errors
            ]);
        } catch (Exception $e) {
            mysqli_rollback($this->conn);
            $this->errorResponse($e->getMessage());
        }
    }

    private function processBatchExpenses()
    {
        $data = $this->getJsonInput();
        $expenses = $data['expenses'] ?? [];
        $batch_description = mysqli_real_escape_string($this->conn, $data['description'] ?? 'Batch Expenses');

        if (empty($expenses)) {
            $this->errorResponse('Expenses array is required');
        }

        $user_id = $_SESSION['user_id'];
        $accounts = $this->coaMapping->getStandardAccounts();

        mysqli_begin_transaction($this->conn);

        try {
            // Create batch record
            $stmt = mysqli_prepare(
                $this->conn,
                "INSERT INTO batch_processing (batch_type, description, status, total_items, created_by) 
                 VALUES ('expenses', ?, 'processing', ?, ?)"
            );
            $total_items = count($expenses);
            mysqli_stmt_bind_param($stmt, "sii", $batch_description, $total_items, $user_id);
            mysqli_stmt_execute($stmt);
            $batch_id = mysqli_insert_id($this->conn);
            mysqli_stmt_close($stmt);

            $successful = 0;
            $failed = 0;
            $errors = [];

            foreach ($expenses as $index => $expense_data) {
                try {
                    $category = mysqli_real_escape_string($this->conn, $expense_data['category'] ?? '');
                    $amount = floatval($expense_data['amount'] ?? 0);
                    $expense_date = mysqli_real_escape_string($this->conn, $expense_data['expense_date'] ?? date('Y-m-d'));
                    $description = mysqli_real_escape_string($this->conn, $expense_data['description'] ?? '');
                    $account_code = mysqli_real_escape_string($this->conn, $expense_data['account_code'] ?? $accounts['operating_expenses']);

                    if (empty($category) || $amount <= 0) {
                        throw new Exception("Category and positive amount required");
                    }

                    // Create expense
                    $stmt = mysqli_prepare(
                        $this->conn,
                        "INSERT INTO expenses (category, account_code, amount, expense_date, description, user_id) 
                         VALUES (?, ?, ?, ?, ?, ?)"
                    );
                    mysqli_stmt_bind_param($stmt, "ssdssi", $category, $account_code, $amount, $expense_date, $description, $user_id);
                    mysqli_stmt_execute($stmt);
                    $expense_id = mysqli_insert_id($this->conn);
                    mysqli_stmt_close($stmt);

                    // Post to GL
                    $voucher_number = $this->ledgerService->getNextVoucherNumber('EXP');
                    $gl_entries = [
                        [
                            'account_code' => $account_code,
                            'entry_type' => 'DEBIT',
                            'amount' => $amount,
                            'description' => "$category - $description"
                        ],
                        [
                            'account_code' => $accounts['cash'],
                            'entry_type' => 'CREDIT',
                            'amount' => $amount,
                            'description' => "دفع مصروف - $category"
                        ]
                    ];

                    $this->ledgerService->postTransaction($gl_entries, 'expenses', $expense_id, $voucher_number, $expense_date);

                    // Record batch item
                    $stmt = mysqli_prepare(
                        $this->conn,
                        "INSERT INTO batch_items (batch_id, item_index, status, reference_id, voucher_number, error_message) 
                         VALUES (?, ?, 'success', ?, ?, NULL)"
                    );
                    mysqli_stmt_bind_param($stmt, "iiis", $batch_id, $index, $expense_id, $voucher_number);
                    mysqli_stmt_execute($stmt);
                    mysqli_stmt_close($stmt);

                    $successful++;
                } catch (Exception $e) {
                    $failed++;
                    $error_msg = mysqli_real_escape_string($this->conn, $e->getMessage());

                    $stmt = mysqli_prepare(
                        $this->conn,
                        "INSERT INTO batch_items (batch_id, item_index, status, error_message) 
                         VALUES (?, ?, 'error', ?)"
                    );
                    mysqli_stmt_bind_param($stmt, "iis", $batch_id, $index, $error_msg);
                    mysqli_stmt_execute($stmt);
                    mysqli_stmt_close($stmt);

                    $errors[] = [
                        'index' => $index,
                        'error' => $e->getMessage()
                    ];
                }
            }

            // Update batch status
            $status = ($failed == 0) ? 'completed' : 'partial';
            $stmt = mysqli_prepare(
                $this->conn,
                "UPDATE batch_processing SET status = ?, successful_items = ?, failed_items = ?, completed_at = NOW() WHERE id = ?"
            );
            mysqli_stmt_bind_param($stmt, "siii", $status, $successful, $failed, $batch_id);
            mysqli_stmt_execute($stmt);
            mysqli_stmt_close($stmt);

            mysqli_commit($this->conn);
            log_operation('CREATE', 'batch_processing', $batch_id, null, ['total' => $total_items, 'successful' => $successful, 'failed' => $failed]);

            $this->successResponse([
                'batch_id' => $batch_id,
                'total_items' => $total_items,
                'successful' => $successful,
                'failed' => $failed,
                'errors' => $errors
            ]);
        } catch (Exception $e) {
            mysqli_rollback($this->conn);
            $this->errorResponse($e->getMessage());
        }
    }
}
