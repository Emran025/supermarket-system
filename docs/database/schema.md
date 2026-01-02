# Database Schema

## Overview

The database is structured using the InnoDB engine to ensure ACID compliance and support foreign key constraints.

## Table Definitions

### 1. `users`

| Column | Type | Constraints |
| :--- | :--- | :--- |
| `id` | INT | Primary Key, Auto Increment |
| `username` | VARCHAR(50) | Unique, Not Null |
| `password` | VARCHAR(255) | Not Null (Hashed) |
| `created_at` | TIMESTAMP | Default CURRENT_TIMESTAMP |

### 2. `sessions`

| Column | Type | Constraints |
| :--- | :--- | :--- |
| `id` | INT | Primary Key, Auto Increment |
| `user_id` | INT | Foreign Key (users.id) |
| `session_token` | VARCHAR(64) | Unique, Not Null |
| `expires_at` | DATETIME | Not Null |

### 3. `products`

| Column | Type | Constraints |
| :--- | :--- | :--- |
| `id` | INT | Primary Key, Auto Increment |
| `name` | VARCHAR(255) | Not Null |
| `description` | TEXT | - |
| `category` | VARCHAR(100) | - |
| `unit_price` | DECIMAL(10,2) | Default 0.00 |
| `minimum_profit_margin` | DECIMAL(10,2) | Default 0.00 |
| `stock_quantity` | INT | Default 0 |
| `unit_name` | VARCHAR(50) | Default 'كرتون' |
| `items_per_unit` | INT | Default 1 |
| `sub_unit_name` | VARCHAR(50) | Default 'حبة' |

### 4. `categories`

| Column | Type | Constraints |
| :--- | :--- | :--- |
| `id` | INT | Primary Key, Auto Increment |
| `name` | VARCHAR(100) | Unique, Not Null |

### 5. `purchases`

| Column | Type | Constraints |
| :--- | :--- | :--- |
| `id` | INT | Primary Key, Auto Increment |
| `product_id` | INT | Foreign Key (products.id) |
| `quantity` | INT | Not Null |
| `invoice_price` | DECIMAL(10,2) | Not Null |
| `unit_type` | VARCHAR(20) | Default 'sub' |
| `purchase_date` | TIMESTAMP | Default CURRENT_TIMESTAMP |

### 6. `invoices`

| Column | Type | Constraints |
| :--- | :--- | :--- |
| `id` | INT | Primary Key, Auto Increment |
| `invoice_number` | VARCHAR(50) | Unique, Not Null |
| `total_amount` | DECIMAL(10,2) | Not Null |
| `created_at` | TIMESTAMP | Default CURRENT_TIMESTAMP |

### 7. `invoice_items`

| Column | Type | Constraints |
| :--- | :--- | :--- |
| `id` | INT | Primary Key, Auto Increment |
| `invoice_id` | INT | Foreign Key (invoices.id) |
| `product_id` | INT | Foreign Key (products.id) |
| `quantity` | INT | Not Null |
| `unit_price` | DECIMAL(10,2) | Not Null |
| `subtotal` | DECIMAL(10,2) | Not Null |

## Normalization

The database follows the **Third Normal Form (3NF)**:

1. **1NF**: Atomic values in all columns (no lists). Each row is unique.
2. **2NF**: No partial dependencies. All non-key columns depend on the entire primary key (e.g., product details depend on Product ID).
3. **3NF**: No transitive dependencies. Categories are extracted to their own table to prevent repeating names/metadata in multiple product rows.
