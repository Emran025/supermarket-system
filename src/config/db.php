<?php
require_once 'config.php';

/**
 * Get database connection
 */
function get_db_connection()
{
    static $conn = null;

    if ($conn === null) {
        $conn = mysqli_connect(DB_HOST, DB_USER, DB_PASS, DB_NAME);

        if (!$conn) {
            // Try to create database if it doesn't exist
            $conn = mysqli_connect(DB_HOST, DB_USER, DB_PASS);
            if ($conn) {
                if (!mysqli_query($conn, "CREATE DATABASE IF NOT EXISTS " . DB_NAME)) {
                    throw new Exception("Failed to create database: " . mysqli_error($conn));
                }
                if (!mysqli_select_db($conn, DB_NAME)) {
                    throw new Exception("Failed to select database: " . mysqli_error($conn));
                }
            } else {
                throw new Exception("Database connection failed: " . mysqli_connect_error());
            }
        }

        if (!mysqli_set_charset($conn, "utf8mb4")) {
            throw new Exception("Failed to set charset: " . mysqli_error($conn));
        }
    }
    return $conn;
}

/**
 * Initialize database tables
 */
function init_database()
{
    try {
        $conn = get_db_connection();
    } catch (Exception $e) {
        error_log("Database initialization failed: " . $e->getMessage());
        throw $e;
    }

    // Users table
    $users_sql = "CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        full_name VARCHAR(100) DEFAULT NULL,
        role VARCHAR(20) DEFAULT 'admin',
        is_active TINYINT(1) DEFAULT 1,
        manager_id INT DEFAULT NULL,
        created_by INT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";


    if (!mysqli_query($conn, $users_sql)) {
        error_log("Failed to create users table: " . mysqli_error($conn));
        throw new Exception("Failed to create users table: " . mysqli_error($conn));
    }

    // Sessions table
    $sessions_sql = "CREATE TABLE IF NOT EXISTS sessions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        session_token VARCHAR(64) UNIQUE NOT NULL,
        ip_address VARCHAR(45),
        user_agent VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";

    if (!mysqli_query($conn, $sessions_sql)) {
        error_log("Failed to create sessions table: " . mysqli_error($conn));
        throw new Exception("Failed to create sessions table: " . mysqli_error($conn));
    }

    // Migrate existing sessions table if expires_at is TIMESTAMP
    $check_result = mysqli_query($conn, "SHOW COLUMNS FROM sessions WHERE Field = 'expires_at'");
    if ($check_result && $check_result instanceof mysqli_result && mysqli_num_rows($check_result) > 0) {
        $column = mysqli_fetch_assoc($check_result);
        if (stripos($column['Type'], 'timestamp') !== false) {
            // Alter the column to DATETIME
            $alter_sql = "ALTER TABLE sessions MODIFY expires_at DATETIME NOT NULL";
            if (!mysqli_query($conn, $alter_sql)) {
                error_log("Failed to alter sessions.expires_at: " . mysqli_error($conn));
                // Don't throw - table exists, just log the warning
            }
        }
    }

    // Check if new columns exist in users table
    $check_users = mysqli_query($conn, "SHOW COLUMNS FROM users LIKE 'role'");
    if ($check_users && $check_users instanceof mysqli_result && mysqli_num_rows($check_users) == 0) {
        mysqli_query($conn, "ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'admin'");
        mysqli_query($conn, "ALTER TABLE users ADD COLUMN is_active TINYINT(1) DEFAULT 1");
    }

    $check_manager = mysqli_query($conn, "SHOW COLUMNS FROM users LIKE 'manager_id'");
    if ($check_manager && $check_manager instanceof mysqli_result && mysqli_num_rows($check_manager) == 0) {
        mysqli_query($conn, "ALTER TABLE users ADD COLUMN manager_id INT DEFAULT NULL");
        mysqli_query($conn, "ALTER TABLE users ADD CONSTRAINT fk_user_manager FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL");
    }

    $check_fullname = mysqli_query($conn, "SHOW COLUMNS FROM users LIKE 'full_name'");
    if ($check_fullname && $check_fullname instanceof mysqli_result && mysqli_num_rows($check_fullname) == 0) {
        mysqli_query($conn, "ALTER TABLE users ADD COLUMN full_name VARCHAR(100) DEFAULT NULL AFTER password");
    }

    // Check if new columns exist in sessions table
    $check_sessions = mysqli_query($conn, "SHOW COLUMNS FROM sessions LIKE 'ip_address'");
    if ($check_sessions && $check_sessions instanceof mysqli_result && mysqli_num_rows($check_sessions) == 0) {
        mysqli_query($conn, "ALTER TABLE sessions ADD COLUMN ip_address VARCHAR(45)");
        mysqli_query($conn, "ALTER TABLE sessions ADD COLUMN user_agent VARCHAR(255)");
    }

    // RBAC: Roles table
    $roles_sql = "CREATE TABLE IF NOT EXISTS roles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        role_key VARCHAR(50) UNIQUE NOT NULL,
        role_name_ar VARCHAR(100) NOT NULL,
        role_name_en VARCHAR(100) NOT NULL,
        description TEXT,
        is_system TINYINT(1) DEFAULT 0,
        is_active TINYINT(1) DEFAULT 1,
        created_by INT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_role_key (role_key),
        INDEX idx_is_active (is_active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";

    if (!mysqli_query($conn, $roles_sql)) {
        error_log("Failed to create roles table: " . mysqli_error($conn));
        throw new Exception("Failed to create roles table: " . mysqli_error($conn));
    }

    // RBAC: Modules table
    $modules_sql = "CREATE TABLE IF NOT EXISTS modules (
        id INT AUTO_INCREMENT PRIMARY KEY,
        module_key VARCHAR(50) UNIQUE NOT NULL,
        module_name_ar VARCHAR(100) NOT NULL,
        module_name_en VARCHAR(100) NOT NULL,
        category VARCHAR(50),
        icon VARCHAR(50),
        sort_order INT DEFAULT 0,
        is_active TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_module_key (module_key),
        INDEX idx_category (category),
        INDEX idx_is_active (is_active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";

    if (!mysqli_query($conn, $modules_sql)) {
        error_log("Failed to create modules table: " . mysqli_error($conn));
        throw new Exception("Failed to create modules table: " . mysqli_error($conn));
    }

    // RBAC: Role Permissions table
    $permissions_sql = "CREATE TABLE IF NOT EXISTS role_permissions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        role_id INT NOT NULL,
        module_id INT NOT NULL,
        can_view TINYINT(1) DEFAULT 0,
        can_create TINYINT(1) DEFAULT 0,
        can_edit TINYINT(1) DEFAULT 0,
        can_delete TINYINT(1) DEFAULT 0,
        created_by INT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
        FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
        UNIQUE KEY unique_role_module (role_id, module_id),
        INDEX idx_role_id (role_id),
        INDEX idx_module_id (module_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";

    if (!mysqli_query($conn, $permissions_sql)) {
        error_log("Failed to create role_permissions table: " . mysqli_error($conn));
        throw new Exception("Failed to create role_permissions table: " . mysqli_error($conn));
    }

    // RBAC: Migrate users table to use role_id
    $check_user_role_id = mysqli_query($conn, "SHOW COLUMNS FROM users LIKE 'role_id'");
    if ($check_user_role_id && $check_user_role_id instanceof mysqli_result && mysqli_num_rows($check_user_role_id) == 0) {
        mysqli_query($conn, "ALTER TABLE users ADD COLUMN role_id INT NULL AFTER role");
        mysqli_query($conn, "ALTER TABLE users ADD CONSTRAINT fk_user_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE SET NULL");
    }

    // Login attempts table (for throttling)
    $login_attempts_sql = "CREATE TABLE IF NOT EXISTS login_attempts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) NOT NULL,
        attempts INT DEFAULT 1,
        last_attempt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        locked_until TIMESTAMP NULL,
        INDEX idx_username (username)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";

    if (!mysqli_query($conn, $login_attempts_sql)) {
        error_log("Failed to create login_attempts table: " . mysqli_error($conn));
        throw new Exception("Failed to create login_attempts table: " . mysqli_error($conn));
    }

    // Products table
    $products_sql = "CREATE TABLE IF NOT EXISTS products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        category VARCHAR(100),
        unit_price DECIMAL(10, 2) DEFAULT 0.00,
        minimum_profit_margin DECIMAL(10, 2) DEFAULT 0.00,
        stock_quantity INT DEFAULT 0,
        created_by INT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";


    if (!mysqli_query($conn, $products_sql)) {
        error_log("Failed to create products table: " . mysqli_error($conn));
        throw new Exception("Failed to create products table: " . mysqli_error($conn));
    }

    // Purchases table
    $purchases_sql = "CREATE TABLE IF NOT EXISTS purchases (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_id INT NOT NULL,
        quantity INT NOT NULL,
        invoice_price DECIMAL(10, 2) NOT NULL,
        expiry_date DATE DEFAULT NULL,
        user_id INT DEFAULT NULL,
        purchase_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";


    if (!mysqli_query($conn, $purchases_sql)) {
        error_log("Failed to create purchases table: " . mysqli_error($conn));
        throw new Exception("Failed to create purchases table: " . mysqli_error($conn));
    }

    $check_pur_expiry = mysqli_query($conn, "SHOW COLUMNS FROM purchases LIKE 'expiry_date'");
    if ($check_pur_expiry && $check_pur_expiry instanceof mysqli_result && mysqli_num_rows($check_pur_expiry) == 0) {
        mysqli_query($conn, "ALTER TABLE purchases ADD COLUMN expiry_date DATE DEFAULT NULL AFTER invoice_price");
    }

    // Invoices table
    $invoices_sql = "CREATE TABLE IF NOT EXISTS invoices (
        id INT AUTO_INCREMENT PRIMARY KEY,
        invoice_number VARCHAR(50) UNIQUE NOT NULL,
        total_amount DECIMAL(10, 2) NOT NULL,
        user_id INT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";


    if (!mysqli_query($conn, $invoices_sql)) {
        error_log("Failed to create invoices table: " . mysqli_error($conn));
        throw new Exception("Failed to create invoices table: " . mysqli_error($conn));
    }

    // Invoice items table
    $invoice_items_sql = "CREATE TABLE IF NOT EXISTS invoice_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        invoice_id INT NOT NULL,
        product_id INT NOT NULL,
        quantity INT NOT NULL,
        unit_price DECIMAL(10, 2) NOT NULL,
        subtotal DECIMAL(10, 2) NOT NULL,
        FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";

    // Categories table
    $categories_table_sql = "CREATE TABLE IF NOT EXISTS categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        created_by INT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";


    if (!mysqli_query($conn, $categories_table_sql)) {
        error_log("Failed to create categories table: " . mysqli_error($conn));
        throw new Exception("Failed to create categories table: " . mysqli_error($conn));
    }

    if (!mysqli_query($conn, $invoice_items_sql)) {
        error_log("Failed to create invoice_items table: " . mysqli_error($conn));
        throw new Exception("Failed to create invoice_items table: " . mysqli_error($conn));
    }

    // Telescope Logs table
    $telescope_sql = "CREATE TABLE IF NOT EXISTS telescope (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT DEFAULT NULL,
        operation VARCHAR(20) NOT NULL,
        table_name VARCHAR(50) NOT NULL,
        record_id INT DEFAULT NULL,
        old_values JSON DEFAULT NULL,
        new_values JSON DEFAULT NULL,
        ip_address VARCHAR(45),
        user_agent VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";

    if (!mysqli_query($conn, $telescope_sql)) {
        error_log("Failed to create telescope table: " . mysqli_error($conn));
        throw new Exception("Failed to create telescope table: " . mysqli_error($conn));
    }

    // Settings table
    $settings_sql = "CREATE TABLE IF NOT EXISTS settings (
        setting_key VARCHAR(50) PRIMARY KEY,
        setting_value TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";


    if (!mysqli_query($conn, $settings_sql)) {
        error_log("Failed to create settings table: " . mysqli_error($conn));
        throw new Exception("Failed to create settings table: " . mysqli_error($conn));
    }

    // AR Customers table
    $ar_customers_sql = "CREATE TABLE IF NOT EXISTS ar_customers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        email VARCHAR(255),
        address TEXT,
        tax_number VARCHAR(50),
        current_balance DECIMAL(10, 2) DEFAULT 0.00,
        created_by INT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";

    if (!mysqli_query($conn, $ar_customers_sql)) {
        error_log("Failed to create ar_customers table: " . mysqli_error($conn));
        throw new Exception("Failed to create ar_customers table: " . mysqli_error($conn));
    }

    // AR Transactions table (Ledger)
    $ar_transactions_sql = "CREATE TABLE IF NOT EXISTS ar_transactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        customer_id INT NOT NULL,
        type VARCHAR(20) NOT NULL COMMENT 'invoice, payment, return',
        amount DECIMAL(10, 2) NOT NULL,
        description TEXT,
        reference_type VARCHAR(50) DEFAULT NULL COMMENT 'table name e.g. invoices',
        reference_id INT DEFAULT NULL COMMENT 'record id in reference table',
        transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by INT DEFAULT NULL,
        is_deleted TINYINT(1) DEFAULT 0,
        deleted_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES ar_customers(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";

    if (!mysqli_query($conn, $ar_transactions_sql)) {
        error_log("Failed to create ar_transactions table: " . mysqli_error($conn));
        throw new Exception("Failed to create ar_transactions table: " . mysqli_error($conn));
    }

    // Expenses table
    $expenses_sql = "CREATE TABLE IF NOT EXISTS expenses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        category VARCHAR(100) NOT NULL,
        account_code VARCHAR(20) DEFAULT NULL COMMENT 'Chart of Accounts code',
        amount DECIMAL(10, 2) NOT NULL,
        expense_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        description TEXT,
        user_id INT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_account_code (account_code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";

    if (!mysqli_query($conn, $expenses_sql)) {
        error_log("Failed to create expenses table: " . mysqli_error($conn));
        throw new Exception("Failed to create expenses table: " . mysqli_error($conn));
    }

    // Add account_code column to expenses if it doesn't exist (migration)
    $check_exp_account = mysqli_query($conn, "SHOW COLUMNS FROM expenses LIKE 'account_code'");
    if ($check_exp_account && $check_exp_account instanceof mysqli_result && mysqli_num_rows($check_exp_account) == 0) {
        mysqli_query($conn, "ALTER TABLE expenses ADD COLUMN account_code VARCHAR(20) DEFAULT NULL COMMENT 'Chart of Accounts code'");
        mysqli_query($conn, "ALTER TABLE expenses ADD INDEX idx_account_code (account_code)");
    }

    // Assets table
    $assets_sql = "CREATE TABLE IF NOT EXISTS assets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        value DECIMAL(12, 2) NOT NULL,
        purchase_date DATE NOT NULL,
        depreciation_rate DECIMAL(5, 2) DEFAULT 0.00,
        description TEXT,
        status VARCHAR(50) DEFAULT 'active',
        created_by INT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";

    if (!mysqli_query($conn, $assets_sql)) {
        error_log("Failed to create assets table: " . mysqli_error($conn));
        throw new Exception("Failed to create assets table: " . mysqli_error($conn));
    }

    // Revenues table (Direct Cash Revenues)
    $revenues_sql = "CREATE TABLE IF NOT EXISTS revenues (
        id INT AUTO_INCREMENT PRIMARY KEY,
        source VARCHAR(255) NOT NULL,
        amount DECIMAL(12, 2) NOT NULL,
        revenue_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        description TEXT,
        user_id INT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";

    if (!mysqli_query($conn, $revenues_sql)) {
        error_log("Failed to create revenues table: " . mysqli_error($conn));
        throw new Exception("Failed to create revenues table: " . mysqli_error($conn));
    }

    // Chart of Accounts (COA) table
    $coa_sql = "CREATE TABLE IF NOT EXISTS chart_of_accounts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        account_code VARCHAR(20) UNIQUE NOT NULL,
        account_name VARCHAR(255) NOT NULL,
        account_type VARCHAR(50) NOT NULL COMMENT 'Asset, Liability, Equity, Revenue, Expense',
        parent_id INT DEFAULT NULL,
        is_active TINYINT(1) DEFAULT 1,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (parent_id) REFERENCES chart_of_accounts(id) ON DELETE SET NULL,
        INDEX idx_account_type (account_type),
        INDEX idx_parent_id (parent_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";

    if (!mysqli_query($conn, $coa_sql)) {
        error_log("Failed to create chart_of_accounts table: " . mysqli_error($conn));
        throw new Exception("Failed to create chart_of_accounts table: " . mysqli_error($conn));
    }

    // General Ledger (GL) table - Double-entry accounting
    $gl_sql = "CREATE TABLE IF NOT EXISTS general_ledger (
        id INT AUTO_INCREMENT PRIMARY KEY,
        voucher_number VARCHAR(50) NOT NULL,
        voucher_date DATE NOT NULL,
        account_id INT NOT NULL,
        entry_type VARCHAR(10) NOT NULL COMMENT 'DEBIT or CREDIT',
        amount DECIMAL(15, 2) NOT NULL,
        description TEXT,
        reference_type VARCHAR(50) DEFAULT NULL COMMENT 'table name e.g. invoices, purchases',
        reference_id INT DEFAULT NULL COMMENT 'record id in reference table',
        fiscal_period_id INT DEFAULT NULL,
        is_closed TINYINT(1) DEFAULT 0,
        created_by INT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (account_id) REFERENCES chart_of_accounts(id) ON DELETE RESTRICT,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_voucher_number (voucher_number),
        INDEX idx_voucher_date (voucher_date),
        INDEX idx_account_id (account_id),
        INDEX idx_fiscal_period (fiscal_period_id),
        INDEX idx_reference (reference_type, reference_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";

    if (!mysqli_query($conn, $gl_sql)) {
        error_log("Failed to create general_ledger table: " . mysqli_error($conn));
        throw new Exception("Failed to create general_ledger table: " . mysqli_error($conn));
    }

    // Fiscal Periods table
    $fiscal_periods_sql = "CREATE TABLE IF NOT EXISTS fiscal_periods (
        id INT AUTO_INCREMENT PRIMARY KEY,
        period_name VARCHAR(100) NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        is_closed TINYINT(1) DEFAULT 0,
        is_locked TINYINT(1) DEFAULT 0,
        closed_at TIMESTAMP NULL,
        closed_by INT DEFAULT NULL,
        locked_at DATETIME DEFAULT NULL,
        locked_by INT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (closed_by) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (locked_by) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_dates (start_date, end_date),
        INDEX idx_closed (is_closed),
        INDEX idx_locked (is_locked)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";

    if (!mysqli_query($conn, $fiscal_periods_sql)) {
        error_log("Failed to create fiscal_periods table: " . mysqli_error($conn));
        throw new Exception("Failed to create fiscal_periods table: " . mysqli_error($conn));
    }

    // Add period locking columns if not exist
    $check_period_locked = mysqli_query($conn, "SHOW COLUMNS FROM fiscal_periods LIKE 'is_locked'");
    if ($check_period_locked && $check_period_locked instanceof mysqli_result && mysqli_num_rows($check_period_locked) == 0) {
        mysqli_query($conn, "ALTER TABLE fiscal_periods ADD COLUMN is_locked TINYINT(1) DEFAULT 0");
        mysqli_query($conn, "ALTER TABLE fiscal_periods ADD COLUMN locked_at DATETIME DEFAULT NULL");
        mysqli_query($conn, "ALTER TABLE fiscal_periods ADD COLUMN locked_by INT DEFAULT NULL");
        mysqli_query($conn, "ALTER TABLE fiscal_periods ADD CONSTRAINT fk_fiscal_periods_locked_by FOREIGN KEY (locked_by) REFERENCES users(id) ON DELETE SET NULL");
        mysqli_query($conn, "ALTER TABLE fiscal_periods ADD INDEX idx_locked (is_locked)");
    }

    // Accounts Payable (AP) Suppliers table
    $ap_suppliers_sql = "CREATE TABLE IF NOT EXISTS ap_suppliers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        email VARCHAR(255),
        address TEXT,
        tax_number VARCHAR(50),
        credit_limit DECIMAL(15, 2) DEFAULT 0.00,
        payment_terms INT DEFAULT 30 COMMENT 'Days',
        current_balance DECIMAL(15, 2) DEFAULT 0.00,
        created_by INT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";

    if (!mysqli_query($conn, $ap_suppliers_sql)) {
        error_log("Failed to create ap_suppliers table: " . mysqli_error($conn));
        throw new Exception("Failed to create ap_suppliers table: " . mysqli_error($conn));
    }

    // Accounts Payable Transactions table
    $ap_transactions_sql = "CREATE TABLE IF NOT EXISTS ap_transactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        supplier_id INT NOT NULL,
        type VARCHAR(20) NOT NULL COMMENT 'invoice, payment, return',
        amount DECIMAL(15, 2) NOT NULL,
        description TEXT,
        reference_type VARCHAR(50) DEFAULT NULL COMMENT 'table name e.g. purchases',
        reference_id INT DEFAULT NULL COMMENT 'record id in reference table',
        transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by INT DEFAULT NULL,
        is_deleted TINYINT(1) DEFAULT 0,
        deleted_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (supplier_id) REFERENCES ap_suppliers(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_supplier (supplier_id),
        INDEX idx_reference (reference_type, reference_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";

    if (!mysqli_query($conn, $ap_transactions_sql)) {
        error_log("Failed to create ap_transactions table: " . mysqli_error($conn));
        throw new Exception("Failed to create ap_transactions table: " . mysqli_error($conn));
    }

    // Inventory Costing table (for COGS tracking)
    $inventory_costing_sql = "CREATE TABLE IF NOT EXISTS inventory_costing (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_id INT NOT NULL,
        purchase_id INT DEFAULT NULL,
        quantity INT NOT NULL,
        unit_cost DECIMAL(10, 2) NOT NULL,
        total_cost DECIMAL(15, 2) NOT NULL,
        costing_method VARCHAR(20) DEFAULT 'FIFO' COMMENT 'FIFO, WEIGHTED_AVG',
        transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        reference_type VARCHAR(50) DEFAULT NULL COMMENT 'purchases, sales',
        reference_id INT DEFAULT NULL,
        is_sold TINYINT(1) DEFAULT 0,
        sold_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE SET NULL,
        INDEX idx_product (product_id),
        INDEX idx_unsold (product_id, is_sold),
        INDEX idx_reference (reference_type, reference_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";

    if (!mysqli_query($conn, $inventory_costing_sql)) {
        error_log("Failed to create inventory_costing table: " . mysqli_error($conn));
        throw new Exception("Failed to create inventory_costing table: " . mysqli_error($conn));
    }

    // Asset Depreciation table
    $asset_depreciation_sql = "CREATE TABLE IF NOT EXISTS asset_depreciation (
        id INT AUTO_INCREMENT PRIMARY KEY,
        asset_id INT NOT NULL,
        depreciation_date DATE NOT NULL,
        depreciation_amount DECIMAL(15, 2) NOT NULL,
        accumulated_depreciation DECIMAL(15, 2) NOT NULL,
        book_value DECIMAL(15, 2) NOT NULL,
        fiscal_period_id INT DEFAULT NULL,
        created_by INT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
        FOREIGN KEY (fiscal_period_id) REFERENCES fiscal_periods(id) ON DELETE SET NULL,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_asset (asset_id),
        INDEX idx_date (depreciation_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";

    if (!mysqli_query($conn, $asset_depreciation_sql)) {
        error_log("Failed to create asset_depreciation table: " . mysqli_error($conn));
        throw new Exception("Failed to create asset_depreciation table: " . mysqli_error($conn));
    }

    // Document Sequences table (for voucher numbering)
    $document_sequences_sql = "CREATE TABLE IF NOT EXISTS document_sequences (
        id INT AUTO_INCREMENT PRIMARY KEY,
        document_type VARCHAR(50) UNIQUE NOT NULL COMMENT 'INV, PUR, EXP, REV, etc.',
        prefix VARCHAR(10) DEFAULT '',
        current_number INT DEFAULT 0,
        format VARCHAR(50) DEFAULT '{PREFIX}-{NUMBER}',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";

    if (!mysqli_query($conn, $document_sequences_sql)) {
        error_log("Failed to create document_sequences table: " . mysqli_error($conn));
        throw new Exception("Failed to create document_sequences table: " . mysqli_error($conn));
    }

    // Reconciliations table (for cash/bank reconciliation)
    $reconciliations_sql = "CREATE TABLE IF NOT EXISTS reconciliations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        account_code VARCHAR(20) NOT NULL,
        reconciliation_date DATE NOT NULL,
        ledger_balance DECIMAL(15, 2) NOT NULL,
        physical_balance DECIMAL(15, 2) NOT NULL,
        difference DECIMAL(15, 2) NOT NULL,
        status VARCHAR(20) DEFAULT 'unreconciled' COMMENT 'reconciled, unreconciled, adjusted',
        notes TEXT,
        adjustment_notes TEXT,
        reconciled_by INT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (reconciled_by) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_account (account_code),
        INDEX idx_date (reconciliation_date),
        INDEX idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";

    if (!mysqli_query($conn, $reconciliations_sql)) {
        error_log("Failed to create reconciliations table: " . mysqli_error($conn));
        throw new Exception("Failed to create reconciliations table: " . mysqli_error($conn));
    }

    // Journal Vouchers table (for manual journal entries)
    $journal_vouchers_sql = "CREATE TABLE IF NOT EXISTS journal_vouchers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        voucher_number VARCHAR(50) NOT NULL,
        voucher_date DATE NOT NULL,
        account_id INT NOT NULL,
        entry_type VARCHAR(10) NOT NULL COMMENT 'DEBIT or CREDIT',
        amount DECIMAL(15, 2) NOT NULL,
        description TEXT,
        created_by INT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (account_id) REFERENCES chart_of_accounts(id) ON DELETE RESTRICT,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_voucher (voucher_number),
        INDEX idx_date (voucher_date),
        INDEX idx_account (account_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";

    if (!mysqli_query($conn, $journal_vouchers_sql)) {
        error_log("Failed to create journal_vouchers table: " . mysqli_error($conn));
        throw new Exception("Failed to create journal_vouchers table: " . mysqli_error($conn));
    }

    // Accrual Accounting Tables

    // Payroll Entries table
    $payroll_sql = "CREATE TABLE IF NOT EXISTS payroll_entries (
        id INT AUTO_INCREMENT PRIMARY KEY,
        employee_name VARCHAR(255) NOT NULL,
        salary_amount DECIMAL(15, 2) NOT NULL,
        payroll_date DATE NOT NULL,
        description TEXT,
        status VARCHAR(20) DEFAULT 'accrued' COMMENT 'accrued, paid',
        payment_date DATE DEFAULT NULL,
        paid_at DATETIME DEFAULT NULL,
        created_by INT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_date (payroll_date),
        INDEX idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";

    if (!mysqli_query($conn, $payroll_sql)) {
        error_log("Failed to create payroll_entries table: " . mysqli_error($conn));
        throw new Exception("Failed to create payroll_entries table: " . mysqli_error($conn));
    }

    // Prepayments table
    $prepayments_sql = "CREATE TABLE IF NOT EXISTS prepayments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        description VARCHAR(255) NOT NULL,
        total_amount DECIMAL(15, 2) NOT NULL,
        payment_date DATE NOT NULL,
        expense_account_code VARCHAR(20) NOT NULL,
        amortization_periods INT DEFAULT 1,
        amortized_amount DECIMAL(15, 2) DEFAULT 0.00,
        created_by INT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_date (payment_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";

    if (!mysqli_query($conn, $prepayments_sql)) {
        error_log("Failed to create prepayments table: " . mysqli_error($conn));
        throw new Exception("Failed to create prepayments table: " . mysqli_error($conn));
    }

    // Unearned Revenue table
    $unearned_revenue_sql = "CREATE TABLE IF NOT EXISTS unearned_revenue (
        id INT AUTO_INCREMENT PRIMARY KEY,
        description VARCHAR(255) NOT NULL,
        total_amount DECIMAL(15, 2) NOT NULL,
        received_date DATE NOT NULL,
        revenue_account_code VARCHAR(20) NOT NULL,
        recognized_amount DECIMAL(15, 2) DEFAULT 0.00,
        created_by INT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_date (received_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";

    if (!mysqli_query($conn, $unearned_revenue_sql)) {
        error_log("Failed to create unearned_revenue table: " . mysqli_error($conn));
        throw new Exception("Failed to create unearned_revenue table: " . mysqli_error($conn));
    }

    // Periodic Inventory Counts table
    $inventory_counts_sql = "CREATE TABLE IF NOT EXISTS inventory_counts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_id INT NOT NULL,
        fiscal_period_id INT NOT NULL,
        count_date DATE NOT NULL,
        book_quantity INT NOT NULL COMMENT 'Quantity from perpetual system',
        counted_quantity INT NOT NULL COMMENT 'Physical count',
        variance INT NOT NULL COMMENT 'counted - book',
        notes TEXT,
        is_processed TINYINT(1) DEFAULT 0,
        processed_at DATETIME DEFAULT NULL,
        counted_by INT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        FOREIGN KEY (fiscal_period_id) REFERENCES fiscal_periods(id) ON DELETE RESTRICT,
        FOREIGN KEY (counted_by) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_period (fiscal_period_id),
        INDEX idx_product (product_id),
        INDEX idx_processed (is_processed)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";

    if (!mysqli_query($conn, $inventory_counts_sql)) {
        error_log("Failed to create inventory_counts table: " . mysqli_error($conn));
        throw new Exception("Failed to create inventory_counts table: " . mysqli_error($conn));
    }

    // Add inventory method setting
    $check_inv_method = mysqli_query($conn, "SELECT COUNT(*) as count FROM settings WHERE setting_key = 'inventory_method'");
    $inv_method_row = mysqli_fetch_assoc($check_inv_method);
    if ($inv_method_row['count'] == 0) {
        mysqli_query($conn, "INSERT INTO settings (setting_key, setting_value) VALUES ('inventory_method', 'perpetual')");
    }

    // ZATCA E-Invoices table
    $zatca_einvoices_sql = "CREATE TABLE IF NOT EXISTS zatca_einvoices (
        id INT AUTO_INCREMENT PRIMARY KEY,
        invoice_id INT NOT NULL,
        xml_content TEXT NOT NULL,
        hash VARCHAR(64) NOT NULL,
        signed_xml TEXT DEFAULT NULL,
        qr_code VARCHAR(255) DEFAULT NULL,
        zatca_uuid VARCHAR(255) DEFAULT NULL,
        zatca_qr_code TEXT DEFAULT NULL,
        status VARCHAR(20) DEFAULT 'generated' COMMENT 'generated, signed, submitted, rejected',
        signed_at DATETIME DEFAULT NULL,
        submitted_at DATETIME DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
        UNIQUE KEY unique_invoice (invoice_id),
        INDEX idx_status (status),
        INDEX idx_hash (hash)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";

    if (!mysqli_query($conn, $zatca_einvoices_sql)) {
        error_log("Failed to create zatca_einvoices table: " . mysqli_error($conn));
        throw new Exception("Failed to create zatca_einvoices table: " . mysqli_error($conn));
    }

    // Recurring Transactions table
    $recurring_transactions_sql = "CREATE TABLE IF NOT EXISTS recurring_transactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        description VARCHAR(255) NOT NULL,
        debit_account_code VARCHAR(20) NOT NULL,
        credit_account_code VARCHAR(20) NOT NULL,
        amount DECIMAL(15, 2) NOT NULL,
        frequency VARCHAR(20) DEFAULT 'monthly' COMMENT 'daily, weekly, monthly, quarterly, yearly',
        start_date DATE NOT NULL,
        end_date DATE DEFAULT NULL,
        next_due_date DATE NOT NULL,
        last_processed_date DATE DEFAULT NULL,
        auto_process TINYINT(1) DEFAULT 0,
        status VARCHAR(20) DEFAULT 'active' COMMENT 'active, paused, completed',
        processed_count INT DEFAULT 0,
        created_by INT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_status (status),
        INDEX idx_next_due (next_due_date),
        INDEX idx_auto_process (auto_process)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";

    if (!mysqli_query($conn, $recurring_transactions_sql)) {
        error_log("Failed to create recurring_transactions table: " . mysqli_error($conn));
        throw new Exception("Failed to create recurring_transactions table: " . mysqli_error($conn));
    }

    // Batch Processing table
    $batch_processing_sql = "CREATE TABLE IF NOT EXISTS batch_processing (
        id INT AUTO_INCREMENT PRIMARY KEY,
        batch_type VARCHAR(50) NOT NULL COMMENT 'journal_entries, expenses, etc.',
        description VARCHAR(255) NOT NULL,
        status VARCHAR(20) DEFAULT 'processing' COMMENT 'processing, completed, partial, failed',
        total_items INT NOT NULL,
        successful_items INT DEFAULT 0,
        failed_items INT DEFAULT 0,
        created_by INT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME DEFAULT NULL,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_status (status),
        INDEX idx_type (batch_type)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";

    if (!mysqli_query($conn, $batch_processing_sql)) {
        error_log("Failed to create batch_processing table: " . mysqli_error($conn));
        throw new Exception("Failed to create batch_processing table: " . mysqli_error($conn));
    }

    // Batch Items table
    $batch_items_sql = "CREATE TABLE IF NOT EXISTS batch_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        batch_id INT NOT NULL,
        item_index INT NOT NULL,
        status VARCHAR(20) DEFAULT 'pending' COMMENT 'pending, success, error',
        reference_id INT DEFAULT NULL COMMENT 'ID of created record (expense_id, etc.)',
        voucher_number VARCHAR(50) DEFAULT NULL,
        error_message TEXT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (batch_id) REFERENCES batch_processing(id) ON DELETE CASCADE,
        INDEX idx_batch (batch_id),
        INDEX idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";

    if (!mysqli_query($conn, $batch_items_sql)) {
        error_log("Failed to create batch_items table: " . mysqli_error($conn));
        throw new Exception("Failed to create batch_items table: " . mysqli_error($conn));
    }

    // Add voucher_number to invoices if not exists
    $check_inv_voucher = mysqli_query($conn, "SHOW COLUMNS FROM invoices LIKE 'voucher_number'");
    if ($check_inv_voucher && $check_inv_voucher instanceof mysqli_result && mysqli_num_rows($check_inv_voucher) == 0) {
        mysqli_query($conn, "ALTER TABLE invoices ADD COLUMN voucher_number VARCHAR(50) DEFAULT NULL");
        mysqli_query($conn, "ALTER TABLE invoices ADD INDEX idx_voucher_number (voucher_number)");
    }

    // Add supplier_id to purchases if not exists
    $check_purch_supplier = mysqli_query($conn, "SHOW COLUMNS FROM purchases LIKE 'supplier_id'");
    if ($check_purch_supplier && $check_purch_supplier instanceof mysqli_result && mysqli_num_rows($check_purch_supplier) == 0) {
        mysqli_query($conn, "ALTER TABLE purchases ADD COLUMN supplier_id INT DEFAULT NULL");
        mysqli_query($conn, "ALTER TABLE purchases ADD COLUMN voucher_number VARCHAR(50) DEFAULT NULL");
        mysqli_query($conn, "ALTER TABLE purchases ADD CONSTRAINT fk_purchases_supplier FOREIGN KEY (supplier_id) REFERENCES ap_suppliers(id) ON DELETE SET NULL");
        mysqli_query($conn, "ALTER TABLE purchases ADD INDEX idx_voucher_number (voucher_number)");
    }

    // Add VAT fields to invoices
    $check_inv_vat = mysqli_query($conn, "SHOW COLUMNS FROM invoices LIKE 'vat_rate'");
    if ($check_inv_vat && $check_inv_vat instanceof mysqli_result && mysqli_num_rows($check_inv_vat) == 0) {
        mysqli_query($conn, "ALTER TABLE invoices ADD COLUMN vat_rate DECIMAL(5, 2) DEFAULT 0.00");
        mysqli_query($conn, "ALTER TABLE invoices ADD COLUMN vat_amount DECIMAL(10, 2) DEFAULT 0.00");
        mysqli_query($conn, "ALTER TABLE invoices ADD COLUMN subtotal DECIMAL(10, 2) DEFAULT 0.00");
    }

    // Add VAT fields to purchases
    $check_purch_vat = mysqli_query($conn, "SHOW COLUMNS FROM purchases LIKE 'vat_rate'");
    if ($check_purch_vat && $check_purch_vat instanceof mysqli_result && mysqli_num_rows($check_purch_vat) == 0) {
        mysqli_query($conn, "ALTER TABLE purchases ADD COLUMN vat_rate DECIMAL(5, 2) DEFAULT 0.00");
        mysqli_query($conn, "ALTER TABLE purchases ADD COLUMN vat_amount DECIMAL(10, 2) DEFAULT 0.00");
    }

    // Add weighted_average_cost to products
    $check_prod_wac = mysqli_query($conn, "SHOW COLUMNS FROM products LIKE 'weighted_average_cost'");
    if ($check_prod_wac && $check_prod_wac instanceof mysqli_result && mysqli_num_rows($check_prod_wac) == 0) {
        mysqli_query($conn, "ALTER TABLE products ADD COLUMN weighted_average_cost DECIMAL(10, 2) DEFAULT 0.00");
    }

    // Add fiscal_period_id to general_ledger (already in CREATE, but ensure FK exists)
    $check_gl_fiscal = mysqli_query($conn, "SHOW COLUMNS FROM general_ledger LIKE 'fiscal_period_id'");
    if ($check_gl_fiscal && $check_gl_fiscal instanceof mysqli_result && mysqli_num_rows($check_gl_fiscal) > 0) {
        // Check if FK exists
        $fk_check = mysqli_query($conn, "SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'general_ledger' AND COLUMN_NAME = 'fiscal_period_id' AND REFERENCED_TABLE_NAME IS NOT NULL");
        if (!$fk_check || mysqli_num_rows($fk_check) == 0) {
            mysqli_query($conn, "ALTER TABLE general_ledger ADD CONSTRAINT fk_gl_fiscal_period FOREIGN KEY (fiscal_period_id) REFERENCES fiscal_periods(id) ON DELETE SET NULL");
        }
    }


    // Migrations for existing tables
    // Update products table
    $check_products = mysqli_query($conn, "SHOW COLUMNS FROM products LIKE 'unit_name'");
    if ($check_products && $check_products instanceof mysqli_result && mysqli_num_rows($check_products) == 0) {
        mysqli_query($conn, "ALTER TABLE products ADD COLUMN unit_name VARCHAR(50) DEFAULT 'كرتون'");
        mysqli_query($conn, "ALTER TABLE products ADD COLUMN items_per_unit INT DEFAULT 1");
        mysqli_query($conn, "ALTER TABLE products ADD COLUMN sub_unit_name VARCHAR(50) DEFAULT 'حبة'");
    }

    // Change category to store ID or keep as text but link? 
    // Usually easier to keep as text for simple systems but dropdown from table.
    // Let's keep it as text in products but synced from categories table for now to avoid breaking changes.

    // Update purchases table
    $check_purchases = mysqli_query($conn, "SHOW COLUMNS FROM purchases LIKE 'unit_type'");
    if ($check_purchases && $check_purchases instanceof mysqli_result && mysqli_num_rows($check_purchases) == 0) {
        mysqli_query($conn, "ALTER TABLE purchases ADD COLUMN unit_type VARCHAR(20) DEFAULT 'sub'");
    }

    $check_purchases_expiry = mysqli_query($conn, "SHOW COLUMNS FROM purchases LIKE 'expiry_date'");
    if ($check_purchases_expiry && $check_purchases_expiry instanceof mysqli_result && mysqli_num_rows($check_purchases_expiry) == 0) {
        mysqli_query($conn, "ALTER TABLE purchases ADD COLUMN production_date DATE DEFAULT NULL");
        mysqli_query($conn, "ALTER TABLE purchases ADD COLUMN expiry_date DATE DEFAULT NULL");
    }

    // Add tracking columns to existing tables
    $check_prod_tracking = mysqli_query($conn, "SHOW COLUMNS FROM products LIKE 'created_by'");
    if ($check_prod_tracking && $check_prod_tracking instanceof mysqli_result && mysqli_num_rows($check_prod_tracking) == 0) {
        mysqli_query($conn, "ALTER TABLE products ADD COLUMN created_by INT DEFAULT NULL");
        mysqli_query($conn, "ALTER TABLE products ADD CONSTRAINT fk_products_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL");
    }

    $check_cat_tracking = mysqli_query($conn, "SHOW COLUMNS FROM categories LIKE 'created_by'");
    if ($check_cat_tracking && $check_cat_tracking instanceof mysqli_result && mysqli_num_rows($check_cat_tracking) == 0) {
        mysqli_query($conn, "ALTER TABLE categories ADD COLUMN created_by INT DEFAULT NULL");
        mysqli_query($conn, "ALTER TABLE categories ADD CONSTRAINT fk_categories_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL");
    }

    $check_purch_tracking = mysqli_query($conn, "SHOW COLUMNS FROM purchases LIKE 'user_id'");
    if ($check_purch_tracking && $check_purch_tracking instanceof mysqli_result && mysqli_num_rows($check_purch_tracking) == 0) {
        mysqli_query($conn, "ALTER TABLE purchases ADD COLUMN user_id INT DEFAULT NULL");
        mysqli_query($conn, "ALTER TABLE purchases ADD CONSTRAINT fk_purchases_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL");
    }

    $check_inv_tracking = mysqli_query($conn, "SHOW COLUMNS FROM invoices LIKE 'user_id'");
    if ($check_inv_tracking && $check_inv_tracking instanceof mysqli_result && mysqli_num_rows($check_inv_tracking) == 0) {
        mysqli_query($conn, "ALTER TABLE invoices ADD COLUMN user_id INT DEFAULT NULL");
        mysqli_query($conn, "ALTER TABLE invoices ADD CONSTRAINT fk_invoices_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL");
    }

    $check_inv_customer = mysqli_query($conn, "SHOW COLUMNS FROM invoices LIKE 'customer_id'");
    if ($check_inv_customer && $check_inv_customer instanceof mysqli_result && mysqli_num_rows($check_inv_customer) == 0) {
        mysqli_query($conn, "ALTER TABLE invoices ADD COLUMN customer_id INT DEFAULT NULL"); // For AR customer
        mysqli_query($conn, "ALTER TABLE invoices ADD COLUMN payment_type VARCHAR(20) DEFAULT 'cash'"); // cash or credit
        mysqli_query($conn, "ALTER TABLE invoices ADD COLUMN amount_paid DECIMAL(10, 2) DEFAULT 0.00");
        mysqli_query($conn, "ALTER TABLE invoices ADD CONSTRAINT fk_invoices_customer FOREIGN KEY (customer_id) REFERENCES ar_customers(id) ON DELETE SET NULL");
    }

    $check_inv_paid = mysqli_query($conn, "SHOW COLUMNS FROM invoices LIKE 'amount_paid'");
    if ($check_inv_paid && $check_inv_paid instanceof mysqli_result && mysqli_num_rows($check_inv_paid) == 0) {
        mysqli_query($conn, "ALTER TABLE invoices ADD COLUMN amount_paid DECIMAL(10, 2) DEFAULT 0.00");
    }

    $check_user_tracking = mysqli_query($conn, "SHOW COLUMNS FROM users LIKE 'created_by'");
    if ($check_user_tracking && $check_user_tracking instanceof mysqli_result && mysqli_num_rows($check_user_tracking) == 0) {
        mysqli_query($conn, "ALTER TABLE users ADD COLUMN created_by INT DEFAULT NULL");
        mysqli_query($conn, "ALTER TABLE users ADD CONSTRAINT fk_users_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL");
    }

    // Add reversal tracking columns for immutable audit trail
    $check_inv_reversed = mysqli_query($conn, "SHOW COLUMNS FROM invoices LIKE 'is_reversed'");
    if ($check_inv_reversed && $check_inv_reversed instanceof mysqli_result && mysqli_num_rows($check_inv_reversed) == 0) {
        mysqli_query($conn, "ALTER TABLE invoices ADD COLUMN is_reversed TINYINT(1) DEFAULT 0");
        mysqli_query($conn, "ALTER TABLE invoices ADD COLUMN reversed_at DATETIME DEFAULT NULL");
        mysqli_query($conn, "ALTER TABLE invoices ADD COLUMN reversed_by INT DEFAULT NULL");
        mysqli_query($conn, "ALTER TABLE invoices ADD CONSTRAINT fk_invoices_reversed_by FOREIGN KEY (reversed_by) REFERENCES users(id) ON DELETE SET NULL");
    }

    $check_pur_reversed = mysqli_query($conn, "SHOW COLUMNS FROM purchases LIKE 'is_reversed'");
    if ($check_pur_reversed && $check_pur_reversed instanceof mysqli_result && mysqli_num_rows($check_pur_reversed) == 0) {
        mysqli_query($conn, "ALTER TABLE purchases ADD COLUMN is_reversed TINYINT(1) DEFAULT 0");
        mysqli_query($conn, "ALTER TABLE purchases ADD COLUMN reversed_at DATETIME DEFAULT NULL");
        mysqli_query($conn, "ALTER TABLE purchases ADD COLUMN reversed_by INT DEFAULT NULL");
        mysqli_query($conn, "ALTER TABLE purchases ADD CONSTRAINT fk_purchases_reversed_by FOREIGN KEY (reversed_by) REFERENCES users(id) ON DELETE SET NULL");
    }

    // Add approval workflow columns to purchases
    $check_pur_approval = mysqli_query($conn, "SHOW COLUMNS FROM purchases LIKE 'approval_status'");
    if ($check_pur_approval && $check_pur_approval instanceof mysqli_result && mysqli_num_rows($check_pur_approval) == 0) {
        mysqli_query($conn, "ALTER TABLE purchases ADD COLUMN approval_status VARCHAR(20) DEFAULT 'approved' COMMENT 'pending, approved, rejected'");
        mysqli_query($conn, "ALTER TABLE purchases ADD COLUMN approved_by INT DEFAULT NULL");
        mysqli_query($conn, "ALTER TABLE purchases ADD COLUMN approved_at DATETIME DEFAULT NULL");
        mysqli_query($conn, "ALTER TABLE purchases ADD CONSTRAINT fk_purchases_approved_by FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL");
        mysqli_query($conn, "ALTER TABLE purchases ADD INDEX idx_approval_status (approval_status)");
    }

    // Add approval threshold setting
    $check_threshold = mysqli_query($conn, "SELECT COUNT(*) as count FROM settings WHERE setting_key = 'purchase_approval_threshold'");
    $threshold_row = mysqli_fetch_assoc($check_threshold);
    if ($threshold_row['count'] == 0) {
        mysqli_query($conn, "INSERT INTO settings (setting_key, setting_value) VALUES ('purchase_approval_threshold', '10000')");
    }

    // Purchase Requests table
    $requests_sql = "CREATE TABLE IF NOT EXISTS purchase_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_id INT NULL,
        product_name VARCHAR(255) NULL, 
        quantity INT DEFAULT 1,
        user_id INT,
        status VARCHAR(50) DEFAULT 'pending',
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";

    if (!mysqli_query($conn, $requests_sql)) {
        error_log("Failed to create purchase_requests table: " . mysqli_error($conn));
        throw new Exception("Failed to create purchase_requests table: " . mysqli_error($conn));
    }



    // Seed default user if not exists
    try {
        seed_default_user();
    } catch (Exception $e) {
        error_log("Failed to seed default user: " . $e->getMessage());
        // Don't throw, just log - seeding is not critical
    }

    // Seed products if table is empty
    try {
        seed_products();
    } catch (Exception $e) {
        error_log("Failed to seed products: " . $e->getMessage());
        // Don't throw, just log - seeding is not critical
    }
    // Seed default settings
    try {
        seed_settings();
    } catch (Exception $e) {
        error_log("Failed to seed settings: " . $e->getMessage());
    }
    // Seed invoices if table is empty
    try {
        seed_invoices();
    } catch (Exception $e) {
        error_log("Failed to seed invoices: " . $e->getMessage());
    }

    // Seed RBAC Roles, Modules and Permissions
    try {
        seed_rbac();
    } catch (Exception $e) {
        error_log("Failed to seed RBAC: " . $e->getMessage());
    }

    // Seed Chart of Accounts
    try {
        seed_chart_of_accounts();
    } catch (Exception $e) {
        error_log("Failed to seed chart of accounts: " . $e->getMessage());
    }
    // Seed document sequences
    try {
        seed_document_sequences();
    } catch (Exception $e) {
        error_log("Failed to seed document sequences: " . $e->getMessage());
    }
}



/**
 * Seed default user
 */
function seed_default_user()
{
    $conn = get_db_connection();

    // Check if users table exists
    $table_check = mysqli_query($conn, "SHOW TABLES LIKE 'users'");
    if (mysqli_num_rows($table_check) == 0) {
        // Table doesn't exist yet, will be created by init_database
        return;
    }

    $result = mysqli_query($conn, "SELECT COUNT(*) as count FROM users");
    if (!$result) {
        return;
    }

    $row = mysqli_fetch_assoc($result);

    if ($row['count'] == 0) {
        $username = 'admin';
        $password = password_hash('admin123', PASSWORD_DEFAULT);
        
        // Try to get admin role ID
        $role_id = null;
        $role_res = mysqli_query($conn, "SELECT id FROM roles WHERE role_key = 'admin'");
        if ($role_res && mysqli_num_rows($role_res) > 0) {
            $role_row = mysqli_fetch_assoc($role_res);
            $role_id = $role_row['id'];
        }

        $stmt = mysqli_prepare($conn, "INSERT INTO users (username, password, role, role_id) VALUES (?, ?, 'admin', ?)");
        if ($stmt) {
            mysqli_stmt_bind_param($stmt, "ssi", $username, $password, $role_id);
            if (!mysqli_stmt_execute($stmt)) {
                error_log("Failed to create default user: " . mysqli_error($conn));
            }
            mysqli_stmt_close($stmt);
        } else {
            error_log("Failed to prepare user insert statement: " . mysqli_error($conn));
        }
    }
}

/**
 * Seed products with realistic data
 */
function seed_products()
{
    $conn = get_db_connection();

    $result = mysqli_query($conn, "SELECT COUNT(*) as count FROM products");
    $row = mysqli_fetch_assoc($result);

    if ($row['count'] == 0) {
        $categories = ['فواكه', 'خضروات', 'ألبان', 'مشروبات', 'تسالي', 'لحوم', 'مخبوزات', 'معلبات', 'مجمدات', 'أدوات تنظيف'];

        // Seed categories table
        foreach ($categories as $cat) {
            $cat_esc = mysqli_real_escape_string($conn, $cat);
            mysqli_query($conn, "INSERT IGNORE INTO categories (name) VALUES ('$cat_esc')");
        }

        $product_names = [
            'فواكه' => ['تفاح', 'موز', 'برتقال', 'عنب', 'فراولة', 'مانجو', 'بطيخ', 'أناناس', 'كيوي', 'خوخ'],
            'خضروات' => ['طماطم', 'جزر', 'خس', 'بصل', 'بطاطس', 'بروكلي', 'خيار', 'فلفل رومي', 'سبانخ', 'كرنب'],
            'ألبان' => ['حليب', 'جبنة', 'زبادي', 'زبدة', 'قشطة', 'كريمة حامضة', 'جبنة قريش', 'موتزاريلا', 'شيدر', 'فيتا'],
            'مشروبات' => ['ماء', 'عصير', 'صودا', 'قهوة', 'شاي', 'مشروب طاقة', 'مشروب رياضي', 'ماء فوار', 'ليمونادة', 'شاي مثلج'],
            'تسالي' => ['شيبسي', 'كوكيز', 'مقرمشات', 'مكسرات', 'شوكولاتة', 'حلويات', 'فشار', 'بريتزل', 'مكسرات مشكلة', 'ألواح جرانولا'],
            'لحوم' => ['صدر دجاج', 'لحم مفروم', 'سلمون', 'ريش غنم', 'ديك رومي', 'ستيك بقري', 'سجق', 'بسطرمة', 'لانشون', 'تونة'],
            'مخبوزات' => ['خبز', 'باجل', 'كرواسون', 'مافن', 'دونات', 'كوكيز', 'كيك', 'فطيرة', 'لفائف', 'خبز صمول'],
            'معلبات' => ['فول', 'ذرة', 'بسلة', 'صلصة طماطم', 'شوربة', 'تونة', 'سردين', 'زيتون', 'مخلل', 'صوص'],
            'مجمدات' => ['آيس كريم', 'خضروات مجمدة', 'بيتزا مجمدة', 'بطاطس مجمدة', 'توت مجمد', 'دجاج مجمد', 'سمك مجمد', 'وجبات مجمدة', 'زبادي مجمدة', 'وافل مجمد'],
            'أدوات تنظيف' => ['منظف', 'صابون', 'شامبو', 'معجون أسنان', 'مناشف ورقية', 'أكياس قمامة', 'إسفنج', 'كلور', 'مطهر', 'منعم أقمشة']
        ];

        $stmt = mysqli_prepare($conn, "INSERT INTO products (name, description, category, unit_price, minimum_profit_margin, stock_quantity) VALUES (?, ?, ?, ?, ?, ?)");

        foreach ($categories as $category) {
            $products = $product_names[$category];
            foreach ($products as $product_name) {
                $description = "{$product_name} عالي الجودة من موردين موثوقين";
                $unit_price = rand(50, 5000) / 100; // Random price between 0.50 and 50.00
                $min_margin = rand(10, 500) / 100; // Random margin between 0.10 and 5.00
                $stock = rand(10, 200);

                mysqli_stmt_bind_param($stmt, "sssddi", $product_name, $description, $category, $unit_price, $min_margin, $stock);
                mysqli_stmt_execute($stmt);
            }
        }

        mysqli_stmt_close($stmt);

        // Seed some purchases
        seed_purchases();
    }
}

/**
 * Seed purchases
 */
function seed_purchases()
{
    $conn = get_db_connection();

    $result = mysqli_query($conn, "SELECT id FROM products LIMIT 50");
    $product_ids = [];
    while ($row = mysqli_fetch_assoc($result)) {
        $product_ids[] = $row['id'];
    }

    $stmt = mysqli_prepare($conn, "INSERT INTO purchases (product_id, quantity, invoice_price, purchase_date) VALUES (?, ?, ?, ?)");

    // Create purchases for the last 30 days
    for ($i = 0; $i < 50; $i++) {
        $product_id = $product_ids[array_rand($product_ids)];
        $quantity = rand(5, 50);

        // Get product unit price to set reasonable invoice price
        $prod_result = mysqli_query($conn, "SELECT unit_price FROM products WHERE id = $product_id");
        $prod_row = mysqli_fetch_assoc($prod_result);
        $base_price = $prod_row['unit_price'];
        $invoice_price = $base_price * 0.7; // Purchase price is 70% of unit price

        $days_ago = rand(0, 30);
        $purchase_date = date('Y-m-d H:i:s', strtotime("-$days_ago days"));

        mysqli_stmt_bind_param($stmt, "iids", $product_id, $quantity, $invoice_price, $purchase_date);
        mysqli_stmt_execute($stmt);
    }

    mysqli_stmt_close($stmt);
}

/**
 * Seed default settings
 */
function seed_settings()
{
    $conn = get_db_connection();

    $default_settings = [
        'store_name' => 'سوبر ماركت الوفاء',
        'store_address' => 'اليمن - صنعاء - شارع الستين',
        'store_phone' => '777123456',
        'invoice_size' => 'thermal', // 'thermal' or 'a4'
        'currency_symbol' => 'ر.ي',
        'tax_number' => '123456789',
        'footer_message' => 'شكراً لزيارتكم .. نأمل رؤيتكم قريباً'
    ];

    foreach ($default_settings as $key => $value) {
        $key_esc = mysqli_real_escape_string($conn, $key);
        $val_esc = mysqli_real_escape_string($conn, $value);
        mysqli_query($conn, "INSERT IGNORE INTO settings (setting_key, setting_value) VALUES ('$key_esc', '$val_esc')");
    }
}


// Initialize database on include
try {
    init_database();
} catch (Exception $e) {
    // Log error but don't stop execution - let the calling code handle it
    error_log("Database initialization error: " . $e->getMessage());
    // Re-throw so api.php can catch it
    throw $e;
}

/**
 * Log a system operation in the telescope table
 */
function log_operation($operation, $table_name, $record_id = null, $old_values = null, $new_values = null)
{
    try {
        $conn = get_db_connection();
        $user_id = $_SESSION['user_id'] ?? null;
        $ip = $_SERVER['REMOTE_ADDR'] ?? null;
        $ua = $_SERVER['HTTP_USER_AGENT'] ?? null;

        $old_json = $old_values ? json_encode($old_values, JSON_UNESCAPED_UNICODE) : null;
        $new_json = $new_values ? json_encode($new_values, JSON_UNESCAPED_UNICODE) : null;

        $sql = "INSERT INTO telescope (user_id, operation, table_name, record_id, old_values, new_values, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
        $stmt = mysqli_prepare($conn, $sql);
        mysqli_stmt_bind_param($stmt, "ississss", $user_id, $operation, $table_name, $record_id, $old_json, $new_json, $ip, $ua);
        mysqli_stmt_execute($stmt);
        mysqli_stmt_close($stmt);
    } catch (Exception $e) {
        error_log("Telescope logging failed: " . $e->getMessage());
    }
}

/**
 * Seed invoices
 */
function seed_invoices()
{
    $conn = get_db_connection();

    $result = mysqli_query($conn, "SELECT COUNT(*) as count FROM invoices");
    $row = mysqli_fetch_assoc($result);

    if ($row['count'] == 0) {
        $result = mysqli_query($conn, "SELECT id, unit_price FROM products LIMIT 5");
        $products = [];
        while ($row = mysqli_fetch_assoc($result)) {
            $products[] = $row;
        }

        if (empty($products)) return;

        // Get admin user
        $user_res = mysqli_query($conn, "SELECT id FROM users LIMIT 1");
        $user_row = mysqli_fetch_assoc($user_res);
        $user_id = $user_row['id'] ?? null;

        for ($i = 0; $i < 3; $i++) {
            $invoice_number = "INV-PREVIEW-" . (1000 + $i);
            $total = 0;
            $items = [];

            // Randomly pick 2 products
            $keys = array_rand($products, 2);
            foreach ($keys as $k) {
                $p = $products[$k];
                $qty = rand(1, 5);
                $subtotal = $qty * $p['unit_price'];
                $total += $subtotal;
                $items[] = [
                    'product_id' => $p['id'],
                    'quantity' => $qty,
                    'unit_price' => $p['unit_price'],
                    'subtotal' => $subtotal
                ];
            }

            mysqli_query($conn, "INSERT INTO invoices (invoice_number, total_amount, user_id) VALUES ('$invoice_number', $total, $user_id)");
            $inv_id = mysqli_insert_id($conn);

            foreach ($items as $item) {
                mysqli_query($conn, "INSERT INTO invoice_items (invoice_id, product_id, quantity, unit_price, subtotal) VALUES ($inv_id, {$item['product_id']}, {$item['quantity']}, {$item['unit_price']}, {$item['subtotal']})");
            }
        }
    }
}

/**
 * Seed Chart of Accounts
 */
function seed_chart_of_accounts()
{
    $conn = get_db_connection();

    $result = mysqli_query($conn, "SELECT COUNT(*) as count FROM chart_of_accounts");
    $row = mysqli_fetch_assoc($result);

    if ($row['count'] == 0) {
        // Define standard chart of accounts structure
        $accounts = [
            // Assets
            ['code' => '1000', 'name' => 'الأصول', 'type' => 'Asset', 'parent_id' => null],
            ['code' => '1100', 'name' => 'الأصول المتداولة', 'type' => 'Asset', 'parent_id' => null], // Will be set after parent
            ['code' => '1110', 'name' => 'النقدية', 'type' => 'Asset', 'parent_id' => null],
            ['code' => '1120', 'name' => 'الذمم المدينة', 'type' => 'Asset', 'parent_id' => null],
            ['code' => '1130', 'name' => 'المخزون', 'type' => 'Asset', 'parent_id' => null],
            ['code' => '1200', 'name' => 'الأصول الثابتة', 'type' => 'Asset', 'parent_id' => null],
            ['code' => '1210', 'name' => 'المعدات', 'type' => 'Asset', 'parent_id' => null],
            ['code' => '1220', 'name' => 'مخصص الإهلاك', 'type' => 'Asset', 'parent_id' => null],

            // Liabilities
            ['code' => '2000', 'name' => 'الخصوم', 'type' => 'Liability', 'parent_id' => null],
            ['code' => '2100', 'name' => 'الخصوم المتداولة', 'type' => 'Liability', 'parent_id' => null],
            ['code' => '2110', 'name' => 'الذمم الدائنة', 'type' => 'Liability', 'parent_id' => null],
            ['code' => '2200', 'name' => 'ضريبة القيمة المضافة', 'type' => 'Liability', 'parent_id' => null],
            ['code' => '2210', 'name' => 'ضريبة القيمة المضافة - مخرجات', 'type' => 'Liability', 'parent_id' => null],
            ['code' => '2220', 'name' => 'ضريبة القيمة المضافة - مدخلات', 'type' => 'Liability', 'parent_id' => null],

            // Equity
            ['code' => '3000', 'name' => 'حقوق الملكية', 'type' => 'Equity', 'parent_id' => null],
            ['code' => '3100', 'name' => 'رأس المال', 'type' => 'Equity', 'parent_id' => null],
            ['code' => '3200', 'name' => 'الأرباح المحتجزة', 'type' => 'Equity', 'parent_id' => null],

            // Revenue
            ['code' => '4000', 'name' => 'الإيرادات', 'type' => 'Revenue', 'parent_id' => null],
            ['code' => '4100', 'name' => 'مبيعات', 'type' => 'Revenue', 'parent_id' => null],
            ['code' => '4200', 'name' => 'إيرادات أخرى', 'type' => 'Revenue', 'parent_id' => null],

            // Expenses
            ['code' => '5000', 'name' => 'المصروفات', 'type' => 'Expense', 'parent_id' => null],
            ['code' => '5100', 'name' => 'تكلفة البضاعة المباعة', 'type' => 'Expense', 'parent_id' => null],
            ['code' => '5200', 'name' => 'المصروفات التشغيلية', 'type' => 'Expense', 'parent_id' => null],
            ['code' => '5210', 'name' => 'إيجار', 'type' => 'Expense', 'parent_id' => null],
            ['code' => '5220', 'name' => 'مرتبات', 'type' => 'Expense', 'parent_id' => null],
            ['code' => '5230', 'name' => 'مرافق', 'type' => 'Expense', 'parent_id' => null],
            ['code' => '5300', 'name' => 'مصروف الإهلاك', 'type' => 'Expense', 'parent_id' => null],
        ];

        // Insert accounts and build parent relationships
        $account_map = [];
        foreach ($accounts as $acc) {
            $code = mysqli_real_escape_string($conn, $acc['code']);
            $name = mysqli_real_escape_string($conn, $acc['name']);
            $type = mysqli_real_escape_string($conn, $acc['type']);

            mysqli_query($conn, "INSERT INTO chart_of_accounts (account_code, account_name, account_type) VALUES ('$code', '$name', '$type')");
            $account_map[$code] = mysqli_insert_id($conn);
        }

        // Update parent relationships
        $parent_relationships = [
            '1100' => '1000',
            '1110' => '1100',
            '1120' => '1100',
            '1130' => '1100',
            '1200' => '1000',
            '1210' => '1200',
            '1220' => '1200',
            '2100' => '2000',
            '2110' => '2100',
            '2200' => '2000',
            '2210' => '2200',
            '2220' => '2200',
            '3100' => '3000',
            '3200' => '3000',
            '4100' => '4000',
            '4200' => '4000',
            '5100' => '5000',
            '5200' => '5000',
            '5210' => '5200',
            '5220' => '5200',
            '5230' => '5200',
            '5300' => '5000',
        ];

        foreach ($parent_relationships as $child_code => $parent_code) {
            if (isset($account_map[$child_code]) && isset($account_map[$parent_code])) {
                $child_id = $account_map[$child_code];
                $parent_id = $account_map[$parent_code];
                mysqli_query($conn, "UPDATE chart_of_accounts SET parent_id = $parent_id WHERE id = $child_id");
            }
        }
    }
}

/**
 * Seed document sequences
 */
function seed_document_sequences()
{
    $conn = get_db_connection();

    $sequences = [
        ['document_type' => 'INV', 'prefix' => 'INV', 'current_number' => 0, 'format' => '{PREFIX}-{NUMBER}'],
        ['document_type' => 'PUR', 'prefix' => 'PUR', 'current_number' => 0, 'format' => '{PREFIX}-{NUMBER}'],
        ['document_type' => 'EXP', 'prefix' => 'EXP', 'current_number' => 0, 'format' => '{PREFIX}-{NUMBER}'],
        ['document_type' => 'REV', 'prefix' => 'REV', 'current_number' => 0, 'format' => '{PREFIX}-{NUMBER}'],
        ['document_type' => 'VOU', 'prefix' => 'VOU', 'current_number' => 0, 'format' => '{PREFIX}-{NUMBER}'],
    ];

    foreach ($sequences as $seq) {
        $type = mysqli_real_escape_string($conn, $seq['document_type']);
        $prefix = mysqli_real_escape_string($conn, $seq['prefix']);
        $number = intval($seq['current_number']);
        $format = mysqli_real_escape_string($conn, $seq['format']);

        mysqli_query($conn, "INSERT IGNORE INTO document_sequences (document_type, prefix, current_number, format) VALUES ('$type', '$prefix', $number, '$format')");
    }
}

/**
 * Seed RBAC Data (Roles, Modules, and Default Permissions)
 */
function seed_rbac()
{
    $conn = get_db_connection();

    // 1. Seed Roles
    $roles = [
        ['admin', 'مدير النظام', 'System Administrator', 'Full system access with all permissions', 1],
        ['manager', 'مدير', 'Manager', 'Business manager with most operational permissions', 1],
        ['accountant', 'محاسب', 'Accountant', 'Financial operations and reporting', 1],
        ['cashier', 'كاشير', 'Cashier', 'Point-of-sale operations only', 1]
    ];

    foreach ($roles as $role) {
        $stmt = mysqli_prepare($conn, "INSERT INTO roles (role_key, role_name_ar, role_name_en, description, is_system) 
                                     VALUES (?, ?, ?, ?, ?) 
                                     ON DUPLICATE KEY UPDATE 
                                     role_name_ar = VALUES(role_name_ar), 
                                     role_name_en = VALUES(role_name_en), 
                                     description = VALUES(description)");
        mysqli_stmt_bind_param($stmt, "ssssi", $role[0], $role[1], $role[2], $role[3], $role[4]);
        mysqli_stmt_execute($stmt);
        mysqli_stmt_close($stmt);
    }

    // 2. Seed Modules
    $modules = [
        ['dashboard', 'لوحة التحكم', 'Dashboard', 'system', 'home', 1],
        ['sales', 'المبيعات', 'Sales', 'sales', 'cart', 10],
        ['revenues', 'الإيرادات الإضافية', 'Additional Revenues', 'sales', 'plus', 11],
        ['products', 'المنتجات', 'Products', 'inventory', 'box', 20],
        ['purchases', 'المشتريات', 'Purchases', 'purchases', 'download', 30],
        ['expenses', 'المصروفات', 'Expenses', 'purchases', 'dollar', 31],
        ['ar_customers', 'العملاء والديون', 'AR Customers', 'people', 'users', 40],
        ['ap_suppliers', 'الموردين', 'AP Suppliers', 'people', 'users', 41],
        ['chart_of_accounts', 'دليل الحسابات', 'Chart of Accounts', 'finance', 'box', 50],
        ['general_ledger', 'دفتر الأستاذ العام', 'General Ledger', 'finance', 'dollar', 51],
        ['journal_vouchers', 'سندات القيد', 'Journal Vouchers', 'finance', 'edit', 52],
        ['fiscal_periods', 'الفترات المالية', 'Fiscal Periods', 'finance', 'dollar', 53],
        ['accrual_accounting', 'المحاسبة الاستحقاقية', 'Accrual Accounting', 'finance', 'dollar', 54],
        ['reconciliation', 'التسوية البنكية', 'Bank Reconciliation', 'finance', 'check', 55],
        ['assets', 'الأصول', 'Fixed Assets', 'finance', 'building', 56],
        ['reports', 'الميزانية والتقارير', 'Reports & Balance Sheet', 'reports', 'eye', 60],
        ['audit_trail', 'سجل التدقيق', 'Audit Trail', 'system', 'eye', 70],
        ['recurring_transactions', 'المعاملات المتكررة', 'Recurring Transactions', 'system', 'check', 71],
        ['batch_processing', 'المعالجة الدفعية', 'Batch Processing', 'system', 'check', 72],
        ['users', 'إدارة المستخدمين', 'User Management', 'system', 'users', 73],
        ['settings', 'الإعدادات', 'Settings', 'system', 'settings', 74],
        ['roles_permissions', 'الأدوار والصلاحيات', 'Roles & Permissions', 'system', 'lock', 75]
    ];

    foreach ($modules as $mod) {
        $stmt = mysqli_prepare($conn, "INSERT INTO modules (module_key, module_name_ar, module_name_en, category, icon, sort_order) 
                                     VALUES (?, ?, ?, ?, ?, ?) 
                                     ON DUPLICATE KEY UPDATE 
                                     module_name_ar = VALUES(module_name_ar), 
                                     module_name_en = VALUES(module_name_en), 
                                     category = VALUES(category), 
                                     icon = VALUES(icon), 
                                     sort_order = VALUES(sort_order)");
        mysqli_stmt_bind_param($stmt, "sssssi", $mod[0], $mod[1], $mod[2], $mod[3], $mod[4], $mod[5]);
        mysqli_stmt_execute($stmt);
        mysqli_stmt_close($stmt);
    }

    // 3. Seed Permissions (Admin Wildcard)
    mysqli_query($conn, "INSERT INTO role_permissions (role_id, module_id, can_view, can_create, can_edit, can_delete)
                        SELECT r.id, m.id, 1, 1, 1, 1 FROM roles r CROSS JOIN modules m WHERE r.role_key = 'admin'
                        ON DUPLICATE KEY UPDATE can_view = 1, can_create = 1, can_edit = 1, can_delete = 1");

    // 4. Seed Manager Permissions
    $manager_perms_sql = "INSERT INTO role_permissions (role_id, module_id, can_view, can_create, can_edit, can_delete)
        SELECT r.id, m.id, 1,
            CASE WHEN m.module_key IN ('fiscal_periods', 'general_ledger', 'reports', 'audit_trail') THEN 0 ELSE 1 END,
            CASE WHEN m.module_key IN ('fiscal_periods', 'general_ledger', 'reports', 'audit_trail', 'journal_vouchers', 'users', 'settings', 'roles_permissions') THEN 0 ELSE 1 END,
            CASE WHEN m.module_key IN ('revenues', 'expenses') THEN 1 ELSE 0 END
        FROM roles r CROSS JOIN modules m WHERE r.role_key = 'manager' AND m.module_key NOT IN ('settings', 'batch_processing', 'roles_permissions')
        ON DUPLICATE KEY UPDATE can_view = VALUES(can_view), can_create = VALUES(can_create), can_edit = VALUES(can_edit), can_delete = VALUES(can_delete)";
    mysqli_query($conn, $manager_perms_sql);

    // 5. Seed Accountant Permissions
    $accountant_perms_sql = "INSERT INTO role_permissions (role_id, module_id, can_view, can_create, can_edit, can_delete)
        SELECT r.id, m.id, 1,
            CASE WHEN m.module_key IN ('products', 'fiscal_periods', 'general_ledger', 'reports', 'audit_trail', 'recurring_transactions') THEN 0 ELSE 1 END,
            CASE WHEN m.module_key IN ('sales', 'products', 'purchases', 'fiscal_periods', 'general_ledger', 'journal_vouchers', 'reports', 'audit_trail', 'recurring_transactions') THEN 0 ELSE 1 END,
            0
        FROM roles r CROSS JOIN modules m WHERE r.role_key = 'accountant' AND m.module_key NOT IN ('users', 'settings', 'batch_processing', 'roles_permissions')
        ON DUPLICATE KEY UPDATE can_view = VALUES(can_view), can_create = VALUES(can_create), can_edit = VALUES(can_edit), can_delete = VALUES(can_delete)";
    mysqli_query($conn, $accountant_perms_sql);

    // 6. Seed Cashier Permissions
    $cashier_perms_sql = "INSERT INTO role_permissions (role_id, module_id, can_view, can_create, can_edit, can_delete)
        SELECT r.id, m.id, 1,
            CASE WHEN m.module_key = 'sales' THEN 1 ELSE 0 END,
            0, 0
        FROM roles r CROSS JOIN modules m WHERE r.role_key = 'cashier' AND m.module_key IN ('dashboard', 'sales', 'products', 'ar_customers')
        ON DUPLICATE KEY UPDATE can_view = VALUES(can_view), can_create = VALUES(can_create), can_edit = VALUES(can_edit), can_delete = VALUES(can_delete)";
    mysqli_query($conn, $cashier_perms_sql);

    // 7. Migration: Sync existing user role strings to role_id
    mysqli_query($conn, "UPDATE users u INNER JOIN roles r ON u.role = r.role_key SET u.role_id = r.id WHERE u.role_id IS NULL");
}
