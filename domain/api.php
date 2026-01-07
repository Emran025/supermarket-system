<?php
// Enable error reporting for debugging (remove in production)
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

// Set error handler to catch fatal errors
register_shutdown_function(function() {
    $error = error_get_last();
    if ($error !== NULL && in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR])) {
        http_response_code(500);
        header('Content-Type: application/json');
        echo json_encode([
            'success' => false,
            'message' => 'Fatal error: ' . $error['message'] . ' in ' . $error['file'] . ' on line ' . $error['line']
        ]);
    }
});

try {
    require_once 'config.php';
    require_once 'db.php';
    require_once 'auth.php';
    
    // Autoload controllers
    require_once 'api/Router.php';
    require_once 'api/AuthController.php';
    require_once 'api/ProductsController.php';
    require_once 'api/SalesController.php';
    require_once 'api/PurchasesController.php';
    require_once 'api/CategoriesController.php';
    require_once 'api/UsersController.php';
    require_once 'api/DashboardController.php';
    require_once 'api/SettingsController.php';
    require_once 'api/ExpensesController.php';
    require_once 'api/AssetsController.php';
    require_once 'api/RevenuesController.php';
    require_once 'api/ReportsController.php';
    require_once 'api/ApController.php';
    require_once 'api/FiscalPeriodsController.php';


} catch (Exception $e) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'message' => 'Initialization error: ' . $e->getMessage()]);
    exit;
} catch (Error $e) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'message' => 'Fatal initialization error: ' . $e->getMessage()]);
    exit;
}

// Add CORS headers to allow credentials
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Origin: ' . ($_SERVER['HTTP_ORIGIN'] ?? 'http://localhost'));
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

header('Content-Type: application/json');

try {
    // Only start session if cookies are present to avoid starting sessions for every random request?
    // Or just always start it. Auth.php handles lazy start.
    // Actually `is_logged_in` calls `start_session`. 
    // But we might want to log the request with session ID if available.
    start_session(); 
    error_log("API Request: " . $_SERVER['REQUEST_METHOD'] . " " . ($_SERVER['REQUEST_URI'] ?? '') . " | Session: " . session_id());
    
    $router = new Router();
    
    // Auth
    $router->register('login', 'AuthController');
    $router->register('logout', 'AuthController');
    $router->register('check', 'AuthController');
    
    // Products
    $router->register('products', 'ProductsController');
    
    // Categories
    $router->register('categories', 'CategoriesController');
    
    // Purchases
    $router->register('purchases', 'PurchasesController');
    $router->register('requests', 'PurchasesController');
    
    // Sales/Invoices
    $router->register('invoices', 'SalesController');
    $router->register('invoice_details', 'SalesController');
    
    // Users & Account
    $router->register('users', 'UsersController');
    $router->register('change_password', 'UsersController');
    $router->register('my_sessions', 'UsersController'); // For account page
    $router->register('manager_list', 'UsersController');
    
    // Dashboard
    $router->register('dashboard', 'DashboardController');
    
    // Settings
    $router->register('settings', 'SettingsController');

    // AR Customers & Ledger
    require_once 'api/ArController.php';
    $router->register('ar_customers', 'ArController');
    $router->register('ar_ledger', 'ArController');

    // Expenses & Assets
    $router->register('expenses', 'ExpensesController');
    $router->register('assets', 'AssetsController');
    $router->register('revenues', 'RevenuesController');
    
    // Accounts Payable
    require_once 'api/ApController.php';
    $router->register('ap_suppliers', 'ApController');
    $router->register('ap_transactions', 'ApController');
    $router->register('ap_payments', 'ApController');
    
    // Fiscal Periods
    require_once 'api/FiscalPeriodsController.php';
    $router->register('fiscal_periods', 'FiscalPeriodsController');
    
    // Chart of Accounts (FIN-003)
    require_once 'api/ChartOfAccountsController.php';
    $router->register('chart_of_accounts', 'ChartOfAccountsController');

    // Reports
    require_once 'api/ReportsController.php';
    $router->register('reports', 'ReportsController');
    
    // General Ledger
    require_once 'api/GeneralLedgerController.php';
    $router->register('general_ledger', 'GeneralLedgerController');
    $router->register('gl', 'GeneralLedgerController'); // Alias
    
    // Reconciliation
    require_once 'api/ReconciliationController.php';
    $router->register('reconciliation', 'ReconciliationController');
    
    // Journal Vouchers
    require_once 'api/JournalVouchersController.php';
    $router->register('journal_vouchers', 'JournalVouchersController');
    
    // Accrual Accounting
    require_once 'api/AccrualAccountingController.php';
    $router->register('accrual', 'AccrualAccountingController');
    
    // Periodic Inventory
    require_once 'api/PeriodicInventoryController.php';
    $router->register('periodic_inventory', 'PeriodicInventoryController');
    
    // ZATCA E-Invoicing
    require_once 'api/ZATCAInvoiceController.php';
    $router->register('zatca_invoice', 'ZATCAInvoiceController');
    
    // Recurring Transactions
    require_once 'api/RecurringTransactionsController.php';
    $router->register('recurring_transactions', 'RecurringTransactionsController');
    
    // Audit Trail
    require_once 'api/AuditTrailController.php';
    $router->register('audit_trail', 'AuditTrailController');
    
    // Batch Processing
    require_once 'api/BatchProcessingController.php';
    $router->register('batch', 'BatchProcessingController');
    
    $router->dispatch();

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
    exit;
} catch (Error $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Fatal server error: ' . $e->getMessage()]);
    exit;
}
