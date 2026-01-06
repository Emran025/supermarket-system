# Project Description

## Business Domain

**Industry**: Retail / Supermarket Management

**Target Users**:

- Small to medium-sized retail businesses
- Grocery stores, convenience stores, mini-markets
- Single-location operations

**Primary Objectives**:

1. Digitize point-of-sale operations
2. Track inventory in real-time
3. Manage customer credit accounts
4. Generate financial reports
5. Maintain audit trail for compliance

## System Scope

### What the System Does

**Core Retail Functions**:

- ✓ Product catalog management with multi-unit handling
- ✓ Stock replenishment tracking with cost history
- ✓ Point-of-sale (cash and credit sales)
- ✓ Inventory valuation and stock alerts

**Financial Management**:

- ✓ Accounts receivable with customer ledgers
- ✓ Expense tracking by category
- ✓ Fixed asset registry
- ✓ Cash revenue recording
- ✓ Balance sheet generation

**Administrative**:

- ✓ User management with role-based permissions
- ✓ Complete audit logging (Telescope)
- ✓ Invoice customization and printing
- ✓ Multi-unit inventory (cartons, pieces, etc.)

### What the System Does NOT Do

**Out of Scope**:

- ✗ Multi-store/branch management
- ✗ Supplier relationship management
- ✗ Barcode generation/printing
- ✗ Payroll or HR functions
- ✗ Purchase orders to suppliers
- ✗ Discount codes or promotions
- ✗ Loyalty/rewards programs
- ✗ Integrated payment processing
- ✗ E-commerce / online sales
- ✗ Advanced analytics / forecasting

## Business Logic

### Inventory Valuation Method

**Approach**: **Last Purchase Price** (not FIFO or weighted average)

**Algorithm**:

1. Record purchase with `invoice_price` (total cost)
2. Calculate price per item: `invoice_price / actual_quantity`
3. Calculate new selling price: `cost_per_item + minimum_profit_margin`
4. Update `products.unit_price` to new selling price

**Example**:

- Purchase 10 cartons @ 1000.00 total
- Carton = 24 pieces (items_per_unit)
- Actual quantity = 10 × 24 = 240 pieces
- Cost per piece = 1000 / 240 = 4.17
- Minimum margin = 2.00
- New selling price = 4.17 + 2.00 = 6.17 per piece

**Implications**:

- Simple to understand and implement
- Price reflects most recent market conditions
- Not compliant with FIFO rules (acceptable for small business)

### Multi-Unit Support

**Concept**: Products can be bought/sold in different units

**Structure**:

- **Main Unit**: Bulk packaging (e.g., "Carton")
- **Sub Unit**: Individual items (e.g., "Piece")
- **Conversion Factor**: `items_per_unit`

**Storage**: All stock stored in sub-units internally

**Operations**:

- **Purchase**: Can specify unit_type ('main' or 'sub')
  - If 'main': quantity × items_per_unit added to stock
  - If 'sub': quantity added to stock directly
- **Sale**: Always in sub-units (quantity of pieces)

**Example**:

- Product: Coca-Cola
- unit_name: "Carton", items_per_unit: 24, sub_unit_name: "Bottle"
- Purchase 5 cartons → stock increases by 5 × 24 = 120 bottles
- Sell 10 bottles → stock decreases by 10 bottles

### Credit Sales Workflow

**Process**:

1. Salesperson creates invoice with payment_type='credit'
2. Selects AR customer from list
3. System creates invoice record
4. System creates AR transaction (type='invoice') for total amount
5. If partial payment made: System creates AR transaction (type='payment')
6. System recalculates customer.current_balance

**Balance Calculation**:

```SQL
current_balance = 
SUM(amount WHERE type='invoice' AND is_deleted=0) -
SUM(amount WHERE type IN ('payment','return') AND is_deleted=0)
```

**Payment Recording**:

- Customer pays 100.00 → AR transaction (type='payment', amount=100)
- Balance auto-updates (decreases by 100)

**Returns**:

- Return goods worth 50 → AR transaction (type='return', amount=50)
- Balance auto-updates (decreases by 50)

### Soft Delete Pattern

**Used In**: AR Transactions

**Purpose**: Financial records should be correctable but never truly deleted

**Mechanism**:

- DELETE action sets `is_deleted = 1`, `deleted_at = NOW()`
- Queries filter `WHERE is_deleted = 0`
- Balance calculation excludes deleted transactions
- Restore action sets `is_deleted = 0`, `deleted_at = NULL`

**Rationale**:

- Accounting best practice (immutable ledger)
- Allows error correction without data loss
- Maintains compliance with audit requirements

### Purchase Request Approval

**Workflow**:

1. **Staff (sales role)** creates purchase request
   - Either selects existing product OR suggests new product name
   - Specifies quantity needed
2. **Manager reviews** pending requests
   - Can approve or reject
3. **If approved**:
   - Staff converts request to actual purchase
   - Records cost and supplier info
   - Stock increases automatically

**Rationale**: Separates requisition from procurement

## Audit & Compliance

### Telescope Audit System

**Mechanism**: Every CREATE, UPDATE, DELETE operation logged

**Captured Data**:

- User who performed action (user_id)
- IP address and browser (user_agent)
- Timestamp
- Table and record affected
- Before/after snapshots (JSON)

**Immutability**: Telescope entries never modified or deleted

**Use Cases**:

- Regulatory compliance (tax audits)
- Internal investigations (who changed price)
- Data recovery (see historical values)

**Example Query**:

```sql
-- Who changed product #5 price?
SELECT * FROM telescope 
WHERE table_name = 'products' 
  AND record_id = 5 
  AND JSON_EXTRACT(new_values, '$.unit_price') != JSON_EXTRACT(old_values, '$.unit_price')
ORDER BY created_at DESC;
```

### E-Invoicing Compliance

**Feature**: QR code on printed receipts

**Format**: TLV (Tag-Length-Value) base64 encoded

**Contents**:

1. Seller name
2. Tax number
3. Timestamp
4. Total amount with tax

**Standards Compliance**: ZATCA (Zakat, Tax and Customs Authority) format for Saudi Arabia/Yemen

**Implementation**: JavaScript QRCode library generates code client-side

## Reporting & Analytics

### Balance Sheet

**Purpose**: Snapshot of financial position

**Components**:

**Assets**:

- Cash Estimate = (Total Sales + Revenues) - (Purchases + Expenses)
- Inventory Value = SUM(unit_price × stock_quantity)
- Fixed Assets = SUM(value WHERE status='active')
- Accounts Receivable = SUM(current_balance)

**Income Statement**:

- Total Sales: SUM(invoices.total_amount)
- Other Revenues: SUM(revenues.amount)
- Cost of Goods Sold: SUM(purchases.invoice_price)
- Operating Expenses: SUM(expenses.amount)
- Net Profit: (Sales + Revenues) - (COGS + Expenses)

**Limitations**:

- Simplified cash-based accounting
- No liability tracking (payables)
- No equity calculation
- Manual depreciation (not auto-calculated)

### Dashboard Metrics

**Real-Time KPIs**:

1. Daily sales total (invoices created today)
2. Low stock alerts (stock_quantity < 10)
3. Recent transactions (last 20 invoices)
4. Expiring products (expiry_date < 30 days from now)
5. Pending purchase requests

**Refresh**: Manual or JavaScript timer (60-second intervals)

## User Roles & Permissions

### Admin

**Capabilities**:

- Full system access
- User management (create, edit, delete)
- System settings configuration
- Financial reports access
- All data CREATE/UPDATE/DELETE

**Restrictions**: None

### Manager

**Capabilities**:

- View/approve purchase requests
- Create/edit products
- Record purchases
- View reports
- Manage assigned staff

**Restrictions**:

- Cannot create admin users
- Cannot modify system settings
- Cannot delete users

### Sales

**Capabilities**:

- Create sales invoices (POS)
- View products (read-only)
- Create purchase requests
- Change own password

**Restrictions**:

- Cannot view financial reports
- Cannot create/edit products
- Cannot access user management
- Cannot record purchases

## Session & Security

### Authentication

**Method**: Session-based with secure tokens

**Token Generation**: 64-character random hex string

**Storage**:

- Server: `sessions` table with expiry timestamp
- Client: HttpOnly cookie (PHPSESSID)

**Validation**: On every API request via `is_logged_in()`

**Expiry**: 24 hours default (configurable in session creation)

### Brute-Force Protection

**Mechanism**: `login_attempts` table tracking

**Logic**:

- Failed login → increment attempt count
- ≥5 attempts → `locked_until` = NOW() + 15 minutes
- Successful login → clear attempts
- Login blocked if NOW() < `locked_until`

**Display**: "Account locked, try again after HH:MM"

### Data Protection

**Passwords**: Bcrypt hashed (PHP `password_hash()`)

**SQL Injection**: Prevented via prepared statements

**XSS**: Mitigated by using `textContent` in JavaScript (where possible)

**CSRF**: Not implemented (relies on same-origin policy)

**HTTPS**: Recommended but not enforced by application

### Concurrent Access

**Database Locks**: Row-level (InnoDB)

**Transactions**: Used for multi-step operations (invoice creation)

**Session Concurrency**: Multiple sessions per user allowed

**Stock Conflicts**: Possible if two users sell last item simultaneously

- Mitigation: Check stock in transaction before deducting

## Deployment Model

**Target Environment**: Shared hosting / On-premise server

**Infrastructure**:

- Single PHP application server
- Single MySQL database
- Apache/Nginx for static file serving

**Scaling**: Vertical only (no horizontal scaling designed)

**Initialization**: Auto-creates database and seeds data on first run

**Backups**: Manual mysqldump (no automated backup system)

**Updates**: Direct file replacement (no migration runner)

## Assumptions & Constraints

**Assumptions**:

1. Single store location
2. Single currency per installation
3. Stable internet (for cloud deployments)
4. Users trust each other (minimal access control within roles)
5. Product prices change infrequently
6. AR customers pay eventually (no aging collections)

**Technical Constraints**:

1. PHP 7.4+ required (password_hash, JSON support)
2. MySQL 5.7+ for JSON columns
3. No offline mode (requires database connection)
4. No API versioning (breaking changes affect all clients)
5. Session-based auth limits to single server (without sticky sessions)

**Business Constraints**:

1. No supplier credit tracking (only customer AR)
2. No multi-warehouse support
3. No lot/batch tracking beyond expiry date
4. Simplified accounting (not double-entry compliant)

## Future Enhancement Opportunities

**Short-Term** (low effort):

- Export reports to PDF/Excel
- Barcode scanning support
- SMS notifications for low stock
- Backup automation

**Medium-Term** (moderate effort):

- Accounts payable (supplier debt tracking)
- Batch/lot number tracking
- Advanced role permissions (granular)
- API documentation (Swagger/OpenAPI)

**Long-Term** (significant effort):

- Multi-store support with central reporting
- Mobile app (iOS/Android)
- Predictive analytics (demand forecasting)
- Integration with accounting software (QuickBooks, etc.)
- E-commerce integration (online orders)
