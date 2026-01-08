<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ProductsController;
use App\Http\Controllers\Api\SalesController;
use App\Http\Controllers\Api\PurchasesController;
use App\Http\Controllers\Api\ArController;
use App\Http\Controllers\Api\ApController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\SettingsController;
use App\Http\Controllers\Api\UsersController;
use App\Http\Controllers\Api\CategoriesController;
use App\Http\Controllers\Api\ExpensesController;
use App\Http\Controllers\Api\AssetsController;
use App\Http\Controllers\Api\RevenuesController;
use App\Http\Controllers\Api\GeneralLedgerController;
use App\Http\Controllers\Api\FiscalPeriodsController;
use App\Http\Controllers\Api\ReportsController;
use App\Http\Controllers\Api\RolesController;
use App\Http\Controllers\Api\ChartOfAccountsController;
use App\Http\Controllers\Api\AccrualAccountingController;
use App\Http\Controllers\Api\BankReconciliationController;
use App\Http\Controllers\Api\RecurringTransactionsController;
use App\Http\Controllers\Api\SessionsController;

/*
|--------------------------------------------------------------------------
| API Routes - Matching Legacy API Contract
|--------------------------------------------------------------------------
*/

// Auth routes
Route::post('/login', [AuthController::class, 'login'])->name('api.login');
Route::post('/logout', [AuthController::class, 'logout'])->name('api.logout');
Route::get('/check', [AuthController::class, 'check'])->name('api.check');

