// ============================================
// Authentication Middleware
// ============================================
import { Context, Next } from 'hono';
import { Bindings, Variables, User, Store } from '../types/index';
import { getPgPool, PgD1Database } from '../utils/db';

type AppContext = Context<{ Bindings: Bindings; Variables: Variables }>;

export async function authMiddleware(c: AppContext, next: Next) {
  const token = getToken(c);
  
  if (!token) {
    const path = new URL(c.req.url).pathname;
    if (isProtectedPath(path)) {
      if (isApiPath(path)) {
        return c.json({ error: 'Unauthorized', message: 'يجب تسجيل الدخول' }, 401);
      }
      return c.redirect('/auth/login');
    }
    return next();
  }

  try {
    const db: any = (c.env && c.env.DB) ? c.env.DB : (getPgPool() ? new PgD1Database(getPgPool()) : null);
    if (db) {
      try {
        const nowIso = new Date().toISOString();
        const session = await db.prepare(
          `SELECT s.user_id, s.store_id, u.name, u.email, u.role, u.avatar, u.is_active
           FROM sessions s
           JOIN users u ON u.id = s.user_id
           WHERE s.token = ? AND (s.expires_at IS NULL OR s.expires_at > ?)`
        ).bind(token, nowIso).first() as any;

        if (session) {
          const user: User = {
            id: session.user_id,
            name: session.name,
            email: session.email,
            role: session.role,
            avatar: session.avatar,
            is_active: session.is_active,
          };

          c.set('user', user);

          let storeId = session.store_id;
          if (!storeId && session.role === 'merchant') {
            const st = await db.prepare('SELECT id FROM stores WHERE user_id = ? LIMIT 1').bind(session.user_id).first() as any;
            storeId = st?.id || null;
          }

          if (storeId) {
            const store = await db.prepare('SELECT * FROM stores WHERE id = ?').bind(storeId).first() as any;
            if (store) c.set('store', store);
          }

          return await next();
        }
      } catch (e: any) {
        console.error('[Auth Middleware] session query error:', e?.message || e);
      }
    }
  } catch (e: any) {
    console.error('[Auth Middleware] outer error:', e?.message || e);
  }

  const path = new URL(c.req.url).pathname;
  if (isProtectedPath(path)) {
    if (isApiPath(path)) {
      return c.json({ error: 'Unauthorized', message: 'انتهت الجلسة' }, 401);
    }
    return c.redirect('/auth/login');
  }
  return next();
}

export function requireAuth(c: AppContext, next: Next) {
  const user = c.get('user');
  if (!user) {
    if (isApiPath(c.req.url)) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    return c.redirect('/auth/login');
  }
  return next();
}

export function requireAdmin(c: AppContext, next: Next) {
  const user = c.get('user');
  if (!user || user.role !== 'admin') {
    if (isApiPath(c.req.url)) {
      return c.json({ error: 'Forbidden', message: 'غير مصرح' }, 403);
    }
    return c.redirect('/auth/login');
  }
  return next();
}

export function requireMerchant(c: AppContext, next: Next) {
  const user = c.get('user');
  if (!user || (user.role !== 'merchant' && user.role !== 'admin')) {
    if (isApiPath(c.req.url)) {
      return c.json({ error: 'Forbidden' }, 403);
    }
    return c.redirect('/auth/login');
  }

  // Check subscription expiration for merchant
  if (user.role === 'merchant') {
    const store = c.get('store');
    if (store) {
      const isEndsAtPast = store.subscription_ends_at ? new Date(store.subscription_ends_at) < new Date() : false;
      const isInactive = store.subscription_status === 'expired' || store.subscription_status === 'pending_activation' || isEndsAtPast;

      if (isInactive) {
        // If API request (write/read)
        if (isApiPath(c.req.url)) {
          // Allow renewal endpoint
          if (c.req.url.includes('/subscription/renew')) {
            return next();
          }
          return c.json({ 
            error: 'Subscription Expired', 
            message: 'انتهت صلاحية اشتراكك أو بانتظار التفعيل. جميع مزايا المتجر معطلة حتى التجديد والتفعيل من الإدارة.' 
          }, 403);
        }

        // Allow viewing subscription status page and settings
        const currentPath = new URL(c.req.url).pathname;
        if (currentPath.indexOf('/dashboard/subscription') === -1 && currentPath.indexOf('/dashboard/settings') === -1 && currentPath !== '/dashboard') {
          return c.redirect('/dashboard/subscription');
        }
      }
    }
  }

  return next();
}

export function getToken(c: AppContext): string | null {
  // Check Authorization header
  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  // Check Cookie
  const cookieHeader = c.req.header('Cookie') || '';
  const cookies = parseCookies(cookieHeader);
  return cookies['auth_token'] || null;
}

function parseCookies(cookieStr: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  cookieStr.split(';').forEach(cookie => {
    const [name, ...rest] = cookie.split('=');
    if (name) cookies[name.trim()] = rest.join('=').trim();
  });
  return cookies;
}

function isProtectedPath(path: string): boolean {
  const protectedPrefixes = ['/dashboard', '/admin', '/api/dashboard', '/api/admin'];
  return protectedPrefixes.some(prefix => path.startsWith(prefix));
}

function isApiPath(path: string): boolean {
  return path.startsWith('/api/');
}

export function setAuthCookie(token: string): string {
  const expires = new Date();
  expires.setDate(expires.getDate() + 30);
  return `auth_token=${token}; Path=/; HttpOnly; SameSite=Lax; Expires=${expires.toUTCString()}`;
}

export function clearAuthCookie(): string {
  return `auth_token=; Path=/; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}
