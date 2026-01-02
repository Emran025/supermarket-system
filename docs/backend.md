# Backend Documentation

## Overview

The backend is a modernized, Object-Oriented PHP API. It serves as the logic layer between the frontend SPA and the MySQL database, ensuring strict validation, security, and data integrity.

## Backend Architecture

The backend has migrated from a procedural style to a structured **Controller-based architecture**:

- **API Entry Point (`domain/api.php`)**: Acts as a Front Controller, routing incoming requests to the appropriate Controller class based on the `action` parameter.
- **Controllers (`domain/api/*Controller.php`)**: Handle specific domains (e.g., `ProductsController`, `SalesController`). They encapsulate logic for creating, reading, updating, and deleting resources.
- **Router (`domain/api/Router.php`)**: Maps `action` strings to Controller classes.
- **Database Layer (`db.php`)**: A singleton wrapper for PDO operations, ensuring consistent connection handling and prepared statements.
- **Auth Layer (`auth.php`)**: Manages session state, login throttling, and CSRF protection.

## Responsibilities

- **Request Routing & Validation**: Each controller validates inputs before processing.
- **Role-Based Access Control (RBAC)**: Middleware checks if the user is an Admin or Salesperson before allowing sensitive operations (e.g., `UsersController` is Admin-only).
- **Transaction Management**: Critical operations like "Finalize Sale" use SQL transactions to ensure stock and financial records are updated atomically.
- **Security Checkpoints**: SQL injection prevention (Prepared Statements) and XSS mitigation (Output encoding).

## Authentication & Authorization

- **Session-Based**: Uses PHP native sessions backed by a `sessions` table for persistence.
- **Security**:
  - **Login Throttling**: Delays execution after failed attempts to prevent brute-force attacks.
  - **Session Timeout**: Auto-logout after inactivity.
  - **Role Checks**: The `ensureAdmin()` helper blocks unauthorized access to admin-only API actions.

## Error Handling Strategy

- **HTTP Status Codes**:
  - `200 OK`: Successful operation.
  - `401 Unauthorized`: Authentication required.
  - `403 Forbidden`: User lacks necessary permissions.
  - `404 Not Found`: Resource or Endpoint does not exist.
  - `500 Internal Server Error`: Critical failure.

- **Standardized Response**:

  ```json
    {
      "success": true,
      "message": "Human-readable message",
      "data": [], // Data payload
      "error_code": "OPTIONAL_CODE" // For client-side logic
    }
    ```

## Technologies and Patterns

- **PHP 7.4+ / 8.x**: Uses Classes and namespace-like structure for optional autoloading.
- **MySQL/MariaDB**: Relational storage with Foreign Keys.
- **Singleton Pattern**: For Database connection.
- **Factory/Strategy Pattern**: Implicitly used in Routing logic.
