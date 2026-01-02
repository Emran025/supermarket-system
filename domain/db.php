<?php
require_once 'config.php';

/**
 * Get database connection
 */
function get_db_connection() {
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
function init_database() {
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
    if ($check_result && mysqli_num_rows($check_result) > 0) {
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
    if (mysqli_num_rows($check_users) == 0) {
        mysqli_query($conn, "ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'admin'");
        mysqli_query($conn, "ALTER TABLE users ADD COLUMN is_active TINYINT(1) DEFAULT 1");
    }

    $check_manager = mysqli_query($conn, "SHOW COLUMNS FROM users LIKE 'manager_id'");
    if (mysqli_num_rows($check_manager) == 0) {
        mysqli_query($conn, "ALTER TABLE users ADD COLUMN manager_id INT DEFAULT NULL");
        mysqli_query($conn, "ALTER TABLE users ADD CONSTRAINT fk_user_manager FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL");
    }

    // Check if new columns exist in sessions table
    $check_sessions = mysqli_query($conn, "SHOW COLUMNS FROM sessions LIKE 'ip_address'");
    if (mysqli_num_rows($check_sessions) == 0) {
        mysqli_query($conn, "ALTER TABLE sessions ADD COLUMN ip_address VARCHAR(45)");
        mysqli_query($conn, "ALTER TABLE sessions ADD COLUMN user_agent VARCHAR(255)");
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

    
    // Migrations for existing tables
    // Update products table
    $check_products = mysqli_query($conn, "SHOW COLUMNS FROM products LIKE 'unit_name'");
    if (mysqli_num_rows($check_products) == 0) {
        mysqli_query($conn, "ALTER TABLE products ADD COLUMN unit_name VARCHAR(50) DEFAULT 'كرتون'");
        mysqli_query($conn, "ALTER TABLE products ADD COLUMN items_per_unit INT DEFAULT 1");
        mysqli_query($conn, "ALTER TABLE products ADD COLUMN sub_unit_name VARCHAR(50) DEFAULT 'حبة'");
    }
    
    // Change category to store ID or keep as text but link? 
    // Usually easier to keep as text for simple systems but dropdown from table.
    // Let's keep it as text in products but synced from categories table for now to avoid breaking changes.
    
    // Update purchases table
    $check_purchases = mysqli_query($conn, "SHOW COLUMNS FROM purchases LIKE 'unit_type'");
    if (mysqli_num_rows($check_purchases) == 0) {
        mysqli_query($conn, "ALTER TABLE purchases ADD COLUMN unit_type VARCHAR(20) DEFAULT 'sub'");
    }

    // Add tracking columns to existing tables
    $check_prod_tracking = mysqli_query($conn, "SHOW COLUMNS FROM products LIKE 'created_by'");
    if (mysqli_num_rows($check_prod_tracking) == 0) {
        mysqli_query($conn, "ALTER TABLE products ADD COLUMN created_by INT DEFAULT NULL");
        mysqli_query($conn, "ALTER TABLE products ADD CONSTRAINT fk_products_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL");
    }

    $check_cat_tracking = mysqli_query($conn, "SHOW COLUMNS FROM categories LIKE 'created_by'");
    if (mysqli_num_rows($check_cat_tracking) == 0) {
        mysqli_query($conn, "ALTER TABLE categories ADD COLUMN created_by INT DEFAULT NULL");
        mysqli_query($conn, "ALTER TABLE categories ADD CONSTRAINT fk_categories_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL");
    }

    $check_purch_tracking = mysqli_query($conn, "SHOW COLUMNS FROM purchases LIKE 'user_id'");
    if (mysqli_num_rows($check_purch_tracking) == 0) {
        mysqli_query($conn, "ALTER TABLE purchases ADD COLUMN user_id INT DEFAULT NULL");
        mysqli_query($conn, "ALTER TABLE purchases ADD CONSTRAINT fk_purchases_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL");
    }

    $check_inv_tracking = mysqli_query($conn, "SHOW COLUMNS FROM invoices LIKE 'user_id'");
    if (mysqli_num_rows($check_inv_tracking) == 0) {
        mysqli_query($conn, "ALTER TABLE invoices ADD COLUMN user_id INT DEFAULT NULL");
        mysqli_query($conn, "ALTER TABLE invoices ADD CONSTRAINT fk_invoices_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL");
    }

    $check_user_tracking = mysqli_query($conn, "SHOW COLUMNS FROM users LIKE 'created_by'");
    if (mysqli_num_rows($check_user_tracking) == 0) {
        mysqli_query($conn, "ALTER TABLE users ADD COLUMN created_by INT DEFAULT NULL");
        mysqli_query($conn, "ALTER TABLE users ADD CONSTRAINT fk_users_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL");
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
}

/**
 * Seed default user
 */
function seed_default_user() {
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
        $stmt = mysqli_prepare($conn, "INSERT INTO users (username, password) VALUES (?, ?)");
        if ($stmt) {
            mysqli_stmt_bind_param($stmt, "ss", $username, $password);
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
function seed_products() {
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
function seed_purchases() {
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
function log_operation($operation, $table_name, $record_id = null, $old_values = null, $new_values = null) {
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

?>

