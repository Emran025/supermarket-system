# Database Schema

## Overview

**Database Engine**: MySQL 5.7+ / MariaDB 10.4+

**Storage Engine**: InnoDB

**Character Set**: utf8mb4 (full Unicode support including emojis)

**Key Features**:

- Foreign key constraints for referential integrity
- ACID transactions for financial operations
- JSON column support for flexible data storage
- Automatic timestamps on most tables
- Soft deletes where appropriate

## Schema Initialization

**Auto-Creation**: Database and tables created automatically on first run

**Location**: `domain/db.php::init_database()`

**Migration Strategy**: Incremental column additions (no drop/recreate)

## Core Tables

### 1. `users`

**Purpose**: User accounts with role-based access control

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | INT | PRIMARY KEY, AUTO_INCREMENT | User ID |
| `username` | VARCHAR(50) | UNIQUE, NOT NULL | Login username |
| `password` | VARCHAR(255) | NOT NULL | Bcrypt hashed password |
| `role` | VARCHAR(20) | DEFAULT 'admin' | admin, manager, sales |
| `is_active` | TINYINT(1) | DEFAULT 1 | Account status flag |
| `manager_id` | INT | FOREIGN KEY → users(id) | Supervisor reference |
| `created_by` | INT | FOREIGN KEY → users(id) | Creator reference |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Creation time |

**Indexes**:

- PRIMARY: `id`
- UNIQUE: `username`
- FOREIGN KEY: `manager_id`, `created_by`

**Self-Referencing**: `manager_id` creates hierarchy

### 2. `sessions`

**Purpose**: Active user sessions for authentication

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | INT | PRIMARY KEY, AUTO_INCREMENT | Session ID |
| `user_id` | INT | FOREIGN KEY → users(id), NOT NULL | User reference |
| `session_token` | VARCHAR(64) | UNIQUE, NOT NULL | Secure random token |
| `ip_address` | VARCHAR(45) | | IPv4/IPv6 address |
| `user_agent` | VARCHAR(255) | | Browser identifier |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Session start |
| `expires_at` | DATETIME | NOT NULL | Expiration time |

**Indexes**:

- PRIMARY: `id`
- UNIQUE: `session_token`
- FOREIGN KEY: `user_id` (CASCADE delete)

**Cleanup**: No automatic expiry cleanup (could add cron job)

### 3. `login_attempts`

**Purpose**: Brute-force protection tracking

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | INT | PRIMARY KEY, AUTO_INCREMENT | Record ID |
| `username` | VARCHAR(50) | NOT NULL, INDEX | Username attempted |
| `attempts` | INT | DEFAULT 1 | Failed attempt count |
| `last_attempt` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Last failure time |
| `locked_until` | TIMESTAMP | NULL | Lockout expiration |

**Indexes**:

- PRIMARY: `id`
- INDEX: `username`

**Logic**:

- 5 attempts → locked_until = +15 minutes
- Cleared on successful login

### 4. `products`

**Purpose**: Product catalog with multi-unit support

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | INT | PRIMARY KEY, AUTO_INCREMENT | Product ID |
| `name` | VARCHAR(255) | NOT NULL | Product name |
| `description` | TEXT | | Product description |
| `category` | VARCHAR(100) | | Category name (text, not FK) |
| `unit_price` | DECIMAL(10,2) | DEFAULT 0.00 | Current selling price |
| `minimum_profit_margin` | DECIMAL(10,2) | DEFAULT 0.00 | Min markup amount |
| `stock_quantity` | INT | DEFAULT 0 | Available stock (in sub-units) |
| `unit_name` | VARCHAR(50) | DEFAULT 'كرتون' | Main unit name (e.g., Carton) |
| `items_per_unit` | INT | DEFAULT 1 | Conversion factor |
| `sub_unit_name` | VARCHAR(50) | DEFAULT 'حبة' | Sub-unit name (e.g., Piece) |
| `created_by` | INT | FOREIGN KEY → users(id) | Creator reference |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Creation time |
| `updated_at` | TIMESTAMP | ON UPDATE CURRENT_TIMESTAMP | Last update time |

**Indexes**:

- PRIMARY: `id`
- FOREIGN KEY: `created_by`

**Unit Conversion**: `stock_quantity` always in sub-units

**Example**:

- unit_name = "Carton", items_per_unit = 24, sub_unit_name = "Piece"
- stock_quantity = 240 means 10 cartons or 240 pieces

### 5. `categories`

**Purpose**: Product category lookup

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | INT | PRIMARY KEY, AUTO_INCREMENT | Category ID |
| `name` | VARCHAR(100) | UNIQUE, NOT NULL | Category name |
| `created_by` | INT | FOREIGN KEY → users(id) | Creator reference |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Creation time |

**Usage**: Informational only; products store category as text

### 6. `purchases`

**Purpose**: Stock acquisition records with expiry tracking

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | INT | PRIMARY KEY, AUTO_INCREMENT | Purchase ID |
| `product_id` | INT | FOREIGN KEY → products(id), NOT NULL | Product reference |
| `quantity` | INT | NOT NULL | Quantity purchased |
| `invoice_price` | DECIMAL(10,2) | NOT NULL | Total cost |
| `unit_type` | VARCHAR(20) | DEFAULT 'sub' | 'main' or 'sub' |
| `production_date` | DATE | NULL | Manufacturing date |
| `expiry_date` | DATE | NULL | Expiration date |
| `user_id` | INT | FOREIGN KEY → users(id) | Purchaser reference |
| `purchase_date` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Purchase time |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Record creation |

**Indexes**:

- PRIMARY: `id`
- FOREIGN KEY: `product_id` (CASCADE), `user_id`

**Price Calculation**:

```batch
actual_qty = (unit_type == 'main') ? quantity * items_per_unit : quantity
price_per_item = invoice_price / actual_qty
new_unit_price = price_per_item + minimum_profit_margin
```

### 7. `purchase_requests`

**Purpose**: Purchase requisition workflow

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | INT | PRIMARY KEY, AUTO_INCREMENT | Request ID |
| `product_id` | INT | NULL | Existing product reference |
| `product_name` | VARCHAR(255) | NULL | New product name |
| `quantity` | INT | DEFAULT 1 | Requested quantity |
| `user_id` | INT | FOREIGN KEY → users(id) | Requester reference |
| `status` | VARCHAR(50) | DEFAULT 'pending' | pending, approved, rejected |
| `notes` | TEXT | | Additional comments |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Request time |
| `updated_at` | DATETIME | ON UPDATE CURRENT_TIMESTAMP | Status update time |

**Logic**: Either `product_id` OR `product_name` must be provided

### 8. `invoices`

**Purpose**: Sales transaction headers

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | INT | PRIMARY KEY, AUTO_INCREMENT | Invoice ID |
| `invoice_number` | VARCHAR(50) | UNIQUE, NOT NULL | Display number |
| `total_amount` | DECIMAL(10,2) | NOT NULL | Grand total |
| `payment_type` | VARCHAR(20) | DEFAULT 'cash' | 'cash' or 'credit' |
| `customer_id` | INT | FOREIGN KEY → ar_customers(id) | AR customer (credit only) |
| `amount_paid` | DECIMAL(10,2) | DEFAULT 0.00 | Partial payment amount |
| `user_id` | INT | FOREIGN KEY → users(id) | Salesperson reference |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Sale time |
| `updated_at` | TIMESTAMP | ON UPDATE CURRENT_TIMESTAMP | Last update |

**Indexes**:

- PRIMARY: `id`
- UNIQUE: `invoice_number`
- FOREIGN KEY: `customer_id`, `user_id`

**Invoice Number Format**: Usually "INV-{sequential_number}"

### 9. `invoice_items`

**Purpose**: Sales transaction line items

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | INT | PRIMARY KEY, AUTO_INCREMENT | Line item ID |
| `invoice_id` | INT | FOREIGN KEY → invoices(id), NOT NULL | Invoice reference |
| `product_id` | INT | FOREIGN KEY → products(id), NOT NULL | Product reference |
| `quantity` | INT | NOT NULL | Quantity sold |
| `unit_price` | DECIMAL(10,2) | NOT NULL | Price at sale time |
| `subtotal` | DECIMAL(10,2) | NOT NULL | quantity × unit_price |

**Indexes**:

- PRIMARY: `id`
- FOREIGN KEY: `invoice_id` (CASCADE), `product_id` (CASCADE)

**Denormalized**: `unit_price` snapshot ensures historical accuracy

## Financial Tables

### 10. `ar_customers`

