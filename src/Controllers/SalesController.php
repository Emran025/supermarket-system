<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Controller;
use App\Services\SalesService;
use App\Models\Operations\Invoice;
use App\Models\Finance\JournalEntry;
use App\Models\Finance\JournalEntryLine;
use App\Core\Validator;
use Exception;

class SalesController extends Controller
{
    public function __construct(
        private SalesService $salesService
    ) {}

    /**
     * Store a new invoice.
     * POST /invoices
     */
    public function store()
    {
        // 1. Input Handling
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        
        // 2. Validation
        $validator = new Validator(); 
        $isValid = $validator->validate($input, [
            'items' => 'required', // Assuming Validator supports array check
            // Add other rules like 'user_id' => 'required|numeric'
        ]);

        if (!$isValid) {
            $this->errorResponse('Validation Failed', 422, $validator->getErrors());
            return;
        }

        // 3. Service Execution
        try {
            $invoiceId = $this->salesService->createInvoice($input);
            
            $this->jsonResponse([
                'message' => 'Invoice created successfully',
                'invoice_id' => $invoiceId
            ], 201);

        } catch (Exception $e) {
            $this->errorResponse($e->getMessage(), 500);
        }
    }
}
