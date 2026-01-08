<?php
// Enable error reporting for debugging (remove in production)
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

// Set error handler to catch fatal errors
register_shutdown_function(function () {
    $error = error_get_last();
    if ($error !== NULL && in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR])) {
        http_response_code(500);
        header('Content-Type: application/json');
        error_log('Fatal error: ' . $error['message'] . ' in ' . $error['file'] . ' on line ' . $error['line']);
        echo json_encode([
            'success' => false,
            'message' => 'An internal server error occurred.'
        ]);
    }
});

// --- CORS HEADERS (Must be early) ---
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
header('Access-Control-Allow-Credentials: true');
if (empty($origin)) {
    header('Access-Control-Allow-Origin: http://localhost:3000');
} elseif (strpos($origin, 'http://localhost') === 0 || strpos($origin, 'http://127.0.0.1') === 0) {
    header('Access-Control-Allow-Origin: ' . $origin);
} else {
    header('Access-Control-Allow-Origin: http://localhost:3000');
}
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}
// ------------------------------------

try {
    require_once __DIR__ . '/../config/config.php';
    require_once __DIR__ . '/../config/db.php';
    require_once __DIR__ . '/auth.php';

    // Simple PSR-4-ish autoloader for the `App\` namespace to map to src/
    spl_autoload_register(function ($class) {
        $prefix = 'App\\';
        $base_dir = __DIR__ . '/../'; // points to src/

        // only handle classes in the App\ namespace
        if (strncmp($prefix, $class, strlen($prefix)) !== 0) {
            return;
        }

        $relative_class = substr($class, strlen($prefix));
        $file = $base_dir . str_replace('\\', '/', $relative_class) . '.php';

        if (file_exists($file)) {
            require_once $file;
        }
    });

    // Autoload controllers
    require_once __DIR__ . '/../Core/Router.php';
    require_once __DIR__ . '/../Controllers/AuthController.php';
    require_once __DIR__ . '/../Controllers/ProductsController.php';
    require_once __DIR__ . '/../Controllers/SalesController.php';
    require_once __DIR__ . '/../Controllers/PurchasesController.php';
    require_once __DIR__ . '/../Controllers/CategoriesController.php';
    require_once __DIR__ . '/../Controllers/UsersController.php';
    require_once __DIR__ . '/../Controllers/DashboardController.php';
    require_once __DIR__ . '/../Controllers/SettingsController.php';
    require_once __DIR__ . '/../Controllers/ExpensesController.php';
    require_once __DIR__ . '/../Controllers/AssetsController.php';
    require_once __DIR__ . '/../Controllers/RevenuesController.php';
    require_once __DIR__ . '/../Controllers/ReportsController.php';
    require_once __DIR__ . '/../Controllers/ApController.php';
    require_once __DIR__ . '/../Controllers/FiscalPeriodsController.php';
    require_once __DIR__ . '/../Controllers/RolesPermissionsController.php';
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

// Set content type for successful responses
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
    require_once __DIR__ . '/../Controllers/ArController.php';
    $router->register('ar_customers', 'ArController');
    $router->register('ar_ledger', 'ArController');

    // Expenses & Assets
    $router->register('expenses', 'ExpensesController');
    $router->register('assets', 'AssetsController');
    $router->register('revenues', 'RevenuesController');

    // Accounts Payable
    require_once __DIR__ . '/../Controllers/ApController.php';
    $router->register('ap_suppliers', 'ApController');
    $router->register('ap_transactions', 'ApController');
    $router->register('ap_payments', 'ApController');

    // Fiscal Periods
    require_once __DIR__ . '/../Controllers/FiscalPeriodsController.php';
    $router->register('fiscal_periods', 'FiscalPeriodsController');

    // Chart of Accounts (FIN-003)
    require_once __DIR__ . '/../Controllers/ChartOfAccountsController.php';
    $router->register('chart_of_accounts', 'ChartOfAccountsController');

    // Reports
    require_once __DIR__ . '/../Controllers/ReportsController.php';
    $router->register('reports', 'ReportsController');

    // General Ledger
    require_once __DIR__ . '/../Controllers/GeneralLedgerController.php';
    $router->register('general_ledger', 'GeneralLedgerController');
    $router->register('gl', 'GeneralLedgerController'); // Alias

    // Reconciliation
    require_once __DIR__ . '/../Controllers/ReconciliationController.php';
    $router->register('reconciliation', 'ReconciliationController');

    // Journal Vouchers
    require_once __DIR__ . '/../Controllers/JournalVouchersController.php';
    $router->register('journal_vouchers', 'JournalVouchersController');

    // Accrual Accounting
    require_once __DIR__ . '/../Controllers/AccrualAccountingController.php';
    $router->register('accrual', 'AccrualAccountingController');

    // Periodic Inventory
    require_once __DIR__ . '/../Controllers/PeriodicInventoryController.php';
    $router->register('periodic_inventory', 'PeriodicInventoryController');

    // ZATCA E-Invoicing
    require_once __DIR__ . '/../Controllers/ZATCAInvoiceController.php';
    $router->register('zatca_invoice', 'ZATCAInvoiceController');

    // Recurring Transactions
    require_once __DIR__ . '/../Controllers/RecurringTransactionsController.php';
    $router->register('recurring_transactions', 'RecurringTransactionsController');

    // Audit Trail
    require_once __DIR__ . '/../Controllers/AuditTrailController.php';
    $router->register('audit_trail', 'AuditTrailController');

    // Batch Processing
    require_once __DIR__ . '/../Controllers/BatchProcessingController.php';
    $router->register('batch', 'BatchProcessingController');

    // Roles & Permissions
    $router->register('roles', 'RolesPermissionsController');
    $router->register('modules', 'RolesPermissionsController');
    $router->register('role_permissions', 'RolesPermissionsController');
    $router->register('create_role', 'RolesPermissionsController');
    $router->register('update_permissions', 'RolesPermissionsController');

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
