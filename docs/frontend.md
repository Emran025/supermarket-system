# Frontend Documentation

## Architecture

**Pattern**: Multi-page application with shared utilities

**Structure**:

```batch
presentation/
├── login.html              # Entry point
├── dashboard.html          # Main page post-login
├── products.html           # Product management
├── purchases.html          # Purchase recording
├── sales.html              # Point of sale
├── ar_customers.html       # AR customer profiles
├── ar_ledger.html          # AR transaction ledger
├── expenses.html           # Expense tracking
├── assets.html             # Asset management
├── revenues.html           # Revenue recording
├── reports.html            # Financial reports
├── users.html              # User management
├── settings.html           # System settings
├── *.js                    # Page-specific controllers
├── common.js               # Shared utilities
├── styles.css              # Global stylesheet
└── qrcode.js               # QR code library
```

## Technology Stack

### Core

- **HTML5**: Semantic markup
- **Vanilla JavaScript**: ES6+ features (async/await, destructuring)
- **CSS3**: Custom properties (variables) for theming
- **SVG**: Inline icons for performance

### Libraries

- **QRCode.js**: QR code generation for invoices
- **FontAwesome 6**: Icon set (CDN)
- **Google Fonts**: Outfit (Latin), Cairo (Arabic)

### Communication

- **Fetch API**: All HTTP requests
- **JSON**: Data exchange format
- **Credentials**: Cookies sent automatically

## Common Utilities (`common.js`)

### Navigation

```javascript
function navigate(page)
    // Client-side navigation (window.location.href)

function logout()
    // Calls API, then redirects to login
```

### API Communication

```javascript
async function fetchAPI(action, options = {})
    // Wrapper around fetch()
    // Handles auth errors (401 → redirect to login)
    // Parses JSON response
    // Throws on HTTP errors

// Usage
const data = await fetchAPI('products');
const result = await fetchAPI('products', {
    method: 'POST',
    body: JSON.stringify({...})
});
```

### UI Feedback

```javascript
function showToast(message, type = 'info', duration = 3000)
    // Creates temporary notification
    // Types: 'success', 'error', 'info', 'warning'

function showLoadingOverlay(message)
function hideLoadingOverlay()
    // Full-screen loading indicator
```

### Modal Dialogs

```javascript
function showModal(title, content, onConfirm, onCancel)
    // Creates dialog overlay
    // Returns promise resolving to true (confirm) or false (cancel)

// Example
const confirmed = await showModal(
    'Delete Product',
    'Are you sure?',
    () => true,
    () => false
);
```

### Pagination

```javascript
function renderPagination(total, page, perPage, onPageChange)
    // Creates pagination controls
    // Calls onPageChange(newPage) when clicked

// Typical pattern
renderPagination(data.total, currentPage, 20, (newPage) => {
    currentPage = newPage;
    loadData();
});
```

### Formatting

```javascript
function formatCurrency(amount)
    // Returns formatted price with currency symbol
    // Example: formatCurrency(1234.56) → "1,234.56 ر.ي"

function formatDate(dateString)
    // Returns Arabic-localized date
    // Example: "2026-01-06T18:30:00" → custom Arabic format
```

### User Context

```javascript
function getUserInfo()
    // Returns {id, username, role} from session

function hasRole(role)
    // Checks if current user has specified role
    // Example: hasRole('admin')
```

## Page Patterns

### Standard Page Structure

```html
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8">
    <title>Page Title</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <div class="app-container">
        <!-- Sidebar navigation -->
        <aside class="sidebar">...</aside>
        
        <!-- Main content -->
        <main class="main-content">
            <header class="page-header">
                <h1>Page Title</h1>
                <div class="user-info">
                    <span id="userNameDisplay"></span>
                    <button onclick="logout()">Logout</button>
                </div>
            </header>
            
            <div class="content-wrapper">
                <!-- Search bar -->
                <div class="search-container">
                    <input type="text" id="params-search" />
                    <button id="search-btn">...</button>
                </div>
                
                <!-- Action buttons -->
                <div class="header-actions">
                    <button id="addBtn">Add New</button>
                </div>
                
                <!-- Data table -->
                <table id="dataTable">
                    <thead>...</thead>
                    <tbody></tbody>
                </table>
                
                <!-- Pagination -->
                <div id="paginationContainer"></div>
            </div>
        </main>
    </div>
    
    <!-- Modals -->
    <div id="editModal" class="dialog-overlay"></div>
    
    <script src="common.js"></script>
    <script src="page-specific.js"></script>
</body>
</html>
```

### JavaScript Page Controller Pattern