**Purpose**: Credit customer profiles

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | INT | PRIMARY KEY, AUTO_INCREMENT | Customer ID |
| `name` | VARCHAR(255) | NOT NULL | Customer name |
| `phone` | VARCHAR(50) | | Contact number |
| `email` | VARCHAR(255) | | Email address |
| `address` | TEXT | | Physical address |
| `tax_number` | VARCHAR(50) | | Tax registration number |
| `current_balance` | DECIMAL(10,2) | DEFAULT 0.00 | Outstanding debt |
| `created_by` | INT | FOREIGN KEY → users(id) | Creator reference |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Creation time |
| `updated_at` | TIMESTAMP | ON UPDATE CURRENT_TIMESTAMP | Last update |

**Indexes**:

- PRIMARY: `id`
- FOREIGN KEY: `created_by`

**Balance Calculation**: Auto-updated from `ar_transactions` ledger

### 11. `ar_transactions`

**Purpose**: Accounts receivable ledger (double-entry style)

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | INT | PRIMARY KEY, AUTO_INCREMENT | Transaction ID |
| `customer_id` | INT | FOREIGN KEY → ar_customers(id), NOT NULL | Customer reference |
| `type` | VARCHAR(20) | NOT NULL | 'invoice', 'payment', 'return' |
| `amount` | DECIMAL(10,2) | NOT NULL | Transaction amount |
| `description` | TEXT | | Transaction details |
| `reference_type` | VARCHAR(50) | | Source table (e.g., 'invoices') |
| `reference_id` | INT | | Source record ID |
| `transaction_date` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Transaction time |
| `created_by` | INT | FOREIGN KEY → users(id) | User who recorded |
| `is_deleted` | TINYINT(1) | DEFAULT 0 | Soft delete flag |
| `deleted_at` | TIMESTAMP | NULL | Deletion time |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Record creation |

**Indexes**:

- PRIMARY: `id`
- FOREIGN KEY: `customer_id` (CASCADE), `created_by`

**Balance Logic**:

```sql
current_balance = 
  SUM(amount WHERE type='invoice' AND is_deleted=0) -
  SUM(amount WHERE type IN ('payment','return') AND is_deleted=0)
```

### 12. `expenses`

**Purpose**: Business expense tracking

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | INT | PRIMARY KEY, AUTO_INCREMENT | Expense ID |
| `category` | VARCHAR(100) | NOT NULL | Expense category |
| `amount` | DECIMAL(10,2) | NOT NULL | Expense amount |
| `expense_date` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Expense date |
| `description` | TEXT | | Expense details |
| `user_id` | INT | FOREIGN KEY → users(id) | Recorder reference |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Record creation |
| `updated_at` | TIMESTAMP | ON UPDATE CURRENT_TIMESTAMP | Last update |

**Common Categories**: Rent, Utilities, Salaries, Maintenance, Supplies

### 13. `assets`

**Purpose**: Fixed asset registry

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | INT | PRIMARY KEY, AUTO_INCREMENT | Asset ID |
| `name` | VARCHAR(255) | NOT NULL | Asset name |
| `value` | DECIMAL(12,2) | NOT NULL | Purchase value |
| `purchase_date` | DATE | NOT NULL | Acquisition date |
| `depreciation_rate` | DECIMAL(5,2) | DEFAULT 0.00 | Annual depreciation % |
| `description` | TEXT | | Asset details |
| `status` | VARCHAR(50) | DEFAULT 'active' | 'active' or 'disposed' |
| `created_by` | INT | FOREIGN KEY → users(id) | Recorder reference |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Record creation |
| `updated_at` | TIMESTAMP | ON UPDATE CURRENT_TIMESTAMP | Last update |

**Note**: Depreciation calculated externally; not auto-computed

### 14. `revenues`

**Purpose**: Non-POS cash revenue tracking

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | INT | PRIMARY KEY, AUTO_INCREMENT | Revenue ID |
| `source` | VARCHAR(255) | NOT NULL | Revenue source |
| `amount` | DECIMAL(12,2) | NOT NULL | Revenue amount |
| `revenue_date` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Revenue date |
| `description` | TEXT | | Revenue details |
| `user_id` | INT | FOREIGN KEY → users(id) | Recorder reference |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Record creation |
| `updated_at` | TIMESTAMP | ON UPDATE CURRENT_TIMESTAMP | Last update |

