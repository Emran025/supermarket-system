# Database Schema - Entity Relationship Diagram

> **Accounting System Database Structure**  
> 49 Tables | Full ACID Compliance | Normalized Design

---

## Overview

This document provides a detailed Entity Relationship Diagram (ERD) for the accounting system database in text format, showing all tables, columns, relationships, and constraints.

---

## Table Groups

### 1. Authentication & Authorization

- `users` - System users
- `sessions` - Active sessions
- `roles` - User roles
- `modules` - System modules
- `role_permissions` - Permission matrix
- `login_attempts` - Security audit

### 2. Inventory Management

- `products` - Inventory items
- `categories` - Product categories
- `purchases` - Purchase transactions
- `purchase_requests` - Purchase requisitions
- `inventory_costing` - Cost tracking (FIFO/Average)
- `inventory_counts` - Physical inventory

### 3. Sales & Invoicing

- `invoices` - Sales invoices
- `invoice_items` - Invoice line items
- `zatca_einvoices` - ZATCA compliance data

### 4. Accounts Receivable

- `ar_customers` - Customer master
- `ar_transactions` - Customer ledger

### 5. Accounts Payable

- `ap_suppliers` - Supplier master
- `ap_transactions` - Supplier ledger

### 6. General Ledger

- `chart_of_accounts` - Account hierarchy
- `general_ledger` - Journal entries
- `fiscal_periods` - Accounting periods
- `journal_vouchers` - Manual entries

### 7. HR & Payroll

- `employees` - Employee master
- `departments` - Organizational units
- `payroll_cycles` - Payroll runs
- `payroll_items` - Employee payroll entries
- `payroll_transactions` - Payment records
- `payroll_entries` - Legacy/audit
- `employee_documents` - Document attachments
- `employee_allowances` - Recurring allowances
- `employee_deductions` - Recurring deductions

### 8. Fixed Assets

- `assets` - Asset register
- `asset_depreciation` - Depreciation schedule

### 9. Accrual Accounting

- `prepayments` - Prepaid expenses
- `unearned_revenue` - Deferred revenue

### 10. Banking & Reconciliation

- `reconciliations` - Bank reconciliations

### 11. Multi-Currency

- `currencies` - Currency master
- `currency_denominations` - Cash drawer setup

### 12. System Administration

- `settings` - System settings (key-value)
- `document_sequences` - Auto-numbering
- `batch_processing` - Batch jobs
- `batch_items` - Batch job items
- `recurring_transactions` - Auto-posting templates
- `telescope` - Audit trail

---

## Detailed Entity Relationships

### 1. Users & Authentication Flow

```txt
┌─────────────────┐
│     users       │
├─────────────────┤
│ PK: id          │
│ UK: username    │
│ FK: role_id     ├──────┐
│ FK: manager_id  │      │ Self-referential
│ FK: created_by  │◄─────┘
└────────┬────────┘
         │ 1
         │
         │ N
┌────────┴────────┐
│   sessions      │      ┌──────────────┐
├─────────────────┤      │    roles     │
│ PK: id          │      ├──────────────┤
│ UK: token       │      │ PK: id       │
│ FK: user_id     │      │ UK: role_key │
└─────────────────┘      └───────┬──────┘
                                 │ 1
                                 │
                                 │ N
                         ┌───────┴──────────┐
                         │ role_permissions │
                         ├──────────────────┤
                         │ PK: id           │
                         │ FK: role_id      │
                         │ FK: module_id    ├────┐
                         └──────────────────┘    │
                                                 │ N
                                                 │
                                                 │ 1
                                         ┌───────┴────────┐
                                         │     modules    │
                                         ├────────────────┤
                                         │ PK: id         │
                                         │ UK: module_key │
                                         └────────────────┘
```

### 2. Inventory & Product Management

```txt
┌──────────────┐
│ categories   │ 1
├──────────────┤
│ PK: id       ├────────┐
│    name      │        │
└──────────────┘        │
                        │ N
              ┌─────────┴──────────┐
              │      products      │
              ├────────────────────┤
              │ PK: id             │
              │ UK: barcode        │
              │ FK: category_id    │
              │ FK: created_by     │
              │    name            │
              │    stock_quantity  │
              │    selling_price   │
              └────────┬───────────┘
                       │ 1
       ┌───────────────┼───────────────┐
       │ N             │ N             │ N
┌──────┴──────┐  ┌─────┴───────┐  ┌─────┴────────────┐
│ purchases   │  │invoice_items│  │inventory_costing │
├─────────────┤  ├─────────────┤  ├──────────────────┤
│ PK: id      │  │ PK: id      │  │ PK: id           │
│ FK: product │  │ FK: product │  │ FK: product_id   │
│ FK: supplier│  │ FK: invoice │  │    transaction_  │
│ FK: user_id │  │   quantity  │  │    type          │
│   quantity  │  │   subtotal  │  │    unit_cost     │
└─────────────┘  └─────────────┘  └──────────────────┘
```

