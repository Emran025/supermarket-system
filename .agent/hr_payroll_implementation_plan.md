# Human Resources and Payroll Module - Implementation Plan

## Executive Summary

This document provides a comprehensive implementation plan for adding a Human Resources and Payroll module to the existing accounting system. The plan ensures complete consistency with the current design patterns, component structures, and code architecture.

---

## 1. System Analysis

### 1.1 Current Architecture Overview

**Frontend Stack:**

- Next.js 14+ with TypeScript
- Component-based architecture using React functional components
- RTL (Right-to-Left) Arabic interface
- Consistent design system with CSS variables

**Backend Stack:**

- Laravel 11 (PHP)
- RESTful API architecture
- Role-Based Access Control (RBAC)
- Service-oriented design pattern

**Design Patterns Identified:**

1. **Tab-based navigation** for complex pages (Settings, Reports, Accrual Accounting)
2. **Table-based listing** with pagination, search, and filters
3. **Dialog-based forms** for simple CRUD operations
4. **Separate page forms** for complex data entry
5. **Consistent card-based layouts** with `.sales-card` styling
6. **Permission-based UI rendering** using `canAccess()` utility

### 1.2 Key Reference Pages

**Settings Page (`/app/system/settings/page.tsx`):**

- Tab navigation pattern
- Component-based tab content
- Permission-based tab visibility

**Users Page (`/app/people/users/page.tsx`):**

- Table with pagination
- Dialog-based add/edit forms
- Role and manager selection
- Search and filter capabilities

**Accrual Accounting Page (`/app/finance/accrual_accounting/page.tsx`):**

- Multi-tab interface
- Complex data management
- Integration with financial accounts

---

## 2. Database Schema Design

### 2.1 New Tables Required

#### `employees` Table

```php
Schema::create('employees', function (Blueprint $table) {
    $table->id();
    $table->string('employee_code', 50)->unique();
    $table->string('full_name', 100);
    $table->string('email', 100)->unique();
    $table->string('password'); // For employee portal access
    $table->string('phone', 20)->nullable();
    $table->string('national_id', 20)->nullable();
    $table->date('date_of_birth')->nullable();
    $table->enum('gender', ['male', 'female'])->nullable();
    $table->text('address')->nullable();
    $table->foreignId('job_title_id')->nullable()->constrained('job_titles')->onDelete('set null');
    $table->foreignId('department_id')->nullable()->constrained('departments')->onDelete('set null');
    $table->date('hire_date');
    $table->date('termination_date')->nullable();
    $table->enum('employment_status', ['active', 'suspended', 'terminated'])->default('active');
    $table->decimal('base_salary', 15, 2)->default(0);
    $table->foreignId('account_id')->nullable()->constrained('chart_of_accounts')->onDelete('set null');
    $table->boolean('is_active')->default(true);
    $table->foreignId('created_by')->nullable()->constrained('users')->onDelete('set null');
    $table->timestamps();
    $table->softDeletes();
});
```

#### `job_titles` Table

```php
Schema::create('job_titles', function (Blueprint $table) {
    $table->id();
    $table->string('title_ar', 100);
    $table->string('title_en', 100)->nullable();
    $table->text('description')->nullable();
    $table->decimal('min_salary', 15, 2)->nullable();
    $table->decimal('max_salary', 15, 2)->nullable();
    $table->boolean('is_active')->default(true);
    $table->timestamps();
});
```

#### `departments` Table

```php
Schema::create('departments', function (Blueprint $table) {
    $table->id();
    $table->string('name_ar', 100);
    $table->string('name_en', 100)->nullable();
    $table->text('description')->nullable();
    $table->foreignId('manager_id')->nullable()->constrained('employees')->onDelete('set null');
    $table->boolean('is_active')->default(true);
    $table->timestamps();
});
```

#### `employee_documents` Table

```php
Schema::create('employee_documents', function (Blueprint $table) {
    $table->id();
    $table->foreignId('employee_id')->constrained('employees')->onDelete('cascade');
    $table->enum('document_type', ['cv', 'contract', 'certificate', 'other']);
    $table->string('document_name', 255);
    $table->string('file_path', 500);
    $table->text('notes')->nullable();
    $table->foreignId('uploaded_by')->nullable()->constrained('users')->onDelete('set null');
    $table->timestamps();
});
```

