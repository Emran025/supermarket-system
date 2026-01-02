# System Architecture

## Overall System Architecture

The Supermarket Management System is built on a **3-Tier Architecture**, ensuring clear separation of concerns, scalability, and maintainability.

### 1. Presentation Tier (Frontend)

- Built with standard Web technologies (HTML/JS/CSS).
- Communicates with the backend exclusively via asynchronous JSON requests (Fetch API).
- Handles UI state management and user feedback.

### 2. Logic Tier (Backend API)

- Developed in PHP using a **Controller-based architecture**.
- **Stateless design**: It doesn't store user data in local variables; instead, it relies on the database and session tokens for state.
- **Router Pattern**: Requests are routed from `api.php` to specific Controllers (e.g., `ProductsController`, `SalesController`) to keep logic organized.
- Enforces business rules (e.g., "Cannot sell more than available stock", "Only Admins can delete users").

### 3. Data Tier (Relational Database)

- MariaDB/MySQL storage.
- Stores persistent data for configurations, transactions, and users.
- Ensures data integrity through Foreign Key constraints and ACID transactions.

## Communication Flow

1. **Request**: The user interacts with the UI (e.g., clicks "Save Product").
2. **Transmission**: The Frontend sends a POST request with JSON payload to `domain/api.php?action=products`.
3. **Routing**: `api.php` instantiates the appropriate Controller based on `action`.
4. **Processing**: The Controller validates the user's session, sanitizes the input, and executes the SQL query via the DB helper.
5. **Response**: The Backend returns a success or error message in JSON format.
6. **Update**: The UI dynamically updates the table or displays an alert based on the response.

## Design Decisions and Reasoning

- **Object-Oriented PHP**: Migrated from procedural code to Controllers to improve testability and organization as the project grew.
- **Client-Side Rendering**: By using JS to build tables, we reduce server load and provide a modern, snappy feel.
- **Centralized Settings**: System configuration is stored in the database rather than hardcoded, allowing non-technical admins to update store details.
- **Dynamic Price Calculation**: Decided to calculate price on new purchases automatically to prevent manual entry errors and ensure consistent profit margins.

## Scalability Considerations

- **Database Indexing**: Critical columns like `invoice_number` and `product_id` are indexed to ensure fast lookups.
- **Stateless API**: Because the API is stateless, it can theoretically be deployed across multiple servers.
- **Modular Frontend**: Each page has its own JS file (`products.js`, `sales.js`), keeping client-side logic decoupled.
