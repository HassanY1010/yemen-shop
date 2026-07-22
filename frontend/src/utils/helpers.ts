// ============================================
// Authentication & Authorization Utilities
// ============================================

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'saas-platform-salt');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const hashedInput = await hashPassword(password);
  return hashedInput === hash;
}

export function generateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function generateOrderNumber(storeId: number): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `ORD-${storeId}-${timestamp}${random}`;
}

export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[أإآا]/g, 'a')
    .replace(/[بپ]/g, 'b')
    .replace(/[تث]/g, 't')
    .replace(/[جچ]/g, 'j')
    .replace(/[حخ]/g, 'h')
    .replace(/[دذ]/g, 'd')
    .replace(/[رز]/g, 'r')
    .replace(/[سش]/g, 's')
    .replace(/[صض]/g, 's')
    .replace(/[طظ]/g, 't')
    .replace(/[عغ]/g, 'g')
    .replace(/[فق]/g, 'f')
    .replace(/[كگ]/g, 'k')
    .replace(/[ل]/g, 'l')
    .replace(/[م]/g, 'm')
    .replace(/[ن]/g, 'n')
    .replace(/[هة]/g, 'h')
    .replace(/[وؤ]/g, 'w')
    .replace(/[يئى]/g, 'y')
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+|-+$/g, '') || 
    `item-${Date.now()}`;
}

export function formatCurrency(amount: number, currency: string = 'YER'): string {
  const formatted = new Intl.NumberFormat('ar-YE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount || 0);
  return `${formatted} ر.ي`;
}

export function formatDate(dateStr: string, locale: string = 'ar-SA'): string {
  return new Date(dateStr).toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function getOrderStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: 'جديد',
    processing: 'قيد المعالجة',
    completed: 'مكتمل',
    cancelled: 'ملغي',
  };
  return labels[status] || status;
}

export function getOrderStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    processing: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}

export function getPaymentStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: 'معلق',
    paid: 'مدفوع',
    failed: 'فشل',
    refunded: 'مسترد',
  };
  return labels[status] || status;
}

export function getPlanLabel(slug: string): string {
  const labels: Record<string, string> = {
    free: 'مجاني',
    basic: 'أساسي',
    pro: 'احترافي',
    business: 'أعمال',
  };
  return labels[slug] || slug;
}

export function sanitizeInput(input: string): string {
  return input.replace(/<[^>]*>/g, '').trim();
}

export const LARAVEL_API_URL = 'http://127.0.0.1:8000/api';

export async function fetchLaravel(path: string, token: string | null = null, options: RequestInit = {}) {
  const url = `${LARAVEL_API_URL}/${path.replace(/^\//, '')}`;
  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }
  return fetch(url, { ...options, headers });
}
