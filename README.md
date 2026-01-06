# Supermarket Management System

A comprehensive retail management system with integrated financial accounting, accounts receivable, and inventory control features.

## Features

### Core Retail Operations

- **Product Management**: Multi-unit product handling (main unit/sub-unit conversion)
- **Point of Sale (POS)**: Cash and credit sales with real-time inventory updates
- **Inventory Control**: Stock tracking, expiry date management, and replenishment workflows
- **Purchase Management**: Stock acquisition recording with automatic price calculation
- **Purchase Requests**: Staff-initiated procurement workflow with approval system

### Financial Management

- **Accounts Receivable (AR)**: Customer credit accounts with ledger tracking
- **Expenses Tracking**: Categorized business expense recording
- **Asset Management**: Fixed asset tracking with depreciation
- **Revenue Recording**: Non-POS cash revenue tracking
- **Financial Reports**: Balance sheet and income statement generation

### System Management

- **User Management**: Role-based access control (Admin, Manager, Sales)
- **Audit Logging**: Complete transaction history via Telescope module
- **Session Management**: Secure authentication with brute-force protection
- **Settings Configuration**: Customizable store information and invoice templates

## Technology Stack

### Backend

- **Language**: PHP 7.4+
- **Database**: MySQL/MariaDB (InnoDB engine)
- **Architecture**: MVC pattern with Controller-based routing
- **Authentication**: Session-based with secure token management

### Frontend

- **Core**: Vanilla JavaScript (ES6+)
- **Styling**: CSS3 with custom variables
- **Icons**: FontAwesome 6
- **Fonts**: Google Fonts (Outfit, Cairo)
- **Communication**: Fetch API for async requests

## Project Structure

```batch
supermarket-system/
├── domain/              # Backend logic layer
│   ├── api/            # Controller classes
│   │   ├── ArController.php
│   │   ├── AssetsController.php
│   │   ├── AuthController.php
│   │   ├── CategoriesController.php
│   │   ├── Controller.php (Base class)
│   │   ├── DashboardController.php
│   │   ├── ExpensesController.php
│   │   ├── ProductsController.php
│   │   ├── PurchasesController.php
│   │   ├── ReportsController.php
│   │   ├── RevenuesController.php
│   │   ├── Router.php
│   │   ├── SalesController.php
│   │   ├── SettingsController.php
│   │   └── UsersController.php
│   ├── api.php         # API entry point
│   ├── auth.php        # Authentication helpers
│   ├── config.php      # Database configuration
│   ├── db.php          # Database initialization & helpers
│   └── init.php        # System bootstrap
├── presentation/        # Frontend layer
│   ├── assets/         # Static resources
│   ├── *.html          # Page templates
│   ├── *.js            # Page controllers
│   ├── common.js       # Shared utilities
│   ├── styles.css      # Global stylesheet
│   └── qrcode.js       # QR code generation library
├── docs/               # Documentation
└── index.php           # Application entry point
```

## Key Capabilities

### Inventory Valuation

- Uses "Last Purchase Price" method
- Automatic selling price calculation based on cost + minimum profit margin
- Main unit to sub-unit conversion (e.g., Cartons to Pieces)

### Credit Management

- Customer profiles with contact and tax information
- Transaction ledger (invoices, payments, returns)
- Automatic balance calculation and tracking

### Financial Reporting

- **Assets**: Cash estimate, Inventory value, Fixed assets, Accounts receivable
- **Income Statement**: Sales, Revenues, Purchases, Expenses, Net profit

### Audit Trail

- Every CREATE, UPDATE, DELETE operation logged
- JSON snapshots of before/after states
- User, IP, and timestamp tracking

## Quick Start

### Requirements

- PHP 7.4 or higher
- MySQL 5.7+ or MariaDB 10.4+
- Apache/Nginx web server

### Installation

1. Clone/extract to server root (e.g., `htdocs/supermarket-system`)
2. Configure database in `domain/config.php`
3. Navigate to system URL (e.g., `http://localhost/supermarket-system`)
4. System auto-creates database and tables on first run

### Default Credentials

- **Username**: `admin`
- **Password**: `admin123`

## Documentation

See `/docs` folder for detailed documentation:

- `overview.md` - System overview
- `architecture.md` - Technical architecture  
- `backend.md` - Backend implementation
- `frontend.md` - Frontend implementation
- `api-overview.md` - API reference
- `database/` - Database schema and relationships
- `setup-and-usage.md` - Installation and user guide

## License

MIT License
