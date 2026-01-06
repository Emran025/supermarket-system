# Setup and Usage Guide

## Prerequisites

### Server Requirements

**Minimum**:

- PHP 7.4 or higher
- MySQL 5.7+ or MariaDB 10.4+
- Apache 2.4+ or Nginx
- 50 MB disk space
- 128 MB RAM

**Recommended**:

- PHP 8.0+
- MariaDB 10.6+
- 500 MB disk space
- 512 MB RAM
- HTTPS SSL certificate

### PHP Extensions Required

- `mysqli` - Database connectivity
- `json` - JSON encoding/decoding
- `session` - Session management
- `mbstring` - Multi-byte string handling

**Check Extensions**:

```bash
php -m | grep -E "mysqli|json|session|mbstring"
```

## Installation

### Step 1: Download/Extract Files

**Option A - Git Clone**:

```bash
cd /path/to/htdocs
git clone <repository-url> supermarket-system
```

**Option B - Manual Extract**:

1. Extract ZIP to `htdocs/supermarket-system/`
2. Ensure directory structure intact

**Directory Structure**:

```batch
htdocs/supermarket-system/
├── domain/
├── presentation/
├── docs/
├── index.php
└── LICENSE
```

### Step 2: Configure Database

**Edit Configuration**:
Open `domain/config.php` and update:

```php
<?php
define('DB_HOST', 'localhost');      // Usually localhost
define('DB_USER', 'root');            // Your MySQL user
define('DB_PASS', '');                // Your MySQL password
define('DB_NAME', 'supermarket_db');  // Database name
```

**Important Notes**:

- Database does NOT need to exist beforehand
- System auto-creates database and tables on first run
- Ensure MySQL user has CREATE DATABASE privilege

### Step 3: First Run

1. Navigate to installation URL:

   ```link
   http://localhost/supermarket-system/
   ```

2. **Auto-Initialization**:
   - Database created
   - All 16 tables created
   - Default admin user seeded
   - Sample data populated

3. **Login Screen** appears when initialization complete

### Step 4: Initial Login

**Default Credentials**:

- **Username**: `admin`
- **Password**: `admin123`

**First Steps After Login**:

1. **Change Password** (Settings → Account → Change Password)
2. **Update Store Information** (Settings page)
3. **Review Sample Data** (Dashboard)
4. **Optional**: Delete sample products/invoices

## Configuration

### System Settings

**Access**: Settings page (Admin only)

**Configurable Options**:

| Setting | Description | Default |
| :--- | :--- | :--- |
| Store Name | Business name on invoices | سوبر ماركت الوفاء |
| Store Address | Physical location | اليمن - صنعاء - شارع الستين |
| Store Phone | Contact number | 777123456 |
| Tax Number | Tax registration ID | 123456789 |
| Currency Symbol | Display symbol | ر.ي |
| Invoice Size | 'thermal' or 'a4' | thermal |
| Footer Message | Receipt footer text | شكراً لزيارتكم... |

**Save**: Click "Save Settings" button

### User Management

**Creating Users** (Admin only):

1. Go to Users page
2. Click "Add User"
3. Enter:
   - Username (unique)
   - Password (min 8 chars recommended)
   - Role (admin / manager / sales)
   - Manager (optional, for hierarchy)
4. Click "Save"

**Role Recommendations**:

- **Admin**: Store owner, IT staff
- **Manager**: Department heads, supervisors
- **Sales**: Cashiers, sales staff

**Deactivating Users**:

- Edit user → Set "Active" to No
- Preserves user's historical data
- Prevents login

## Basic Usage

### Dashboard Overview

**Upon Login**:

- Daily sales total
- Low stock alerts (products < 10 units)
- Recent transactions
- Expiring products (< 30 days)
- Pending purchase requests

**Refresh**: Click refresh icon or wait 60 seconds for auto-refresh

### Product Management

#### Adding Products

1. Go to **Products** page
2. Click "Add Product"
3. Fill form:
   - **Name**: Product name
   - **Description**: Optional details
   - **Category**: Select from dropdown or type new
   - **Unit Price**: Current selling price
   - **Minimum Profit Margin**: Guaranteed markup
   - **Stock Quantity**: Initial stock (in sub-units)
   - **Unit Name**: Main unit (e.g., "Carton")
   - **Items per Unit**: Conversion factor (e.g., 24)
   - **Sub Unit Name**: Sub unit (e.g., "Piece")
4. Click "Save"

**Example**:

- Name: "Coca-Cola 330ml"
- Unit Name: "Carton", Items per Unit: 24, Sub Unit: "Bottle"
- Means 1 carton = 24 bottles

#### Editing Products

