# API Overview

## Structure

The API is accessible through a single entry point: `domain/api.php`. Internal routing delegates requests to specific Controllers (`domain/api/*Controller.php`) based on the `action` query parameter.

**Base URL**: `/domain/api.php`

## Authentication

Most endpoints require a valid session.

- **Header**: Requests should include any necessary cookie-based credentials (CORS-enabled).
- **Status 401**: Returned if the user is not logged in.

## Endpoints

### 1. Authentication

| Action | Method | Description |
| :--- | :--- | :--- |
| `login` | `POST` | Authenticates user and starts session. |
| `logout` | `POST` | Destroys the current session. |
| `check` | `GET` | Validates if the user is currently logged in. |

### 2. Dashboard (`?action=dashboard`)

| Method | Description |
| :--- | :--- |
| `GET` | Retrieve daily/weekly sales stats and top products. |

### 3. Products (`?action=products`)

| Method | Description |
| :--- | :--- |
| `GET` | Retrieve list of all products. Supports `search` query param. |
| `POST` | Create a new product. |
| `PUT` | Update an existing product. |
| `DELETE` | Remove a product (by `id`). |

### 4. Purchases (`?action=purchases`)

| Method | Description |
| :--- | :--- |
| `GET` | Retrieve purchase history. Supports `search` query param. |
| `POST` | Record a new stock purchase and update product price/stock. |
| `DELETE` | Remove a purchase (restricted to last 24h). |

### 5. Invoices/Sales (`?action=invoices`)

| Method | Description |
| :--- | :--- |
| `GET` | Retrieve sales history. |
| `POST` | Create a new sale invoice and decrease stock. |
| `DELETE` | Revoke an invoice (restricted to last 48h). |

### 6. Users (`?action=users`)

| Method | Description |
| :--- | :--- |
| `GET` | List all system users (Admin only). |
| `POST` | Create a new user (Admin only). |
| `PUT` | Update user details/password (Admin only). |
| `DELETE` | Remove a user (Admin only). |

### 7. Settings (`?action=settings`)

| Method | Description |
| :--- | :--- |
| `GET` | Retrieve system configuration (store name, tax, etc.). |
| `POST` | Update system configuration (Admin only). |

## Request/Response Formats

### Request (JSON)

For `POST` and `PUT` requests, data must be sent as a JSON object in the request body.

```json
{
  "name": "Coca Cola",
  "unit_price": 1.5,
  ...
}
```

### Response (JSON)

```json
{
  "success": true,
  "message": "Operation successful",
  "data": [ ... ], // Optional
  "id": 123 // Optional (for creation)
}
```

## Status Codes

- `200`: Success.
- `401`: Unauthorized access.
- `403`: Forbidden (e.g., Sales user trying to access Admin APIs).
- `404`: Action not found.
- `500`: Server/SQL error.