```javascript
let currentPage = 1;
let searchQuery = '';

// Initialize on load
document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    displayUserInfo();
    await loadData();
    initializeEventListeners();
});

function initializeEventListeners() {
    document.getElementById('addBtn').addEventListener('click', showAddModal);    document.getElementById('params-search').addEventListener('input', debounce(handleSearch, 300));
}

async function loadData() {
    const params = new URLSearchParams({
        page: currentPage,
        per_page: 20,
        search: searchQuery
    });
    
    const response = await fetchAPI(`endpoint?${params}`);
    renderTable(response.data);
    renderPagination(response.total, currentPage, 20, (page) => {
        currentPage = page;
        loadData();
    });
}

function renderTable(items) {
    const tbody = document.getElementById('dataTable').querySelector('tbody');
    tbody.innerHTML = items.map(item => `
        <tr>
            <td>${item.name}</td>
            <td>
                <button onclick="editItem(${item.id})">Edit</button>
                <button onclick="deleteItem(${item.id})">Delete</button>
            </td>
        </tr>
    `).join('');
}

async function showAddModal() {
    // Show modal, collect input
    // Call API to create
    // Reload data
}

async function editItem(id) {
    // Similar to add
}

async function deleteItem(id) {
    const confirmed = await showModal('Confirm Delete', 'Are you sure?');
    if (!confirmed) return;
    
    await fetchAPI(`endpoint?id=${id}`, { method: 'DELETE' });
    showToast('Deleted successfully', 'success');
    loadData();
}
```

## Key Pages

### Dashboard (`dashboard.html`, `dashboard.js`)

**Displays**:

- Daily sales total
- Low stock alerts (products with stock < 10)
- Recent sales table
- Expiring products (within 30 days)
- Pending purchase requests

**Data Flow**:

```javascript
const stats = await fetchAPI('dashboard');
// stats = { daily_sales, low_stock[], recent_sales[], expiring[], pending_requests[] }
```

**UI Updates**:

- Auto-refresh every 60 seconds
- Animated counters for metrics
- Color-coded alerts

### Products (`products.html`, `products.js`)

**Features**:

- Search (name, category, ID, description)
- Add/Edit/Delete
- Multi-unit display (unit_name, sub_unit_name)
- Stock quantity display
- Minimum profit margin configuration

**Form Fields**:

- name, description, category
- unit_price, minimum_profit_margin, stock_quantity
- unit_name, items_per_unit, sub_unit_name

### Sales / POS (`sales.html`, `sales.js`)

**Workflow**:

1. **Add Items**: Search products, select, set quantity
2. **Review Cart**: Edit quantities, remove items
3. **Select Payment Type**: Cash or Credit
4. **If Credit**: Select customer from dropdown
5. **Complete Sale**: Creates invoice, deducts stock
6. **Print Receipt**: Auto-opens print dialog with QR code

**QR Code**:

- Generated using qrcode.js
- Contains: TLV-encoded data (seller name, tax number, timestamp, total)
- ZATCA-compliant format

**Payment Types**:

```javascript
<select id="paymentType">
    <option value="cash">Cash</option>
    <option value="credit">Credit (Deferred)</option>
</select>

// If credit selected
<select id="customerSelect">
    <!-- Populated from ar_customers API -->
</select>
```

### Purchases (`purchases.html`, `purchases.js`)

**Two Tabs**:

1. **Purchase History**: List of completed purchases
2. **Purchase Requests**: Pending/approved requests

**Add Purchase**:

- Select product
- Enter quantity and unit type (main/sub)
- Enter invoice price (total cost)
- Optional: production_date, expiry_date
- System calculates new selling price

**Purchase Requests**:

- Staff creates request
- Manager can approve/reject
- Status: pending, approved, rejected

### AR Customers (`ar_customers.html`, `ar_customers.js`)

**Fields**:

- name, phone, email, address
- tax_number
- current_balance (read-only, calculated)

**Table Columns**:

- Name
- Phone
- Current Balance (formatted as currency)
- Actions (View Ledger, Edit, Delete)

### AR Ledger (`ar_ledger.html`, `ar_ledger.js`)

**Displays**: Transaction history for selected customer

**Columns**:

- Date
- Type (Invoice, Payment, Return)
- Description
- Amount
- Balance (running total)
- Actions (Delete/Restore if soft-deleted)

**Add Transaction**:

- Type: Payment or Return
- Amount
- Description

**Invoices**: Automatically added when credit sale created

### Expenses (`expenses.html`, `expenses.js`)

**Fields**:

- category (free text)
- amount
- expense_date
- description

**Common Categories**: Rent, Utilities, Salaries, Maintenance

### Assets (`assets.html`, `assets.js`)

**Fields**:

- name
- value
- purchase_date
- depreciation_rate (percentage)
- status (active/disposed)
- description

### Revenues (`revenues.html`, `revenues.js`)

**Fields**:

- source (where revenue came from)
- amount
- revenue_date
- description

**Use Cases**: Scrap sales, commission income, donations

### Reports (`reports.html`, `reports.js`)

**Single Report**: Balance Sheet

**Displays**:

```batch
Assets:
- Cash Estimate: X
- Inventory Value: Y
- Fixed Assets: Z
- Accounts Receivable: W
Total Assets: (sum)

Income Statement:
- Total Sales: A
- Other Revenues: B
- Total Purchases: C
- Total Expenses: D
Net Profit: (A + B) - (C + D)
```