### 3. Sales & Invoicing Flow

```txt
┌──────────────────┐
│   ar_customers   │ 1
├──────────────────┤
│ PK: id           ├────────────┐
│ UK: account_code │            │
│    name          │            │
│    balance       │            │
└──────────────────┘            │
                                │ N
                      ┌─────────┴─────────┐
                      │     invoices      │
                      ├───────────────────┤
                      │ PK: id            │
                      │ UK: invoice_number│
                      │ FK: customer_id   │
                      │ FK: user_id       │
                      │    total_amount   │
                      │    payment_type   │
                      │    is_reversed    │
                      └────────┬──────────┘
                               │ 1
               ┌───────────────┼────────────────┐
               │ N             │ 1              │ 1
      ┌────────┴───────┐  ┌────┴────────────┐  ┌┴──────────────┐
      │ invoice_items  │  │zatca_einvoices  │  │ar_transactions│
      ├────────────────┤  ├─────────────────┤  ├───────────────┤
      │ PK: id         │  │ PK: id          │  │ PK: id        │
      │ FK: invoice_id │  │ FK: invoice_id  │  │ FK: customer  │
      │ FK: product_id │  │    uuid         │  │    type       │
      │    quantity    │  │    qr_code      │  │    amount     │
      │    unit_price  │  │    invoice_hash │  │   voucher_#   │
      └────────────────┘  └─────────────────┘  └───────────────┘
```

### 4. Purchases & Accounts Payable

```txt
┌──────────────────┐
│   ap_suppliers   │ 1
├──────────────────┤
│ PK: id           ├────────────┐
│ UK: account_code │            │
│    name          │            │
└──────────────────┘            │
                                │ N
                      ┌─────────┴─────────┐
                      │    purchases      │
                      ├───────────────────┤
                      │ PK: id            │
                      │ FK: product_id    │
                      │ FK: supplier_id   │
                      │ FK: user_id       │
                      │    quantity       │
                      │    invoice_price  │
                      │    approval_status│
                      │    is_reversed    │
                      └───────────────────┘
                               │
                               │
                      ┌────────┴──────────┐
                      │ ap_transactions   │
                      ├───────────────────┤
                      │ PK: id            │
                      │ FK: supplier_id   │
                      │    type           │
                      │    amount         │
                      │    voucher_number │
                      └───────────────────┘
```

### 5. General Ledger Core

```txt
┌──────────────────────┐
│ chart_of_accounts    │ Self-referential
├──────────────────────┤
│ PK: id               │◄────┐
│ UK: account_code     │     │
│ FK: parent_id        ├─────┘
│    account_name      │
│    account_type      │
│    is_active         │
└──────────┬───────────┘
           │ 1
           │
           │ N
┌──────────┴───────────┐     ┌─────────────────┐
│  general_ledger      │  N  │ fiscal_periods  │ 1
├──────────────────────┤─────┤                 │
│ PK: id               │     │ PK: id          │
│ FK: account_id       │     │    period_name  │
│ FK: fiscal_period_id │     │    start_date   │
│ FK: created_by       │     │    end_date     │
│    voucher_number    │     │    status       │
│    entry_type        │     │    is_current   │
│    amount            │     └─────────────────┘
│    reference_type    │
│    reference_id      │
│    is_reversed       │
└──────────────────────┘
```

### 6. HR & Payroll System

```txt
┌──────────────┐
│ departments  │ 1
├──────────────┤
│ PK: id       ├────────┐
│    name      │        │
└──────────────┘        │
                        │ N
                ┌───────┴──────────────┐
                │     employees        │ Self-referential
                ├──────────────────────┤◄────┐
                │ PK: id               │     │
                │ UK: employee_code    │     │
                │ UK: email            │     │
                │ FK: department_id    │     │
                │ FK: account_id       ├─┐   │
                │ FK: role_id          │ │   │
                │ FK: user_id          │ │   │
                │ FK: manager_id       ├─┘   │
                │    base_salary       │     │
                │    employment_status │     │
                └──────────┬───────────┘     │
                           │ 1               │
        ┌──────────────────┼─────────────────┼────────────────┐
        │ N                │ N               │ N              │ N
┌───────┴────────┐  ┌──────┴──────┐   ┌──────┴──────┐  ┌──────┴──────┐
│employee_       │  │employee_    │   │employee_    │  │payroll_items│
│documents       │  │allowances   │   │deductions   │  │             │
├────────────────┤  ├─────────────┤   ├─────────────┤  ├─────────────┤
│PK: id          │  │PK: id       │   │PK: id       │  │PK: id       │
│FK: employee_id │  │FK: employee │   │FK: employee │  │FK: employee │
│   document_url │  │   type      │   │   type      │  │FK: cycle_id │
└────────────────┘  │   amount    │   │   amount    │  │  net_amount │
                    └─────────────┘   └─────────────┘  │  status     │
                                                       └──────┬──────┘
                                                              │ 1
                             ┌────────────────────────────────┤
                             │ N                              │ 1
                     ┌───────┴────────────┐         ┌─────────┴─────────┐
                     │payroll_transactions│         │  payroll_cycles   │
                     ├────────────────────┤         ├───────────────────┤
                     │PK: id              │         │PK: id             │
                     │FK: payroll_item_id │         │   cycle_name      │
                     │   amount           │         │   cycle_type      │
                     │   payment_method   │         │   status          │
                     │   voucher_number   │         │   approval_level  │
                     └────────────────────┘         │   total_amount    │
                                                    │   voucher_number  │
                                                    └───────────────────┘
```