#### `employee_allowances` Table

```php
Schema::create('employee_allowances', function (Blueprint $table) {
    $table->id();
    $table->foreignId('employee_id')->constrained('employees')->onDelete('cascade');
    $table->string('allowance_name', 100);
    $table->decimal('amount', 15, 2);
    $table->enum('frequency', ['monthly', 'quarterly', 'annual', 'one_time']);
    $table->date('start_date');
    $table->date('end_date')->nullable();
    $table->boolean('is_active')->default(true);
    $table->timestamps();
});
```

#### `employee_deductions` Table

```php
Schema::create('employee_deductions', function (Blueprint $table) {
    $table->id();
    $table->foreignId('employee_id')->constrained('employees')->onDelete('cascade');
    $table->string('deduction_name', 100);
    $table->decimal('amount', 15, 2);
    $table->enum('frequency', ['monthly', 'quarterly', 'annual', 'one_time']);
    $table->date('start_date');
    $table->date('end_date')->nullable();
    $table->boolean('is_active')->default(true);
    $table->timestamps();
});
```

#### `payroll_cycles` Table

```php
Schema::create('payroll_cycles', function (Blueprint $table) {
    $table->id();
    $table->string('cycle_name', 100);
    $table->date('period_start');
    $table->date('period_end');
    $table->date('payment_date');
    $table->enum('status', ['draft', 'processing', 'approved', 'paid'])->default('draft');
    $table->decimal('total_gross', 15, 2)->default(0);
    $table->decimal('total_deductions', 15, 2)->default(0);
    $table->decimal('total_net', 15, 2)->default(0);
    $table->foreignId('approved_by')->nullable()->constrained('users')->onDelete('set null');
    $table->dateTime('approved_at')->nullable();
    $table->foreignId('created_by')->nullable()->constrained('users')->onDelete('set null');
    $table->timestamps();
});
```

#### `payroll_items` Table

```php
Schema::create('payroll_items', function (Blueprint $table) {
    $table->id();
    $table->foreignId('payroll_cycle_id')->constrained('payroll_cycles')->onDelete('cascade');
    $table->foreignId('employee_id')->constrained('employees')->onDelete('cascade');
    $table->decimal('base_salary', 15, 2);
    $table->decimal('total_allowances', 15, 2)->default(0);
    $table->decimal('total_deductions', 15, 2)->default(0);
    $table->decimal('gross_salary', 15, 2);
    $table->decimal('net_salary', 15, 2);
    $table->text('notes')->nullable();
    $table->timestamps();
});
```

#### `payroll_transactions` Table (GL Integration)

```php
Schema::create('payroll_transactions', function (Blueprint $table) {
    $table->id();
    $table->foreignId('payroll_cycle_id')->constrained('payroll_cycles')->onDelete('cascade');
    $table->foreignId('employee_id')->constrained('employees')->onDelete('cascade');
    $table->foreignId('gl_entry_id')->nullable()->constrained('general_ledger')->onDelete('set null');
    $table->decimal('amount', 15, 2);
    $table->enum('transaction_type', ['salary', 'allowance', 'deduction', 'payment']);
    $table->date('transaction_date');
    $table->text('description')->nullable();
    $table->timestamps();
});
```

### 2.2 Database Migration Files

Create migrations in order:

1. `2026_01_10_000001_create_job_titles_table.php`
2. `2026_01_10_000002_create_departments_table.php`
3. `2026_01_10_000003_create_employees_table.php`
4. `2026_01_10_000004_create_employee_documents_table.php`
5. `2026_01_10_000005_create_employee_allowances_table.php`
6. `2026_01_10_000006_create_employee_deductions_table.php`
7. `2026_01_10_000007_create_payroll_cycles_table.php`
8. `2026_01_10_000008_create_payroll_items_table.php`
9. `2026_01_10_000009_create_payroll_transactions_table.php`

---

## 3. Backend Implementation

### 3.1 Models

#### `Employee.php`

