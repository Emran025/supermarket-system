# Setup and Usage Guide

## Environment Requirements

To run this project, you need the following installed:

- **Server**: Apache (or Nginx) with PHP 7.4 or higher.
- **Database**: MariaDB 10.4 or MySQL 5.7 or higher.
- **Tooling**: XAMPP, WAMP, or any local PHP/DB stack.
- **Web Browser**: Modern browser (Chrome, Firefox, Safari, Edge).

## Local Setup Instructions

1. **Clone/Download**: Extract the project files into your server root (e.g., `C:/xampp/htdocs/supermarket-system/`).
2. **Database Configuration**:
   - Open `domain/config.php`.
   - Update `DB_HOST`, `DB_USER`, `DB_PASS`, and `DB_NAME` to match your local database settings.
   - The system is designed to **auto-create** the database and tables if they don't exist upon the first run.
3. **Application Initialization**:
   - Navigate to `http://localhost/supermarket-system/` (or your specific directory).
   - On the first load, the `init_database()` function will create all required tables.
4. **Login**:
   - **Default Username**: `admin`
   - **Default Password**: `admin123`
   - *Recommendation*: Change these credentials immediately via the "Users" page after first login.

## Basic Usage

### 1. Dashboard

- View key metrics like "Daily Sales" and "Low Stock Alerts" immediately upon login.
- Check the "Recent Sales" table for a quick overview of store activity.

### 2. Managing Products

- Go to the **Products** section.
- Click **Add Product** to populate your catalog.
- Use the **Search** bar to find items by name or barcode.
- Set "Minimum Profit Margin" to protect against underpricing.

### 3. Recording Purchases (Inbound)

- Navigate to **Purchases**.
- Select a product, input the quantity received and the total cost.
- Save to automatically update the stock and recalculate average costs.

### 4. Processing Sales (POS)

- Open the **Sales** page.
- Select items via Search or Barcode Scan.
- Adjust quantities as needed.
- Click **Complete Sale** to generate an instant invoice.
- A **Thermal Receipt** with a QR Code will be ready for printing.

### 5. Administration

- **Users**: Go to `Users` page to create restricted "Sales" accounts for cashiers.
- **Settings**: Use the `Settings` page to customize the invoice header (Store Name, Phone, Tax Number).

## Troubleshooting

- **Database Error**: Ensure your MySQL service is running in XAMPP.
- **API Errors**: Check the Browser Console (F12) Network tab for 500/400 errors.
- **Printing Issues**: Ensure your thermal printer is set as the default system printer for "One-Click" experience.

## Future Improvements

- **Cloud Sync**: Optional cloud backup for database.
- **Supplier Management**: Dedicated module for vendor contact lists.
- **Discount System**: Promo codes and seasonal discounts.
- **Advanced Forecasting**: AI-driven stock prediction models.