### Users (`users.html`, `users.js`) **Admin Only**

**Fields**:

- username
- role (admin, manager, sales)
- is_active (boolean)
- manager_id (for sales/managers)

**Actions**:

- Create user
- Update role/status
- Change password (modal)
- Delete user

### Settings (`settings.html`, `settings.js`)

**Sections**:

1. **Store Information**:
   - store_name, store_address, store_phone, tax_number

2. **Invoice Configuration**:
   - invoice_size (thermal/a4)
   - currency_symbol
   - footer_message

3. **Preview**:
   - Fetches latest invoice
   - Renders print template
   - Shows in modal

## Styling (`styles.css`)

### Design System

**CSS Variables**:

```css
:root {
    --primary-color: #10b981;
    --primary-dark: #059669;
    --bg-primary: #f9fafb;
    --text-primary: #111827;
    --border-color: #e5e7eb;
    --radius-sm: 6px;
    --radius-md: 8px;
    --shadow-sm: 0 1px 3px rgba(0,0,0,0.1);
}
```

**Typography**:

- Headings: Outfit font
- Body (Arabic): Cairo font
- Font sizes: 0.875rem to 2rem

**Components**:

- `.btn`: Buttons with variants (primary, secondary, danger)
- `.section-card`: Content containers
- `.table`: Data tables with hover effects
- `.dialog-overlay`: Modal dialogs
- `.badge`: Status indicators

**Layout**:

- Flexbox for header/footer
- CSS Grid for dashboard cards
- RTL support (dir="rtl")

### Responsive Design

**Breakpoints**:

- Desktop: 1024px+
- Tablet: 768px - 1024px
- Mobile: < 768px

**Adjustments**:

- Sidebar collapses on mobile
- Tables scroll horizontally
- Forms stack vertically

## State Management **No Global State Library**

**Page-Level State**:

```javascript
// Each page maintains its own state variables
let currentPage = 1;
let searchQuery = '';
let selectedItems = [];
```

**Session State**:

- Stored in `sessionStorage`
- Used for user info caching
- Cleared on logout

## Form Validation

**Client-Side**:

```javascript
function validateForm(data) {
    if (!data.name) {
        showToast('Name is required', 'error');
        return false;
    }
    if (data.amount <= 0) {
        showToast('Amount must be positive', 'error');
        return false;
    }
    return true;
}
```

**Server-Side**:

- Backend performs final validation
- Frontend displays error messages from API

## Print Functionality

**Invoice Printing**:

1. Generate HTML template in hidden div
2. Include QR code canvas toDataURL()
3. Call window.print()
4. Print dialog opens with thermal/A4 format
5. CSS media query `@media print` styles

**Print Styles**:

```css
@media print {
    .no-print { display: none; }
    .print-section { display: block; }
    /* Optimize for thermal printer: 80mm width */
}
```

## Performance Optimizations

**Debouncing**:

```javascript
function debounce(func, delay) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), delay);
    };
}

// Usage
searchInput.addEventListener('input', debounce(handleSearch, 300));
```

**Lazy Loading**:

- Images use loading="lazy"
- Large tables paginated (20 items per page)

**Caching**:

- Static assets (CSS, JS) browser-cached
- API responses not cached (always fresh data)

## Accessibility

**Keyboard Navigation**:

- Tab index on interactive elements
- Enter key submits forms
- Escape key closes modals

**Screen Readers**:

- Semantic HTML (header, nav, main, article)
- ARIA labels on icon buttons
- Alt text on images

**Contrast**:

- WCAG AA compliant color ratios
- Focus indicators on inputs

## Browser Compatibility

**Tested**:

- Chrome 90+
- Firefox 88+
- Edge 90+
- Safari 14+

**Polyfills**: None (assumes modern browser)

## Error Handling

**Patterns**:

```javascript
try {
    const data = await fetchAPI('products');
    renderTable(data);
} catch (error) {
    showToast(error.message, 'error');
    console.error(error);
}
```

**Network Errors**:

- Display user-friendly message
- Log to console for debugging
- Retry button where appropriate

## Localization

**Language**: Arabic (RTL)

**Hardcoded Strings**: All in Arabic in HTML/JS

**Date/Time**: Gregorian calendar with Arabic month names

**Numbers**: Arabic-Indic numerals (١٢٣) vs Latin (123) - configurable

## Security Considerations

**XSS Prevention**:

- Use textContent instead of innerHTML where possible
- Sanitize user input before rendering

**CSRF**: Not implemented (relies on same-origin policy)

**Authentication**:

- All requests include session cookie
- 401 responses redirect to login immediately

## Development Workflow

**File Organization**:

- One HTML + one JS per page
- Shared code in common.js
- Global styles in styles.css

**Adding New Page**:

1. Create page.html (copy template)
2. Create page.js (copy controller pattern)
3. Add navigation link in sidebar
4. Register route if needed

**Debugging**:

- Browser DevTools Network tab for API calls
- Console for JavaScript errors
- Vue/React DevTools NOT applicable (vanilla JS)