### 7. Multi-Level Approval Workflow (Payroll)

```txt
Payroll Approval Hierarchy:

┌─────────────────┐
│ payroll_cycles  │
├─────────────────┤
│ status:         │
│  - draft        │
│  - pending_     │
│    approval     │
│  - approved     │
│  - paid         │
├─────────────────┤
│ approval_level: │
│  1, 2, or 3     │
│                 │
│ approved_by_    │
│ level_1         ├──► FK: users
│ approved_by_    │
│ level_2         ├──► FK: users
│ approved_by_    │
│ level_3         ├──► FK: users
└─────────────────┘

Workflow:
1. Created by user → status='draft', approval_level set
2. First approval → approved_by_level_1 filled
3. Second approval (if needed) → approved_by_level_2 filled
4. Final approval → status='approved', GL entries created
5. Process payment → status='paid', payment GL entries
```

### 8. Fixed Assets & Depreciation

```txt
┌─────────────────┐
│     assets      │
├─────────────────┤
│ PK: id          │
│ FK: created_by  │
│    name         │
│    category     │
│    purchase_date│
│    purchase_price│
│    current_value│
│    depreciation_│
│    method       │
│    status       │
└────────┬────────┘
         │ 1
         │
         │ N
┌────────┴────────────┐
│asset_depreciation   │
├─────────────────────┤
│ PK: id              │
│ FK: asset_id        │
│ FK: created_by      │
│    depreciation_date│
│    depreciation_amt │
│    accumulated_depr │
│    book_value       │
│    voucher_number   │
└─────────────────────┘
```

### 9.Accrual Accounting

```txt
┌──────────────────┐
│   prepayments    │
├──────────────────┤
│ PK: id           │
│ FK: created_by   │
│    account_code  │
│    total_amount  │
│    amortized_amt │
│    remaining_amt │
│    start_date    │
│    end_date      │
│    status        │
│    frequency     │
└──────────────────┘

┌──────────────────┐
│unearned_revenue  │
├──────────────────┤
│ PK: id           │
│ FK: created_by   │
│    account_code  │
│    total_amount  │
│    recognized_amt│
│    remaining_amt │
│    start_date    │
│    end_date      │
│    status        │
│    frequency     │
└──────────────────┘
```

### 10. Multi-Currency Support

```txt
┌──────────────┐
│  currencies  │ 1
├──────────────┤
│ PK: id       ├──────┐
│ UK: code     │      │
│    name      │      │
│    symbol    │      │
│    exchange_ │      │
│    rate      │      │
│    is_primary│      │
│    is_active │      │
└──────────────┘      │
                      │ N
            ┌─────────┴──────────┐
            │currency_           │
            │denominations       │
            ├────────────────────┤
            │ PK: id             │
            │ FK: currency_id    │
            │    value           │
            │    type (coin/note)│
            └────────────────────┘

Currency-enabled tables:
- invoices (currency_id, exchange_rate)
- purchases (currency_id, exchange_rate)
- ar_transactions (currency_id, exchange_rate)
- ap_transactions (currency_id, exchange_rate)
```

### 11. Batch Processing System

```txt
┌──────────────────┐
│batch_processing  │ 1
├──────────────────┤
│ PK: id           ├────────┐
│    job_type      │        │
│    status        │        │
│    total_items   │        │
│    processed_itms│        │
│    progress      │        │
│    parameters    │        │
│    error_message │        │
└──────────────────┘        │
                            │ N
                   ┌────────┴──────┐
                   │  batch_items  │
                   ├───────────────┤
                   │ PK: id        │
                   │ FK: batch_id  │
                   │    item_data  │
                   │    status     │
                   │    error_msg  │
                   └───────────────┘
```

