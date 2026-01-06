# Backend Documentation

## Implementation

### Technology Stack

- **Language**: PHP 7.4+
- **Database Driver**: MySQLi (procedural and OOP)
- **Pattern**: MVC Controllers with Router
- **Authentication**: Session-based
- **Error Handling**: Try-catch with transactions

### Entry Point: `api.php`

All API requests route through this single file:

1. **Error handling setup**: Registers shutdown function for fatal errors
2. **Dependency loading**: Includes config, db, auth, and all controllers
3. **CORS configuration**: Allows credentials from specified origins
4. **Session initialization**: Starts session via `start_session()`
5. **Router setup**: Registers all action→controller mappings
6. **Dispatch**: Routes request to appropriate controller

### Registered Routes

```php
// Authentication
'login' => AuthController
'logout' => AuthController
'check' => AuthController

// Catalog
'products' => ProductsController
'categories' => CategoriesController

// Procurement
'purchases' => PurchasesController
'requests' => PurchasesController (purchase requests)

// Sales
'invoices' => SalesController
'invoice_details' => SalesController

// Financial
'expenses' => ExpensesController
'assets' => AssetsController
'revenues' => RevenuesController
'balance_sheet' => ReportsController

// AR
'ar_customers' => ArController
'ar_ledger' => ArController

// System
'users' => Users Controller
'change_password' => UsersController
'my_sessions' => UsersController
'manager_list' => UsersController
'dashboard' => DashboardController
'settings' => SettingsController
```

## Controller Details

### Base Controller (`api/Controller.php`)

Abstract class providing common functionality:

**Properties**:

- `$conn`: Database connection (from `get_db_connection()`)

**Methods**:

```php
protected function getJsonInput(): array
    // Decodes JSON request body

protected function successResponse(array $data = [], int $code = 200): void
    // Outputs {"success": true, ...} and exits

protected function errorResponse(string $message, int $code = 400): void
    // Outputs {"success": false, "message": ...} and exits

protected function getPaginationParams(): array
    // Extracts page, per_page from query string
    // Returns ['page', 'limit', 'offset']

protected function paginatedResponse(array $items, int $total, int $page, int $limit): void
    // Outputs data with pagination metadata
```

### ProductsController

**Routes by HTTP Method**:

- `GET`: Retrieve products with search and pagination
- `POST`: Create new product
- `PUT`: Update existing product
- `DELETE`: Remove product

**Key Logic**:

- Search supports: name, category, description, ID
- Optional `include_purchase_price` query param fetches latest purchase cost
- Stores user who created product (`created_by`)

**Fields**:

- name, description, category
- unit_price, minimum_profit_margin, stock_quantity
- unit_name, items_per_unit, sub_unit_name

### SalesController (Invoices)

**Methods**:

- `GET`: List invoices (supports customer_id filter for AR)
- `POST`: Create invoice with items
- `DELETE`: Revoke invoice (restores stock, reverses AR transactions)
- `getInvoiceDetails()`: Returns invoice with line items

**Create Invoice Logic**:

1. Validate items and stock
2. Begin transaction
3. Calculate total
4. Insert invoice record
5. **If credit sale**:
   - Insert AR transaction (type=invoice)
   - If partial payment: Insert AR transaction (type=payment)
   - Update customer balance
6. Insert invoice items
7. Deduct stock from products
8. Commit transaction
9. Log to telescope

**DELETE Invoice Logic**:

1. Fetch invoice details
2. **If credit sale**: Mark AR transactions as deleted
3. Restore stock to products
4. Delete invoice_items
5. Delete invoice
6. Log to telescope

### PurchasesController

**Handles Two Actions**:

1. **purchases**: Direct stock purchases
2. **requests**: Purchase request workflow

**Create Purchase Logic**:

1. Get product details (items_per_unit, minimum_profit_margin)
2. Convert quantity to sub-units if unit_type='main'
3. Calculate price per item (total cost / quantity)
4. Calculate new selling price (cost + margin)
5. Begin transaction
6. Insert purchase record (with production/expiry dates)
7. Update product: stock += quantity, unit_price = new_price
8. Commit and log

**Purchase Requests**:

- Staff creates request (pending status)
- Manager can approve/reject
- Approved requests can be converted to actual purchases

### ArController

**Two Sub-Actions**:

1. **ar_customers**: Customer CRUD
2. **ar_ledger**: Transaction ledger

**Customer Management**:

- Fields: name, phone, email, address, tax_number
- `current_balance` automatically calculated from ledger

**Ledger Transactions**:

- Types: 'invoice' (debit), 'payment' (credit), 'return' (credit)
- Soft deletes via `is_deleted` flag
- `reference_type` and `reference_id` link to source documents

**Balance Calculation** (`updateCustomerBalance`):

```sql
debit = SUM(amount WHERE type='invoice' AND is_deleted=0)
credit = SUM(amount WHERE type IN ('payment','return') AND is_deleted=0)
current_balance = debit - credit
```

### ExpensesController, AssetsController, RevenuesController

Standard CRUD controllers with similar patterns:

**GET**: List with search, pagination
**POST**: Create record (user_id tracked)
**PUT**: Update record
**DELETE**: Remove record

**Assets Specific**:

- `depreciation_rate` field
- `status` field (active/disposed)

### ReportsController

**Single Action**: `balance_sheet`

**Calculations**:

```php
// Assets
cash_estimate = (sales + revenues) - (purchases + expenses)
stock_value = SUM(unit_price * stock_quantity)
fixed_assets = SUM(value WHERE status='active')
accounts_receivable = SUM(current_balance FROM ar_customers)

// Income Statement
total_sales = SUM(invoices.total_amount)
other_revenues = SUM(revenues.amount)
total_purchases = SUM(purchases.invoice_price)
total_expenses = SUM(expenses.amount)
net_profit = (sales + revenues) - (purchases + expenses)
```