```php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;

class Employee extends Authenticatable
{
    use SoftDeletes;

    protected $fillable = [
        'employee_code', 'full_name', 'email', 'password', 'phone',
        'national_id', 'date_of_birth', 'gender', 'address',
        'job_title_id', 'department_id', 'hire_date', 'termination_date',
        'employment_status', 'base_salary', 'account_id', 'is_active', 'created_by'
    ];

    protected $hidden = ['password'];

    protected $casts = [
        'date_of_birth' => 'date',
        'hire_date' => 'date',
        'termination_date' => 'date',
        'is_active' => 'boolean',
        'base_salary' => 'decimal:2',
    ];

    public function jobTitle() {
        return $this->belongsTo(JobTitle::class);
    }

    public function department() {
        return $this->belongsTo(Department::class);
    }

    public function account() {
        return $this->belongsTo(ChartOfAccounts::class, 'account_id');
    }

    public function documents() {
        return $this->hasMany(EmployeeDocument::class);
    }

    public function allowances() {
        return $this->hasMany(EmployeeAllowance::class);
    }

    public function deductions() {
        return $this->hasMany(EmployeeDeduction::class);
    }

    public function payrollItems() {
        return $this->hasMany(PayrollItem::class);
    }
}
```

### 3.2 Controllers

#### `EmployeesController.php`

Location: `domain/app/Http/Controllers/Api/EmployeesController.php`

Key methods:

- `index()` - List employees with pagination, search, filter
- `store()` - Create new employee
- `show($id)` - Get employee details
- `update($id)` - Update employee
- `destroy($id)` - Soft delete employee
- `uploadDocument()` - Upload employee documents
- `getDocuments($id)` - Get employee documents
- `suspend($id)` - Suspend employee
- `activate($id)` - Activate employee

#### `PayrollController.php`

Location: `domain/app/Http/Controllers/Api/PayrollController.php`

Key methods:

- `index()` - List payroll cycles
- `create()` - Create new payroll cycle
- `generatePayroll()` - Generate payroll for a period
- `approve($id)` - Approve payroll cycle
- `processPayment($id)` - Process salary payments
- `getEmployeeStatement($employeeId)` - Get employee account statement
- `exportPayrollVoucher($id)` - Export payroll voucher

### 3.3 Services

#### `PayrollService.php`

Location: `domain/app/Services/PayrollService.php`

Responsibilities:

- Calculate employee gross salary
- Calculate allowances and deductions
- Generate GL entries for payroll
- Create employee account transactions
- Generate payroll vouchers

#### `EmployeeAccountService.php`

Location: `domain/app/Services/EmployeeAccountService.php`

Responsibilities:

- Manage employee GL accounts
- Record salary transactions
- Calculate employee balances
- Generate employee statements

### 3.4 API Routes

Add to `domain/routes/api.php`:

```php
// HR & Payroll Routes
Route::middleware(['auth:sanctum'])->group(function () {
    // Employees
    Route::get('/employees', [EmployeesController::class, 'index']);
    Route::post('/employees', [EmployeesController::class, 'store']);
    Route::get('/employees/{id}', [EmployeesController::class, 'show']);
    Route::put('/employees/{id}', [EmployeesController::class, 'update']);
    Route::delete('/employees/{id}', [EmployeesController::class, 'destroy']);
    Route::post('/employees/{id}/suspend', [EmployeesController::class, 'suspend']);
    Route::post('/employees/{id}/activate', [EmployeesController::class, 'activate']);
    
    // Employee Documents
    Route::post('/employees/{id}/documents', [EmployeesController::class, 'uploadDocument']);
    Route::get('/employees/{id}/documents', [EmployeesController::class, 'getDocuments']);
    
    // Job Titles & Departments
    Route::apiResource('job-titles', JobTitlesController::class);
    Route::apiResource('departments', DepartmentsController::class);
    
    // Payroll
    Route::get('/payroll/cycles', [PayrollController::class, 'index']);
    Route::post('/payroll/cycles', [PayrollController::class, 'create']);
    Route::post('/payroll/generate', [PayrollController::class, 'generatePayroll']);
    Route::post('/payroll/{id}/approve', [PayrollController::class, 'approve']);
    Route::post('/payroll/{id}/process-payment', [PayrollController::class, 'processPayment']);
    Route::get('/payroll/employee/{id}/statement', [PayrollController::class, 'getEmployeeStatement']);
    Route::get('/payroll/{id}/voucher', [PayrollController::class, 'exportPayrollVoucher']);
});
```

---

## 4. Frontend Implementation

### 4.1 Page Structure