1. Find product in table
2. Click "Edit" button
3. Modify fields
4. Click "Save"

**Note**: Changing price affects future sales only (past invoices unchanged)

#### Searching Products

- Type in search box (searches name, category, description, ID)
- Results filter in real-time

### Recording Purchases

**Purpose**: Add stock and update prices

**Process**:

1. Go to **Purchases** page
2. Click "Add Purchase"
3. Fill form:
   - **Product**: Select from dropdown
   - **Quantity**: Amount purchased
   - **Unit Type**: "Main" (cartons) or "Sub" (pieces)
   - **Invoice Price**: **Total cost** (not per-unit)
   - **Production Date**: Optional
   - **Expiry Date**: Optional
4. Click "Save"

**System Actions**:

- Stock increases by quantity
- New selling price calculated: (cost/qty) + margin
- Product.unit_price updated
- Purchase recorded in history

**Example**:

- Purchase 10 cartons @ 500.00 total
- Unit type: Main
- Actual stock increase: 10 × 24 = 240 pieces
- Cost per piece: 500 / 240 = 2.08
- Margin: 1.50
- New price: 2.08 + 1.50 = 3.58

### Processing Sales (POS)

**Cash Sale**:

1. Go to **Sales** page
2. Search and select products
3. Set quantities for each item
4. Review cart total
5. **Payment Type**: Select "Cash"
6. Click "Complete Sale"
7. Print receipt (auto-opens print dialog)

**Credit Sale**:

1. Follow steps 1-4 above
2. **Payment Type**: Select "Credit"
3. **Customer**: Select AR customer from dropdown
4. **Amount Paid** (optional): Enter partial payment
5. Click "Complete Sale"
6. AR transaction created automatically
7. Customer balance updated

**Receipt**: Contains QR code for compliance

### Managing AR Customers

#### Creating Customers

1. Go to **AR Customers** page
2. Click "Add Customer"
3. Fill form:
   - Name, Phone, Email, Address
   - Tax Number
4. Click "Save"

**Note**: Current balance auto-calculated (starts at 0)

#### Recording Payments

1. Go to **AR Ledger** page
2. Select customer
3. Click "Record Payment"
4. Enter amount and description
5. Save

**Effect**: Creates AR transaction (type=payment), reduces customer balance

### Financial Management

#### Recording Expenses

1. Go to **Expenses** page
2. Click "Add Expense"
3. Enter:
   - Category (e.g., "Rent", "Utilities")
   - Amount
   - Date
   - Description
4. Save

**Use Cases**: Rent, electricity, salaries, supplies

#### Adding Assets

1. Go to **Assets** page
2. Click "Add Asset"
3. Enter:
   - Name (e.g., "Refrigerator")
   - Value (purchase price)
   - Purchase Date
   - Depreciation Rate (e.g., 10.00 = 10%/year)
   - Status (active/disposed)
4. Save

**Note**: Depreciation calculated manually (not automated)

#### Recording Revenues

1. Go to **Revenues** page
2. Click "Add Revenue"
3. Enter:
   - Source (e.g., "Scrap Sales")
   - Amount
   - Date
   - Description
4. Save

**Use Cases**: Non-POS income (commissions, scrap sales, etc.)

### Viewing Reports

**Balance Sheet**:

1. Go to **Reports** page
2. Click "Generate Balance Sheet"
3. View:
   - **Assets**: Cash, Stock, Fixed Assets, AR
   - **Income Statement**: Sales, Revenues, Purchases, Expenses, Net Profit

**Export**: Currently manual (copy to Excel)

## Advanced Features

### Purchase Requests (Approval Workflow)

**Creating Request** (Sales role):

1. Go to **Purchases** page → **Requests** tab
2. Click "Create Request"
3. Select existing product OR enter new product name
4. Enter quantity needed
5. Add notes
6. Submit

**Approving Request** (Manager role):

1. View pending requests on Dashboard or Purchases page
2. Click "Approve" or "Reject"

**Converting to Purchase**:

1. After approval, click "Convert to Purchase"
2. Enter cost and supplier details
3. System creates purchase and updates stock

### Session Management

**Viewing Active Sessions**:

1. Go to **Account** page (user icon → Account)
2. See list of active sessions
3. View IP, browser, login time

**Terminating Sessions**:

- Currently manual (delete from database)
- Future: "Logout All Other Devices" button

### Invoice Management

**Viewing Invoices**:

1. Go to **Sales** page
2. Browse recent invoices
3. Click "Details" to view line items

**Revoking Invoice** (Admin only):

1. Find invoice in list
2. Click "Delete"
3. Confirm action

**Effects**:

- Stock restored to products
- AR transactions soft-deleted (if credit sale)
- Customer balance recalculated

**Restriction**: Only recent invoices allowed (implemented in controller)

## Troubleshooting

### Database Connection Errors

**Symptom**: "Database connection failed" message

**Solutions**:

1. Check MySQL service is running:

   ```bash
   # XAMPP
   Open XAMPP Control Panel → Start MySQL
   
   # Linux
   sudo systemctl status mysql
   ```

2. Verify credentials in `domain/config.php`

3. Check user privileges:

   ```sql
   GRANT ALL PRIVILEGES ON *.* TO 'root'@'localhost';
   FLUSH PRIVILEGES;
   ```

### Login Issues

**Problem**: "Invalid credentials" despite correct password

**Solutions**:

1. Reset admin password via database:

   ```sql
   UPDATE users 
   SET password = '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi' -- "admin123"
   WHERE username = 'admin';
   ```

2. Check account not locked:

   ```sql
   DELETE FROM login_attempts WHERE username = 'admin';
   ```

**Problem**: "Account locked" message

**Solution**: Wait 15 minutes or clear `login_attempts` table

### Blank Pages / 500 Errors

**Steps**:

1. Check PHP error log:

   ```link
   # XAMPP
   xampp/apache/logs/error.log
   
   # Linux
   /var/log/apache2/error.log
   ```

2. Enable error display (temporarily):
   In `domain/api.php`:

   ```php
   ini_set('display_errors', 1);
   ```

3. Check file permissions (Linux):

   ```bash
   chmod 755 -R /path/to/supermarket-system
   ```

### Printing Issues

**Problem**: Print dialog doesn't open

**Solutions**:

1. Allow pop-ups in browser
2. Check printer is set as default
3. Try different browser

**Problem**: Receipt formatting wrong

**Solution**: Change Invoice Size in Settings (thermal vs. a4)

### Stock Discrepancies

**Symptom**: Stock quantity incorrect

**Debugging**:

1. Check Telescope table for recent changes:

   ```sql
   SELECT * FROM telescope 
   WHERE table_name = 'products' AND record_id = {product_id}
   ORDER BY created_at DESC;
   ```

2. Reconcile purchases vs. sales:

   ```sql
   -- Total purchased
   SELECT SUM(quantity) FROM purchases WHERE product_id = {id};
   
   -- Total sold
   SELECT SUM(quantity) FROM invoice_items WHERE product_id = {id};
   ```

## Maintenance

### Backup

**Manual Backup**:

```bash
# Full database
mysqldump -u root -p supermarket_db > backup_$(date +%F).sql

# Tables only (no data)
mysqldump -u root -p --no-data supermarket_db > schema.sql
```

**Restore**:

```bash
mysql -u root -p supermarket_db < backup_2026-01-06.sql
```

**Recommended**: Daily backups with 30-day retention

### Cleanup

**Clear Old Sessions**:

```sql
DELETE FROM sessions WHERE expires_at < NOW();
```

**Archive Telescope**:

```sql
-- Move entries older than 1 year to archive table
CREATE TABLE telescope_archive LIKE telescope;
INSERT INTO telescope_archive SELECT * FROM telescope WHERE created_at < DATE_SUB(NOW(), INTERVAL 1 YEAR);
DELETE FROM telescope WHERE created_at < DATE_SUB(NOW(), INTERVAL 1 YEAR);
```

### Performance Optimization

**Add Indexes** (if slow):

```sql
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_telescope_created ON telescope(created_at);
```

**Check Slow Queries**:
Enable MySQL slow query log in my.cnf

### Updating System

**Process**:

1. **Backup database**
2. **Backup files**
3. Replace files with new version
4. Navigate to system URL (runs migrations automatically)
5. Test functionality
6. Clear browser cache

**Rollback**: Restore files and database from backup

## Security Best Practices

**After Installation**:

1. ✓ Change default admin password
2. ✓ Use HTTPS (configure in Apache/Nginx)
3. ✓ Restrict database user privileges
4. ✓ Set `display_errors = 0` in `api.php`
5. ✓ Regular backups
6. ✓ Keep PHP/MySQL updated

**Ongoing**:

- Review telescope logs for suspicious activity
- Rotate user passwords periodically
- Limit admin accounts (use manager/sales roles)
- Monitor login_attempts for brute-force attacks

## Support & Resources

**Documentation**: `/docs` folder

**Log Files**:

- PHP Errors: `xampp/apache/logs/error.log`
- Application Audit: `telescope` table in database

**Customization**: Modify `presentation/*.html` and `presentation/*.js` files

**Database Schema**: See `docs/database/schema.md`

**API Reference**: See `docs/api-overview.md`
