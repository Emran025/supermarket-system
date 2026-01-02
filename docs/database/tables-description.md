# Tables Description

## 1. `users`

**Purpose**: Stores credentials and identity of system users (admins/staff).

- **id**: Primary internal identifier.
- **username**: The name used to log in (must be unique).
- **password**: A cryptographic hash of the user's password.
- **created_at**: Auditing timestamp for when the account was created.

## 2. `products`

**Purpose**: The central catalog of all items available for sale.

- **id**: Unique product identifier.
- **name**: Display name of the item.
- **description**: Detailed notes or specifications.
- **category**: Functional grouping (linked to the `categories` table).
- **unit_price**: The current selling price of the item.
- **minimum_profit_margin**: The fixed amount added to the purchase cost to determine the selling price.
- **stock_quantity**: Current count of items in the warehouse/store.
- **unit_name**: The primary bulk unit (e.g., 'Carton').
- **items_per_unit**: Multiplication factor for sub-units.

## 3. `categories`

**Purpose**: Organizes products into logical groups for easier management.

- **id**: Primary identifier.
- **name**: Human-readable category name (e.g., 'Vegetables').

## 4. `purchases`

**Purpose**: Records all inbound stock arrivals from suppliers.

- **id**: Unique transaction record.
- **product_id**: Reference to which product was bought.
- **quantity**: Amount received.
- **invoice_price**: The cost paid to the supplier for this specific batch.
- **unit_type**: Whether the quantity represents the 'Main' unit or the 'Sub' unit.
- **purchase_date**: When the goods were received.

## 5. `invoices`

**Purpose**: Header record for customer sales.

- **id**: Primary identifier.
- **invoice_number**: A unique alphanumeric code (e.g., INV-1001) for indexing.
- **total_amount**: The sum of all line items included in this sale.

## 6. `invoice_items`

**Purpose**: Detailed line items for each sale.

- **id**: Line item identifier.
- **invoice_id**: Links this item to a specific `invoice`.
- **product_id**: Reference to the product sold.
- **quantity**: Number of units sold.
- **unit_price**: The price at which the item was sold at the time of transaction.
- **subtotal**: `quantity * unit_price`.

## 7. `sessions`

**Purpose**: Tracks active user logins to prevent unauthorized access.

- **id**: Session identifier.
- **user_id**: References the logged-in `user`.
- **session_token**: A secure random string used for API authentication.
- **expires_at**: Timestamp after which the token is no longer valid.