#### Main HR Page

**Path:** `public/app/hr/page.tsx`

Structure (similar to Settings page):

```tsx
"use client";

import { useState, useEffect } from "react";
import { MainLayout, PageHeader } from "@/components/layout";
import { TabNavigation } from "@/components/ui";
import { User, getStoredUser, getStoredPermissions, Permission, canAccess } from "@/lib/auth";

import { EmployeesTab } from "./components/EmployeesTab";
import { PayrollTab } from "./components/PayrollTab";

export default function HRPage() {
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [activeTab, setActiveTab] = useState("employees");

  useEffect(() => {
    const storedUser = getStoredUser();
    const storedPermissions = getStoredPermissions();
    setUser(storedUser);
    setPermissions(storedPermissions);
  }, []);

  return (
    <MainLayout requiredModule="hr">
      <PageHeader title="الموارد البشرية" user={user} showDate={true} />

      <div className="settings-wrapper animate-fade">
        <TabNavigation 
          tabs={[
            { key: "employees", label: "إدارة الموظفين", icon: "fa-users" },
            { key: "payroll", label: "الرواتب والمستحقات", icon: "fa-money-bill-wave" },
          ]}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        <div style={{ marginTop: "1rem" }}>
            {activeTab === "employees" && <EmployeesTab />}
            {activeTab === "payroll" && <PayrollTab />}
        </div>
      </div>
    </MainLayout>
  );
}
```

### 4.2 Employees Tab Component

**Path:** `public/app/hr/components/EmployeesTab.tsx`

Features:

- Table listing all employees
- Search by name, email, employee code
- Filter by department, job title, status
- Add button (opens separate page)
- Edit button (opens separate page)
- View employee file button
- Suspend/Activate actions

Structure (similar to Users page table):

```tsx
export function EmployeesTab() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDepartment, setFilterDepartment] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // Table columns similar to Users page
  const columns: Column<Employee>[] = [
    { key: "employee_code", header: "رقم الموظف", dataLabel: "رقم الموظف" },
    { key: "full_name", header: "الاسم الكامل", dataLabel: "الاسم الكامل" },
    { key: "job_title", header: "المسمى الوظيفي", dataLabel: "المسمى الوظيفي" },
    { key: "department", header: "القسم", dataLabel: "القسم" },
    { key: "base_salary", header: "الراتب الأساسي", dataLabel: "الراتب الأساسي" },
    { key: "employment_status", header: "الحالة", dataLabel: "الحالة", render: (item) => (
      <span className={`badge ${getStatusBadgeClass(item.employment_status)}`}>
        {getStatusText(item.employment_status)}
      </span>
    )},
    { key: "actions", header: "الإجراءات", dataLabel: "الإجراءات", render: (item) => (
      <div className="action-buttons">
        <button className="icon-btn view" onClick={() => viewEmployee(item.id)}>
          {getIcon("eye")}
        </button>
        <button className="icon-btn edit" onClick={() => editEmployee(item.id)}>
          {getIcon("edit")}
        </button>
      </div>
    )},
  ];

  return (
    <div className="sales-card animate-fade">
      {/* Search and Filter Section */}
      <div className="form-row" style={{ marginBottom: "1.5rem" }}>
        <div className="form-group">
          <input
            type="text"
            placeholder="بحث بالاسم أو البريد الإلكتروني..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="form-group">
          <select value={filterDepartment} onChange={(e) => setFilterDepartment(e.target.value)}>
            <option value="">كل الأقسام</option>
            {/* Department options */}
          </select>
        </div>
        <div className="form-group">
          <button className="btn btn-primary" onClick={() => router.push('/hr/employees/add')}>
            {getIcon("plus")} إضافة موظف
          </button>
        </div>
      </div>

      {/* Table */}
      <Table
        columns={columns}
        data={employees}
        keyExtractor={(item) => item.id}
        emptyMessage="لا يوجد موظفين"
        isLoading={isLoading}
        pagination={{
          currentPage,
          totalPages,
          onPageChange: loadEmployees,
        }}
      />
    </div>
  );
}
```

### 4.3 Add/Edit Employee Page

**Path:** `public/app/hr/employees/add/page.tsx` and `public/app/hr/employees/edit/[id]/page.tsx`

This is a **separate page** (not a dialog) with comprehensive form fields:

Sections:

1. **Personal Information**
   - Full Name, Email, Phone
   - National ID, Date of Birth, Gender
   - Address

2. **Employment Information**
   - Employee Code (auto-generated)
   - Job Title (dropdown)
   - Department (dropdown)
   - Hire Date
   - Base Salary
   - Employment Status

3. **Account Information**
   - Email (for portal access)
   - Password (for new employees)
   - Linked GL Account (dropdown from Chart of Accounts)

4. **Documents** (Edit mode only)
   - Upload CV
   - Upload Contract
   - Upload Certificates
   - Other documents

5. **Allowances** (Edit mode only)
   - Add/Edit/Delete allowances
   - Allowance name, amount, frequency

6. **Deductions** (Edit mode only)
   - Add/Edit/Delete deductions
   - Deduction name, amount, frequency

Layout similar to complex forms in the system with card-based sections.

### 4.4 Employee File Page

**Path:** `public/app/hr/employees/view/[id]/page.tsx`

Professional employee file display with tabs:

- Overview (personal info, employment info)
- Documents
- Allowances & Deductions
- Salary History
- Account Statement

### 4.5 Payroll Tab Component

**Path:** `public/app/hr/components/PayrollTab.tsx`

Features:

- List of payroll cycles
- Create new payroll cycle
- Generate payroll for period
- Approve payroll
- Process payments
- Export payroll vouchers
- Employee account statements

Structure:

```tsx
export function PayrollTab() {
  const [payrollCycles, setPayrollCycles] = useState<PayrollCycle[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  return (
    <div className="sales-card animate-fade">
      <div className="card-header-flex">
        <h3>دورات الرواتب</h3>
        <button className="btn btn-primary" onClick={() => setShowCreateDialog(true)}>
          {getIcon("plus")} دورة رواتب جديدة
        </button>
      </div>

      {/* Payroll Cycles Table */}
      <Table
        columns={payrollColumns}
        data={payrollCycles}
        keyExtractor={(item) => item.id}
        emptyMessage="لا توجد دورات رواتب"
      />

      {/* Create Payroll Dialog */}
      <Dialog isOpen={showCreateDialog} onClose={() => setShowCreateDialog(false)}>
        {/* Form fields */}
      </Dialog>
    </div>
  );
}
```

### 4.6 TypeScript Interfaces

**Path:** `public/app/hr/types.ts`

```typescript
export interface Employee {
  id: number;
  employee_code: string;
  full_name: string;
  email: string;
  phone?: string;
  national_id?: string;
  date_of_birth?: string;
  gender?: 'male' | 'female';
  address?: string;
  job_title_id?: number;
  job_title?: JobTitle;
  department_id?: number;
  department?: Department;
  hire_date: string;
  termination_date?: string;
  employment_status: 'active' | 'suspended' | 'terminated';
  base_salary: number;
  account_id?: number;
  is_active: boolean;
  created_at: string;
}

export interface JobTitle {
  id: number;
  title_ar: string;
  title_en?: string;
  description?: string;
  min_salary?: number;
  max_salary?: number;
  is_active: boolean;
}

export interface Department {
  id: number;
  name_ar: string;
  name_en?: string;
  description?: string;
  manager_id?: number;
  is_active: boolean;
}

export interface EmployeeDocument {
  id: number;
  employee_id: number;
  document_type: 'cv' | 'contract' | 'certificate' | 'other';
  document_name: string;
  file_path: string;
  notes?: string;
  uploaded_by?: number;
  created_at: string;
}

export interface EmployeeAllowance {
  id: number;
  employee_id: number;
  allowance_name: string;
  amount: number;
  frequency: 'monthly' | 'quarterly' | 'annual' | 'one_time';
  start_date: string;
  end_date?: string;
  is_active: boolean;
}

export interface EmployeeDeduction {
  id: number;
  employee_id: number;
  deduction_name: string;
  amount: number;
  frequency: 'monthly' | 'quarterly' | 'annual' | 'one_time';
  start_date: string;
  end_date?: string;
  is_active: boolean;
}

export interface PayrollCycle {
  id: number;
  cycle_name: string;
  period_start: string;
  period_end: string;
  payment_date: string;
  status: 'draft' | 'processing' | 'approved' | 'paid';
  total_gross: number;
  total_deductions: number;
  total_net: number;
  approved_by?: number;
  approved_at?: string;
  created_at: string;
}

export interface PayrollItem {
  id: number;
  payroll_cycle_id: number;
  employee_id: number;
  employee?: Employee;
  base_salary: number;
  total_allowances: number;
  total_deductions: number;
  gross_salary: number;
  net_salary: number;
  notes?: string;
}
```

