# API Reference

## Base Information

**Base URL**: `/domain/api.php`

**Entry Point**: All API requests route through this single file

**Authentication**: Session-based (cookies)

**Content Type**: `application/json`

## Request Format

**URL Pattern**:

```batch
GET /domain/api.php?action={action_name}&{params}
POST /domain/api.php?action={action_name}
PUT /domain/api.php?action={action_name}
DELETE /domain/api.php?action={action_name}
```

**Request Headers**:

```batch
Content-Type: application/json
Cookie: PHPSESSID={session_token}
```

**Request Body** (POST/PUT):

```json
{
  "field1": "value1",
  "field2": "value2"
}
```

## Response Format

**Success Response**:

```json
{
  "success": true,
  "message": "Optional success message",
  "data": [ ... ],  // Optional payload
  "id": 123         // Optional, for creation operations
}
``

`

**Error Response**:
```json
{
  "success": false,
  "message": "Error description"
}
```

**Paginated Response**:

```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 150,
    "total_pages": 8
  }
}
```

## HTTP Status Codes

| Code | Meaning |
| :--- | :--- |
| `200` | Success |
| `400` | Bad Request (validation error) |
| `401` | Unauthorized (not logged in) |
| `403` | Forbidden (insufficient permissions) |
| `404` | Not Found |
| `405` | Method Not Allowed |
| `500` | Internal Server Error |

## Endpoints

### Authentication

#### Login

```http
POST /api.php?action=login
```

**Request**:

```json
{
  "username": "admin",
  "password": "admin123"
}
```

**Response**:

```json
{
  "success": true,
  "user": {
    "id": 1,
    "username": "admin",
    "role": "admin"
  }
}
```

**Errors**:

- `Invalid credentials`
- `Account is locked. Try again after {time}`

#### Logout

```http
POST /api.php?action=logout
```

**Response**:

```json
{
  "success": true
}
```

#### Check Session

```http
GET /api.php?action=check
```

**Response**:

```json
{
  "success": true,
  "user": {
    "id": 1,
    "username": "admin",
    "role": "admin"
  }
}
```

### Products

#### List Products

```http
GET /api.php?action=products&page=1&per_page=20&search={query}
```

**Query Parameters**:

- `page`: Page number (default: 1)
- `per_page`: Items per page (default: 20)
- `search`: Search term (optional)
- `include_purchase_price`: Include latest purchase price (optional)

**Response**:

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Product Name",
      "description": "Description",
      "category": "Category",
      "unit_price": 10.50,
      "minimum_profit_margin": 2.00,
      "stock_quantity": 100,
      "unit_name": "Carton",
      "items_per_unit": 24,
      "sub_unit_name": "Piece",
      "created_by": 1,
      "creator_name": "admin",
      "latest_purchase_price": 8.00  // If include_purchase_price=1
    }
  ],
  "pagination": { ... }
}
```

#### Create Product

```http
POST /api.php?action=products
```

**Request**:

```json
{
  "name": "Product Name",
  "description": "Description",
  "category": "Category",
  "unit_price": 10.50,
  "minimum_profit_margin": 2.00,
  "stock_quantity": 100,
  "unit_name": "Carton",
  "items_per_unit": 24,
  "sub_unit_name": "Piece"
}
```

**Response**:

```json
{
  "success": true,
  "id": 123
}
```

#### Update Product

```http
PUT /api.php?action=products
```

**Request**: Same as create, plus `id` field

#### Delete Product

```http
DELETE /api.php?action=products&id=123
```

### Purchases

#### List Purchases

```http
GET /api.php?action=purchases&page=1&per_page=20&search={query}
```

**Response**:

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "product_id": 5,
      "product_name": "Product",
      "quantity": 50,
      "invoice_price": 400.00,
      "unit_type": "main",
      "production_date": "2026-01-01",
      "expiry_date": "2027-01-01",
      "purchase_date": "2026-01-06 12:00:00"
    }
  ]
}
```

#### Create Purchase

```http
POST /api.php?action=purchases
```

**Request**:

```json
{
  "product_id": 5,
  "quantity": 50,
  "invoice_price": 400.00,
  "unit_type": "main",  // or "sub"
  "production_date": "2026-01-01",  // Optional
  "expiry_date": "2027-01-01"       // Optional
}
```

**Response**:

```json
{
  "success": true,
  "id": 123,
  "new_unit_price": 10.50
}
```

#### Purchase Requests

**List Requests**:

```http
GET /api.php?action=requests
```

**Create Request**:

```http
POST /api.php?action=requests
```

**Request**:

