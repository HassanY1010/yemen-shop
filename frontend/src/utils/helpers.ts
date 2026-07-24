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

export function escapeHtml(str: string | null | undefined): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
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
  const num = amount || 0;
  const curr = (currency || 'YER').toUpperCase();
  let symbol = 'ر.ي';
  if (curr === 'SAR' || curr === 'ر.س') symbol = 'ر.س';
  else if (curr === 'USD' || curr === '$') symbol = '$';
  else if (curr === 'EUR' || curr === '€') symbol = '€';

  const formatted = new Intl.NumberFormat(curr === 'USD' ? 'en-US' : 'ar-YE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num);

  return curr === 'USD' ? `${symbol}${formatted}` : `${formatted} ${symbol}`;
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

export const DEFAULT_STORE_LOGO = '/pwa-icon.png';

export const DEFAULT_AVATAR = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Ccircle cx='100' cy='100' r='100' fill='%23e2e8f0'/%3E%3Ccircle cx='100' cy='75' r='35' fill='%2394a3b8'/%3E%3Cpath d='M30 170c0-35 30-50 70-50s70 15 70 50' fill='%2394a3b8'/%3E%3C/svg%3E`;

export function getEnvVar(c: any, key: string, fallback: string = ''): string {
  try {
    if (c && c.env && typeof c.env === 'object' && c.env[key]) {
      return String(c.env[key]);
    }
  } catch (e) {}

  try {
    if (typeof process !== 'undefined' && process && process.env && process.env[key]) {
      return String(process.env[key]);
    }
  } catch (e) {}

  return fallback;
}

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

  // Preserve static platform assets (/static/...)
  if (cleanUrl.startsWith('/static/') || cleanUrl.startsWith('static/')) {
    return cleanUrl.startsWith('/') ? cleanUrl : `/${cleanUrl}`;
  }

  // Normalize relative paths (/uploads/..., storage/uploads/..., uploads/...)
  let relativePath = cleanUrl;
  if (relativePath.startsWith('/storage/')) {
    relativePath = relativePath.replace('/storage/', '/');
  }
  if (!relativePath.startsWith('/uploads/')) {
    relativePath = `/uploads/${relativePath.replace(/^\//, '')}`;
  }

  return relativePath;
}

export async function fetchLaravel(apiPath: string, token?: string | null, options: any = {}) {
  const baseUrl = getEnvVar(null, 'LARAVEL_API_URL', 'http://localhost:8000/api');
  const headers: Record<string, string> = { ...(options.headers || {}) };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (!headers['Accept']) {
    headers['Accept'] = 'application/json';
  }

  const cleanPath = apiPath.replace(/^\//, '');
  try {
    const response = await fetch(`${baseUrl}/${cleanPath}`, {
      method: options.method || 'GET',
      headers,
      body: options.body
    });
    return response;
  } catch (err: any) {
    console.error(`[fetchLaravel Error] Path: ${cleanPath}`, err);
    return new Response(JSON.stringify({ success: false, message: 'Backend unreachable', error: err?.message }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// ============================================
// Order Inventory Management Utilities
// ============================================

export async function checkAndUpdateOrderStock(db: any, orderId: number): Promise<void> {
  if (!db || !orderId) return;

  try {
    // Ensure inventory_deducted column exists on orders table
    try {
      await db.prepare('ALTER TABLE orders ADD COLUMN inventory_deducted INT DEFAULT 0').run();
    } catch (e) {}

    const order = await db.prepare(
      'SELECT id, store_id, status, payment_status, inventory_deducted FROM orders WHERE id = ?'
    ).bind(orderId).first() as any;

    if (!order) return;

    const isCompleted = (order.status === 'completed');
    const isPaid = (order.payment_status === 'paid');
    const isDeducted = (Number(order.inventory_deducted) === 1);

    // 1) Both conditions met (status=completed AND payment_status=paid) & not deducted yet -> Deduct stock & mark inventory_deducted = 1
    if (isCompleted && isPaid && !isDeducted) {
      const items = await db.prepare(
        'SELECT product_id, quantity FROM order_items WHERE order_id = ?'
      ).bind(orderId).all() as any;

      if (items?.results && Array.isArray(items.results)) {
        for (const item of items.results) {
          if (!item.product_id || !item.quantity) continue;
          const qty = Math.max(1, parseInt(item.quantity) || 1);

          try {
            await db.prepare(
              'UPDATE products SET stock = MAX(0, stock - ?), total_sold = total_sold + ? WHERE id = ?'
            ).bind(qty, qty, item.product_id).run();
          } catch (e) {
            await db.prepare(
              'UPDATE products SET stock = stock - ?, total_sold = total_sold + ? WHERE id = ?'
            ).bind(qty, qty, item.product_id).run();
          }
        }
      }

      await db.prepare('UPDATE orders SET inventory_deducted = 1 WHERE id = ?').bind(orderId).run();
      console.log(`[STOCK DEDUCTED] Order #${orderId} stock deducted (status=completed, payment=paid).`);
    }
    // 2) Stock WAS deducted previously, but order is now cancelled or refunded -> Return stock & mark inventory_deducted = 0
    else if (isDeducted && (order.status === 'cancelled' || order.status === 'refunded' || order.payment_status === 'refunded')) {
      const items = await db.prepare(
        'SELECT product_id, quantity FROM order_items WHERE order_id = ?'
      ).bind(orderId).all() as any;

      if (items?.results && Array.isArray(items.results)) {
        for (const item of items.results) {
          if (!item.product_id || !item.quantity) continue;
          const qty = Math.max(1, parseInt(item.quantity) || 1);

          try {
            await db.prepare(
              'UPDATE products SET stock = stock + ?, total_sold = MAX(0, total_sold - ?) WHERE id = ?'
            ).bind(qty, qty, item.product_id).run();
          } catch (e) {
            await db.prepare(
              'UPDATE products SET stock = stock + ?, total_sold = total_sold - ? WHERE id = ?'
            ).bind(qty, qty, item.product_id).run();
          }
        }
      }

      await db.prepare('UPDATE orders SET inventory_deducted = 0 WHERE id = ?').bind(orderId).run();
      console.log(`[STOCK RESTORED] Order #${orderId} stock restored (status=${order.status}, payment=${order.payment_status}).`);
    }
  } catch (err: any) {
    console.error(`[STOCK ERROR] Failed to update stock for order #${orderId}:`, err);
  }
}