---

## 5. RBAC Integration

### 5.1 Module Registration

Add to `domain/database/seeders/ModulesSeeder.php`:

```php
DB::table('modules')->insert([
    [
        'module_key' => 'hr',
        'name_ar' => 'الموارد البشرية',
        'name_en' => 'Human Resources',
        'category' => 'hr',
        'icon' => 'fa-users',
        'sort_order' => 70,
        'is_active' => true,
    ],
    [
        'module_key' => 'employees',
        'name_ar' => 'إدارة الموظفين',
        'name_en' => 'Employee Management',
        'category' => 'hr',
        'icon' => 'fa-user-tie',
        'sort_order' => 71,
        'is_active' => true,
    ],
    [
        'module_key' => 'payroll',
        'name_ar' => 'الرواتب',
        'name_en' => 'Payroll',
        'category' => 'hr',
        'icon' => 'fa-money-bill-wave',
        'sort_order' => 72,
        'is_active' => true,
    ],
]);
```

### 5.2 Sidebar Integration

Update `public/lib/auth.ts` - `getSidebarLinks()`:

```typescript
const allLinks = [
  // ... existing links
  { href: "/hr", icon: "users", label: "الموارد البشرية", module: "hr" },
  // ... rest of links
];
```

---

## 6. Design Consistency Checklist

### 6.1 Visual Design

- ✅ Use `.sales-card` for all card containers
- ✅ Use `.settings-wrapper` for tab-based pages
- ✅ Use consistent color scheme (CSS variables)
- ✅ Use `.form-group` and `.form-row` for forms
- ✅ Use `.btn btn-primary` for action buttons
- ✅ Use `.icon-btn` for icon-only buttons
- ✅ Use `.badge` for status indicators
- ✅ Use `.table-container` for tables

### 6.2 Component Patterns

- ✅ Use `TabNavigation` component for tabs
- ✅ Use `Table` component for data listing
- ✅ Use `Dialog` component for simple forms
- ✅ Use `PageHeader` component for page headers
- ✅ Use `MainLayout` wrapper for all pages
- ✅ Use `showToast` for notifications

### 6.3 Code Patterns

- ✅ Use TypeScript interfaces for all data types
- ✅ Use `fetchAPI` utility for API calls
- ✅ Use `canAccess` for permission checks
- ✅ Use `useCallback` for API functions
- ✅ Use consistent error handling
- ✅ Use pagination pattern from Users page
- ✅ Use Laravel Resource Controllers
- ✅ Use Service classes for business logic

---

## 7. Implementation Phases

### Phase 1: Database & Backend Foundation (Week 1)

1. Create all migration files
2. Create all Model classes
3. Create Controller skeletons
4. Set up API routes
5. Test database structure

### Phase 2: Core Employee Management (Week 2)

1. Implement EmployeesController (CRUD)
2. Create EmployeesTab component
3. Create Add Employee page
4. Create Edit Employee page
5. Implement document upload
6. Test employee management flow

### Phase 3: Payroll Foundation (Week 3)

1. Create PayrollService
2. Create EmployeeAccountService
3. Implement PayrollController
4. Create PayrollTab component
5. Implement payroll cycle creation
6. Test payroll generation

### Phase 4: GL Integration (Week 4)

1. Integrate with Chart of Accounts
2. Create employee GL accounts automatically
3. Generate GL entries for payroll
4. Implement employee account statements
5. Test financial integration

### Phase 5: Advanced Features (Week 5)

1. Create Employee File view page
2. Implement allowances/deductions management
3. Create payroll voucher export
4. Implement employee suspension logic
5. Add comprehensive search and filters

### Phase 6: Testing & Refinement (Week 6)

1. End-to-end testing
2. Permission testing
3. UI/UX refinement
4. Performance optimization
5. Documentation

---

## 8. File Structure Summary

