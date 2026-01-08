// Core Types for the Accounting System

export interface User {
  id: number;
  username: string;
  full_name: string;
  role: string;
  role_id: number;
  role_key?: string;
  role_name_ar?: string;
  permissions?: Permissions;
  is_active: boolean | number;
  manager_id?: number;
  manager_name?: string;
  created_at?: string;
  creator_name?: string;
}

export interface Permissions {
  [module: string]: {
    view?: boolean;
    create?: boolean;
    edit?: boolean;
    delete?: boolean;
  };
}

export interface Permission {
  module: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

export interface Product {
  id: number;
  name: string;
  category?: string;
  category_id?: number;
  category_name?: string;
  description?: string;
  unit_price?: number;
  purchase_price?: number;
  selling_price?: number;
  minimum_profit_margin?: number;
  profit_margin?: number;
  stock_quantity?: number;
  stock?: number;
  min_stock?: number;
  unit_name?: string;
  unit_type?: string;
  items_per_unit?: number;
  units_per_package?: number;
  package_price?: number;
  sub_unit_name?: string;
  barcode?: string;
  expiry_date?: string;
  latest_purchase_price?: number;
  creator_name?: string;
  created_at?: string;
}

export interface Invoice {
  id: number;
  invoice_number: string;
  total_amount: number;
  item_count?: number;
  created_at: string;
  salesperson_name?: string;
  payment_type: 'cash' | 'credit';
  customer_id?: number;
  customer_name?: string;
  customer_phone?: string;
  customer_tax?: string;
  amount_paid?: number;
  items?: InvoiceItem[];
}

export interface InvoiceItem {
  product_id: number;
  product_name: string;
  display_name?: string;
  quantity: number;
  unit_type?: string;
  unit_name?: string;
  total_sub_units?: number;
  unit_price: number;
  subtotal: number;
}

export interface Purchase {
  id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  unit_type?: string;
  unit_name?: string;
  sub_unit_name?: string;
  unit_price?: number;
  total_price?: number;
  invoice_price?: number;
  purchase_date: string;
  production_date?: string;
  expiry_date?: string;
  supplier?: string;
  notes?: string;
  recorder_name?: string;
  created_at?: string;
}

export interface Expense {
  id: number;
  category: string;
  amount: number;
  expense_date: string;
  description?: string;
  recorder_name?: string;
  created_at?: string;
}

export interface Revenue {
  id: number;
  category: string;
  amount: number;
  revenue_date: string;
  description?: string;
  notes?: string;
  recorder_name?: string;
  created_at?: string;
}

export interface Customer {
  id: number;
  name: string;
  phone?: string;
  address?: string;
  tax_number?: string;
  balance?: number;
  total_debt?: number;
  total_paid?: number;
  created_at?: string;
}

export interface Asset {
  id: number;
  name: string;
  category: string;
  purchase_date: string;
  purchase_price: number;
  current_value: number;
  depreciation_rate?: number;
  description?: string;
}

export interface DashboardStats {
  daily_sales?: number;
  todays_sales?: number;
  today_breakdown?: {
    cash: number;
    credit: number;
  };
  total_products: number;
  low_stock_count?: number;
  low_stock_products?: number;
  expiring_soon_count?: number;
  expiring_products?: number;
  total_sales: number;
  sales_breakdown?: {
    cash: { value: number; count: number };
    credit: { value: number; count: number };
  };
  today_expenses?: number;
  todays_expenses?: number;
  total_expenses: number;
  today_revenues?: number;
  todays_revenues?: number;
  total_revenues: number;
  total_assets: number;
  recent_sales?: Invoice[];
}

export interface SystemSettings {
  store_name?: string;
  store_address?: string;
  store_phone?: string;
  store_email?: string;
  tax_number?: string;
  cr_number?: string;
  invoice_size?: 'thermal' | 'a4';
  footer_message?: string;
  currency_symbol?: string;
}

export interface Role {
  id: number;
  name: string;
  role_key?: string;
  role_name_ar?: string;
  role_name_en?: string;
  description?: string;
  is_system?: boolean;
  user_count?: number;
  permissions?: RolePermission[];
}

export interface Module {
  id: number;
  name: string;
  module_key?: string;
  module_name_ar?: string;
  module_name_en?: string;
  category?: string;
  label?: string;
}

export interface RolePermission {
  module_id?: number;
  module: string;
  module_key?: string;
  module_name_ar?: string;
  category?: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

export interface Session {
  id: number;
  device?: string;
  user_agent?: string;
  ip_address: string;
  last_activity?: string;
  created_at?: string;
  is_current: boolean;
}

export interface PurchaseRequest {
  id: number;
  product_id?: number;
  product_name: string;
  display_name?: string;
  quantity: number;
  notes?: string;
  requester?: string;
  status: 'pending' | 'approved' | 'done' | 'completed';
  type?: string;
  created_at: string;
}

export interface Category {
  id: number;
  name: string;
}

export interface Pagination {
  current_page: number;
  per_page: number;
  total_pages: number;
  total_records: number;
}

// GL Types
export interface GLEntry {
  id: number;
  entry_number?: string;
  voucher_number?: string;
  entry_date?: string;
  voucher_date?: string;
  account_code?: string;
  account_name?: string;
  debit_account?: string;
  credit_account?: string;
  description?: string;
  entry_type?: 'DEBIT' | 'CREDIT';
  amount: number;
  reference?: string;
  created_at?: string;
}

export interface TrialBalanceEntry {
  account_code: string;
  account_name: string;
  debit?: number;
  credit?: number;
  debit_balance?: number;
  credit_balance?: number;
  balance?: number;
}

export interface AccountTransaction {
  id?: number;
  voucher_number?: string;
  voucher_date?: string;
  entry_date?: string;
  description?: string;
  entry_type?: 'DEBIT' | 'CREDIT';
  debit?: number;
  credit?: number;
  amount?: number;
  running_balance: number;
}

export interface ChartOfAccount {
  id: number;
  code: string;
  account_code?: string;
  name: string;
  account_name_ar?: string;
  account_name_en?: string;
  type: string;
  account_type?: string;
  parent_id?: number;
  parent_name?: string;
  is_active: boolean;
  balance?: number;
  normal_balance?: 'DEBIT' | 'CREDIT';
  description?: string;
}

export interface JournalVoucher {
  id: number;
  voucher_number: string;
  voucher_date: string;
  description?: string;
  status: 'draft' | 'posted' | 'reversed';
  total_debit: number;
  total_credit: number;
  lines?: VoucherLine[];
  entries?: JournalEntry[];
  created_by?: string;
  created_at: string;
  completed_at?: string;
}

export interface VoucherLine {
  account_id: number;
  account_name?: string;
  debit: number;
  credit: number;
  description?: string;
}

export interface JournalEntry {
  id?: number;
  account_code?: string;
  account_id?: number;
  account_name?: string;
  description?: string;
  debit?: number;
  credit?: number;
  debit_amount?: number;
  credit_amount?: number;
}

export interface FiscalPeriod {
  id: number;
  period_name: string;
  start_date: string;
  end_date: string;
  status: 'open' | 'closed' | 'locked';
  is_current: boolean;
}

export interface RecurringTransaction {
  id: number;
  name: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  next_run: string;
  last_run?: string;
  is_active: boolean;
  template: JournalVoucher;
}

export interface AuditLog {
  id: number;
  user_id?: number;
  user_name?: string;
  username?: string;
  action: string;
  module: string;
  description?: string;
  record_id?: number;
  old_values?: string;
  new_values?: string;
  ip_address?: string;
  created_at: string;
}

export interface Reconciliation {
  id: number;
  account_code: string;
  account_name: string;
  reconciliation_date: string;
  statement_balance: number;
  book_balance: number;
  difference: number;
  status: 'pending' | 'completed';
  items: ReconciliationItem[];
}

export interface ReconciliationItem {
  id: number;
  transaction_id: number;
  description: string;
  amount: number;
  is_reconciled: boolean;
}

export interface BatchJob {
  id: number;
  job_type: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  total_items: number;
  processed_items: number;
  error_message?: string;
  created_at: string;
  completed_at?: string;
}

export interface DeferredSale {
  id: number;
  invoice_number: string;
  customer_name: string;
  customer_phone?: string;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  created_at: string;
  status: 'pending' | 'partial' | 'paid';
}

export interface Payment {
  id: number;
  amount: number;
  payment_date: string;
  notes?: string;
}
