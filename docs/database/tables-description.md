# Table Descriptions

## Core Business Tables

### users

**Purpose**: User authentication and role-based access control

**Key Columns**:

- `role`: Defines permissions (admin > manager > sales)
- `manager_id`: Creates hierarchical reporting structure
- `is_active`: Allows disabling accounts without deletion

**Business Logic**:

- Passwords hashed with bcrypt (minimum 8 characters recommended)
- Username uniqueness enforced at database level
- Self-referencing for org chart (sales → manager → admin)

**Use Cases**:

- Login authentication
- Permission checks in controllers
- Audit attribution (created_by fields)

---

### products

**Purpose**: Product master catalog with multi-unit inventory tracking

**Key Columns**:

- `unit_price`: Current selling price (updated on purchase)
- `minimum_profit_margin`: Enforced markup amount
- `stock_quantity`: Always stored in sub-units (e.g., pieces)
- `items_per_unit`: Conversion factor (e.g., 24 pieces per carton)

**Business Logic**:

- Unit conversion: 1 carton of 24 pieces = 24 stock_quantity
- Price calculation: `new_price = (purchase_cost / qty) + minimum_profit_margin`
- Stock updates:
  - Purchase: stock += quantity
  - Sale: stock -= quantity

**Use Cases**:

- POS product lookup
- Inventory valuation (stock_quantity × unit_price)
- Purchase price calculation

---

### purchases

**Purpose**: Stock acquisition history with cost tracking and expiry management

**Key Columns**:

- `invoice_price`: Total cost of purchase (not per-unit)
- `unit_type`: Specifies if quantity is in 'main' (carton) or 'sub' (piece)
- `production_date` / `expiry_date`: Quality control and FEFO tracking

**Business Logic**:

- Actual quantity = (`unit_type` == 'main') ? `quantity` × `items_per_unit` : `quantity`
- Price per item = `invoice_price` / actual_quantity
- Triggers product price update on insert

**Use Cases**:

- Latest cost lookup for pricing
- Expiry alerts (dashboard query: `expiry_date` < NOW() + 30 days)
- Purchase history reporting

---

### invoices

**Purpose**: Sales transaction headers

**Key Columns**:

- `invoice_number`: User-facing unique identifier (e.g., "INV-1001")
- `payment_type`: 'cash' (immediate) or 'credit' (deferred)
- `customer_id`: Required only when payment_type = 'credit'
- `amount_paid`: Supports partial payments on credit sales

**Business Logic**:

- Cash: customer_id = NULL, amount_paid = 0
- Credit: customer_id set, creates AR transactions
- Total calculated as SUM(invoice_items.subtotal)

**Use Cases**:

- Sales reporting (daily/monthly totals)
- AR filtering (invoices for specific customer)
- Print receipt generation

---

### invoice_items

**Purpose**: Line-level detail for sales transactions

**Key Columns**:

- `unit_price`: **Snapshot** price at sale time (not current product.unit_price)
- `subtotal`: Precomputed quantity × unit_price

**Business Logic**:

- Denormalized price for historical accuracy
- Cascade delete when invoice deleted
- Used to restore stock on invoice reversal

**Use Cases**:

- Receipt printing (itemized list)
- Product sales analysis
- Stock deduction tracking

---

## Financial Tables

### ar_customers

**Purpose**: Credit customer profiles with balance tracking

**Key Columns**:

- `current_balance`: Outstanding debt (auto-calculated from ledger)
- `tax_number`: For invoicing compliance

**Business Logic**:

- Balance updated after every ar_transaction change
- Balance = SUM(debit) - SUM(credit) from ar_transactions
- Cannot delete customer with non-zero balance (soft constraint)

**Use Cases**:

- Customer lookup for credit sales
- Aging report (customers with balance > 0)
- Credit limit checks (application-level)

---

### ar_transactions

**Purpose**: Double-entry ledger for customer debt tracking

**Key Columns**:

- `type`: 'invoice' (debit), 'payment' (credit), 'return' (credit)
- `reference_type` / `reference_id`: Links to source document
- `is_deleted`: Soft delete for correction without losing history

**Business Logic**:

- Invoice: Increases customer balance
- Payment/Return: Decreases customer balance
- Soft delete: Excluded from balance calculation
- Restore: Reincluded in balance calculation

**Use Cases**:

- Customer ledger/statement
- Payment recording
- Balance reconciliation

---

### expenses

**Purpose**: Operating expense tracking with Chart of Accounts integration

**Key Columns**:

- `category`: Free-text categorization (Rent, Utilities, Payroll, etc.)
- `account_code`: **FIN-003** - Chart of Accounts code (links to chart_of_accounts table)
- `expense_date`: Allows backdating for accurate period reporting

