# Project Description

## Project Idea

The Supermarket Management System is designed as a lightweight yet powerful ERP solution for small to medium-sized retail businesses. It focuses on the core pillars of retail: Product Cataloging, Inventory Control, Purchasing (Inbound), Sales (Outbound), and Business Intelligence.

## Business Logic

The system implements several critical business rules:

1. **Inventory Valuation**: Uses the "Last Purchase Price" method. When a new purchase is recorded, the system suggests a new selling price by adding the `minimum_profit_margin` to the cost per unit of the latest purchase.
2. **Unit Conversion**: Products are often bought in bulk and sold individually. The system supports `items_per_unit` to convert main units (Invoices) into sub-units (Sales).
3. **Stock Integrity**:
   - A Sale decreases stock.
   - A Purchase increases stock.
   - Deleting a Sale (within 48 hours) restores stock.
   - Deleting a Purchase (within 24 hours) decreases stock.
4. **Time-Limited Edits**: To maintain financial integrity, sales and purchase records are locked for deletion/editing after a grace period (48 hours for sales, 24 hours for purchases).
5. **E-Invoicing**: All sales generate a cryptographic QR code (TLV base64) to comply with modern tax regulations.

## Main Workflows

### 1. Product Setup

- Admin creates a new category (e.g., "Beverages").
- Admin adds a new product, defining its name, category, and minimum profit margin.
- Initial stock can be set, or left at zero to be populated via purchases.

### 2. Purchasing Workflow

- Staff receives goods from a supplier.
- Staff records a "Purchase" in the system, selecting the product and specifying the quantity and total invoice price.
- The system automatically:
  - Increments the product's `stock_quantity`.
  - Updates the product's `unit_price` based on the new cost + margin.

### 3. Sales Workflow (POS)

- Cashier selects products for a customer.
- System checks stock availability.
- Cashier finalizes the "Invoice".
- The system automatically:
  - Decrements the `stock_quantity`.
  - Generates a unique invoice number and records the transaction.
  - Triggers the print dialog for a thermal receipt.

## Assumptions and Constraints

- **Currency**: Configurable in Settings (defaulting to YER/SAR).
- **Concurrency**: The system assumes a controlled environment where multiple users might access the API, handled via atomic SQL transactions.
- **Data Persistence**: Data is persisted in a relational database (MariaDB/MySQL).
- **Network**: Requires a stable connection to the server for real-time stock updates.
