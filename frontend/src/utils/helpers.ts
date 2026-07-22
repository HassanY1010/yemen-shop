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

// ============================================
// Image Utilities & Placeholders
// ============================================

export const DEFAULT_PRODUCT_IMAGE = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 400'%3E%3Crect width='400' height='400' fill='%23f1f5f9'/%3E%3Cpath d='M160 160c0-22.1 17.9-40 40-40s40 17.9 40 40-17.9 40-40 40-40-17.9-40-40zm120 120H120l50-65 35 45 25-30 50 50z' fill='%2394a3b8'/%3E%3Ctext x='50%25' y='82%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='16' font-weight='bold' fill='%2364748b'%3Eصورة غير متوفرة%3C/text%3E%3C/svg%3E`;

export const DEFAULT_STORE_LOGO = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Crect width='200' height='200' rx='40' fill='%234f46e5'/%3E%3Cpath d='M60 70v-10c0-22 18-40 40-40s40 18 40 40v10h10c8 0 15 7 15 15l-10 80c-1 8-7 15-15 15H60c-8 0-14-7-15-15L35 85c0-8 7-15 15-15h10zm20 0h40v-10c0-11-9-20-20-20s-20 9-20 20v10z' fill='%23ffffff'/%3E%3C/svg%3E`;

export const DEFAULT_AVATAR = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Ccircle cx='100' cy='100' r='100' fill='%23e2e8f0'/%3E%3Ccircle cx='100' cy='75' r='35' fill='%2394a3b8'/%3E%3Cpath d='M30 170c0-35 30-50 70-50s70 15 70 50' fill='%2394a3b8'/%3E%3C/svg%3E`;

export function getImageUrl(url: string | null | undefined, fallback: string = DEFAULT_PRODUCT_IMAGE): string {
  if (!url || typeof url !== 'string' || !url.trim()) {
    return fallback;
  }

  const cleanUrl = url.trim();

  // Return base64 or Data URIs directly
  if (cleanUrl.startsWith('data:')) {
    return cleanUrl;
  }

  // Absolute HTTP/HTTPS URLs (including Supabase Storage URLs)
  if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')) {
    return cleanUrl;
  }

  // Normalize relative paths (/uploads/..., storage/uploads/..., uploads/...)
  let relativePath = cleanUrl;
  if (relativePath.startsWith('/storage/')) {
    relativePath = relativePath.replace('/storage/', '/');
  }
  if (!relativePath.startsWith('/')) {
    relativePath = '/' + relativePath;
  }

  return relativePath;
}



