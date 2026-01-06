# System Overview

## Introduction

The Supermarket Management System is a full-featured retail business management platform that combines point-of-sale operations with comprehensive financial accounting. The system manages the complete retail cycle from procurement to sales, including credit management and financial reporting.

## Core Modules

### 1. Authentication & Authorization

**Purpose**: Secure access control with role-based permissions

**Components**:

- Session-based authentication with secure token management
- Brute-force protection via login attempt tracking
- Three-tier role system: Admin, Manager, Sales
- Password change functionality
- Active session monitoring

**Implementation**:

- `domain/auth.php` - Authentication helpers
- `domain/api/AuthController.php` - Login/logout handlers
- `login_attempts` table - Throttling mechanism
- `sessions` table - Active session tracking

### 2. Product & Inventory Management

**Purpose**: Centralized product catalog with multi-unit handling

**Features**:

- Product master data (name, description, category, pricing)
- Dual-unit system (main unit ↔ sub-unit conversion)
- Stock quantity tracking
- Minimum profit margin enforcement
- Category management
- Expiry date tracking on purchases

**Implementation**:

- `products` table - Product master
- `categories` table - Category lookup
- `purchases` table - Stock acquisitions with expiry dates
- Automatic stock updates on sales/purchases

### 3. Sales & Point of Sale

**Purpose**: Transaction processing with cash and credit support

**Features**:

- Multi-item invoice creation
- Dual payment modes: Cash or Credit
- Real-time stock deduction
- QR code generation for invoices (ZATCA compliant)
- Partial payment support for credit sales
- Invoice revocation with stock restoration

**Implementation**:

- `invoices` table - Invoice headers
- `invoice_items` table - Line items
- Integration with AR system for credit sales
- `SalesController` handles transaction logic

### 4. Accounts Receivable (AR)

**Purpose**: Customer credit management and debt tracking

**Features**:

- Customer profiles (name, contact, tax info)
- Transaction ledger (invoices, payments, returns)
- Automatic balance calculation
- Soft-delete support for corrections
- Payment recording and history

**Implementation**:

- `ar_customers` table - Customer master with current_balance
- `ar_transactions` table - Double-entry ledger
- `ArController` manages customers and transactions
- Balance recalculation on every transaction

### 5. Purchase Management

**Purpose**: Stock replenishment and price management

**Features**:

- Purchase recording with cost tracking
- Unit type selection (main/sub units)
- Automatic selling price calculation (cost + margin)
- Production and expiry date tracking
- Purchase request workflow (staff → manager approval)

**Implementation**:

- `purchases` table - Purchase history
- `purchase_requests` table - Procurement workflow
- `PurchasesController` handles purchases and requests
- Stock and price updates in transactions

### 6. Financial Management

**Purpose**: Business accounting beyond retail operations

**Modules**:

#### A. Expenses

- Categorized expense recording
- Date tracking and descriptions
- User attribution

#### B. Assets  

- Fixed asset registry
- Value and depreciation rate tracking
- Status management (active/disposed)

#### C. Revenues

- Direct cash revenue recording
- Non-POS income sources
- Source and description tracking

**Implementation**:

- `expenses`, `assets`, `revenues` tables
- Dedicated controllers for each module
- Integration with balance sheet reporting

### 7. Reporting & Analytics

**Purpose**: Financial statement generation

**Reports**:

#### Balance Sheet

- **Assets**:
  - Cash estimate (revenues - expenses - purchases)
  - Inventory value (stock × unit price)
  - Fixed assets value
  - Accounts receivable
- **Income Statement**:
  - Total sales
  - Other revenues
  - Total purchases (COGS)
  - Total expenses
  - Net profit

**Implementation**:

- `ReportsController.getBalanceSheet()`
- Real-time calculation from transaction tables
- No pre-aggregated balances

### 8. Dashboard & KPIs

**Purpose**: Real-time business metrics

**Metrics**:

- Daily sales summary
- Low stock alerts
- Recent transactions
- Expiring products
- Pending purchase requests

**Implementation**:

- `DashboardController` aggregates data
- `dashboard.html` displays metrics
- Auto-refresh capabilities

### 9. Audit & Compliance

**Purpose**: Complete transaction history for compliance

**Features**:

- Every CREATE/UPDATE/DELETE operation logged
- Before/after snapshots (JSON)
- User, IP, timestamp tracking
- Immutable audit trail

**Implementation**:

- `telescope` table - Audit log
- `log_operation()` helper function
- Automatic invocation in all controllers

### 10. System Configuration

**Purpose**: Centralized settings management

**Settings**:

- Store information (name, address, phone)
- Tax number
- Invoice format (thermal/A4)
- Currency symbol
- Footer message

**Implementation**:

- `settings` table (key-value store)
- `SettingsController` for CRUD operations
- Invoice preview functionality

## Data Flow

### Sale Transaction Flow

1. **Frontend**: User selects products, quantities, payment type
2. **SalesController**:
   - Validates stock availability
   - Creates invoice record
   - Inserts invoice items
   - Deducts stock quantities
   - If credit: Creates AR transaction, updates customer balance
3. **Telescope**: Logs operation
4. **Response**: Returns invoice ID and number

### Purchase Transaction Flow

1. **Frontend**: User enters product, quantity, cost, unit type
2. **PurchasesController**:
   - Calculates actual quantity (main → sub conversion)
   - Calculates new selling price (cost + margin)
   - Inserts purchase record
   - Updates stock and unit price
3. **Telescope**: Logs operation
4. **Response**: Returns new unit price

### AR Payment Flow

1. **Frontend**: Customer ID, payment amount, description
2. **ArController**:
   - Creates payment transaction
   - Recalculates customer balance (debit - credit)
   - Updates `ar_customers.current_balance`
3. **Telescope**: Logs operation

## Security Model

### Role Permissions

- **Admin**: Full system access
- **Manager**: All except critical settings; can approve purchase requests
- **Sales**: POS, basic product viewing, own password changes

### Session Management

- Token-based sessions with expiration
- IP and user agent tracking
- Manual session termination support

### Brute-Force Protection

- Failed login attempt tracking
- Account lockout after threshold
- Time-based unlock mechanism

## Technical Characteristics

### Database

- InnoDB engine for ACID compliance
- Foreign key constraints for referential integrity
- JSON columns for flexible data (telescope, settings)
- Automatic timestamps on most tables
- Soft deletes where reversibility needed

### API Design

- RESTful principles
- Single entry point (`api.php`)
- Controller-based routing
- JSON request/response format
- HTTP status codes (200, 401, 403, 404, 500)

### Frontend Architecture

- Client-side rendering
- Reusable component functions (`common.js`)
- Fetch API for async operations
- No external JS frameworks
- RTL support for Arabic UI

## System Boundaries

### What the System Does

✓ Retail operations (sales, purchases, inventory)  
✓ Credit customer management  
✓ Financial accounting (expenses, assets, revenues)  
✓ User and permission management  
✓ Audit logging  
✓ Basic reporting (balance sheet, income statement)

### What the System Does NOT Do

✗ Multi-store/branch management  
✗ Supplier management module  
✗ Payroll or HR functions  
✗ Advanced analytics or forecasting  
✗ Integration with external accounting systems  
✗ Multi-currency support (single currency per instance)  
✗ Barcode printing  
✗ Loyalty programs or discounts