**Business Logic**:

- **FIN-003**: Must reference valid Chart of Accounts code of type 'Expense'
- Posts to General Ledger with double-entry accounting:
  - Debit: Expense account (from account_code)
  - Credit: Cash account (1110)
- Generates voucher number for audit trail
- Default account_code: '5200' (Operating Expenses parent)

**Use Cases**:

- Expense report by category and account
- Monthly/quarterly expense totals by COA account
- Net profit calculation (revenue - expenses)
- Financial statement generation from GL

---

### assets

**Purpose**: Fixed asset register with automated depreciation

**Key Columns**:

- `depreciation_rate`: Annual percentage (e.g., 10.00 = 10% per year)
- `status`: 'active' (in use) or 'disposed' (sold/discarded)

**Business Logic**:

- **ALM-003**: Automated depreciation via `DepreciationService`
- Posts to General Ledger on creation:
  - Debit: Fixed Assets (1210)
  - Credit: Cash (1110) or Accounts Payable (2110)
- Monthly depreciation calculated automatically:
  - Debit: Depreciation Expense (5300)
  - Credit: Accumulated Depreciation (1220)
- Only 'active' assets included in balance sheet
- Book value = `value` - (accumulated depreciation from asset_depreciation table)

**Use Cases**:

- Asset inventory
- Automated depreciation schedule
- Balance sheet fixed assets line (at book value)
- Depreciation expense tracking in income statement

---

### revenues

**Purpose**: Non-POS cash inflows

**Key Columns**:

- `source`: Description of revenue origin (e.g., "Scrap Sales", "Commission Income")

**Business Logic**:

- Separate from invoices (invoices tracked in `invoices` table)
- Adds to cash in balance sheet

**Use Cases**:

- Miscellaneous income tracking
- Total revenue calculation (invoice + revenues)

---

### chart_of_accounts

**Purpose**: **FIN-003** - Hierarchical Chart of Accounts for double-entry accounting

**Key Columns**:

- `account_code`: Unique code (e.g., '1110', '5200')
- `account_name`: Account name in Arabic/English
- `account_type`: Asset, Liability, Equity, Revenue, Expense
- `parent_id`: Parent account for hierarchical structure
- `is_active`: Soft delete flag

**Business Logic**:

- Hierarchical structure (parent-child relationships)
- Used by ExpensesController and other financial modules
- Accounts with GL entries cannot be hard-deleted (soft-deleted instead)
- Validates account type when used in transactions

**Use Cases**:

- Expense categorization (replaces hardcoded categories)
- Financial statement generation
- Account balance queries
- Trial balance preparation

---

### general_ledger

**Purpose**: **FIN-001, FIN-002** - Central double-entry accounting ledger

**Key Columns**:

- `voucher_number`: Unique document identifier (TAX-002)
- `voucher_date`: Transaction date
- `account_id`: Foreign key to chart_of_accounts
- `entry_type`: 'DEBIT' or 'CREDIT'
- `amount`: Transaction amount
- `reference_type` / `reference_id`: Links to source document (invoices, purchases, etc.)
- `fiscal_period_id`: Links to fiscal period
- `is_closed`: Prevents modification after period closing

**Business Logic**:

- **FIN-002**: Every transaction must have balanced debits and credits
- All financial events (sales, purchases, expenses, revenues) post to GL
- Account balances calculated from GL entries
- Closed periods cannot be modified (FIN-004)

**Use Cases**:

- Trial balance generation
- Financial statement preparation
- Account reconciliation
- Audit trail

---

### fiscal_periods

**Purpose**: **FIN-004** - Fiscal period management and closing

**Key Columns**:

- `period_name`: Human-readable name (e.g., "January 2026")
- `start_date` / `end_date`: Period boundaries
- `is_closed`: Lock flag
- `closed_at` / `closed_by`: Closing audit trail

**Business Logic**:

- When closed, all GL entries in period marked as `is_closed = 1`
- Closing entries transfer net income to Retained Earnings
- Closed periods prevent retroactive modifications
- Supports monthly, quarterly, or annual periods

**Use Cases**:

- Period-based reporting
- Financial finality and audit integrity
- Year-end closing procedures

---

### inventory_costing

**Purpose**: **INV-001** - COGS tracking with FIFO/Weighted Average methods

**Key Columns**:

- `product_id`: Product reference
- `purchase_id`: Source purchase record
- `quantity`: Units in this batch
- `unit_cost`: Cost per unit
- `total_cost`: Total batch cost
- `costing_method`: 'FIFO' or 'WEIGHTED_AVG'
- `is_sold`: Flag indicating if batch has been sold
- `sold_at`: Timestamp when sold