```json
{
  "product_id": 5,      // Or null for new product
  "product_name": "New Product",  // If product_id is null
  "quantity": 100,
  "notes": "Urgently needed"
}
```

**Update Request Status**:

```http
PUT /api.php?action=requests
```

**Request**:

```json
{
  "id": 123,
  "status": "approved"  // or "rejected"
}
```

### Sales / Invoices

#### List Invoices

```http
GET /api.php?action=invoices&page=1&customer_id={id}
```

**Query Parameters**:

- `customer_id`: Filter by AR customer (optional)

**Response**:

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "invoice_number": "INV-1001",
      "total_amount": 150.00,
      "payment_type": "cash",  // or "credit"
      "customer_id": null,     // or customer ID
      "amount_paid": 0.00,
      "user_id": 1,
      "created_at": "2026-01-06 18:00:00"
    }
  ]
}
```

#### Create Invoice

```http
POST /api.php?action=invoices
```

**Request**:

```json
{
  "invoice_number": "INV-1002",
  "payment_type": "credit",  // "cash" or "credit"
  "customer_id": 5,          // Required if payment_type = credit
  "amount_paid": 50.00,      // Optional partial payment
  "items": [
    {
      "product_id": 10,
      "quantity": 2,
      "unit_price": 25.00
    }
  ]
}
```

**Response**:

```json
{
  "success": true,
  "id": 123,
  "invoice_number": "INV-1002"
}
```

#### Delete Invoice

```http
DELETE /api.php?action=invoices&id=123
```

**Note**: Restores stock and reverses AR transactions

#### Get Invoice Details

```http
GET /api.php?action=invoice_details&id=123
```

**Response**:

```json
{
  "success": true,
  "invoice": {
    "id": 123,
    "invoice_number": "INV-1002",
    "total_amount": 150.00,
    ...
  },
  "items": [
    {
      "product_id": 10,
      "product_name": "Product",
      "quantity": 2,
      "unit_price": 25.00,
      "subtotal": 50.00
    }
  ]
}
```

### Accounts Receivable

#### AR Customers

**List Customers**:

```http
GET /api.php?action=ar_customers&page=1&search={query}
```

**Response Data Fields**:

- `id`, `name`, `phone`, `email`, `address`, `tax_number`, `current_balance`

**Create Customer**:

```http
POST /api.php?action=ar_customers
```

**Update Customer**:

```http
PUT /api.php?action=ar_customers
```

**Delete Customer**:

```http
DELETE /api.php?action=ar_customers&id=123
```

#### AR Ledger

**Get Customer Ledger**:

```http
GET /api.php?action=ar_ledger&customer_id=5&page=1
```

**Response**:

```json
{
  "success": true,
  "customer": {
    "id": 5,
    "name": "Customer Name",
    "current_balance": 500.00
  },
  "transactions": [
    {
      "id": 1,
      "type": "invoice",  // or "payment", "return"
      "amount": 150.00,
      "description": "Invoice #INV-1002",
      "reference_type": "invoices",
      "reference_id": 123,
      "transaction_date": "2026-01-06 18:00:00",
      "is_deleted": 0
    }
  ]
}
```

**Create Payment/Return**:

```http
POST /api.php?action=ar_ledger
```

**Request**:

```json
{
  "customer_id": 5,
  "type": "payment",  // or "return"
  "amount": 100.00,
  "description": "Cash payment"
}
```

**Delete Transaction** (Soft Delete):

```http
DELETE /api.php?action=ar_ledger&id=123
```

**Restore Transaction**:

```http
PUT /api.php?action=ar_ledger
```

**Request**:

```json
{
  "id": 123,
  "restore": true
}
```

### Financial Management

#### Expenses

**CRUD Operations**: GET, POST, PUT, DELETE

**Endpoint**: `/api.php?action=expenses`

**Data Fields**:

- `category`, `amount`, `expense_date`, `description`

#### Assets

**CRUD Operations**: GET, POST, PUT, DELETE

**Endpoint**: `/api.php?action=assets`

**Data Fields**:

- `name`, `value`, `purchase_date`, `depreciation_rate`, `status`, `description`

#### Revenues

**CRUD Operations**: GET, POST, PUT, DELETE

**Endpoint**: `/api.php?action=revenues`

**Data Fields**:

- `source`, `amount`, `revenue_date`, `description`

#### Balance Sheet

```http
GET /api.php?action=balance_sheet
```

**Response**:

```json
{
  "success": true,
  "data": {
    "assets": {
      "cash_estimate": 5000.00,
      "stock_value": 12000.00,
      "fixed_assets": 8000.00,
      "accounts_receivable": 3000.00,
      "total_assets": 28000.00
    },
    "income_statement": {
      "total_sales": 50000.00,
      "other_revenues": 2000.00,
      "total_purchases": 30000.00,
      "total_expenses": 17000.00,
      "net_profit": 5000.00
    }
  }
}
```

### Users

#### List Users (Admin Only)

```http
GET /api.php?action=users
```

**Response Data Fields**:

- `id`, `username`, `role`, `is_active`, `manager_id`, `created_by`, `created_at`

#### Create User

```http
POST /api.php?action=users
```

**Request**:

```json
{
  "username": "newuser",
  "password": "password123",
  "role": "sales",  // "admin", "manager", "sales"
  "is_active": 1,
  "manager_id": 2  // Optional
}
```

#### Update User

```http
PUT /api.php?action=users
```

**Request**: Same as create, plus `id` field

#### Delete User

```http
DELETE /api.php?action=users&id=123
```

#### Change Password

```http
POST /api.php?action=change_password
```

**Request**:

```json
{
  "current_password": "old123",
  "new_password": "new123"
}
```

#### Manager List (For Dropdowns)

```http
GET /api.php?action=manager_list
```

**Response**:

```json
{
  "success": true,
  "data": [
    { "id": 2, "username": "manager1" },
    { "id": 3, "username": "manager2" }
  ]
}
```

#### My Sessions

```http
GET /api.php?action=my_sessions
```

**Response**:

```json
{
  "success": true,
  "sessions": [
    {
      "id": 1,
      "session_token": "abc123...",
      "ip_address": "192.168.1.1",
      "user_agent": "Mozilla/5.0...",
      "created_at": "2026-01-06 18:00:00",
      "expires_at": "2026-01-07 18:00:00"
    }
  ]
}
```

### Dashboard

```http
GET /api.php?action=dashboard
```

**Response**:

```json
{
  "success": true,
  "daily_sales": 1500.00,
  "low_stock_count": 5,
  "low_stock_products": [ ... ],
  "recent_sales": [ ... ],
  "expiring_products": [ ... ],
  "pending_requests": [ ... ]
}
```

### Settings

**Get Settings**:

```http
GET /api.php?action=settings
```

**Response**:

```json
{
  "success": true,
  "settings": {
    "store_name": "My Store",
    "store_address": "Address",
    "store_phone": "123456",
    "tax_number": "TAX123",
    "currency_symbol": "ر.ي",
    "invoice_size": "thermal",
    "footer_message": "Thank you"
  }
}
```

**Update Settings**:

```http
POST /api.php?action=settings
```

**Request**: Object with setting key-value pairs

### Categories

**List Categories**:

```http
GET /api.php?action=categories
```

**Create Category**:

```http
POST /api.php?action=categories
```

**Request**:

```json
{
  "name": "New Category"
}
```

## Common Patterns

### Pagination

**Query Parameters**:

- `page`: Current page (1-indexed)
- `per_page`: Items per page (default 20)

**Response Metadata**:

```json
{
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 150,
    "total_pages": 8
  }
}
```

### Search/Filtering

**Query Parameter**:

- `search`: Search term

**Behavior**:

- Searches across multiple relevant fields
- Case-insensitive
- Partial matching (LIKE '%term%')

### Soft Deletes

**Pattern**:

- First DELETE: Sets `is_deleted = 1`
- PUT with `restore = true`: Sets `is_deleted = 0`

**Used In**:

- AR Transactions

### Audit Logging

**Automatic Logging**:

- Every CREATE, UPDATE, DELETE operation
- Logged to `telescope` table
- Called via `log_operation()` function

**Not Exposed via API**: Admins must query database directly

## Error Messages

### Common Errors

**Validation**:

- `Field {name} is required`
- `Invalid value for {field}`
- `Insufficient stock for product {name}`

**Authentication**:

- `Unauthorized`
- `Session expired`

**Authorization**:

- `Access denied`
- `This action requires {role} role`

**Business Logic**:

- `Customer is required for credit sales`
- `Cannot delete invoice older than 48 hours`
- `Product not found`

## Rate Limiting

**Current Implementation**: None

**Login Throttling**:

- 5 failed attempts → 15-minute lockout
- Tracked per username, not IP

## CORS Configuration

**Allowed Origins**: Configurable (defaults to request origin)

**Allowed Methods**: GET, POST, PUT, DELETE, OPTIONS

**Credentials**: Allowed (cookies sent)

## API Versioning

**Current Version**: No versioning (single version)

**Future**: Could add `/v1/`, `/v2/` prefix in URL
