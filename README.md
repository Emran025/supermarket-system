# Accounting System - Monorepo

> **Enterprise-Grade Accounting System** | Laravel 12 + Next.js 16 | Full-Stack TypeScript/PHP

[![Laravel](https://img.shields.io/badge/Laravel-12.x-red.svg)](https://laravel.com)
[![Next.js](https://img.shields.io/badge/Next.js-16.x-black.svg)](https://nextjs.org)
[![PHP](https://img.shields.io/badge/PHP-8.2+-777BB4.svg)](https://php.net)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org)

---

## Quick Start

### Prerequisites

- **PHP 8.2+** with extensions: `sqlite3`, `mbstring`, `xml`, `bcmath`, `json`, `curl`
- **Composer** (latest)
- **Node.js 20+** and npm
- **Git**

### Installation (5 minutes)

```bash
# 1. Clone the repository
git clone <your-repo-url>
cd accounting-system

# 2. Backend Setup
cd src
composer install
cp .env.example .env
php artisan key:generate
touch database/database.sqlite
php artisan migrate

# 3. Frontend Setup
cd ../public
npm install

# 4. Run the application
# Terminal 1 - Backend
cd src && php artisan serve

# Terminal 2 - Frontend
cd public && npm run dev

# 5. Access the app
# Open http://localhost:3000
# Default login: admin / admin
```

---

## Documentation

For **complete technical documentation**, see:

### **[TECHNICAL_DOCUMENTATION.md](./docs/TECHNICAL_DOCUMENTATION.md)**

This comprehensive guide includes:

- **Architecture & Design Patterns**
- **Complete Database Schema** (49 tables, 46 models)
- **API Reference** (All endpoints with examples)
- **Business Logic** (Services, workflows)
- **Security & Authentication**
- **Developer Onboarding**
- **Deployment Guide**

---

## What's Inside

### Core Features

| Module | Description |
| -------- | ------------- |
| **Sales & POS** | Cash/credit sales, ZATCA e-invoicing, barcode/QR generation |
| **Inventory** | Multi-level approval, FIFO/Average costing, expiry tracking |
| **AR/AP** | Customer/supplier management, aging reports, payment tracking |
| **General Ledger** | Double-entry bookkeeping, trial balance, journal vouchers |
| **Financial Reports** | Balance Sheet, P&L, Cash Flow, Comparative Analysis |
| **Accrual Accounting** | Prepayments, unearned revenue, payroll accruals |
| 👥 **HR & Payroll** | Multi-level approval workflow, salary processing |
| **Fixed Assets** | Depreciation (SL/DB), asset lifecycle management |
| **Multi-Currency** | Exchange rates, currency conversion |
| **Fiscal Periods** | Period locking, year-end closing |
| **Batch Processing** | Background jobs, bulk operations |

---

## Architecture

```txt
┌─────────────────────────────────────┐
│   NEXT.JS FRONTEND (Port 3000)      │
│   React 19 + TypeScript + Tailwind  │
└─────────────────┬───────────────────┘
                  │ REST API (JSON)
┌─────────────────▼───────────────────┐
│    LARAVEL BACKEND (Port 8000)      │
│    PHP 8.2 + MVC + Service Layer    │
└─────────────────┬───────────────────┘
                  │
┌─────────────────▼───────────────────┐
│    DATABASE (SQLite/MySQL)          │
│    49 Tables, Full ACID Compliance  │
└─────────────────────────────────────┘
```

**Design Patterns:**

- **Backend:** Service Layer, Repository (Eloquent), Form Requests, Middleware
- **Frontend:** Component-based, Custom Hooks, Utility-first CSS

---

## Project Structure

```txt
accounting-system/
│
├── src/                      # Laravel Backend (API)
│   ├── app/
│   │   ├── Http/Controllers/Api/  # 33 Controllers
│   │   ├── Models/                # 46 Eloquent Models
│   │   ├── Services/              # 10 Business Services
│   │   └── Helpers/               # Utility Functions
│   ├── database/migrations/       # 49 Migration Files
│   ├── routes/api.php            # API Routes
│   └── ...
│
└── public/                   # Next.js Frontend
    ├── app/                  # App Router Pages
    │   ├── auth/             # Authentication
    │   ├── system/           # Dashboard, Settings, Reports
    │   ├── sales/            # Sales & Invoicing
    │   ├── purchases/        # Purchases & Expenses
    │   ├── finance/          # GL, Accounts, Periods
    │   └── hr/               # HR & Payroll
    ├── components/           # Reusable Components
    ├── lib/                  # API, Types, Utilities
    └── ...
```

---

## Development

### Running Locally

**Full Stack (Recommended):**

```bash
# Terminal 1 - Backend
cd src
php artisan serve

# Terminal 2 - Queue Worker
cd src
php artisan queue:listen

# Terminal 3 - Frontend
cd public
npm run dev
```

**With Composer Script (Backend only):**

```bash
cd src
composer dev
# Runs: API, Queue, Logs, Vite concurrently
```

### Making Changes

**Backend (Laravel):**

```bash
# Create migration
php artisan make:migration create_table_name

# Run migrations
php artisan migrate

# Create controller
php artisan make:controller Api/MyController

# Clear cache
php artisan config:clear
```

**Frontend (Next.js):**

- Edit files in `public/app/`
- Auto-reloads on save
- Add types to `lib/types.ts`
- Build: `npm run build`

---

## Testing

**Backend:**

```bash
cd src
php artisan test
```

**Frontend:**

- Testing framework not yet configured
- Recommended: Jest + React Testing Library

---

## Database Schema Highlights

**49 Tables Covering:**

| Category | Tables |
| ---------- | -------- |
| **Auth & Users** | users, sessions, roles, modules, role_permissions, login_attempts |
| **Inventory** | products, categories, purchases, purchase_requests, inventory_costing, inventory_counts |
| **Sales** | invoices, invoice_items, zatca_einvoices |
| **AR/AP** | ar_customers, ar_transactions, ap_suppliers, ap_transactions |
| **Finance** | chart_of_accounts, general_ledger, fiscal_periods, journal_vouchers |
| **HR & Payroll** | employees, departments, payroll_cycles, payroll_items, payroll_transactions, employee_documents, employee_allowances, employee_deductions |
| **Advanced** | assets, asset_depreciation, prepayments, unearned_revenue, reconciliations, currencies, currency_denominations |
| **System** | settings, document_sequences, batch_processing, batch_items, recurring_transactions, telescope (audit) |

---

## Security

- **Authentication:** Session-based with secure tokens
- **Authorization:** Role-based permissions (RBAC)
- **Validation:** Laravel Form Requests
- **SQL Injection:** Protected via Eloquent ORM
- **XSS:** React auto-escaping + custom utilities
- **Password Hashing:** Bcrypt (12 rounds)

---

## Deployment

### Production Checklist

**Backend:**

```bash
# Set environment
APP_ENV=production
APP_DEBUG=false

# Use production database (MySQL/PostgreSQL)
DB_CONNECTION=mysql

# Optimize
composer install --optimize-autoloader --no-dev
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Run migrations
php artisan migrate --force

# Set up queue worker with Supervisor
```

**Frontend:**

```bash
# Build
npm run build

# Run production server
npm start

# Or deploy to Vercel/Netlify
```

See [TECHNICAL_DOCUMENTATION.md](./docs/TECHNICAL_DOCUMENTATION.md#11-deployment-guide) for detailed deployment instructions.

---

## API Documentation

**Base URL:** `http://localhost:8000/api`

**Authentication:**

- Header: `X-Session-Token: {your_token}`
- Obtain via: `POST /api/login`

**Key Endpoints:**

| Endpoint | Method | Description |
| ---------- | -------- | ------------- |
| `/login` | POST | User authentication |
| `/invoices` | GET | List invoices (paginated) |
| `/invoices` | POST | Create invoice |
| `/purchases` | GET, POST | Purchase management |
| `/trial_balance` | GET | Trial balance report |
| `/reports/balance_sheet` | GET | Balance sheet |
| `/reports/profit_loss` | GET | P&L statement |
| `/payroll/generate` | POST | Generate payroll cycle |
| `/employees` | GET, POST | Employee management |

**Response Format:**

```json
{
  "success": true,
  "data": { ... },
  "pagination": { ... }
}
```

See [TECHNICAL_DOCUMENTATION.md](./docs/TECHNICAL_DOCUMENTATION.md#6-api-surface--contracts) for complete API reference.

---

## Tech Stack

### Backend (`/src`)

- **Framework:** Laravel 12
- **Language:** PHP 8.2+
- **Database:** SQLite (dev), MySQL/PostgreSQL (prod)
- **ORM:** Eloquent
- **Queue:** Database driver
- **Cache:** Database driver

### Frontend (`/public`)

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript 5
- **UI Library:** React 19
- **Styling:** Tailwind CSS 4
- **HTTP Client:** Fetch API

---

## Troubleshooting

**Common Issues:**

| Problem | Solution |
| --------- | ---------- |
| "No encryption key" | `php artisan key:generate` |
| Database error | Check `.env` DB settings, ensure DB exists |
| 500 API error | Check `storage/logs/laravel.log` |
| Frontend can't connect | Verify backend running on port 8000 |
| 401 Unauthorized | Clear localStorage, re-login |
| Changes not reflecting | Clear cache: `php artisan config:clear` |

See [TECHNICAL_DOCUMENTATION.md](./docs/TECHNICAL_DOCUMENTATION.md#10-troubleshooting--common-issues) for detailed troubleshooting.

---

## License

MIT License - See LICENSE file for details

---

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

---

## Support

- **Documentation:** [TECHNICAL_DOCUMENTATION.md](./docs/TECHNICAL_DOCUMENTATION.md)
- **Issues:** Submit via GitHub Issues with detailed logs
- **Logs:** Check `src/storage/logs/laravel.log`

---

> Built with using Laravel & Next.js
> **build by: Emran Nasser && AI Aigents**
