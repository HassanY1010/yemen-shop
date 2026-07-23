// ============================================
// Multi-Tenant Middleware - Store Isolation
// ============================================
import { Context, Next } from 'hono';
import { Bindings, Variables, Store } from '../types/index';

type AppContext = Context<{ Bindings: Bindings; Variables: Variables }>;

/**
 * Ensures all DB queries are scoped to current store_id
 * Prevents cross-store data access
 */
export async function tenantMiddleware(c: AppContext, next: Next) {
  const user = c.get('user');
  if (!user) return next();

  // Admin has access to all stores
  if (user.role === 'admin') return next();

  // For merchant, load their store
  const store = c.get('store');
  if (!store) {
    // Try to load store from user
    const userStore = await c.env.DB.prepare(`
      SELECT s.*, p.name as plan_name, p.slug as plan_slug, p.price as plan_price, p.max_products as plan_max_products, p.max_orders as plan_max_orders, p.max_staff as plan_max_staff
      FROM stores s
      LEFT JOIN plans p ON s.plan_id = p.id
      WHERE s.user_id = ? LIMIT 1
    `).bind(user.id).first() as any;

    if (userStore) {
      if (!userStore.plan) {
        userStore.plan = {
          id: userStore.plan_id,
          name: userStore.plan_name || 'مجاني',
          slug: userStore.plan_slug || 'free',
          price: userStore.plan_price || 0,
          max_products: userStore.plan_max_products,
          max_orders: userStore.plan_max_orders,
          max_staff: userStore.plan_max_staff
        };
      }
      c.set('store', userStore);
    }
  }

  return next();
}

/**
 * Validates store ownership for dashboard routes
 */
export async function validateStoreAccess(c: AppContext, storeId: number): Promise<boolean> {
  const user = c.get('user');
  if (!user) return false;
  if (user.role === 'admin') return true;

  const store = await c.env.DB.prepare(
    'SELECT id FROM stores WHERE id = ? AND user_id = ? AND status != ?'
  ).bind(storeId, user.id, 'deleted').first();

  return !!store;
}

/**
 * Scope a DB query to current store
 * Usage: getStoreQuery(c, 'SELECT * FROM products WHERE store_id = ?')
 */
export function getCurrentStoreId(c: AppContext): number | null {
  const store = c.get('store');
  return store?.id || null;
}

/**
 * Ensure the 4 official plans are seeded with exact specifications
 */
export async function ensurePlansSeeded(db: any) {
  if (!db) return;
  try {
    try { await db.prepare("ALTER TABLE plans ADD COLUMN IF NOT EXISTS duration_days INTEGER DEFAULT 30").run(); } catch {}
    try { await db.prepare("ALTER TABLE plans ADD COLUMN IF NOT EXISTS max_stores INTEGER DEFAULT 1").run(); } catch {}
    try { await db.prepare("ALTER TABLE plans ADD COLUMN IF NOT EXISTS max_categories INTEGER DEFAULT 20").run(); } catch {}
    try { await db.prepare("ALTER TABLE stores ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) DEFAULT 'active'").run(); } catch {}
    try { await db.prepare("ALTER TABLE stores ADD COLUMN IF NOT EXISTS subscription_starts_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP").run(); } catch {}
    try { await db.prepare("ALTER TABLE stores ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMP").run(); } catch {}

    const plansData = [
      { slug: 'free',     name: 'Free (تجربة مجانية 5 أيام)', price: 0,     duration_days: 5,  max_stores: 1,  max_products: 5,   max_categories: 5,   max_orders: 50,   max_staff: 1 },
      { slug: 'basic',    name: 'Basic',                        price: 15000, duration_days: 30, max_stores: 1,  max_products: 50,  max_categories: 20,  max_orders: 500,  max_staff: 2 },
      { slug: 'pro',      name: 'Pro',                          price: 30000, duration_days: 30, max_stores: 1,  max_products: 200, max_categories: 50,  max_orders: 2000, max_staff: 5 },
      { slug: 'business', name: 'Business',                     price: 60000, duration_days: 30, max_stores: -1, max_products: -1,  max_categories: -1,  max_orders: -1,   max_staff: -1 }
    ];

    for (const p of plansData) {
      const existing = await db.prepare("SELECT id FROM plans WHERE slug = ?").bind(p.slug).first();
      if (!existing) {
        try {
          await db.prepare(`
            INSERT INTO plans (slug, name, price, duration_days, max_stores, max_products, max_categories, max_orders, max_staff, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          `).bind(p.slug, p.name, p.price, p.duration_days, p.max_stores, p.max_products, p.max_categories, p.max_orders, p.max_staff).run();
        } catch (e) {
          await db.prepare(`
            INSERT INTO plans (slug, name, price, max_products, max_orders, max_staff)
            VALUES (?, ?, ?, ?, ?, ?)
          `).bind(p.slug, p.name, p.price, p.max_products, p.max_orders, p.max_staff).run();
        }
      }
    }
  } catch (err) {
    console.error('Failed to seed plans:', err);
  }
}