### 12. Audit & System Tables

```txt
┌──────────────────┐
│    telescope     │
├──────────────────┤
│ PK: id           │
│ FK: user_id      │
│    action        │
│    module        │
│    record_id     │
│    old_values    │
│    new_values    │
│    ip_address    │
│    created_at    │
└──────────────────┘

┌───────────────────┐
│document_sequences │
├───────────────────┤
│ PK: id            │
│ UK: document_type │
│    prefix         │
│    current_number │
│    padding        │
└───────────────────┘

┌───────────────────┐
│     settings      │
├───────────────────┤
│ PK: id            │
│ UK: key           │
│    value          │
└───────────────────┘
```

---

## Key Indexes

**Performance Optimizations:**

| Table | Indexed Columns |
| ------- | ---------------- |
| `users` | username (unique), role_id |
| `sessions` | token (unique), user_id |
| `products` | barcode (unique), category_id |
| `invoices` | invoice_number (unique), voucher_number, customer_id |
| `purchases` | voucher_number, supplier_id, approval_status |
| `general_ledger` | voucher_number, account_id, fiscal_period_id |
| `chart_of_accounts` | account_code (unique), account_type, parent_id |
| `employees` | employee_code (unique), email (unique), department_id |
| `ar_customers` | account_code (unique) |
| `ap_suppliers` | account_code (unique) |

---

## Foreign Key Constraints

**ON DELETE Behaviors:**

- **CASCADE:** `invoice_items.invoice_id`, `products.id` (in purchases)
- **SET NULL:** Most user references (`created_by`, `user_id`), customer/supplier references
- **RESTRICT:** Not used (would prevent deletion)

**Rationale:**

- User deletions don't cascade (preserve audit trail)
- Invoice items cascade when invoice deleted
- Financial records preserved even if customer/supplier deleted

---

## Normalization Level

**3NF (Third Normal Form)** achieved:

- ✅ No repeating groups
- ✅ All non-key attributes depend on primary key
- ✅ No transitive dependencies
- ✅ Lookup tables for categories, departments, modules
- ✅ Separate transaction tables (AR, AP, GL)

**Denormalization for Performance:**

- `products.stock_quantity` (calculated from purchases/sales but cached)
- `invoices.total_amount` (sum of items, cached)
- `payroll_cycles.total_amount` (sum of items, cached)

---

## Data Integrity Rules

### Constraints

1. **Unique Constraints:**
   - Invoice numbers, employee codes, account codes
   - Prevents duplicates

2. **Check Constraints:**
   - `vat_rate` between 0-100
   - `exchange_rate` > 0
   - Status enums enforced at application level

3. **Not Null:**
   - Primary keys
   - Critical business fields (invoice_number, employee_code)

4. **Default Values:**
   - `is_active` = true
   - `created_at` = CURRENT_TIMESTAMP
   - `approval_status` = 'approved'

---

## Soft Deletes

**Tables with Soft Deletes:**

- `employees` (deleted_at column)

**Why not everywhere?**

- Financial records never truly deleted (marked `is_reversed` instead)
- Audit trail via `telescope` table
- Hard deletes only for admin cleanup

---

## JSON Columns

**Flexible data storage:**

| Table | Column | Purpose |
| ------- | -------- | --------- |
| `zatca_einvoices` | zatca_response | API response from ZATCA |
| `batch_processing` | parameters | Job configuration |
| `batch_items` | item_data | Individual item payload |
| `recurring_transactions` | template | Journal entry template |
| `telescope` | old_values, new_values | Audit data |

---

## Relationship Summary

**One-to-Many (1:N):**

- User → Invoices, Purchases, Employees
- Product → Invoice Items, Purchases
- Invoice → Invoice Items
- Employee → Payroll Items
- Chart of Account → GL Entries

**Many-to-One (N:1):**

- Invoices → Customer (many invoices, one customer)
- Purchases → Supplier

**Self-Referential:**

- Users (manager_id → users.id)
- Employees (manager_id → employees.id)
- Chart of Accounts (parent_id → chart_of_accounts.id)

**One-to-One (1:1):**

- Invoice → ZATCA E-Invoice

---

## Transaction Isolation

**ACID Compliance:**

- ❶ **Atomicity:** Laravel DB transactions wrap multi-step operations
- ❷ **Consistency:** Foreign keys + application validations
- ❸ **Isolation:** Default READ COMMITTED (MySQL), SERIALIZABLE (SQLite)
- ❹ **Durability:** Database engine handles persistence

**Example Transaction:**

```php
DB::transaction(function () {
    // 1. Create invoice
    // 2. Create invoice items
    // 3. Reduce stock
    // 4. Post to GL
    // All or nothing
});
```