**Business Logic**:

- **INV-001**: COGS calculated when item sold (not when purchased)
- FIFO: Oldest inventory sold first
- Weighted Average: Average cost of all unsold inventory
- Only unsold inventory (`is_sold = 0`) included in inventory valuation

**Use Cases**:

- Accurate COGS calculation
- Inventory valuation at cost
- Gross profit margin analysis

---

### asset_depreciation

**Purpose**: **ALM-003** - Automated depreciation tracking

**Key Columns**:

- `asset_id`: Asset reference
- `depreciation_date`: Date of depreciation entry
- `depreciation_amount`: Monthly depreciation amount
- `accumulated_depreciation`: Running total
- `book_value`: Asset value after depreciation
- `fiscal_period_id`: Links to fiscal period

**Business Logic**:

- Created automatically by DepreciationService
- Monthly depreciation = (purchase_value × annual_rate) / 12
- Accumulated depreciation never exceeds purchase value
- Posts to General Ledger:
  - Debit: Depreciation Expense (5300)
  - Credit: Accumulated Depreciation (1220)

**Use Cases**:

- Depreciation schedule
- Book value calculation
- Income statement depreciation expense

---

### document_sequences

**Purpose**: **TAX-002** - Voucher number generation

**Key Columns**:

- `document_type`: 'INV', 'PUR', 'EXP', 'REV', 'VOU'
- `prefix`: Prefix for voucher number
- `current_number`: Last used sequence number
- `format`: Template (e.g., '{PREFIX}-{NUMBER}')

**Business Logic**:

- Thread-safe sequence generation (FOR UPDATE lock)
- Auto-increments on each use
- Format: '{PREFIX}-{NUMBER}' (e.g., 'INV-000001')
- Prevents duplicate voucher numbers

**Use Cases**:

- Invoice numbering
- Purchase order numbering
- Audit trail document references

---

### ap_suppliers

**Purpose**: **ALM-002** - Accounts Payable supplier management

**Key Columns**:

- `name`, `phone`, `email`, `address`, `tax_number`
- `credit_limit`: Maximum credit allowed
- `payment_terms`: Days until payment due (default: 30)
- `current_balance`: Outstanding debt (auto-calculated)

**Business Logic**:

- Balance calculated from ap_transactions
- Supports credit purchases (payment_type = 'credit')
- Links to purchases via supplier_id

**Use Cases**:

- Supplier relationship management
- Payment scheduling
- Aging reports

---

### ap_transactions

**Purpose**: **ALM-002** - Accounts Payable transaction ledger

**Key Columns**:

- `supplier_id`: Supplier reference
- `type`: 'invoice' (credit), 'payment' (debit), 'return' (debit)
- `amount`: Transaction amount
- `reference_type` / `reference_id`: Links to purchases table
- `is_deleted`: Soft delete flag

**Business Logic**:

- Invoice: Increases supplier balance (credit purchase)
- Payment: Decreases supplier balance
- Soft delete for corrections
- Balance = SUM(invoices) - SUM(payments)

**Use Cases**:

- Supplier ledger/statement
- Payment recording
- Balance reconciliation

---

## System Tables

### sessions

**Purpose**: Active authentication tokens

**Key Columns**:

- `session_token`: 64-character random hex string
- `expires_at`: DATETIME (not TIMESTAMP, to avoid 2038 problem)

**Business Logic**:

- Created on successful login
- Validated on every API request (`is_logged_in()`)
- Expired sessions not auto-deleted (manual cleanup required)
- Multiple sessions per user allowed (multi-device)

**Use Cases**:

- Authentication check
- Session management (view active sessions)
- Security audit (IP/user agent tracking)

---

### login_attempts

**Purpose**: Brute-force attack mitigation

**Key Columns**:

- `attempts`: Failed login count
- `locked_until`: Account lock expiration time

**Business Logic**:

- Incremented on failed login
- Reset to 0 on successful login
- ≥5 attempts → `locked_until` = NOW() + 15 minutes
- Login blocked if NOW() < `locked_until`

**Use Cases**:

- Login throttling
- Security monitoring (detect brute-force attacks)

---

### telescope

**Purpose**: Immutable audit log

**Key Columns**:

- `operation`: 'CREATE', 'UPDATE', 'DELETE'
- `old_values` / `new_values`: JSON snapshots before/after change

**Business Logic**:

- Written on every INSERT/UPDATE/DELETE via `log_operation()`
- Never updated or deleted (append-only log)
- Includes user context (ID, IP, user agent)

**Use Cases**:

- Compliance auditing
- Data change history
- Troubleshooting (who changed what when)

**Example Entry**:

```json
{
  "operation": "UPDATE",
  "table_name": "products",
  "record_id": 5,
  "old_values": {"unit_price": 10.50},
  "new_values": {"unit_price": 11.00},
  "user_id": 1,
  "created_at": "2026-01-06 18:00:00"
}
```

---

### settings

**Purpose**: Application configuration storage

**Key Structure**: Key-value pairs (setting_key → setting_value)

**Stored Settings**:

- `store_name`: Business name for invoices
- `store_address`: Physical location
- `store_phone`: Contact number
- `tax_number`: Tax registration ID
- `currency_symbol`: Display symbol (e.g., "ر.ي")
- `invoice_size`: 'thermal' (80mm) or 'a4'
- `footer_message`: Receipt footer text

**Business Logic**:

- Loaded once per page (not on every API call)
- Updated via settings UI (Admin only)
- Used in invoice rendering

**Use Cases**:

- Invoice header/footer customization
- Multi-tenancy (each instance has own settings)
- Currency localization

---

## Supporting Tables

### categories

**Purpose**: Product categorization lookup table

**Note**: Products store category as text, not FK. This table is informational/autocomplete only.

**Business Logic**:

- Unique category names
- Used to populate category dropdown in UI
- No CASCADE delete impact on products

---

### purchase_requests

**Purpose**: Procurement workflow

**Key Columns**:

- `product_id`: NULL if requesting new product not in catalog
- `product_name`: If `product_id` NULL, contains suggested name
- `status`: 'pending', 'approved', 'rejected'

**Business Logic**:

- Staff (sales role) creates request
- Manager approves/rejects
- Approved requests manually converted to purchases

**Use Cases**:

- Stock requisition system
- Manager approval workflow
- New product suggestions

---

## Table Size Hierarchy (Largest to Smallest)

1. **telescope** - Grows unbounded, largest over time
2. **general_ledger** - Grows with all financial transactions (double-entry)
3. **invoice_items** - Grows with sales volume
4. **invoices** - Grows with sales volume
5. **purchases** - Grows with procurement activity
6. **inventory_costing** - Grows with purchases and sales (COGS tracking)
7. **ar_transactions** - Grows with credit sales
8. **ap_transactions** - Grows with credit purchases
9. **asset_depreciation** - Grows monthly per active asset
10. **products** - Relatively stable (100-10,000 items typical)
11. **sessions** - Transient, small
12. **ar_customers** - Grows slowly
13. **ap_suppliers** - Grows slowly
14. **expenses** - Low volume (monthly entries)
15. **chart_of_accounts** - Very stable (50-200 accounts typical)
16. **fiscal_periods** - Grows slowly (monthly/quarterly)
17. **users** - Very small (5-50 users typical)
18. **assets** - Very small (10-100 assets typical)
19. **revenues** - Very small (occasional entries)
20. **settings** - Tiny (10-20 keys)
21. **categories** - Tiny (10-50 categories)
22. **document_sequences** - Tiny (5-10 sequences)
23. **purchase_requests** - Transient
24. **login_attempts** - Transient

## Data Ownership

**User-Created Records** (tracked via created_by or user_id):

- Products, Categories, Purchases, Invoices
- AR Customers, AR Transactions
- AP Suppliers, AP Transactions
- Expenses, Assets, Revenues
- Purchase Requests
- Chart of Accounts
- Fiscal Periods

**System-Generated**:

- Sessions
- Login Attempts
- Telescope
- General Ledger entries (via LedgerService)
- Inventory Costing records (via InventoryCostingService)
- Asset Depreciation records (via DepreciationService)
- Document Sequences

**User-Independent**:

- Settings
- Invoice Items (derived from products)

## Cascade Deletion Impact

**When User Deleted**:

- Sessions: ❌ Deleted (CASCADE)
- All created records: ✓ Preserved (SET NULL)
- Telescope entries: ✓ Preserved (SET NULL)

**When Product Deleted**:

- Purchases: ❌ Deleted (CASCADE) - loses cost history  
- Invoice Items: ❌ Deleted (CASCADE) - **Risk**: breaks invoices
- **Recommendation**: Soft-delete products instead of hard delete

**When Invoice Deleted**:

- Invoice Items: ❌ Deleted (CASCADE)
- AR Transactions: ⚠️ Soft-deleted (is_deleted = 1)

**When AR Customer Deleted**:

- AR Transactions: ❌ Deleted (CASCADE) - loses debt history
- Invoices: ✓ Preserved (SET NULL customer_id)
- **Recommendation**: Disallow deletion if transactions exist