**Note**: Uses simplified cash accounting with inventory adjustment

### UsersController

**Methods**:

- `GET`: List all users (Admin only)
- `POST`: Create user (Admin/Manager)
- `PUT`: Update user or change password
- `DELETE`: Remove user
- `manager_list`: Returns users with role='manager' for dropdowns
- `my_sessions`: Returns active sessions for logged-in user

**User Creation**:

- Password hashed with `password_hash()`
- `created_by` tracks who created the account
- `manager_id` enables hierarchical structure

### DashboardController

**Aggregates**:

- Today's sales total
- Low stock products (stock_quantity < 10)
- Recent invoices
- Products nearing expiry (expiry_date < 30 days)
- Pending purchase requests

**Returns**: JSON object with all metrics

### SettingsController

**GET**: Returns all settings as key-value pairs
**POST**: Updates multiple settings

**Settings**:

- store_name, store_address, store_phone
- tax_number, currency_symbol
- invoice_size (thermal/a4)
- footer_message

### AuthController

**Actions**:

- `login`: Validates credentials, creates session token
- `logout`: Destroys session
- `check`: Verifies if user is logged in

**Login Process**:

1. Check for locked account (login_attempts table)
2. Verify username/password
3. Generate secure session token
4. Store in sessions table with expiry
5. Set cookie
6. Clear login_attempts on success

## Authentication Helpers (`auth.php`)

```php
function start_session(): void
    // Starts PHP session with secure settings

function is_logged_in(): bool
    // Checks if valid session exists via token

function create_session(int $user_id): string
    // Creates session record, returns token

function validate_session(string $token): array|null
    // Returns user data if token valid

function destroy_session(): void
    // Removes session record and PHP session
```

## Database Helpers (`db.php`)

```php
function get_db_connection(): mysqli
    // Singleton connection to database

function init_database(): void
    // Creates all tables if not exist
    // Runs migrations (ALTER TABLE for new columns)
    // Seeds default data

function log_operation(string $op, string $table, int $id, $old, $new): void
    // Inserts audit record in telescope table
```

**Audit Log Structure**:

```php
[
    'user_id' => $_SESSION['user_id'],
    'operation' => 'CREATE|UPDATE|DELETE',
    'table_name' => 'products',
    'record_id' => 123,
    'old_values' => {...}, // JSON
    'new_values' => {...}, // JSON
    'ip_address' => $_SERVER['REMOTE_ADDR'],
    'user_agent' => $_SERVER['HTTP_USER_AGENT']
]
```

## Database Initialization

**Tables Created**:

1. users
2. sessions
3. login_attempts
4. products
5. categories
6. purchases
7. purchase_requests
8. invoices
9. invoice_items
10. ar_customers
11. ar_transactions
12. expenses
13. assets
14. revenues
15. telescope
16. settings

**Migrations**:

- Checks for missing columns
- Adds columns without dropping table
- No down migrations

**Seeding**:

- Default admin user (admin/admin123)
- 100 sample products across 10 categories
- 50 purchase records
- 3 sample invoices
- Default settings

## Transaction Management

**Pattern**:

```php
mysqli_begin_transaction($conn);

try {
    // Multiple SQL operations
    // If error thrown, automatically rollback
    mysqli_commit($conn);
} catch (Exception $e) {
    mysqli_rollback($conn);
    throw $e;
}
```

**Used In**:

- Invoice creation (invoice + items + stock update + AR)
- Invoice deletion (stock restore + AR reverse + delete)
- Purchase creation (purchase + stock/price update)

## Error Responses

**Format**:

```json
{
  "success": false,
  "message": "Descriptive error message"
}
```

**Status Codes**:

- 400: Validation error (empty fields, insufficient stock)
- 401: Not logged in
- 403: Insufficient permissions
- 404: Resource not found
- 500: Server/database error

## Security Measures

### SQL Injection Prevention

1. **Prepared statements** for all user input in WHERE clauses
2. **mysqli_real_escape_string()** for dynamic column names
3. **Type casting** (intval, floatval) for numeric parameters

### Authentication

1. Session token stored in httpOnly cookie
2. Token validated on every protected request
3. Brute-force protection (5 attempts = 15-minute lockout)
4. Password hashing with bcrypt (PASSWORD_DEFAULT)

### Authorization

- Checked in controller methods
- User role stored in session
- Admin-only endpoints return 403 for non-admin

### Audit Trail

- All CREATE/UPDATE/DELETE logged
- Immutable (no delete from telescope)
- Includes user context and IP

## Performance Considerations

**Current Bottlenecks**:

- No query result caching
- N+1 queries in some LIST operations (e.g., products with creator name)
- Telescope insertion on every mutation (minimal overhead but accumulates)

**Optimizations Present**:

- Pagination on all list endpoints
- Indexes on primary/foreign keys (via InnoDB)
- Single database connection per request

## Testing

**Current State**: No automated tests

**Manual Testing Path**:

1. Use Postman/curl to hit `api.php?action=products`
2. Check browser console for frontend requests
3. Inspect telescope table for operation logs
4. Check PHP error_log for exceptions

## Deployment Notes

**Requirements**:

- PHP mysqli extension enabled
- MySQL user with CREATE DATABASE privilege (first run)
- Writable session directory

**Environment Variables**: None (all in config.php)

**Database Migrations**: Automatic on page load (init_database() called in db.php)

**Production Checklist**:

- Change default admin password
- Set `display_errors=0` in php.ini
- Use HTTPS
- Restrict api.php to authenticated requests only
- Add indexes to frequently queried columns
- Archive old telescope entries
