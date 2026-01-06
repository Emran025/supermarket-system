# System Architecture

## Architectural Pattern

The system implements a **3-Tier Architecture** with clear separation between presentation, business logic, and data persistence layers.

```batch
┌─────────────────────────────────────┐
│     Presentation Tier (Frontend)    │
│   HTML + Vanilla JS + CSS           │
└──────────────┬──────────────────────┘
               │ JSON over HTTP
┌──────────────▼──────────────────────┐
│     Logic Tier (Backend API)        │
│   PHP Controllers + Business Logic  │
└──────────────┬──────────────────────┘
               │ SQL Queries
┌──────────────▼──────────────────────┐
│     Data Tier (Database)            │
│   MySQL/MariaDB (InnoDB)            │
└─────────────────────────────────────┘
```

## Tier Descriptions

### 1. Presentation Tier

**Location**: `/presentation` directory

**Components**:

- HTML pages (20+ views)
- JavaScript modules (page-specific logic)
- CSS stylesheets (unified design system)
- Static assets

**Characteristics**:

- **Zero server-side rendering**: All pages are static HTML
- **Client-side rendering**: JavaScript builds dynamic content (tables, forms)
- **Stateless interaction**: Communicates via API only, no direct database access
- **Progressive enhancement**: Core functionality works without JS (login)

**Communication**:

- Uses Fetch API for all backend requests
- Sends/receives JSON exclusively
- Includes session cookies automatically
- Handles errors via toast notifications or modals

**Example Request**:

```javascript
const response = await fetchAPI('products', {
  method: 'POST',
  body: JSON.stringify({ name: 'Product Name', ... })
});
```

### 2. Logic Tier

**Location**: `/domain` directory

**Architecture Pattern**: **MVC Controller Pattern**

#### Request Flow

```batch
HTTP Request
    ↓
api.php (Entry Point)
    ↓
Router::dispatch()
    ↓
Specific Controller
    ↓
Business Logic Execution
    ↓
Database Query (via mysqli)
    ↓
JSON Response
```

#### Core Components

##### A. Router (`api/Router.php`)

- Maps `action` parameter to Controller class
- Single responsibility: routing only
- No business logic

**Example**:

```php
$router->register('products', 'ProductsController');
$router->register('invoices', 'SalesController');
```

##### B. Base Controller (`api/Controller.php`)

- Abstract class for all controllers
- Provides helper methods:
  - `getJsonInput()` - Parse request body
  - `successResponse()` - Format success JSON
  - `errorResponse()` - Format error JSON
  - `getPaginationParams()` - Extract pagination from query
- Holds database connection

##### C. Specific Controllers

Each controller handles one domain:

| Controller | Responsibility |
| :--- | :--- |
| `AuthController` | Login, logout, session verification |
| `ProductsController` | Product CRUD operations |
| `SalesController` | Invoice creation, listing, deletion |
| `PurchasesController` | Purchase and request management |
| `ArController` | AR customers and ledger transactions |
| `ExpensesController` | Expense CRUD |
| `AssetsController` | Asset CRUD |
| `RevenuesController` | Revenue CRUD |
| `ReportsController` | Financial report generation |
| `DashboardController` | Dashboard metrics aggregation |
| `UsersController` | User management and password changes |
| `SettingsController` | System configuration |
| `CategoriesController` | Category CRUD |

**Controller Method Pattern**:

```php
public function handle() {
    // 1. Check authentication
    if (!is_logged_in()) {
        $this->errorResponse('Unauthorized', 401);
    }
    
    // 2. Route by HTTP method
    $method = $_SERVER['REQUEST_METHOD'];
    if ($method === 'GET') $this->getItems();
    elseif ($method === 'POST') $this->createItem();
    // ...
}
```

#### D. Supporting Modules

**Authentication (`auth.php`)**:

- Session management functions
- `start_session()` - Initialize session
- `is_logged_in()` - Check authentication status
- `create_session()` - Generate secure token
- Used by all controllers

**Database (`db.php`)**:

- `get_db_connection()` - Singleton connection
- `init_database()` - Schema creation/migration
- `log_operation()` - Audit logging
- Seeding functions for initial data

**Configuration (`config.php`)**:

- Database credentials
- Environment-specific settings

### 3. Data Tier

**Technology**: MySQL 5.7+ / MariaDB 10.4+

**Engine**: InnoDB (for transactions and foreign keys)

**Characteristics**:

- **ACID compliance**: All financial operations use transactions
- **Referential integrity**: Foreign key constraints enforced
- **Soft deletes**: AR transactions use `is_deleted` flag
- **JSON support**: Audit log stores before/after as JSON
- **Auto-timestamps**: `created_at`, `updated_at` on most tables

**Schema Highlights**:

- 16 core tables
- Hierarchical user relationships (manager_id)
- Double-entry AR ledger
- Audit trail (telescope)
- Key-value settings store

## Key Design Decisions

### 1. Controller-Based Routing (vs. Procedural)

**Rationale**:

- Cleaner separation of concerns
- Easier testing and debugging
- Scalable as features grow
- Consistent error handling

**Tradeoff**:

- Slightly more complex than procedural API
- Requires understanding of OOP

### 2. Client-Side Rendering (vs. Server-Side)

**Rationale**:

- Reduces server load
- Provides "app-like" feel (no page reloads)
- Enables rich interactions (sorting, filtering without round-trips)
- Clear API contract for potential mobile apps

**Tradeoff**:

- SEO not applicable (admin system)
- Requires JavaScript (acceptable for internal tool)

### 3. Session-Based Auth (vs. JWT)

**Rationale**:

- Simpler for single-server deployment
- Built-in PHP session management
- Easy logout (server-side session destruction)
- No token refresh complexity

**Tradeoff**:

- Not easily scalable to multi-server without sticky sessions
- Larger cookie size

### 4. Last Purchase Price Inventory Valuation

**Rationale**:

- Simple to implement and understand
- Matches small business practices
- No weighted average calculation needed

**Tradeoff**:

- Not FIFO/LIFO compliant for some accounting standards
- Price can fluctuate based on last purchase

### 5. Soft Deletes for AR Transactions

**Rationale**:

- Financial records should be immutable
- Allows mistake correction without data loss
- Audit trail preserved

**Tradeoff**:

- Queries must filter `is_deleted = 0`
- Disk space accumulates

## Scalability Considerations

### Current Limitations

- **Single server**: No horizontal scaling
- **Synchronous processing**: No queue for long operations
- **No caching**: Every request hits database
- **Session affinity**: Required if load-balanced

### Scaling Paths

1. **Database optimization**:
   - Add indexes on frequently queried columns
   - Implement read replicas
   - Archive old telescope entries

2. **Application optimization**:
   - Implement Redis for session storage
   - Add caching layer (APCu/Redis)
   - Optimize N+1 queries

3. **Infrastructure**:
   - Load balancer with sticky sessions
   - CDN for static assets
   - Database connection pooling

## Security Architecture

### Defense Layers

1. **Input Validation**:
   - `mysqli_real_escape_string()` for SQL
   - Prepared statements for complex queries
   - Type casting (`intval`, `floatval`)

2. **Authentication**:
   - Password hashing (PHP `password_hash`)
   - Secure session tokens
   - Brute-force protection

3. **Authorization**:
   - Role checking in sensitive controllers
   - User context from `$_SESSION['user_id']`

4. **Audit**:
   - All mutations logged to telescope
   - IP and user agent tracking

5. **Transport**:
   - HTTPS recommended (not enforced in code)
   - CORS headers configured

## Error Handling Strategy

### Levels

1. **Fatal Errors**: Caught by shutdown function in `api.php`
2. **Exceptions**: Try-catch in controllers, rollback transactions
3. **Validation Errors**: HTTP 400 with specific message
4. **Auth Errors**: HTTP 401/403
5. **Server Errors**: HTTP 500 with sanitized message

### Logging

- `error_log()` for server-side issues
- Telescope for business operation tracking
- No sensitive data (passwords) in logs

## Deployment Model

**Target Environment**: XAMPP/WAMP local or shared hosting

**Requirements**:

- PHP 7.4+ with mysqli extension
- MySQL 5.7+ or MariaDB 10.4+
- Apache with mod_rewrite (optional, for clean URLs)

**Initialization**:

- First run executes `init_database()`
- Creates all tables automatically
- Seeds default admin user and sample data

**Configuration**:

- Single file: `domain/config.php`
- Change database credentials only

## API Contract

**Endpoint Format**: `domain/api.php?action={action_name}`

**Request**:

- Method: GET, POST, PUT, DELETE
- Body: JSON (for POST/PUT)
- Headers: `Content-Type: application/json`

**Response**:

```json
{
  "success": true|false,
  "message": "Optional message",
  "data": [ ... ] // Optional payload
}
```

**Status Codes**:

- 200: Success
- 400: Bad request
- 401: Not authenticated
- 403: Not authorized
- 404: Not found
- 500: Server error

## Modularity & Extensibility

### Adding New Features

**To add a new entity (e.g., Suppliers)**:

1. **Database**: Add table in `db.php` `init_database()`
2. **Controller**: Create `SuppliersController.php`
3. **Router**: Register in `api.php`: `$router->register('suppliers', 'SuppliersController')`
4. **Frontend**: Create `suppliers.html` and `suppliers.js`
5. **Navigation**: Add link in navbar (common header structure)

### Current Pain Points

- No migration system (all changes in `init_database()`)
- Heavy reliance on procedural helpers in `auth.php` and `db.php`
- Frontend uses inline styles (not component-based CSS)

## Monitoring & Observability

**Current Capabilities**:

- Error logs (PHP error_log)
- Telescope audit table
- Session tracking (IP, user agent)

**Gaps**:

- No performance metrics
- No application-level logging framework
- No health check endpoint

## Conclusion

The system architecture balances simplicity with functionality, prioritizing:

- **Clarity**: Easy to understand for junior developers
- **Maintainability**: Clear separation of concerns
- **Reliability**: Transactional integrity for financial operations
- **Security**: Defense-in-depth approach

Trade-offs favor development speed and ease of deployment over advanced scalability features.