/**
 * Check subscription limits
 */
export async function checkSubscriptionLimit(
  c: AppContext,
  storeId: number,
  type: 'products' | 'categories' | 'staff' | 'orders'
): Promise<{ allowed: boolean; current: number; limit: number; message?: string }> {
  try {
    await ensurePlansSeeded(c.env.DB);
  } catch (e) {
    console.error('[checkSubscriptionLimit] ensurePlansSeeded failed:', e);
  }

  // Use LEFT JOIN so stores without a plan_id still get defaults
  const store = await c.env.DB.prepare(
    `SELECT s.*, p.max_products, p.max_categories, p.max_staff, p.max_orders
     FROM stores s LEFT JOIN plans p ON s.plan_id = p.id
     WHERE s.id = ?`
  ).bind(storeId).first() as any;

  // If store not found at all, block — but if plan is missing, use generous defaults
  if (!store) return { allowed: false, current: 0, limit: 0, message: 'المتجر غير موجود' };

  let current = 0;
  let limit = 0;
  let label = '';

  if (type === 'products') {
    const result = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM products WHERE store_id = ? AND status != ?'
    ).bind(storeId, 'deleted').first() as any;
    current = result?.count || 0;
    // Default to 50 if plan is not linked or max_products is null
    limit = (store.max_products !== null && store.max_products !== undefined) ? store.max_products : 50;
    label = 'منتجات';
  } else if (type === 'categories') {
    const result = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM categories WHERE store_id = ?'
    ).bind(storeId).first() as any;
    current = result?.count || 0;
    limit = (store.max_categories !== null && store.max_categories !== undefined) ? store.max_categories : 20;
    label = 'أقسام';
  } else if (type === 'staff') {
    const result = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM store_staff WHERE store_id = ? AND is_active = 1'
    ).bind(storeId).first() as any;
    current = result?.count || 0;
    limit = (store.max_staff !== null && store.max_staff !== undefined) ? store.max_staff : 2;
    label = 'موظفين';
  } else if (type === 'orders') {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
    const result = await c.env.DB.prepare(
      "SELECT COUNT(*) as count FROM orders WHERE store_id = ? AND created_at >= ?"
    ).bind(storeId, firstDay).first() as any;
    current = result?.count || 0;
    limit = (store.max_orders !== null && store.max_orders !== undefined) ? store.max_orders : -1;
    label = 'طلبات هذا الشهر';
  }

  if (limit !== -1 && current >= limit) {
    return {
      allowed: false,
      current,
      limit,
      message: `لقد وصلت إلى الحد الأقصى المسموح به في باقتك الحالية (${limit} ${label}). يرجى ترقية الباقة لإضافة المزيد.`
    };
  }

  return { allowed: true, current, limit };
}
