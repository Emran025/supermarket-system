// Authentication utilities - migrated from common.js

import { fetchAPI } from "./api";

export interface User {
  id: number;
  username: string;
  full_name: string;
  role: string;
  role_id: number;
  is_active: boolean;
  manager_id?: number;
}

export interface Permission {
  module: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  permissions: Permission[];
}

// Module access mapping for RBAC
const moduleAccessMap: Record<string, string> = {
  "dashboard": "dashboard",
  "sales": "sales",
  "deferred_sales": "deferred_sales",
  "revenues": "revenues",
  "products": "products",
  "purchases": "purchases",
  "expenses": "expenses",
  "users": "users",
  "ar_customers": "ar_customers",
  "settings": "settings",
  "general_ledger": "general_ledger",
  "chart_of_accounts": "chart_of_accounts",
  "journal_vouchers": "journal_vouchers",
  "reports": "reports",
  "audit_trail": "audit_trail",
  "batch_processing": "batch_processing",
};

/**
 * Check if user can access a specific module
 */
export function canAccess(
  permissions: Permission[],
  module: string,
  action: "view" | "create" | "edit" | "delete" = "view"
): boolean {
  const moduleName = moduleAccessMap[module] || module;
  const permission = permissions.find((p) => p.module === moduleName);
  
  if (!permission) return false;
  
  switch (action) {
    case "view":
      return permission.can_view;
    case "create":
      return permission.can_create;
    case "edit":
      return permission.can_edit;
    case "delete":
      return permission.can_delete;
    default:
      return false;
  }
}

/**
 * Get user from localStorage
 */
export function getStoredUser(): User | null {
  if (typeof window === "undefined") return null;
  
  const userStr = localStorage.getItem("user");
  if (!userStr) return null;
  
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

/**
 * Get permissions from localStorage
 */
export function getStoredPermissions(): Permission[] {
  if (typeof window === "undefined") return [];
  
  const permStr = localStorage.getItem("userPermissions");
  if (!permStr) return [];
  
  try {
    return JSON.parse(permStr);
  } catch {
    return [];
  }
}

/**
 * Store user and permissions in localStorage
 */
export function storeAuth(user: User, permissions: Permission[]): void {
  if (typeof window === "undefined") return;
  
  localStorage.setItem("user", JSON.stringify(user));
  localStorage.setItem("userPermissions", JSON.stringify(permissions));
  localStorage.setItem("userRole", user.role);
}

/**
 * Clear authentication data
 */
export function clearAuth(): void {
  if (typeof window === "undefined") return;
  
  localStorage.removeItem("user");
  localStorage.removeItem("userPermissions");
  localStorage.removeItem("userRole");
}

/**
 * Check authentication status with server
 */
export async function checkAuth(): Promise<AuthState> {
  try {
    const response = await fetchAPI("/api/auth/check");
    
    if (response.authenticated && response.user) {
      const permissions = response.permissions as Permission[] || [];
      storeAuth(response.user as User, permissions);
      
      return {
        isAuthenticated: true,
        user: response.user as User,
        permissions,
      };
    }
    
    clearAuth();
    return {
      isAuthenticated: false,
      user: null,
      permissions: [],
    };
  } catch {
    clearAuth();
    return {
      isAuthenticated: false,
      user: null,
      permissions: [],
    };
  }
}

/**
 * Login user
 */
export async function login(
  username: string,
  password: string
): Promise<{ success: boolean; error?: string; user?: User }> {
  try {
    const response = await fetchAPI("/api/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    
    if (response.success && response.user) {
      const permissions = response.permissions as Permission[] || [];
      storeAuth(response.user as User, permissions);
      
      return {
        success: true,
        user: response.user as User,
      };
    }
    
    return {
      success: false,
      error: response.message || "فشل تسجيل الدخول",
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "حدث خطأ في الاتصال",
    };
  }
}

/**
 * Logout user
 */
export async function logout(): Promise<void> {
  try {
    await fetchAPI("/api/logout", { method: "POST" });
  } catch {
    // Ignore errors on logout
  } finally {
    clearAuth();
    if (typeof window !== "undefined") {
      window.location.href = "/auth/login";
    }
  }
}

/**
 * Get sidebar links based on user permissions
 */
export function getSidebarLinks(permissions: Permission[]): Array<{
  href: string;
  icon: string;
  label: string;
  module: string;
}> {
  const allLinks = [
    { href: "/system/dashboard", icon: "home", label: "لوحة التحكم", module: "dashboard" },
    { href: "/sales/sales", icon: "cart", label: "المبيعات", module: "sales" },
    { href: "/sales/deferred_sales", icon: "dollar", label: "المبيعات الآجلة", module: "deferred_sales" },
    { href: "/sales/revenues", icon: "dollar", label: "الإيرادات", module: "revenues" },
    { href: "/inventory/products", icon: "box", label: "المنتجات", module: "products" },
    { href: "/purchases/purchases", icon: "cart", label: "المشتريات", module: "purchases" },
    { href: "/purchases/expenses", icon: "dollar", label: "المصروفات", module: "expenses" },
    { href: "/people/users", icon: "users", label: "المستخدمين", module: "users" },
    { href: "/people/ar_customers", icon: "users", label: "عملاء الآجل", module: "ar_customers" },
    { href: "/finance/general_ledger", icon: "dollar", label: "دفتر الأستاذ", module: "general_ledger" },
    { href: "/finance/chart_of_accounts", icon: "building", label: "دليل الحسابات", module: "chart_of_accounts" },
    { href: "/finance/journal_vouchers", icon: "dollar", label: "سندات القيد", module: "journal_vouchers" },
    { href: "/finance/fiscal_periods", icon: "dollar", label: "الفترات المالية", module: "fiscal_periods" },
    { href: "/finance/accrual_accounting", icon: "dollar", label: "المحاسبة الاستحقاقية", module: "accrual_accounting" },
    { href: "/finance/reconciliation", icon: "check", label: "التسوية البنكية", module: "reconciliation" },
    { href: "/finance/assets", icon: "building", label: "الأصول", module: "assets" },
    { href: "/system/reports", icon: "eye", label: "الميزانية والتقارير", module: "reports" },
    { href: "/system/audit_trail", icon: "eye", label: "سجل التدقيق", module: "audit_trail" },
    { href: "/system/recurring_transactions", icon: "check", label: "المعاملات المتكررة", module: "recurring_transactions" },
    { href: "/system/batch_processing", icon: "check", label: "المعالجة الدفعية", module: "batch_processing" },
    { href: "/system/settings", icon: "settings", label: "الإعدادات", module: "settings" },
  ];
  
  return allLinks.filter((link) => canAccess(permissions, link.module, "view"));
}