## System Tables

### 15. `telescope`

**Purpose**: Audit log for all database mutations

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | INT | PRIMARY KEY, AUTO_INCREMENT | Log entry ID |
| `user_id` | INT | FOREIGN KEY → users(id) | User who performed action |
| `operation` | VARCHAR(20) | NOT NULL | 'CREATE', 'UPDATE', 'DELETE' |
| `table_name` | VARCHAR(50) | NOT NULL | Affected table |
| `record_id` | INT | | Affected record ID |
| `old_values` | JSON | | Before snapshot |
| `new_values` | JSON | | After snapshot |
| `ip_address` | VARCHAR(45) | | Client IP |
| `user_agent` | VARCHAR(255) | | Client browser |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Log time |

**Indexes**:

- PRIMARY: `id`
- FOREIGN KEY: `user_id`

**JSON Example**:

```json
{
  "old_values": {"stock_quantity": 100},
  "new_values": {"stock_quantity": 95}
}
```

### 16. `settings`

**Purpose**: Application configuration key-value store

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `setting_key` | VARCHAR(50) | PRIMARY KEY | Setting name |
| `setting_value` | TEXT | | Setting value |
| `updated_at` | TIMESTAMP | ON UPDATE CURRENT_TIMESTAMP | Last update |

**Default Settings**:

- `store_name`: "سوبر ماركت الوفاء"
- `store_address`: "اليمن - صنعاء - شارع الستين"
- `store_phone`: "777123456"
- `tax_number`: "123456789"
- `currency_symbol`: "ر.ي"
- `invoice_size`: "thermal"
- `footer_message`: "شكراً لزيارتكم .. نأمل رؤيتكم قريباً"

## Relationships Summary

```batch
users (1) ──< (N) sessions
users (1) ──< (N) products
users (1) ──< (N) purchases
users (1) ──< (N) invoices
users (1) ──< (N) ar_customers
users (1) ──< (N) expenses
users (1) ──< (N) assets
users (1) ──< (N) revenues
users (1) ──< (N) telescope

users (recursive) manager_id → users.id
users (recursive) created_by → users.id

products (1) ──< (N) purchases
products (1) ──< (N) invoice_items
products (1) ──< (N) purchase_requests (optional)

invoices (1) ──< (N) invoice_items
invoices (N) ──> (1) ar_customers (optional, credit only)

ar_customers (1) ──< (N) ar_transactions
ar_customers (1) ──< (N) invoices
```

## Storage Estimates

**Typical Row Sizes** (approx.):

- users: 200 bytes
- products: 400 bytes
- purchases: 150 bytes
- invoices: 150 bytes
- invoice_items: 80 bytes
- ar_transactions: 200 bytes
- telescope: 300-1000 bytes (JSON varies)

**Growth Projection** (1 year, 1000 sales/month):

- invoices: 12,000 rows × 150B ≈ 1.8 MB
- invoice_items: 36,000 rows × 80B ≈ 2.9 MB
- telescope: 50,000 rows × 500B ≈ 25 MB

**Total**: <100 MB for first year (manageable)

## Backup Strategy

**Current**: Manual mysqldump

**Recommended**: Daily automated backups with retention policy

**Command**:

```bash
mysqldump -u user -p database_name > backup_$(date +%F).sql
```

## Performance Optimization

**Indexes Present**:

- All primary keys (clustered)
- Foreign keys (non-clustered)
- Unique constraints (username, session_token, invoice_number)

**Missing Indexes** (could add):

- `products (category)` - For category filtering
- `purchases (product_id, purchase_date)` - For recent purchase lookups
- `telescope (table_name, created_at)` - For audit queries

**Query Optimization**:

- Use LIMIT on large table scans
- Avoid SELECT * (already implemented in controllers)
- Use transactions for multi-step operations (already implemented)

## Schema Evolution

**Migration Pattern**:

```php
// Check if column exists
$check = mysqli_query($conn, "SHOW COLUMNS FROM users LIKE 'new_column'");
if (mysqli_num_rows($check) == 0) {
    mysqli_query($conn, "ALTER TABLE users ADD COLUMN new_column VARCHAR(50)");
}
```

**No Rollback**: Once added, columns not removed automatically

**Breaking Changes**: Handled manually (rename column approach)
