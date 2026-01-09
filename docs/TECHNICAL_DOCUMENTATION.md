# Accounting System - Technical Documentation

> **Last Updated:** January 2026  
> **Version:** 2.0  
> **Architecture:** Monorepo (Laravel Backend + Next.js Frontend)

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture & Technology Stack](#2-architecture--technology-stack)
3. [Backend Documentation (`/src`)](#3-backend-documentation-src)
4. [Frontend Documentation (`/public`)](#4-frontend-documentation-public)
5. [Database Schema & Models](#5-database-schema--models)
6. [API Surface & Contracts](#6-api-surface--contracts)
7. [Business Logic & Services](#7-business-logic--services)
8. [Security & Authentication](#8-security--authentication)
9. [Developer Onboarding](#9-developer-onboarding)
10. [Troubleshooting & Common Issues](#10-troubleshooting--common-issues)
11. [Deployment Guide](#11-deployment-guide)

---

## 1. System Overview

### 1.1 High-Level Architecture

This is a **full-featured enterprise accounting system** built as a **monorepo** containing:

```txt
┌────────────────────────────────────────────────────────────┐
│                     USER INTERFACE                         │
│          (Next.js 16 - React 19 - TypeScript)              │
│                      Port: 3000                            │
└──────────────────────────┬─────────────────────────────────┘
                           │ HTTP/JSON API
                           │ (RESTful)
┌──────────────────────────▼─────────────────────────────────┐
│              LARAVEL BACKEND API                           │
│           (Laravel 12 - PHP 8.2+)                          │
│                  Port: 8000                                │
├────────────────────────────────────────────────────────────┤
│  Controllers → Services → Models → Database                │
└──────────────────────────┬─────────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────────┐
│              SQLite DATABASE                               │
│        (Production: MySQL/PostgreSQL)                      │
└────────────────────────────────────────────────────────────┘
```

### 1.2 Core Business Modules

The system implements a comprehensive accounting solution with the following modules:

| Module | Description | Key Features |
| -------- | ------------- | -------------- |
| **Sales & Invoicing** | POS and invoice management | Cash/Credit sales, ZATCA e-invoicing, barcode/QR generation |
| **Purchases & Inventory** | Procurement and stock management | Multi-level approval, inventory costing (FIFO/Average), expiry tracking |
| **Accounts Receivable (AR)** | Customer credit management | Aging reports, payment tracking, customer ledger |
| **Accounts Payable (AP)** | Supplier payment management | Supplier ledger, payment scheduling, aging reports |
| **General Ledger (GL)** | Double-entry bookkeeping | Chart of accounts, journal vouchers, trial balance |
| **Financial Reports** | Comprehensive reporting | Balance Sheet, P&L, Cash Flow, Comparative Reports |
| **Accrual Accounting** | Advanced accounting features | Prepayments, unearned revenue, payroll accruals |
| **HR & Payroll** | Employee and payroll management | Multi-level approval, salary processing, allowances/deductions |
| **Fixed Assets** | Asset lifecycle management | Depreciation (SL/DB), disposal tracking |
| **Multi-Currency** | International transactions | Exchange rate management, multi-currency invoicing |
| **Fiscal Periods** | Period management | Opening/closing periods, period locking |
| **Batch Processing** | Bulk operations | Background job processing, progress tracking |

### 1.3 Integration Points

- **Frontend ↔ Backend:** REST API over HTTP (`/api/*` endpoints)
- **Authentication:** Session-based with token headers (`X-Session-Token`)
- **CORS:** Configured for local development (localhost:3000 ↔ localhost:8000)
- **Data Format:** JSON (request/response)
- **File Uploads:** Multipart form data (employee documents)

---

## 2. Architecture & Technology Stack

### 2.1 Backend Stack (`/src`)

| Component | Technology | Version |
| ----------- | ----------- | --------- |
| **Framework** | Laravel | 12.x |
| **Language** | PHP | 8.2+ |
| **Database** | SQLite (dev) / MySQL (prod) | - |
| **ORM** | Eloquent | Built-in |
| **Queue** | Database driver | Built-in |
| **Cache** | Database driver | Built-in |
| **Session** | Database driver | Built-in |
| **Validation** | Form Requests | Built-in |
| **Testing** | PHPUnit | 11.x |

**Design Patterns:**

- **MVC Architecture** (Model-View-Controller)
- **Service Layer Pattern** (Business logic encapsulation)
- **Repository Pattern** (Through Eloquent)
- **Form Request Validation**
- **Middleware Pipeline** (Authentication, CORS)

### 2.2 Frontend Stack (`/public`)

| Component | Technology | Version |
| ----------- | ----------- | --------- |
| **Framework** | Next.js (App Router) | 16.1.1 |
| **Language** | TypeScript | 5.x |
| **UI Library** | React | 19.2.3 |
| **Styling** | Tailwind CSS | 4.x |
| **State Management** | React Hooks (useState, useEffect) | - |
| **HTTP Client** | Native Fetch API | - |
| **Routing** | File-based (Next.js App Router) | - |
| **QR Code** | qrcode.js | 1.5.4 |

**Architecture Pattern:**

- **App Router** (Server & Client Components)
- **Component-based Architecture**
- **Custom Hooks** for reusable logic
- **Utility Functions** for shared operations

### 2.3 Directory Structure

```txt
accounting-system/
├── src/                          # Laravel Backend
│   ├── app/
│   │   ├── Http/
│   │   │   ├── Controllers/Api/  # 33 API Controllers
│   │   │   ├── Middleware/       # Custom middleware (ApiAuth)
│   │   │   └── Requests/         # Form validation requests
│   │   ├── Models/               # 46 Eloquent models
│   │   ├── Services/             # 10 Business logic services
│   │   └── Helpers/              # 3 Helper files
│   ├── database/
│   │   ├── migrations/           # 49 Migration files
│   │   ├── seeders/              # Database seeders
│   │   └── factories/            # Model factories
│   ├── routes/
│   │   ├── api.php              # API routes (224 lines)
│   │   ├── web.php              # Web routes
│   │   └── console.php          # Artisan commands
│   ├── config/                   # Configuration files
│   ├── storage/                  # File storage, logs, cache
│   └── public/                   # Public assets entry point
│
└── public/                       # Next.js Frontend
    ├── app/                      # App Router pages
    │   ├── auth/login/          # Authentication
    │   ├── system/              # System management
    │   │   ├── dashboard/
    │   │   ├── settings/
    │   │   ├── reports/
    │   │   └── [more...]
    │   ├── sales/               # Sales module
    │   ├── purchases/           # Purchase module
    │   ├── finance/             # Finance module
    │   │   ├── general_ledger/
    │   │   ├── chart_of_accounts/
    │   │   ├── fiscal_periods/
    │   │   └── [more...]
    │   └── hr/                  # HR & Payroll
    ├── components/              # Reusable React components
    ├── lib/                     # Utilities & types
    │   ├── api.ts              # API client
    │   ├── types.ts            # TypeScript interfaces
    │   ├── auth.ts             # Auth utilities
    │   └── [more...]
    └── public/                  # Static assets
```

---

## 3. Backend Documentation (`/src`)

### 3.1 Prerequisites

- **PHP:** Version 8.2 or higher
- **Composer:** Latest version
- **Extensions Required:**
  - `php-sqlite3` (development)
  - `php-mysql` (production)
  - `php-mbstring`
  - `php-xml`
  - `php-bcmath`
  - `php-json`
  - `php-curl`

### 3.2 Installation & Setup

```bash
# Navigate to backend directory
cd src

# Install PHP dependencies
composer install

# Create environment file
cp .env.example .env

# Generate application key
php artisan key:generate

# Create SQLite database (if using SQLite)
touch database/database.sqlite

# Run migrations
php artisan migrate

# Seed the database (optional)
php artisan db:seed

# Link storage
php artisan storage:link
```

### 3.3 Environment Configuration

Key `.env` variables:

```env
APP_NAME="Accounting System"
APP_ENV=local
APP_DEBUG=true
APP_URL=http://localhost:8000

# Database
DB_CONNECTION=sqlite
# Or for MySQL:
# DB_CONNECTION=mysql
# DB_HOST=127.0.0.1
# DB_PORT=3306
# DB_DATABASE=accounting
# DB_USERNAME=root
# DB_PASSWORD=

# Session & Cache
SESSION_DRIVER=database
CACHE_STORE=database
QUEUE_CONNECTION=database

# CORS (for frontend)
FRONTEND_URL=http://localhost:3000
```

### 3.4 Running the Backend

**Development Mode:**

```bash
# Standard server
php artisan serve
# Runs on http://localhost:8000

# Or with custom scripts (runs all services):
composer dev
# Starts: API server, Queue worker, Pail logs, Vite
```

**Queue Worker** (for background jobs):

```bash
php artisan queue:listen
```

### 3.5 Key Controllers

Located in `src/app/Http/Controllers/Api/`:

| Controller | Purpose | Key Methods |
| ------------ | --------- | ------------- |
| `AuthController` | Authentication | `login()`, `logout()`, `check()` |
| `SalesController` | Invoice management | `index()`, `store()`, `show()`, `destroy()` |
| `PurchasesController` | Purchase operations | `index()`, `store()`, `approve()`, `update()`, `destroy()` |
| `ProductsController` | Inventory management | CRUD operations |
| `ArController` | Accounts Receivable | Customer & transaction management |
| `ApController` | Accounts Payable | Supplier & payment management |
| `GeneralLedgerController` | GL operations | Trial balance, account details, entries |
| `ReportsController` | Financial reports | Balance sheet, P&L, cash flow, aging |
| `PayrollController` | Payroll processing | Generate, approve, process payments |
| `EmployeesController` | HR management | CRUD, suspend, activate, documents |
| `CurrencyController` | Multi-currency | CRUD, toggle active |
| `FiscalPeriodsController` | Period management | Close, lock, unlock periods |

### 3.6 Service Layer

Located in `src/app/Services/`:

| Service | Responsibility |
| --------- | --------------- |
| `AuthService.php` | Session management, user authentication |
| `LedgerService.php` | GL posting, voucher numbering, trial balance |
| `SalesService.php` | Invoice creation, VAT calculation, GL posting |
| `PayrollService.php` | Payroll generation, approval workflow, GL entries |
| `InventoryCostingService.php` | FIFO/Average cost calculation |
| `DepreciationService.php` | Asset depreciation (SL/DB methods) |
| `ChartOfAccountsMappingService.php` | Dynamic account code lookup |
| `EmployeeAccountService.php` | Employee GL account creation |
| `PermissionService.php` | Role-based access control |
| `TelescopeService.php` | Audit logging |

### 3.7 Custom Artisan Commands

```bash
# Setup script (runs all setup steps)
composer run setup

# Development environment
composer run dev

# Run tests
composer run test
```

### 3.8 Middleware

Located in `src/app/Http/Middleware/`:

- **`ApiAuth.php`**: Session-based authentication for API routes
  - Checks for `X-Session-Token` header or session token
  - Validates against `sessions` table
  - Sets authenticated user in Laravel's auth system

---

## 4. Frontend Documentation (`/public`)

### 4.1 Prerequisites

- **Node.js:** Version 20.x or higher
- **npm:** Version 10.x or higher

### 4.2 Installation & Setup

```bash
# Navigate to frontend directory
cd public

# Install dependencies
npm install
```

### 4.3 Configuration

The frontend needs to know where the backend API is located:

Create a `.env.local` file in the `public/` directory:

```env
NEXT_PUBLIC_API_BASE=http://127.0.0.1:8000/api
```

**Important:** This environment variable is hardcoded in `lib/api.ts` with a fallback.

### 4.4 Running the Frontend

```bash
# Development server
npm run dev
# Runs on http://localhost:3000

# Production build
npm run build
npm start

# Linting
npm run lint
```

### 4.5 Routing Structure

Next.js **App Router** (file-based routing):

| Route | Page | Description |
| ------- | ------ | ------------- |
| `/auth/login` | Login page | User authentication |
| `/system/dashboard` | Dashboard | Overview, stats, widgets |
| `/system/settings` | Settings | Store, invoice, roles, modules |
| `/system/reports` | Reports | Financial reports |
| `/sales/sales` | Sales | POS interface |
| `/sales/deferred_sales` | Deferred Sales | Credit sales management |
| `/purchases/purchases` | Purchases | Purchase entry |
| `/purchases/expenses` | Expenses | Expense tracking |
| `/inventory/products` | Products | Inventory management |
| `/finance/general_ledger` | General Ledger | GL entries |
| `/finance/chart_of_accounts` | Chart of Accounts | Account hierarchy |
| `/finance/fiscal_periods` | Fiscal Periods | Period management |
| `/finance/accrual_accounting` | Accrual Accounting | Prepayments, unearned revenue |
| `/hr` | HR & Payroll | Employee & payroll management |
| `/ar_customers` | AR Customers | Customer management |
| `/suppliers` | AP Suppliers | Supplier management |

### 4.6 Key Frontend Files

| File | Purpose |
| ------ | --------- |
| `lib/api.ts` | Fetch wrapper with authentication |
| `lib/types.ts` | TypeScript interfaces (mirrors backend models) |
| `lib/auth.ts` | Authentication utilities |
| `lib/utils.ts` | General utilities |
| `lib/icons.tsx` | Icon components |
| `lib/translations.ts` | Arabic/English translations |
| `lib/invoice-utils.ts` | Invoice generation, printing, ZATCA compliance |
| `app/globals.css` | Global styles (43KB - comprehensive design system) |
| `app/layout.tsx` | Root layout |
| `components/` | Reusable UI components |

### 4.7 State Management

The frontend uses **React Hooks** for state management:

- `useState`: Component-level state
- `useEffect`: Side effects (API calls, subscriptions)
- `useRouter`: Next.js navigation
- **No Redux/Zustand**: Kept simple with built-in React capabilities

### 4.8 API Integration

All API calls go through `lib/api.ts`:

```typescript
import { fetchAPI } from '@/lib/api';

// Example: Get invoices
const response = await fetchAPI('invoices?page=1&per_page=20');

// Example: Create invoice
const response = await fetchAPI('invoices', {
  method: 'POST',
  body: JSON.stringify(invoiceData)
});
```

**Authentication Flow:**

1. User logs in → Backend returns `session_token`
2. Token stored in `localStorage`
3. `fetchAPI()` automatically adds `X-Session-Token` header
4. On 401 response → Redirect to `/auth/login`

---

## 5. Database Schema & Models

### 5.1 Core Tables

- Users & Authentication

**`users`** - System users

```sql
- id (PK)
- username (unique)
- password (hashed)
- full_name
- role (legacy field)
- role_id (FK → roles)
- is_active
- manager_id (FK → users, self-referential)
- created_by (FK → users)
- timestamps
```

**`sessions`** - Active sessions

```sql
- id (PK)
- user_id (FK → users)
- token (unique, indexed)
- device, user_agent, ip_address
- last_activity
- timestamps
```

**`roles`** - User roles

```sql
- id (PK)
- role_key (unique)
- role_name_ar, role_name_en
- is_system (system-defined roles)
- timestamps
```

**`modules`** - System modules

```sql
- id (PK)
- module_key (unique)
- module_name_ar, module_name_en
- category
- timestamps
```

**`role_permissions`** - Role-based permissions

```sql
- id (PK)
- role_id (FK → roles)
- module_id (FK → modules)
- can_view, can_create, can_edit, can_delete
- timestamps
```

- Inventory Management

**`categories`** - Product categories

```sql
- id (PK)
- name
- timestamps
```

**`products`** - Inventory items

```sql
- id (PK)
- name
- category_id (FK → categories)
- description
- unit_price, purchase_price, selling_price
- minimum_profit_margin
- stock_quantity, min_stock
- unit_name, sub_unit_name
- unit_type ('main' | 'sub')
- items_per_unit, units_per_package
- package_price
- barcode (unique)
- is_active
- created_by (FK → users)
- timestamps
```

**`inventory_costing`** - Cost tracking

```sql
- id (PK)
- product_id (FK → products)
- transaction_type ('purchase' | 'sale')
- quantity
- unit_cost
- total_cost
- reference_type, reference_id
- transaction_date
- timestamps
```

**`inventory_counts`** - Physical inventory

```sql
- id (PK)
- count_date
- status ('draft' | 'completed')
- notes
- created_by (FK → users)
- completed_by (FK → users)
- completed_at
- timestamps
```

- Sales & Invoicing

**`invoices`** - Sales invoices

```sql
- id (PK)
- invoice_number (unique)
- voucher_number (indexed, nullable)
- total_amount, subtotal
- vat_rate, vat_amount
- discount_amount
- payment_type ('cash' | 'credit')
- customer_id (FK → ar_customers, nullable)
- amount_paid
- user_id (FK → users)
- is_reversed
- reversed_at, reversed_by (FK → users)
- timestamps
```

**`invoice_items`** - Invoice line items

```sql
- id (PK)
- invoice_id (FK → invoices, cascade)
- product_id (FK → products)
- quantity
- unit_type ('main' | 'sub')
- unit_price
- subtotal
- timestamps
```

**`zatca_einvoices`** - ZATCA e-invoicing compliance

```sql
- id (PK)
- invoice_id (FK → invoices)
- uuid (unique)
- invoice_hash
- qr_code (text)
- submission_status
- zatca_response (JSON)
- submitted_at
- timestamps
```

- Purchases

**`purchases`** - Purchase transactions

```sql
- id (PK)
- product_id (FK → products)
- quantity
- invoice_price
- unit_type ('main' | 'sub')
- production_date, expiry_date
- user_id (FK → users)
- supplier_id (FK → ap_suppliers)
- voucher_number (indexed)
- notes
- vat_rate, vat_amount
- approval_status ('pending' | 'approved' | 'rejected')
- approved_by (FK → users)
- approved_at
- is_reversed, reversed_at, reversed_by
- purchase_date
- created_at (no updated_at)
```

**`purchase_requests`** - Purchase requisitions

```sql
- id (PK)
- product_id (FK → products)
- quantity
- notes
- requested_by (FK → users)
- status ('pending' | 'approved' | 'completed')
- timestamps
```

- Accounts Receivable

**`ar_customers`** - Customers

```sql
- id (PK)
- name
- phone, address
- tax_number
- account_code (unique)
- is_active
- timestamps
```

**`ar_transactions`** - Customer transactions

```sql
- id (PK)
- customer_id (FK → ar_customers)
- transaction_type ('sale' | 'payment' | 'adjustment')
- amount
- reference_type, reference_id
- payment_method
- voucher_number
- description
- transaction_date
- created_by (FK → users)
- timestamps
```

- Accounts Payable

**`ap_suppliers`** - Suppliers

```sql
- id (PK)
- name
- phone, address
- tax_number
- account_code (unique)
- is_active
- timestamps
```

**`ap_transactions`** - Supplier transactions

```sql
- id (PK)
- supplier_id (FK → ap_suppliers)
- transaction_type ('purchase' | 'payment' | 'adjustment')
- amount
- reference_type, reference_id
- payment_method
- voucher_number
- description
- transaction_date
- created_by (FK → users)
- timestamps
```

- General Ledger

**`chart_of_accounts`** - Chart of accounts

```sql
- id (PK)
- account_code (unique)
- account_name
- account_type ('Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense')
- parent_id (FK → chart_of_accounts, self-referential)
- is_active
- description
- timestamps
```

**`general_ledger`** - Journal entries

```sql
- id (PK)
- voucher_number (indexed)
- voucher_date
- account_id (FK → chart_of_accounts)
- entry_type ('DEBIT' | 'CREDIT')
- amount
- description
- reference_type, reference_id
- fiscal_period_id (FK → fiscal_periods)
- created_by (FK → users)
- is_reversed
- timestamps
```

**`journal_vouchers`** - Manual journal entries

```sql
- id (PK)
- voucher_number (unique)
- voucher_date
- description
- status ('draft' | 'posted' | 'reversed')
- created_by (FK → users)
- posted_by (FK → users)
- posted_at
- timestamps
```

**`fiscal_periods`** - Accounting periods

```sql
- id (PK)
- period_name
- start_date, end_date
- status ('open' | 'closed' | 'locked')
- is_current
- closed_by (FK → users)
- closed_at
- timestamps
```

- HR & Payroll

**`departments`** - Organizational departments

```sql
- id (PK)
- name
- description
- timestamps
```

**`employees`** - Employee master data

```sql
- id (PK)
- employee_code (unique)
- full_name, email (unique), password
- phone, national_id
- date_of_birth, gender
- address
- department_id (FK → departments)
- hire_date, termination_date
- employment_status ('active' | 'suspended' | 'terminated')
- base_salary
- gosi_number, iban, bank_name
- vacation_days_balance
- contract_type ('full_time' | 'part_time' | 'contract' | 'freelance')
- account_id (FK → chart_of_accounts) - employee GL account
- is_active
- role_id (FK → roles)
- user_id (FK → users)
- manager_id (FK → employees, self-referential)
- created_by (FK → users)
- timestamps, soft_deletes
```

**`employee_documents`** - Document attachments

```sql
- id (PK)
- employee_id (FK → employees)
- document_type
- document_url
- timestamps
```

**`employee_allowances`** - Recurring allowances

```sql
- id (PK)
- employee_id (FK → employees)
- allowance_type
- amount
- timestamps
```

**`employee_deductions`** - Recurring deductions

```sql
- id (PK)
- employee_id (FK → employees)
- deduction_type
- amount
- timestamps
```

**`payroll_cycles`** - Payroll runs

```sql
- id (PK)
- cycle_name
- cycle_type ('salary' | 'bonus' | 'incentive')
- period_start, period_end
- status ('draft' | 'pending_approval' | 'approved' | 'paid')
- total_amount
- approval_level (1, 2, or 3)
- created_by (FK → users)
- approved_by_level_1/2/3 (FK → users)
- approved_at_level_1/2/3
- voucher_number
- timestamps
```

**`payroll_items`** - Individual payroll entries

```sql
- id (PK)
- payroll_cycle_id (FK → payroll_cycles)
- employee_id (FK → employees)
- base_amount
- allowances, deductions
- net_amount
- status ('pending' | 'approved' | 'paid' | 'on_hold')
- is_included (for cycle-level toggles)
- timestamps
```

**`payroll_transactions`** - Payment records

```sql
- id (PK)
- payroll_item_id (FK → payroll_items)
- amount
- payment_method
- transaction_date
- voucher_number
- timestamps
```

**`payroll_entries`** - Legacy/audit table

```sql
- id (PK)
- employee_id (FK → employees)
- amount
- entry_type
- description
- entry_date
- created_by (FK → users)
- timestamps
```

- Other Modules

**`expenses`** - Direct expenses

```sql
- id (PK)
- category
- amount
- expense_date
- description
- voucher_number
- user_id (FK → users)
- timestamps
```

**`revenues`** - Other revenues

```sql
- id (PK)
- category
- amount
- revenue_date
- description, notes
- voucher_number
- user_id (FK → users)
- timestamps
```

**`assets`** - Fixed assets

```sql
- id (PK)
- name, category
- purchase_date, purchase_price
- current_value
- depreciation_rate, depreciation_method ('straight_line' | 'declining_balance')
- useful_life_years
- acquisition_voucher, disposal_voucher
- disposal_date, disposal_amount
- status ('active' | 'disposed')
- created_by (FK → users)
- timestamps
```

**`asset_depreciation`** - Depreciation schedule

```sql
- id (PK)
- asset_id (FK → assets)
- depreciation_date
- depreciation_amount
- accumulated_depreciation
- book_value
- voucher_number
- created_by (FK → users)
- timestamps
```

**`prepayments`** - Prepaid expenses

```sql
- id (PK)
- account_code
- description
- total_amount, amortized_amount, remaining_amount
- start_date, end_date
- status ('active' | 'completed')
- amortization_frequency ('monthly' | 'quarterly')
- last_amortization_date
- created_by (FK → users)
- timestamps
```

**`unearned_revenue`** - Deferred revenue

```sql
- id (PK)
- account_code
- description
- total_amount, recognized_amount, remaining_amount
- start_date, end_date
- status ('active' | 'completed')
- recognition_frequency ('monthly' | 'quarterly')
- last_recognition_date
- created_by (FK → users)
- timestamps
```

**`reconciliations`** - Bank reconciliations

```sql
- id (PK)
- account_id (FK → chart_of_accounts)
- reconciliation_date
- statement_balance, book_balance
- difference
- status ('pending' | 'completed')
- reconciled_by (FK → users)
- reconciled_at
- timestamps
```

**`recurring_transactions`** - Auto-posting templates

```sql
- id (PK)
- name
- frequency ('daily' | 'weekly' | 'monthly' | 'yearly')
- next_run_date
- last_run_date
- is_active
- template (JSON - journal entry structure)
- timestamps
```

**`batch_processing`** - Batch jobs

```sql
- id (PK)
- job_type
- status ('pending' | 'running' | 'completed' | 'failed')
- total_items, processed_items
- progress
- parameters (JSON)
- error_message
- started_at, completed_at
- timestamps
```

**`batch_items`** - Batch job items

```sql
- id (PK)
- batch_id (FK → batch_processing)
- item_data (JSON)
- status ('pending' | 'completed' | 'failed')
- error_message
- processed_at
- timestamps
```

**`currencies`** - Multi-currency support

```sql
- id (PK)
- code (unique, e.g., 'SAR', 'USD')
- name, symbol
- exchange_rate (to base currency)
- is_primary
- is_active
- timestamps
```

**`currency_denominations`** - Cash drawer setup

```sql
- id (PK)
- currency_id (FK → currencies)
- value
- type ('coin' | 'note')
- timestamps
```

**`document_sequences`** - Auto-numbering

```sql
- id (PK)
- document_type (unique)
- prefix
- current_number
- padding
- timestamps
```

**`settings`** - System settings (key-value)

```sql
- id (PK)
- key (unique)
- value (text)
- timestamps
```

**`telescope`** - Audit trail

```sql
- id (PK)
- user_id (FK → users)
- action ('CREATE' | 'UPDATE' | 'DELETE' | 'VIEW')
- module
- record_id
- old_values (JSON)
- new_values (JSON)
- ip_address
- timestamps
```

**`login_attempts`** - Security logging

```sql
- id (PK)
- username
- ip_address
- success (boolean)
- timestamps
```

### 5.2 Key Relationships

```txt
users
  ├─1:N→ invoices (cashier)
  ├─1:N→ purchases (buyer)
  ├─1:N→ payroll_cycles (created_by)
  └─1:N→ employees (as system user)

products
  ├─1:N→ invoice_items
  ├─1:N→ purchases
  └─1:N→ inventory_costing

invoices
  ├─1:N→ invoice_items
  ├─1:1→ zatca_einvoices
  └─N:1→ ar_customers

chart_of_accounts (self-referential hierarchy)
  └─1:N→ general_ledger

employees
  ├─1:N→ payroll_items
  ├─1:N→ employee_documents
  ├─1:N→ employee_allowances
  └─1:N→ employee_deductions

payroll_cycles
  └─1:N→ payroll_items
      └─1:N→ payroll_transactions
```

### 5.3 Multi-Currency Extension

Tables modified with currency support:

- `invoices`: Added `currency_id`, `exchange_rate`
- `purchases`: Added `currency_id`, `exchange_rate`
- `ar_transactions`: Added `currency_id`, `exchange_rate`
- `ap_transactions`: Added `currency_id`, `exchange_rate`

---

## 6. API Surface & Contracts

### 6.1 Base URL

```txt
http://localhost:8000/api
```

### 6.2 Authentication Endpoints

- POST `/login`

**Request:**

```json
{
  "username": "string",
  "password": "string"
}
```

**Response:**

```json
{
  "success": true,
  "session_token": "abc123...",
  "user": {
    "id": 1,
    "username": "admin",
    "full_name": "Administrator",
    "role": "admin",
    "permissions": { ... }
  }
}
```

- POST `/logout`

**Headers:** `X-Session-Token: {token}`
**Response:**

```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

- GET `/check`

**Headers:** `X-Session-Token: {token}`
**Response:**

```json
{
  "authenticated": true,
  "user": { ... }
}
```

### 6.3 Sales Endpoints

- GET `/invoices`

**Query Params:** `page`, `per_page`, `payment_type`, `customer_id`
**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "invoice_number": "INV-00001",
      "total_amount": 115.00,
      "payment_type": "cash",
      "customer_name": "John Doe",
      "created_at": "2026-01-09T10:00:00"
    }
  ],
  "pagination": {
    "current_page": 1,
    "per_page": 20,
    "total_records": 50,
    "total_pages": 3
  }
}
```

- POST `/invoices`

**Request:**

```json
{
  "items": [
    {
      "product_id": 1,
      "quantity": 2,
      "unit_type": "sub",
      "unit_price": 50.00
    }
  ],
  "payment_type": "cash",
  "customer_id": null,
  "discount_amount": 0,
  "amount_paid": 100.00,
  "currency_id": 1,
  "exchange_rate": 1.00
}
```

**Response:**

```json
{
  "success": true,
  "id": 123,
  "invoice_id": 123
}
```

- GET `/invoice_details?id={id}`

**Response:**

```json
{
  "success": true,
  "data": {
    "id": 1,
    "invoice_number": "INV-00001",
    "items": [
      {
        "product_id": 1,
        "product_name": "Product A",
        "quantity": 2,
        "unit_price": 50.00,
        "subtotal": 100.00
      }
    ],
    "zatcaEinvoice": {
      "qr_code": "base64..."
    }
  }
}
```

### 6.4 Purchase Endpoints

- GET `/purchases`

**Query Params:** `page`, `per_page`, `approval_status`
**Response:** Similar pagination structure

- POST `/purchases`

**Request:**

```json
{
  "product_id": 1,
  "quantity": 100,
  "invoice_price": 1500.00,
  "unit_type": "main",
  "supplier": "ABC Suppliers",
  "voucher_number": "PO-001",
  "production_date": "2026-01-01",
  "expiry_date": "2027-01-01",
  "vat_rate": 15,
  "notes": "Bulk order"
}
```

- POST `/purchases/approve`

**Request:**

```json
{
  "id": 123
}
```

### 6.5 General Ledger Endpoints

- GET `/trial_balance?as_of_date=2026-01-09`

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "account_code": "1010",
      "account_name": "Cash",
      "debit": 50000.00,
      "credit": 0.00
    }
  ],
  "totals": {
    "total_debits": 100000.00,
    "total_credits": 100000.00
  }
}
```

- GET `/account_details?code={account_code}`

**Response:**

```json
{
  "success": true,
  "account": {
    "code": "1010",
    "name": "Cash",
    "type": "Asset",
    "balance": 50000.00
  },
  "transactions": [...]
}
```

### 6.6 HR & Payroll Endpoints

- POST `/payroll/generate`

**Request:**

```json
{
  "cycle_name": "January 2026 Salary",
  "cycle_type": "salary",
  "period_start": "2026-01-01",
  "period_end": "2026-01-31",
  "employee_ids": [1, 2, 3]
}
```

**Response:**

```json
{
  "success": true,
  "cycle_id": 5,
  "items_created": 3,
  "total_amount": 45000.00
}
```

- POST `/payroll/{id}/approve`

**Request:** Empty body
**Response:**

```json
{
  "success": true,
  "message": "Payroll approved at level 2",
  "next_approver": "Manager Name"
}
```

- POST `/payroll/{id}/process-payment`

**Request:**

```json
{
  "payment_account_id": 10
}
```

**Response:**

```json
{
  "success": true,
  "voucher_number": "JV-00123"
}
```

### 6.7 Reports Endpoints

- GET `/reports/balance_sheet?as_of_date=2026-01-09`

**Response:**

```json
{
  "success": true,
  "data": {
    "assets": {
      "current_assets": { "cash": 50000, "receivables": 20000 },
      "total_assets": 70000
    },
    "liabilities": {
      "current_liabilities": { "payables": 15000 },
      "total_liabilities": 15000
    },
    "equity": {
      "capital": 50000,
      "retained_earnings": 5000,
      "total_equity": 55000
    },
    "balance_check": true
  }
}
```

- GET `/reports/profit_loss?start_date=2026-01-01&end_date=2026-01-31`

**Response:**

```json
{
  "success": true,
  "data": {
    "revenues": { "sales": 100000, "other": 5000 },
    "expenses": { "cogs": 60000, "operating": 20000 },
    "net_income": 25000
  }
}
```

### 6.8 Currency Endpoints

- GET `/currencies`

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "code": "SAR",
      "name": "Saudi Riyal",
      "symbol": "ر.س",
      "exchange_rate": 1.00,
      "is_primary": true,
      "is_active": true
    }
  ]
}
```

### 6.9 Standard Response Structure

**Success:**

```json
{
  "success": true,
  "data": { ... },
  "message": "Optional message",
  "pagination": { ... } // If applicable
}
```

**Error:**

```json
{
  "success": false,
  "message": "Error description",
  "errors": { ... } // Validation errors
}
```

**HTTP Status Codes:**

- `200`: Success
- `400`: Bad request / validation error
- `401`: Unauthorized
- `403`: Forbidden (permission denied)
- `404`: Not found
- `500`: Server error

---

## 7. Business Logic & Services

### 7.1 LedgerService

**Purpose:** Centralized GL posting engine

**Key Methods:**

```php
getNextVoucherNumber(string $documentType): string
```

- Generates sequential voucher numbers (e.g., JV-00001)
- Uses `document_sequences` table

```php
postTransaction(
    array $entries,
    ?string $referenceType = null,
    ?int $referenceId = null,
    ?string $voucherNumber = null,
    ?string $voucherDate = null
): string
```

- Posts double-entry transactions to `general_ledger`
- Validates debit/credit balance
- Assigns to current fiscal period
- Returns voucher number

```php
getAccountBalance(string $accountCode, ?string $asOfDate = null): float
```

- Calculates account balance (debits - credits for assets/expenses)
- Supports historical balance queries

```php
reverseTransaction(string $voucherNumber, ?string $description = null): string
```

- Creates reversing entries
- Used for invoice/purchase deletions

### 7.2 SalesService

**Purpose:** Invoice processing with stock and GL integration

**Key Methods:**

```php
createInvoice(array $data): int
```

1. Creates `invoices` record
2. Creates `invoice_items` records
3. Reduces product `stock_quantity`
4. Creates `inventory_costing` records
5. Posts to AR (if credit sale)
6. Posts GL entries:
   - DR: Cash/AR
   - CR: Sales Revenue
   - DR: COGS
   - CR: Inventory

```php
deleteInvoice(int $id): void
```

1. Marks invoice as `is_reversed`
2. Restores stock
3. Reverses AR transaction
4. Reverses GL entries

### 7.3 PayrollService

**Purpose:** Multi-level payroll workflow

**Key Methods:**

```php
generatePayroll(array $data, User $user): int
```

1. Creates `payroll_cycles` record with status='draft'
2. For each employee:
   - Calculates base_amount + allowances - deductions
   - Creates `payroll_items`
3. Sets approval_level based on total amount thresholds

```php
approvePayroll(int $id, User $user): void
```

1. Validates user is the next approver
2. Updates approval_level_X and approved_by_level_X
3. If all approvals complete:
   - Status → 'approved'
   - Calls `createAccrualEntries()`

```php
createAccrualEntries(PayrollCycle $cycle, User $user): void
```

- Posts accrual GL entries:
  - DR: Salary Expense (per employee)
  - CR: Salary Payable (per employee)

```php
processPayment(int $id, ?int $paymentAccountId = null): void
```

1. Creates `payroll_transactions` for each item
2. Posts payment GL entries:
   - DR: Salary Payable
   - CR: Cash/Bank
3. Updates cycle status → 'paid'

### 7.4 InventoryCostingService

**Purpose:** FIFO/Average cost calculation

**Methods:**

- `calculateCost(int $productId, int $quantity, string $method = 'FIFO'): float`
- Reads from `inventory_costing` table
- Used by SalesService for COGS calculation

### 7.5 DepreciationService

**Purpose:** Fixed asset depreciation

**Methods:**

- `calculateDepreciation(Asset $asset, Carbon $asOfDate): array`
  - Straight-line: `(cost - salvage) / useful_life`
  - Declining balance: `book_value * rate`
- `postDepreciation(Asset $asset, float $amount): void`
  - DR: Depreciation Expense
  - CR: Accumulated Depreciation

### 7.6 PermissionService

**Purpose:** Role-based access control (RBAC)

**Static Methods:**

```php
requirePermission(string $module, string $action): void
```

- Throws 403 if user lacks permission
- Used in all controller methods

```php
hasPermission(User $user, string $module, string $action): bool
```

- Checks `role_permissions` table
- Actions: 'view', 'create', 'edit', 'delete'

---

## 8. Security & Authentication

### 8.1 Authentication Flow

```txt
1. User submits login (username + password)
   ↓
2. AuthService validates credentials
   ↓
3. AuthService creates session record with unique token
   ↓
4. Token returned to frontend, stored in localStorage
   ↓
5. All API requests include X-Session-Token header
   ↓
6. ApiAuth middleware validates token against sessions table
   ↓
7. If valid, sets Laravel's authenticated user
   ↓
8. Controller can access auth()->user()
```

### 8.2 Session Management

**Sessions Table Structure:**

- `token`: Unique 64-character string
- `user_id`: Foreign key to users
- `last_activity`: Updated on each request
- Automatic cleanup of inactive sessions possible

**Session Expiration:**

- Configured in `.env`: `SESSION_LIFETIME=120` (minutes)
- Middleware can implement auto-expiration logic

### 8.3 Password Hashing

- Uses Laravel's `Hash` facade (bcrypt)
- Configured rounds: `BCRYPT_ROUNDS=12`

### 8.4 Authorization

**Role-Based Permissions:**

1. Each user has a `role_id`
2. `role_permissions` defines what each role can do per module
3. `PermissionService::requirePermission()` enforces in controllers

**Example:**

```php
// In controller
PermissionService::requirePermission('sales', 'create');
// Throws 403 if current user's role lacks 'sales.create'
```

### 8.5 Input Validation

**Form Requests:**

- `StoreInvoiceRequest`, `StorePurchaseRequest`, etc.
- Laravel's built-in validation rules
- Automatic JSON error responses

**Example:**

```php
class StoreInvoiceRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.quantity' => 'required|numeric|min:1',
            'payment_type' => 'required|in:cash,credit',
        ];
    }
}
```

### 8.6 SQL Injection Prevention

- **Eloquent ORM** used throughout
- No raw queries without parameter binding
- `DB::select()` calls use bindings

### 8.7 XSS Prevention

- Frontend: `escapeHtml()` utility in `lib/api.ts`
- React naturally escapes JSX content
- API responses are JSON (not HTML)

### 8.8 CORS Configuration

- Configured in Laravel for `localhost:3000`
- Production: Update `config/cors.php`

---

## 9. Developer Onboarding

### 9.1 Full Stack Local Setup

- **Step 1: Clone Repository**

```bash
git clone <repository-url>
cd accounting-system
```

- **Step 2: Backend Setup**

```bash
cd src

# Install dependencies
composer install

# Environment setup
cp .env.example .env
php artisan key:generate

# Database setup
touch database/database.sqlite
php artisan migrate
# Optional: php artisan db:seed

# Verify installation
php artisan --version
```

- **Step 3: Frontend Setup**

```bash
  cd ../public

  # Install dependencies
  npm install

  # Environment setup (if needed)
  echo "NEXT_PUBLIC_API_BASE=http://127.0.0.1:8000/api" > .env.local

  # Verify installation
  npm run build
```

- **Step 4: Run Both Apps**

  - **Terminal 1 (Backend):**

```bash
  cd src
  php artisan serve
  # Backend running on http://localhost:8000
```

- **Terminal 2 (Queue Worker):**

```bash
    cd src
    php artisan queue:listen
```

- **Terminal 3 (Frontend):**

```bash
    cd public
    npm run dev
    # Frontend running on http://localhost:3000
```

- **Step 5: Access Application**
  - Navigate to <http://localhost:3000>
  - Login with default credentials (if seeded)
    - Username: `admin`
    - Password: `admin` (change in production!)

### 9.2 Development Workflow

**Making Changes:**

1. **Backend Changes:**
   - Modify models, controllers, services in `/src/app`
   - Create migrations: `php artisan make:migration`
   - Run migrations: `php artisan migrate`
   - Clear cache: `php artisan config:clear`

2. **Frontend Changes:**
   - Modify pages in `/public/app`
   - Add components in `/public/components`
   - Update types in `/public/lib/types.ts`
   - Next.js auto-reloads on save

3. **Database Changes:**
   - Always create migrations (never edit existing ones in production)
   - Test rollback: `php artisan migrate:rollback`
   - Fresh migration: `php artisan migrate:fresh` (dev only!)

**Git Workflow:**

```bash
  # Create feature branch
  git checkout -b feature/new-module

  # Make changes, commit frequently
  git add .
  git commit -m "Add new module"

  # Push and create PR
  git push origin feature/new-module
```

### 9.3 Code Style Guidelines

**PHP (Backend):**

- Follow PSR-12
- Use type hints
- Services for business logic, controllers stay thin
- Use Form Requests for validation

**TypeScript (Frontend):**

- Use interfaces for all data structures
- Prefer `const` over `let`
- Use async/await over .then()
- Component file = PascalCase, utils file = camelCase

### 9.4 Testing

**Backend Tests:**

```bash
cd src
php artisan test
```

**Frontend:**

- No testing framework configured yet
- Recommend: Jest + React Testing Library

---

## 10. Troubleshooting & Common Issues

### 10.1 Backend Issues

- **Issue: "No application encryption key has been specified"**

```bash
php artisan key:generate
```

- **Issue: Database connection error**
  - Check `.env` file DB settings
  - For SQLite: Ensure `database/database.sqlite` exists
  - For MySQL: Verify credentials and database exists

- **Issue: 500 error on API calls**

```bash
# Check Laravel logs
tail -f storage/logs/laravel.log

# Clear all caches
php artisan cache:clear
php artisan config:clear
php artisan route:clear
```

- **Issue: Migrations fail**

```bash
  # Check migration status
  php artisan migrate:status

  # Rollback last batch
  php artisan migrate:rollback

  # Fresh install (DESTROYS DATA)
  php artisan migrate:fresh
```

- **Issue: "Class not found"**

```bash
  composer dump-autoload 
```

### 10.2 Frontend Issues

- **Issue: "Cannot connect to API"**
  - Verify backend is running on port 8000
  - Check `NEXT_PUBLIC_API_BASE` in `.env.local`
  - Check browser console for CORS errors

- **Issue: 401 Unauthorized on all API calls**
  - Check `localStorage.sessionToken` in browser DevTools
  - Token may have expired, try re-logging in
  - Verify backend session middleware is working

- **Issue: Module not found errors**

```bash
  # Clear Next.js cache
  rm -rf .next
  npm run dev
```

- **Issue: Build fails**

```bash
  # Clear node_modules
  rm -rf node_modules package-lock.json
  npm install
```

### 10.3 Common Development Pitfalls

- **Problem: Changes not reflecting**
  - **Backend:** Clear cache (`php artisan config:clear`)
  - **Frontend:** Hard refresh (Ctrl+Shift+R) or restart dev server

- **Problem: Stock going negative**
  - Check `InventoryCostingService` logic
  - Verify purchase approvals are posting to stock

- **Problem: GL entries not balancing**
  - Review `LedgerService::postTransaction()`
  - Ensure all service methods pass balanced entries

- **Problem: Payroll approval stuck**
  - Check `users.manager_id` hierarchy
  - Verify approval workflow in `PayrollService`

---

## 11. Deployment Guide

### 11.1 Production Checklist

**Backend:**

- [ ] Set `APP_ENV=production`
- [ ] Set `APP_DEBUG=false`
- [ ] Use MySQL/PostgreSQL (not SQLite)
- [ ] Configure proper `APP_URL`
- [ ] Set strong `APP_KEY`
- [ ] Configure email driver
- [ ] Set up queue worker as service
- [ ] Configure log rotation
- [ ] Set proper file permissions (storage, bootstrap/cache)
- [ ] Run `composer install --optimize-autoloader --no-dev`
- [ ] Run `php artisan config:cache`
- [ ] Run `php artisan route:cache`
- [ ] Run `php artisan view:cache`

**Frontend:**

- [ ] Update `NEXT_PUBLIC_API_BASE` to production URL
- [ ] Run `npm run build`
- [ ] Use `npm start` or deploy to Vercel/Netlify
- [ ] Configure environment variables on hosting platform

### 11.2 Server Requirements

**Backend:**

- PHP 8.2+
- Composer
- MySQL 8.0+ or PostgreSQL 13+
- Web server (Apache/Nginx)
- Supervisor (for queue workers)

**Frontend:**

- Node.js 20+
- npm/yarn
- (Or deploy to Vercel/Netlify)

### 11.3 Database Migration

```bash
# Backup production database first!
mysqldump -u user -p dbname > backup.sql

# Run migrations
php artisan migrate --force
```

### 11.4 Queue Worker Setup (Supervisor)

**`/etc/supervisor/conf.d/accounting-queue.conf`:**

```ini
[program:accounting-queue]
process_name=%(program_name)s_%(process_num)02d
command=php /path/to/src/artisan queue:work --sleep=3 --tries=3
autostart=true
autorestart=true
user=www-data
numprocs=2
redirect_stderr=true
stdout_logfile=/path/to/src/storage/logs/queue.log
```

```bash
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl start accounting-queue:*
```

### 11.5 Nginx Configuration Example

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;
    root /path/to/src/public;

    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";

    index index.php;

    charset utf-8;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location = /favicon.ico { access_log off; log_not_found off; }
    location = /robots.txt  { access_log off; log_not_found off; }

    error_page 404 /index.php;

    location ~ \.php$ {
        fastcgi_pass unix:/var/run/php/php8.2-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
    }

    location ~ /\.(?!well-known).* {
        deny all;
    }
}
```

---

## Appendix A: Key Files Reference

### Backend Key Files

```txt
src/
├── app/Http/Controllers/Api/
│   ├── SalesController.php          # Invoice operations
│   ├── PurchasesController.php      # Purchase management
│   ├── PayrollController.php        # HR payroll
│   ├── GeneralLedgerController.php  # GL operations
│   └── ReportsController.php        # Financial reports
├── app/Services/
│   ├── LedgerService.php            # Core GL engine
│   ├── SalesService.php             # Sales business logic
│   └── PayrollService.php           # Payroll workflow
├── routes/api.php                    # API route definitions
└── database/migrations/              # Database schema
```

### Frontend Key Files

```txt
public/
├── app/
│   ├── system/dashboard/page.tsx    # Main dashboard
│   ├── sales/sales/page.tsx         # POS interface
│   ├── finance/general_ledger/page.tsx
│   └── hr/page.tsx                  # HR & Payroll UI
├── lib/
│   ├── api.ts                       # API client
│   ├── types.ts                     # TypeScript interfaces
│   └── auth.ts                      # Auth utilities
└── components/                       # Reusable components
```

---

## Appendix B: Glossary

| Term | Definition |
| ------ | ------------ |
| **AR** | Accounts Receivable - money owed by customers |
| **AP** | Accounts Payable - money owed to suppliers |
| **GL** | General Ledger - core accounting journal |
| **COGS** | Cost of Goods Sold |
| **FIFO** | First In, First Out - inventory costing method |
| **ZATCA** | Saudi e-invoicing authority |
| **TLV** | Tag-Length-Value encoding for QR codes |
| **Voucher Number** | Unique identifier for GL transactions |
| **Fiscal Period** | Accounting period (month/quarter/year) |
| **Chart of Accounts** | Hierarchical list of GL accounts |
| **Trial Balance** | Report showing all account balances |
| **Accrual** | Recording revenue/expense when incurred (not paid) |

---

## Appendix C: Contact & Support

**Documentation Version:** 1.0  
**Last Reviewed:** January 9, 2026

For issues or questions:

1. Check logs: `src/storage/logs/laravel.log`
2. Review this documentation
3. Submit issue with detailed error logs