// Protected routes
Route::middleware(['api.auth'])->group(function () {
    // Products
    Route::get('/products', [ProductsController::class, 'index'])->name('api.products.index');
    Route::post('/products', [ProductsController::class, 'store'])->name('api.products.store');
    Route::put('/products', [ProductsController::class, 'update'])->name('api.products.update');
    Route::delete('/products', [ProductsController::class, 'destroy'])->name('api.products.destroy');

    // Sales/Invoices
    Route::get('/invoices', [SalesController::class, 'index'])->name('api.invoices.index');
    Route::post('/invoices', [SalesController::class, 'store'])->name('api.invoices.store');
    Route::get('/invoice_details', [SalesController::class, 'show'])->name('api.invoice_details');
    Route::delete('/invoices', [SalesController::class, 'destroy'])->name('api.invoices.destroy');

    // Purchases
    Route::get('/purchases', [PurchasesController::class, 'index'])->name('api.purchases.index');
    Route::post('/purchases', [PurchasesController::class, 'store'])->name('api.purchases.store');
    Route::put('/purchases', [PurchasesController::class, 'update'])->name('api.purchases.update');
    Route::delete('/purchases', [PurchasesController::class, 'destroy'])->name('api.purchases.destroy');
    Route::get('/requests', [PurchasesController::class, 'requests'])->name('api.requests.index');
    Route::post('/requests', [PurchasesController::class, 'storeRequest'])->name('api.requests.store');
    Route::put('/requests', [PurchasesController::class, 'updateRequest'])->name('api.requests.update');
    Route::post('/purchases/approve', [PurchasesController::class, 'approve'])->name('api.purchases.approve');

    // AR Customers & Ledger
    Route::get('/ar_customers', [ArController::class, 'customers'])->name('api.ar_customers.index');
    Route::post('/ar_customers', [ArController::class, 'storeCustomer'])->name('api.ar_customers.store');
    Route::put('/ar_customers', [ArController::class, 'updateCustomer'])->name('api.ar_customers.update');
    Route::delete('/ar_customers', [ArController::class, 'destroyCustomer'])->name('api.ar_customers.destroy');
    Route::get('/ar_ledger', [ArController::class, 'ledger'])->name('api.ar_ledger.index');
    Route::post('/ar_ledger', [ArController::class, 'storeTransaction'])->name('api.ar_ledger.store');
    Route::put('/ar_ledger', [ArController::class, 'updateTransaction'])->name('api.ar_ledger.update');
    Route::delete('/ar_ledger', [ArController::class, 'destroyTransaction'])->name('api.ar_ledger.destroy');

    // AP Suppliers & Ledger
    Route::get('/ap_suppliers', [ApController::class, 'suppliers'])->name('api.ap_suppliers.index');
    Route::post('/ap_suppliers', [ApController::class, 'storeSupplier'])->name('api.ap_suppliers.store');
    Route::put('/ap_suppliers', [ApController::class, 'updateSupplier'])->name('api.ap_suppliers.update');
    Route::delete('/ap_suppliers', [ApController::class, 'destroySupplier'])->name('api.ap_suppliers.destroy');
    Route::get('/ap_transactions', [ApController::class, 'transactions'])->name('api.ap_transactions.index');
    Route::post('/ap_transactions', [ApController::class, 'storeTransaction'])->name('api.ap_transactions.store');
    Route::post('/ap_payment', [ApController::class, 'recordPayment'])->name('api.ap_payment');
    Route::get('/ap_ledger', [ApController::class, 'supplierLedger'])->name('api.ap_ledger');

    // General Ledger
    Route::get('/trial_balance', [GeneralLedgerController::class, 'trialBalance'])->name('api.trial_balance');
    Route::get('/account_details', [GeneralLedgerController::class, 'accountDetails'])->name('api.account_details');
    Route::get('/gl_entries', [GeneralLedgerController::class, 'entries'])->name('api.gl_entries');
    Route::get('/account_activity', [GeneralLedgerController::class, 'accountActivity'])->name('api.account_activity');
    Route::get('/account_balance_history', [GeneralLedgerController::class, 'accountBalanceHistory'])->name('api.account_balance_history');

    // Fiscal Periods
    Route::get('/fiscal_periods', [FiscalPeriodsController::class, 'index'])->name('api.fiscal_periods.index');
    Route::post('/fiscal_periods', [FiscalPeriodsController::class, 'store'])->name('api.fiscal_periods.store');
    Route::post('/fiscal_periods/close', [FiscalPeriodsController::class, 'close'])->name('api.fiscal_periods.close');
    Route::post('/fiscal_periods/lock', [FiscalPeriodsController::class, 'lock'])->name('api.fiscal_periods.lock');
    Route::post('/fiscal_periods/unlock', [FiscalPeriodsController::class, 'unlock'])->name('api.fiscal_periods.unlock');

    // Reports
    Route::get('/reports/balance_sheet', [ReportsController::class, 'balanceSheet'])->name('api.reports.balance_sheet');
    Route::get('/reports/profit_loss', [ReportsController::class, 'profitLoss'])->name('api.reports.profit_loss');
    Route::get('/reports/cash_flow', [ReportsController::class, 'cashFlow'])->name('api.reports.cash_flow');
    Route::get('/reports/aging_receivables', [ReportsController::class, 'agingReceivables'])->name('api.reports.aging_receivables');
    Route::get('/reports/aging_payables', [ReportsController::class, 'agingPayables'])->name('api.reports.aging_payables');
    Route::get('/reports/comparative', [ReportsController::class, 'comparative'])->name('api.reports.comparative');

    // Dashboard
    Route::get('/dashboard', [DashboardController::class, 'index'])->name('api.dashboard');

    // Settings
    Route::get('/settings', [SettingsController::class, 'index'])->name('api.settings.index');
    Route::post('/settings', [SettingsController::class, 'update'])->name('api.settings.update');
    Route::get('/settings/store', [SettingsController::class, 'getStoreSettings'])->name('api.settings.store');
    Route::put('/settings/store', [SettingsController::class, 'updateStoreSettings'])->name('api.settings.store.update');
    Route::get('/settings/invoice', [SettingsController::class, 'getInvoiceSettings'])->name('api.settings.invoice');
    Route::put('/settings/invoice', [SettingsController::class, 'updateInvoiceSettings'])->name('api.settings.invoice.update');

    // Audit Logs
    Route::get('/audit-logs', [\App\Http\Controllers\Api\AuditLogController::class, 'index'])->name('api.audit_logs.index');

    // Users
    Route::get('/users', [UsersController::class, 'index'])->name('api.users.index');
    Route::post('/users', [UsersController::class, 'store'])->name('api.users.store');
    Route::put('/users', [UsersController::class, 'update'])->name('api.users.update');
    Route::delete('/users', [UsersController::class, 'destroy'])->name('api.users.destroy');
    Route::post('/change_password', [UsersController::class, 'changePassword'])->name('api.change_password');
    Route::get('/manager_list', [UsersController::class, 'managerList'])->name('api.manager_list');
    Route::get('/users/managers', [UsersController::class, 'managerList'])->name('api.users.managers');
    Route::get('/roles', [RolesController::class, 'index'])->name('api.roles.index');
    Route::post('/roles', [RolesController::class, 'store'])->name('api.roles.store');
    Route::delete('/roles/{id}', [RolesController::class, 'destroy'])->name('api.roles.destroy');
    Route::get('/my_sessions', [UsersController::class, 'mySessions'])->name('api.my_sessions');
    Route::get('/sessions', [SessionsController::class, 'index'])->name('api.sessions.index');
    Route::delete('/sessions/{id}', [SessionsController::class, 'destroy'])->name('api.sessions.destroy');

    // Categories
    Route::get('/categories', [CategoriesController::class, 'index'])->name('api.categories.index');
    Route::post('/categories', [CategoriesController::class, 'store'])->name('api.categories.store');
    Route::put('/categories', [CategoriesController::class, 'update'])->name('api.categories.update');
    Route::delete('/categories', [CategoriesController::class, 'destroy'])->name('api.categories.destroy');

    // Expenses
    Route::get('/expenses', [ExpensesController::class, 'index'])->name('api.expenses.index');
    Route::post('/expenses', [ExpensesController::class, 'store'])->name('api.expenses.store');
    Route::put('/expenses', [ExpensesController::class, 'update'])->name('api.expenses.update');
    Route::delete('/expenses', [ExpensesController::class, 'destroy'])->name('api.expenses.destroy');

    // Assets
    Route::get('/assets', [AssetsController::class, 'index'])->name('api.assets.index');
    Route::post('/assets', [AssetsController::class, 'store'])->name('api.assets.store');
    Route::put('/assets', [AssetsController::class, 'update'])->name('api.assets.update');
    Route::delete('/assets', [AssetsController::class, 'destroy'])->name('api.assets.destroy');

    // Batch Processing
    Route::get('/batch', [\App\Http\Controllers\Api\BatchController::class, 'index'])->name('api.batch.index');
    Route::post('/batch', [\App\Http\Controllers\Api\BatchController::class, 'store'])->name('api.batch.store');
    Route::delete('/batch', [\App\Http\Controllers\Api\BatchController::class, 'destroy'])->name('api.batch.destroy');

    // Revenues
    Route::get('/revenues', [RevenuesController::class, 'index'])->name('api.revenues.index');
    Route::post('/revenues', [RevenuesController::class, 'store'])->name('api.revenues.store');
    Route::put('/revenues', [RevenuesController::class, 'update'])->name('api.revenues.update');
    Route::delete('/revenues', [RevenuesController::class, 'destroy'])->name('api.revenues.destroy');

    // Chart of Accounts
    Route::get('/accounts', [ChartOfAccountsController::class, 'index'])->name('api.accounts.index');
    Route::post('/accounts', [ChartOfAccountsController::class, 'store'])->name('api.accounts.store');
    Route::put('/accounts/{id}', [\App\Http\Controllers\Api\ChartOfAccountsController::class, 'update'])->name('api.accounts.update');
    Route::delete('/accounts/{id}', [\App\Http\Controllers\Api\ChartOfAccountsController::class, 'destroy'])->name('api.accounts.destroy');

    // Accrual Accounting
    Route::get('/accrual', [\App\Http\Controllers\Api\AccrualAccountingController::class, 'index'])->name('api.accrual.index');
    Route::post('/accrual', [\App\Http\Controllers\Api\AccrualAccountingController::class, 'store'])->name('api.accrual.store');
    Route::put('/accrual', [\App\Http\Controllers\Api\AccrualAccountingController::class, 'update'])->name('api.accrual.update');

    // Bank Reconciliation
    Route::get('/reconciliation', [\App\Http\Controllers\Api\BankReconciliationController::class, 'index'])->name('api.reconciliation.index');
    Route::post('/reconciliation', [\App\Http\Controllers\Api\BankReconciliationController::class, 'store'])->name('api.reconciliation.store');
    Route::put('/reconciliation', [\App\Http\Controllers\Api\BankReconciliationController::class, 'update'])->name('api.reconciliation.update');

    // Recurring Transactions
    Route::get('/recurring_transactions', [\App\Http\Controllers\Api\RecurringTransactionsController::class, 'index'])->name('api.recurring.index');
    Route::post('/recurring_transactions', [\App\Http\Controllers\Api\RecurringTransactionsController::class, 'store'])->name('api.recurring.store');
    Route::put('/recurring_transactions', [\App\Http\Controllers\Api\RecurringTransactionsController::class, 'update'])->name('api.recurring.update');
    Route::delete('/recurring_transactions', [\App\Http\Controllers\Api\RecurringTransactionsController::class, 'destroy'])->name('api.recurring.destroy');
});

