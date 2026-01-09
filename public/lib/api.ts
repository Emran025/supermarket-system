// API Utilities - Mirrors the original common.js fetchAPI
import QRCode from "qrcode";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://127.0.0.1:8000/api';

export interface APIResponse {
  success?: boolean;
  message?: string;
  [key: string]: unknown;
}

interface FetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: string;
  headers?: Record<string, string>;
}

/**
 * Wrapper for fetch to handle repetitive tasks
 */
export async function fetchAPI(
  action: string,
  options?: FetchOptions
): Promise<APIResponse> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options?.headers,
  };

  // Add session token to headers if it exists
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('sessionToken');
    if (token) {
      headers['X-Session-Token'] = token;
    }
  }

  const fetchOptions: RequestInit = {
    method: options?.method || 'GET',
    headers: headers,
    credentials: 'include',
  };

  if (options?.body) {
    fetchOptions.body = options.body;
  }

  try {
    const cleanAction = action
      .replace(/^\//, "") // Remove leading slash
      .replace(/^api\//, "") // Remove api/ prefix
      .replace(/^\?/, ""); // Remove leading ? if any

    // Laravel uses RESTful paths.
    // Ensure we don't have double slashes if action is empty
    const url = cleanAction ? `${API_BASE}/${cleanAction}` : API_BASE;

    const response = await fetch(url, fetchOptions);

    if (response.status === 401) {
      if (typeof window !== 'undefined') {
        window.location.href = '/auth/login';
      }
      return { success: false, message: 'Unauthorized' };
    }

    if (!response.ok) {
      try {
        const errData = await response.json();
        return {
          success: false,
          message: errData.message || `HTTP Error ${response.status}`,
        };
      } catch {
        return { success: false, message: `HTTP Error ${response.status}` };
      }
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('API Error:', error);
    return { success: false, message: 'Connection error. Please try again.' };
  }
}

/**
 * Format currency in Saudi Riyal
 */
export function formatCurrency(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return (
    new Intl.NumberFormat('ar-SA', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num || 0) + ' ر.س'
  );
}

/**
 * Format date to locale string
 */
export function formatDate(dateString: string | null | undefined, includeTime = false): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (includeTime) {
    return date.toLocaleString('ar-SA');
  }
  return date.toLocaleDateString('ar-SA');
}

/**
 * Escape HTML to prevent XSS
 */
export function escapeHtml(text: string | null | undefined): string {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Get role badge text in Arabic
 */
export function getRoleBadgeText(role: string): string {
  const roleNames: Record<string, string> = {
    admin: 'مدير النظام',
    manager: 'مدير',
    accountant: 'محاسب',
    cashier: 'كاشير',
  };
  return roleNames[role] || 'مستخدم';
}

/**
 * Get role badge CSS class
 */
export function getRoleBadgeClass(role: string): string {
  const roleClasses: Record<string, string> = {
    admin: 'badge-primary',
    manager: 'badge-success',
    accountant: 'badge-info',
    cashier: 'badge-secondary',
  };
  return roleClasses[role] || 'badge-secondary';
}

/**
 * Get Arabic day and month names for date display
 */
export function getArabicDate(): string {
  const now = new Date();
  const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const months = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
  ];

  const dayName = days[now.getDay()];
  const day = now.getDate();
  const monthName = months[now.getMonth()];
  const year = now.getFullYear();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');

  return `${dayName}، ${day} ${monthName} , ${year} - ${hours}:${minutes}`;
}

/**
 * Generates a Base64 encoded TLV string for E-Invoicing compliance
 */
export function generateTLV(tags: Record<number, string>): string {
  const binaryParts: number[] = [];

  for (const tagId in tags) {
    const tag = parseInt(tagId);
    const value = String(tags[parseInt(tagId)]);

    binaryParts.push(tag);

    const encoder = new TextEncoder();
    const encodedValue = encoder.encode(value);
    binaryParts.push(encodedValue.length);

    for (const byte of encodedValue) {
      binaryParts.push(byte);
    }
  }

  const uint8Array = new Uint8Array(binaryParts);
  let binaryString = '';
  for (let i = 0; i < uint8Array.length; i++) {
    binaryString += String.fromCharCode(uint8Array[i]);
  }

  return btoa(binaryString);
}


/**
 * Generate barcode-like image (Data URL)
 */
export function generateBarcode(text: string, padding = 20): string {
  if (typeof document === 'undefined') return '';
  
  try {
    const input = String(text || '');
    const bytes = new TextEncoder().encode(input);

    const bits: number[] = [];
    for (const b of bytes) {
      for (let i = 7; i >= 0; i--) {
        bits.push((b >> i) & 1);
      }
      bits.push(0);
    }

    if (bits.length === 0) return '';

    const segments: { bit: number; count: number }[] = [];
    let curr = bits[0];
    let cnt = 1;
    for (let i = 1; i < bits.length; i++) {
      if (bits[i] === curr) cnt++;
      else {
        segments.push({ bit: curr, count: cnt });
        curr = bits[i];
        cnt = 1;
      }
    }
    segments.push({ bit: curr, count: cnt });

    const unit = 1.6;
    const width = Math.round(
      segments.reduce((s, seg) => s + seg.count * unit, 0) + padding * 2
    );
    const height = 120;

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(120, width);
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    let x = padding;
    for (const seg of segments) {
      const segWidth = Math.max(1, Math.round(seg.count * unit));
      if (seg.bit === 1) {
        ctx.fillStyle = '#000';
        ctx.fillRect(x, 0, segWidth, canvas.height);
      }
      x += segWidth;
    }

    return canvas.toDataURL();
  } catch (e) {
    console.error('Barcode generation error', e);
    return '';
  }
}

/**
 * Generate QR Code image (Data URL)
 */
export async function generateQRCode(text: string): Promise<string> {
  if (typeof document === 'undefined') return '';
  
  try {
    return await QRCode.toDataURL(text, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 250,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });
  } catch (err) {
    console.error('QR Code generation error', err);
    return '';
  }
}
