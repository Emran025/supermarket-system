// Utility functions - migrated from common.js

/**
 * Format a number as currency (SAR)
 */
export function formatCurrency(amount: number | string | null | undefined): string {
  const num = parseFloat(String(amount)) || 0;
  return num.toLocaleString("ar-SA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + " ر.س";
}

/**
 * Format a date string to Arabic locale
 */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("ar-SA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

/**
 * Format date with time
 */
export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("ar-SA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

/**
 * Escape HTML to prevent XSS
 */
export function escapeHtml(text: string | null | undefined): string {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Get current date formatted for display
 */
export function getCurrentDate(): string {
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  };
  return now.toLocaleDateString("ar-SA", options);
}

/**
 * Get role badge text in Arabic
 */
export function getRoleBadgeText(role: string): string {
  const roleMap: Record<string, string> = {
    admin: "مدير النظام",
    manager: "مشرف",
    cashier: "كاشير",
    accountant: "محاسب",
    viewer: "مشاهد",
  };
  return roleMap[role?.toLowerCase()] || role || "غير محدد";
}

/**
 * Get role badge CSS class
 */
export function getRoleBadgeClass(role: string): string {
  const classMap: Record<string, string> = {
    admin: "badge-primary",
    manager: "badge-success",
    cashier: "badge-info",
    accountant: "badge-warning",
    viewer: "badge-secondary",
  };
  return classMap[role?.toLowerCase()] || "badge-secondary";
}

/**
 * Translate expense category to Arabic
 */
export function translateExpenseCategory(category: string): string {
  const categoryMap: Record<string, string> = {
    rent: "إيجار",
    utilities: "مرافق",
    salaries: "رواتب",
    maintenance: "صيانة",
    supplies: "مستلزمات",
    marketing: "تسويق",
    transport: "نقل",
    other: "أخرى",
  };
  return categoryMap[category?.toLowerCase()] || category || "أخرى";
}

/**
 * Generate TLV (Tag-Length-Value) for ZATCA e-invoicing
 */
export function generateTLV(data: {
  sellerName: string;
  vatNumber: string;
  timestamp: string;
  total: string;
  vatAmount: string;
}): string {
  const tlvData = [
    { tag: 1, value: data.sellerName },
    { tag: 2, value: data.vatNumber },
    { tag: 3, value: data.timestamp },
    { tag: 4, value: data.total },
    { tag: 5, value: data.vatAmount },
  ];

  let tlvString = "";
  for (const item of tlvData) {
    const valueBytes = new TextEncoder().encode(item.value);
    tlvString += String.fromCharCode(item.tag);
    tlvString += String.fromCharCode(valueBytes.length);
    tlvString += item.value;
  }

  return btoa(tlvString);
}

/**
 * Debounce function for search inputs
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Check if a value is empty (null, undefined, empty string, empty array)
 */
export function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value).length === 0;
  return false;
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Calculate percentage
 */
export function calculatePercentage(value: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((value / total) * 100 * 100) / 100;
}

/**
 * Parse number safely
 */
export function parseNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const parsed = parseFloat(String(value));
  return isNaN(parsed) ? 0 : parsed;
}

