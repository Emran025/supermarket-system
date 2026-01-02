# Frontend Documentation

## Overview

The frontend is a Single Page Application (SPA-like) built with **Vanilla JavaScript**, focusing on performance and a "Premium" user experience. It uses a component-based logical structure without the overhead of heavy frameworks like React or Vue.

## UI Pages and Components

### 1. Dashboard (`dashboard.html`)

- **Purpose**: High-level overview of store performance.
- **Features**:
  - Real-time counters for Daily Sales, Total Products, and Low Stock alerts.
  - "Recent Sales" table for quick monitoring.
  - Quick Action shortcuts.
- **UX**: Auto-refreshing stats and animated counters.

### 2. Point of Sale (`sales.html`)

- **Purpose**: Fast checkout interface for cashiers.
- **Features**:
  - Barcode scanner compatible input.
  - Searchable product dropdown.
  - Real-time subtotal calculation.
  - **Thermal Printing**: Generates a receipt with QR code (ZATCA compatible) immediately after sale.

### 3. Products Management (`products.html`)

- **Purpose**: Inventory control.
- **Features**:
  - Advanced Search & Filtering.
  - Add/Edit/Delete products with validation.
  - "Minimum Profit Margin" warnings.

### 4. Application Settings (`settings.html`)

- **Purpose**: System-wide configuration.
- **Features**:
  - Update Store Name, Address, and Phone (appears on invoices).
  - Configure Tax status.
  - Toggle between A4 and Thermal printer formats.

### 5. User Management (`users.html`)

- **Purpose**: Administer staff accounts.
- **Features**:
  - Create full Administrators or restricted Sales accounts.
  - Reset passwords.

### 6. Login (`login.html`)

- **Purpose**: Secure entry point.
- **Features**:
  - Brute-force protection feedback.
  - Clean, modern aesthetic with glassmorphism effects.

## Technologies Used

- **HTML5 & Vanilla JavaScript**: Core logic, using ES6+ features (Modules, Async/Await).
- **CSS3 Variables**: For theming (Colors, Spacing, Typography).
- **FontAwesome 6**: For scalable interface icons.
- **Custom SVG Icons**: Lightweight internal icon set for core UI elements (`common.js`).
- **Google Fonts**: Uses 'Cairo' (or similar) for modern Arabic typography.
- **Fetch API**: For all backend communication.

## Validation and UX Considerations

- **Optimistic UI**: UI updates immediately where safe, improving perceived speed.
- **Input Masking**: Prices and Quantities are validated to prevent invalid calculations.
- **Feedback**: Toast notifications (`showToast()`) and custom Modal Dialogs replace browser alerts for a professional feel.
- **Responsive**: Fully functional on Mobile and Desktop.
- **Search**: "Smart Search" debounces input to prevent API flooding.