```batch
accounting-system/
├── domain/
│   ├── app/
│   │   ├── Http/
│   │   │   └── Controllers/
│   │   │       └── Api/
│   │   │           ├── EmployeesController.php
│   │   │           ├── PayrollController.php
│   │   │           ├── JobTitlesController.php
│   │   │           └── DepartmentsController.php
│   │   ├── Models/
│   │   │   ├── Employee.php
│   │   │   ├── JobTitle.php
│   │   │   ├── Department.php
│   │   │   ├── EmployeeDocument.php
│   │   │   ├── EmployeeAllowance.php
│   │   │   ├── EmployeeDeduction.php
│   │   │   ├── PayrollCycle.php
│   │   │   ├── PayrollItem.php
│   │   │   └── PayrollTransaction.php
│   │   └── Services/
│   │       ├── PayrollService.php
│   │       └── EmployeeAccountService.php
│   └── database/
│       ├── migrations/
│       │   ├── 2026_01_10_000001_create_job_titles_table.php
│       │   ├── 2026_01_10_000002_create_departments_table.php
│       │   ├── 2026_01_10_000003_create_employees_table.php
│       │   ├── 2026_01_10_000004_create_employee_documents_table.php
│       │   ├── 2026_01_10_000005_create_employee_allowances_table.php
│       │   ├── 2026_01_10_000006_create_employee_deductions_table.php
│       │   ├── 2026_01_10_000007_create_payroll_cycles_table.php
│       │   ├── 2026_01_10_000008_create_payroll_items_table.php
│       │   └── 2026_01_10_000009_create_payroll_transactions_table.php
│       └── seeders/
│           └── ModulesSeeder.php (update)
│
└── public/
    ├── app/
    │   └── hr/
    │       ├── page.tsx (Main HR page with tabs)
    │       ├── types.ts (TypeScript interfaces)
    │       ├── components/
    │       │   ├── EmployeesTab.tsx
    │       │   └── PayrollTab.tsx
    │       └── employees/
    │           ├── add/
    │           │   └── page.tsx
    │           ├── edit/
    │           │   └── [id]/
    │           │       └── page.tsx
    │           └── view/
    │               └── [id]/
    │                   └── page.tsx
    └── lib/
        └── auth.ts (update getSidebarLinks)
```

---

## 9. Critical Success Factors

1. **Design Consistency**: Every component must match existing design patterns
2. **Permission Integration**: All features must respect RBAC
3. **GL Integration**: Payroll must properly integrate with financial accounts
4. **Data Validation**: Comprehensive validation on both frontend and backend
5. **Error Handling**: Consistent error handling and user feedback
6. **Performance**: Efficient queries and pagination
7. **Testing**: Thorough testing at each phase
8. **Documentation**: Clear code comments and user documentation

---

## 10. Potential Challenges & Solutions

### Challenge 1: Complex Payroll Calculations

**Solution**: Create dedicated PayrollService with well-tested calculation methods

### Challenge 2: GL Account Integration

**Solution**: Use existing ChartOfAccountsMappingService pattern, create employee accounts automatically

### Challenge 3: Document Upload & Storage

**Solution**: Use Laravel's file storage system, store in `storage/app/employee_documents`

### Challenge 4: Employee Portal Access

**Solution**: Use separate authentication guard for employees, similar to user authentication

### Challenge 5: Payroll Approval Workflow

**Solution**: Implement status-based workflow (draft → processing → approved → paid)

---

## 11. Next Steps

1. **Review this plan** with stakeholders
2. **Set up development environment** for HR module
3. **Create feature branch** `feature/hr-payroll-module`
4. **Begin Phase 1** implementation
5. **Schedule regular reviews** after each phase

---

## Conclusion

This implementation plan provides a comprehensive roadmap for adding the HR and Payroll module while maintaining complete consistency with the existing system architecture. The modular approach ensures that each component integrates seamlessly with the current design patterns, code structure, and user experience.

The plan prioritizes:

- **Consistency**: Every aspect matches existing patterns
- **Scalability**: Architecture supports future enhancements
- **Maintainability**: Clear code organization and documentation
- **User Experience**: Familiar interface for existing users
- **Data Integrity**: Proper validation and error handling

By following this plan systematically, the HR and Payroll module will integrate seamlessly into the accounting system, providing a professional and cohesive user experience.
