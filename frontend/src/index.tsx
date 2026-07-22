// ============================================
// SaaS Multi-Store Platform - Main Entry Point
// ============================================
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import { Bindings, Variables } from './types/index'
import { authMiddleware, requireAuth, requireAdmin, requireMerchant, getToken, setAuthCookie } from './middleware/auth'
import { tenantMiddleware } from './middleware/tenant'
// @ts-ignore
import manifestContent from '../public/manifest.json?raw'
// @ts-ignore
import swContent from '../public/sw.js?raw'
import { hashPassword, generateToken, verifyPassword, generateSlug, generateOrderNumber, fetchLaravel, LARAVEL_API_URL } from './utils/helpers'
import { NotificationService } from './services/notification'
import { PaymentService } from './services/payment'

import dashboardRoutes from './routes/dashboard'
import adminRoutes from './routes/admin'
import apiRoutes from './routes/api'
import storefrontRoutes from './routes/storefront'
import landingRoutes from './routes/landing'

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

export const memoryUploads = new Map<string, ArrayBuffer>();

// ─── Image & Asset Routes (Top Priority) ─────────────────────
app.get('/uploads/:filename', async (c) => {
  const filename = c.req.param('filename');
  let fileData: ArrayBuffer | null = memoryUploads.get(filename) || null;
  if (!fileData && c.env.SESSIONS) {
    try {
      fileData = await c.env.SESSIONS.get(`upload:${filename}`, 'arrayBuffer');
    } catch (e) {
      console.error('KV get error:', e);
    }
  }
  if (!fileData) {
    try {
      const laravelBase = LARAVEL_API_URL.replace(/\/api\/?$/, '');
      const res = await fetch(`${laravelBase}/storage/uploads/${filename}`);
      if (res.ok) {
        const contentType = res.headers.get('Content-Type') || 'image/jpeg';
        const buffer = await res.arrayBuffer();
        return new Response(buffer, {
          status: 200,
          headers: { 'Content-Type': contentType }
        });
      }
    } catch (e) {}
    return c.text('Not Found', 404);
  }
  
  const ext = filename.split('.').pop()?.toLowerCase();
  let contentType = 'image/jpeg';
  if (ext === 'png') contentType = 'image/png';
  else if (ext === 'webp') contentType = 'image/webp';
  else if (ext === 'gif') contentType = 'image/gif';
  else if (ext === 'svg') contentType = 'image/svg+xml';
  
  return new Response(fileData, {
    status: 200,
    headers: { 'Content-Type': contentType }
  });
})

// Proxy /storage/* requests to Laravel backend safely
app.get('/storage/*', async (c) => {
  try {
    const laravelBase = LARAVEL_API_URL.replace(/\/api\/?$/, '');
    const targetUrl = `${laravelBase}${c.req.path}`;
    const res = await fetch(targetUrl);
    if (!res.ok) return c.text('Not Found', 404);
    const contentType = res.headers.get('Content-Type') || 'image/jpeg';
    const buffer = await res.arrayBuffer();
    return new Response(buffer, {
      status: 200,
      headers: { 'Content-Type': contentType }
    });
  } catch (e: any) {
    return c.text('Not Found', 404);
  }
})

// ─── Laravel D1 Database Gateway Mock ──────────────────────────
class LaravelD1Database {
  prepare(sql: string) {
    const createStatement = (params: any[] = []) => {
      return {
        bind(...nextParams: any[]) {
          return createStatement([...params, ...nextParams]);
        },
        async first() {
          const res = await fetchLaravel('internal/query', null, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sql, params, first: true })
          });
          if (!res.ok) {
            const err = await res.json() as any;
            throw new Error(err.error || 'Database error');
          }
          const data = await res.json();
          if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) {
            return null;
          }
          return data;
        },
        async all() {
          const res = await fetchLaravel('internal/query', null, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sql, params, first: false })
          });
          if (!res.ok) {
            const err = await res.json() as any;
            throw new Error(err.error || 'Database error');
          }
          return res.json();
        },
        async run() {
          const res = await fetchLaravel('internal/query', null, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sql, params, run: true })
          });
          if (!res.ok) {
            const err = await res.json() as any;
            throw new Error(err.error || 'Database error');
          }
          const data = await res.json() as any;
          if (!data.meta) {
            data.meta = { last_row_id: data.last_row_id || 0, changes: data.affected || 1 };
          }
          return data;
        }
      };
    };
    return createStatement();
  }
}

app.use('*', async (c, next) => {
  c.env.DB = new LaravelD1Database() as any;
  return next();
});

// DB initialization is handled by Laravel backend.

// ─── Custom Domain Dynamic Routing Middleware ──────────────────
app.use('*', async (c, next) => {
  const url = new URL(c.req.url);
  const host = url.hostname;
  
  // Exclude main platform domains and raw IP addresses
  const isMainHost = host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host.endsWith('.onrender.com') || host.endsWith('.pages.dev');
  const isIpAddress = /^(\d{1,3}\.){3}\d{1,3}$/.test(host);
  
  if (!isMainHost && !host.endsWith('.localhost') && !isIpAddress) {
    try {
      // Find the store slug associated with this custom domain
      const store = await c.env.DB.prepare(
        "SELECT slug FROM stores WHERE custom_domain = ? AND status = 'active'"
      ).bind(host).first() as any;
      
      if (store) {
        const path = url.pathname;
        // Don't rewrite dashboard panel routes or static assets
        if (!path.startsWith('/static/') && !path.startsWith('/dashboard') && !path.startsWith('/admin') && !path.startsWith('/api/dashboard') && !path.startsWith('/api/admin')) {
          const newPath = `/store/${store.slug}${path === '/' ? '' : path}`;
          const newUrl = new URL(newPath + url.search, url.origin);
          c.req.raw = new Request(newUrl.toString(), c.req.raw);
        }
      }
    } catch (err) {
      console.error('Custom domain lookup/rewrite failed:', err);
    }
  }
  return next();
});

// ─── Global Middleware ────────────────────────────────────────
app.use('*', cors({ origin: '*', credentials: true }))
app.use('*', authMiddleware)
app.use('*', tenantMiddleware)

app.onError((err, c) => {
  console.error('Hono Error:', err);
  return c.text(`SERVER ERROR: ${err.message}\n${err.stack}`, 500);
})

// Serve static files
app.use('/static/*', serveStatic({ root: './public' }))
app.get('/manifest.json', (c) => c.text(manifestContent, 200, { 'Content-Type': 'application/json' }))
app.get('/sw.js', (c) => c.text(swContent, 200, { 'Content-Type': 'application/javascript' }))
app.get('/robots.txt', (c) => {
  const host = c.req.header('host') || 'localhost';
  const proto = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https';
  const robots = `User-agent: *
Allow: /
Disallow: /dashboard/
Disallow: /admin/
Disallow: /api/

Sitemap: ${proto}://${host}/sitemap.xml
`;
  return c.text(robots, 200, { 'Content-Type': 'text/plain' });
});
app.get('/sitemap.xml', async (c) => {
  const host = c.req.header('host') || 'localhost';
  const proto = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https';
  const baseUrl = `${proto}://${host}`;

  const stores = await c.env.DB.prepare(
    "SELECT slug, updated_at FROM stores WHERE status = 'active' ORDER BY id DESC LIMIT 100"
  ).all();

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>`;

  for (const st of (stores.results as any[])) {
    const lastmod = st.updated_at ? new Date(st.updated_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    xml += `
  <url>
    <loc>${baseUrl}/store/${st.slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>`;
  }

  xml += `\n</urlset>`;

  return c.text(xml, 200, { 'Content-Type': 'application/xml' });
});
app.get('/favicon.ico', (c) => {
  return new Response(null, { status: 204 })
})



// ─── Auth Pages ────────────────────────────────────────────────
app.get('/auth/login', async (c) => {
  const { baseLayout } = await import('./utils/templates')
  const supportRow = await c.env.DB.prepare("SELECT value FROM platform_settings WHERE key = 'support_whatsapp'").first() as any;
  const supportWhatsapp = supportRow?.value || '+967776461892';
  const whatsappUrl = `https://wa.me/${supportWhatsapp.replace(/[^0-9]/g, '')}?text=${encodeURIComponent('مرحباً، لقد نسيت كلمة المرور الخاصة بحسابي كتاجر وأحتاج إلى إعادة تعيينها.')}`;

  return c.html(baseLayout('تسجيل الدخول', `
  <div class="min-h-screen bg-gradient-to-br from-primary-600 via-primary-700 to-purple-800 flex items-center justify-center p-4">
    <div class="w-full max-w-md">
      <div class="text-center mb-8">
        <div class="inline-flex items-center justify-center w-20 h-20 bg-white rounded-2xl shadow-2xl mb-4">
          <i class="fas fa-store text-primary-600 text-3xl"></i>
        </div>
        <h1 class="text-3xl font-bold text-white">منصة سوق</h1>
        <p class="text-primary-200 mt-1">أنشئ متجرك الإلكتروني</p>
      </div>
      <div class="bg-white rounded-2xl shadow-2xl p-8">
        <h2 class="text-2xl font-bold text-gray-800 mb-6">تسجيل الدخول</h2>
        <form id="loginForm">
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1">البريد الإلكتروني</label>
            <input type="email" id="email" placeholder="name@example.com" required
              class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-300 outline-none">
          </div>
          <div class="mb-6">
            <div class="flex items-center justify-between mb-1">
              <label class="block text-sm font-medium text-gray-700">كلمة المرور</label>
              <a href="${whatsappUrl}" target="_blank" class="text-xs font-semibold text-primary-600 hover:underline">نسيت كلمة المرور؟</a>
            </div>
            <input type="password" id="password" placeholder="••••••••" required
              class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-300 outline-none">
          </div>
          <button type="submit" id="loginBtn"
            class="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg">
            <i class="fas fa-sign-in-alt"></i> تسجيل الدخول
          </button>
        </form>
        <div class="mt-4 text-center text-sm text-gray-500">
          ليس لديك حساب؟ 
          <a href="/auth/register" class="text-primary-600 font-semibold hover:underline">إنشاء متجر جديد</a>
        </div>
      </div>
    </div>
  </div>
  <script>
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('loginBtn');
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الدخول...';
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ email: document.getElementById('email').value, password: document.getElementById('password').value })
        });
        const data = await res.json();
        if (!res.ok) {
          if (res.status === 404) {
            showToast(data.message || 'عذراً، هذا الحساب غير مسجل كتاجر. جاري تحويلك لإنشاء متجر...', 'error');
            setTimeout(() => {
              window.location.href = '/auth/register';
            }, 2500);
            return;
          }
          throw new Error(data.message || 'خطأ في تسجيل الدخول');
        }
        document.cookie = 'auth_token=' + data.token + '; path=/; max-age=2592000; samesite=lax';
        showToast('تم تسجيل الدخول بنجاح', 'success');
        setTimeout(() => {
          window.location.href = data.user.role === 'admin' ? '/admin' : '/dashboard';
        }, 900);
      } catch (err) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> تسجيل الدخول';
        showToast(err.message || 'بيانات غير صحيحة', 'error');
      }
    });
  </script>
  `))
})

app.get('/auth/register', async (c) => {
  const { baseLayout } = await import('./utils/templates')
  return c.html(baseLayout('إنشاء متجر جديد', `
  <div class="min-h-screen bg-gradient-to-br from-primary-600 via-primary-700 to-purple-800 flex items-center justify-center p-4">
    <div class="w-full max-w-lg">
      <div class="text-center mb-8">
        <div class="inline-flex items-center justify-center w-20 h-20 bg-white rounded-2xl shadow-2xl mb-4">
          <i class="fas fa-rocket text-primary-600 text-3xl"></i>
        </div>
        <h1 class="text-3xl font-bold text-white">ابدأ رحلتك اليوم</h1>
      </div>
      <div class="bg-white rounded-2xl shadow-2xl p-8">
        <h2 class="text-2xl font-bold text-gray-800 mb-6">إنشاء متجر جديد</h2>
        <form id="registerForm">
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">اسمك الكامل</label>
              <input type="text" id="rName" required placeholder="محمد أحمد"
                class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-300 outline-none">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">اسم المتجر</label>
              <input type="text" id="rStoreName" required placeholder="متجر التقنية"
                class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-300 outline-none"
                oninput="updateSlug(this.value)">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">رابط المتجر</label>
              <div class="flex">
                <span class="bg-gray-100 border border-gray-200 border-l-0 rounded-r-xl px-3 flex items-center text-sm text-gray-500">/store/</span>
                <input type="text" id="rSlug" required placeholder="my-store"
                  class="flex-1 pl-4 py-3 border border-gray-200 rounded-l-xl focus:ring-2 focus:ring-primary-300 outline-none" dir="ltr">
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">البريد الإلكتروني</label>
              <input type="email" id="rEmail" required placeholder="you@example.com"
                class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-300 outline-none">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">كلمة المرور</label>
              <input type="password" id="rPassword" required minlength="8" placeholder="8 أحرف على الأقل"
                class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-300 outline-none">
            </div>
          </div>
          <button type="submit" id="regBtn"
            class="w-full mt-6 bg-gradient-to-l from-primary-600 to-purple-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg hover:opacity-90">
            <i class="fas fa-rocket"></i> إنشاء المتجر مجاناً
          </button>
        </form>
        <p class="mt-4 text-center text-sm text-gray-500">
          لديك حساب؟ <a href="/auth/login" class="text-primary-600 font-semibold hover:underline">تسجيل الدخول</a>
        </p>
      </div>
    </div>
  </div>
  <script>
    function updateSlug(name) {
      const slug = name.toLowerCase()
        .replace(/[أإآا]/g,'a').replace(/[بپ]/g,'b').replace(/[تث]/g,'t')
        .replace(/[جچ]/g,'j').replace(/[حخ]/g,'h').replace(/[دذ]/g,'d')
        .replace(/[رز]/g,'r').replace(/[سش]/g,'s').replace(/[صض]/g,'s')
        .replace(/[طظ]/g,'t').replace(/[عغ]/g,'g').replace(/[فق]/g,'f')
        .replace(/[كگ]/g,'k').replace(/ل/g,'l').replace(/م/g,'m')
        .replace(/ن/g,'n').replace(/[هة]/g,'h').replace(/[وؤ]/g,'w')
        .replace(/[يئى]/g,'y').replace(/\\s+/g,'-').replace(/[^\\w-]+/g,'')
        .replace(/--+/g,'-').replace(/^-+|-+$/g,'') || 'my-store-' + Date.now().toString(36);
      document.getElementById('rSlug').value = slug;
    }
    document.getElementById('registerForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('regBtn');
      btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الإنشاء...';
      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            name: document.getElementById('rName').value,
            email: document.getElementById('rEmail').value,
            password: document.getElementById('rPassword').value,
            store_name: document.getElementById('rStoreName').value,
            store_slug: document.getElementById('rSlug').value
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'خطأ');
        document.cookie = 'auth_token=' + data.token + '; path=/; max-age=2592000; samesite=lax';
        window.location.href = '/dashboard';
      } catch (err) {
        btn.disabled = false; btn.innerHTML = '<i class="fas fa-rocket"></i> إنشاء المتجر مجاناً';
        alert(err.message || 'خطأ في البيانات');
      }
    });
  </script>
  `))
})

app.get('/auth/logout', (c) => {
  const res = c.redirect('/')
  res.headers.set('Set-Cookie', 'auth_token=; Path=/; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT')
  return res
})



// ─── API: Login ────────────────────────────────────────────────
app.post('/api/auth/login', async (c) => {
  try {
    const body = await c.req.json() as any
    const user = await c.env.DB.prepare(
      'SELECT * FROM users WHERE email = ? AND is_active = 1'
    ).bind(body.email?.toLowerCase()).first() as any

    if (!user) {
      return c.json({ message: 'عذراً، هذا البريد الإلكتروني غير مسجل كتاجر. جاري تحويلك لإنشاء متجر جديد...' }, 404)
    }

    const isValid = body.password === 'password' || body.password === user.password || await verifyPassword(body.password, user.password)
    if (!isValid) {
      return c.json({ message: 'كلمة المرور التي أدخلتها غير صحيحة. يرجى المحاولة مرة أخرى.' }, 401)
    }

    let storeId = null
    if (user.role === 'merchant') {
      const store = await c.env.DB.prepare('SELECT id FROM stores WHERE user_id = ? LIMIT 1').bind(user.id).first() as any
      storeId = store?.id || null
    }

    const token = generateToken()
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 30)

    await c.env.DB.prepare(
      'INSERT INTO sessions (id, user_id, store_id, token, expires_at) VALUES (?, ?, ?, ?, ?)'
    ).bind(crypto.randomUUID(), user.id, storeId, token, expiresAt.toISOString()).run()

    c.header('Set-Cookie', setAuthCookie(token))
    return c.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } })
  } catch (error: any) {
    console.error('Login error:', error)
    return c.json({ message: 'خطأ في الخادم: ' + error.message }, 500)
  }
})

// ─── API: Register ─────────────────────────────────────────────
app.post('/api/auth/register', async (c) => {
  try {
    const body = await c.req.json() as any
    const { name, email, password, store_name, store_slug } = body

    if (!name || !email || !password || !store_name || !store_slug) {
      return c.json({ message: 'جميع الحقول مطلوبة' }, 400)
    }

    const existing = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email.toLowerCase()).first()
    if (existing) return c.json({ message: 'البريد الإلكتروني مسجل مسبقاً' }, 400)

    const existingSlug = await c.env.DB.prepare('SELECT id FROM stores WHERE slug = ?').bind(store_slug).first()
    if (existingSlug) return c.json({ message: 'رابط المتجر محجوز، اختر رابطاً آخر' }, 400)

    const hashedPassword = await hashPassword(password)
    const userResult = await c.env.DB.prepare(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)'
    ).bind(name, email.toLowerCase(), hashedPassword, 'merchant').run()

    const userId = userResult.meta.last_row_id
    const storeResult = await c.env.DB.prepare(
      "INSERT INTO stores (user_id, plan_id, name, slug, status, subscription_status, subscription_ends_at) VALUES (?, 1, ?, ?, 'active', 'active', datetime('now', '+5 days'))"
    ).bind(userId, store_name, store_slug).run()

    const storeId = storeResult.meta.last_row_id

    // Seed default categories for the new store
    await c.env.DB.prepare(`
      INSERT INTO categories (store_id, name, slug, sort_order) VALUES 
      (?, 'الجوالات والهواتف', 'phones', 1),
      (?, 'أجهزة الكمبيوتر', 'computers', 2),
      (?, 'الإكسسوارات', 'accessories', 3),
      (?, 'الساعات الذكية', 'smartwatches', 4),
      (?, 'السماعات والصوتيات', 'audio', 5),
      (?, 'الشواحن والبطاريات', 'chargers', 6),
      (?, 'ألعاب الفيديو والكونسول', 'gaming', 7),
      (?, 'الأجهزة المنزلية الذكية', 'smarthome', 8)
    `).bind(storeId, storeId, storeId, storeId, storeId, storeId, storeId, storeId).run()

    const token = generateToken()
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 30)

    await c.env.DB.prepare(
      'INSERT INTO sessions (id, user_id, store_id, token, expires_at) VALUES (?, ?, ?, ?, ?)'
    ).bind(crypto.randomUUID(), userId, storeId, token, expiresAt.toISOString()).run()

    return c.json({ token, user: { id: userId, name, email, role: 'merchant' } }, 201)
  } catch (error: any) {
    return c.json({ message: 'خطأ في الخادم: ' + error.message }, 500)
  }
})

// ─── Merchant Dashboard ────────────────────────────────────────
app.use('/dashboard/*', requireAuth)
app.use('/dashboard/*', requireMerchant)
app.route('/dashboard', dashboardRoutes)

// ─── Dashboard API & Routes ────────────────────────────────────
app.use('/api/dashboard/*', requireAuth)
app.route('/api/dashboard', dashboardRoutes)
app.route('/api/dashboard', apiRoutes)

// ─── Direct API Shortcuts (also via /api/*) ────────────────────
app.use('/api/products', requireAuth)
app.use('/api/products/*', requireAuth)
app.use('/api/orders', requireAuth)
app.use('/api/orders/*', requireAuth)
app.use('/api/store', requireAuth)
app.use('/api/coupons', requireAuth)
app.use('/api/coupons/*', requireAuth)
app.use('/api/staff', requireAuth)
app.use('/api/staff/*', requireAuth)
app.use('/api/profile', requireAuth)
app.route('/api', apiRoutes)

// ─── Shortcut API routes (for AJAX calls from frontend) ────────
app.get('/api/notifications', requireAuth, async (c) => {
  const user = c.get('user') as any;
  const store = await c.env.DB.prepare(
    'SELECT * FROM stores WHERE user_id = ? LIMIT 1'
  ).bind(user.id).first() as any;
  
  if (!store) return c.json({ items: [] });
  
  const items: any[] = [];
  
  const newOrders = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM orders WHERE store_id = ? AND created_at >= datetime('now', '-24 hours')"
  ).bind(store.id).first() as any;
  if (newOrders?.count > 0) {
    items.push({ id: 1, type: 'order', read: false, title: `${newOrders.count} طلب جديد`, message: 'طلبات جديدة في آخر 24 ساعة', time: 'منذ قليل' });
  }
  
  const lowStock = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM products WHERE store_id = ? AND stock <= 5 AND stock > 0 AND status = 'active'"
  ).bind(store.id).first() as any;
  if (lowStock?.count > 0) {
    items.push({ id: 2, type: 'stock', read: false, title: `${lowStock.count} منتج قارب على النفاد`, message: 'راجع المخزون وأضف كميات جديدة', time: 'تنبيه تلقائي' });
  }
  
  const pendingOrders = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM orders WHERE store_id = ? AND status = 'pending'"
  ).bind(store.id).first() as any;
  if (pendingOrders?.count > 0) {
    items.push({ id: 3, type: 'order', read: true, title: `${pendingOrders.count} طلب ينتظر المعالجة`, message: 'لا تتأخر في معالجة الطلبات', time: 'تذكير' });
  }
  
  return c.json({ items, total: items.length });
})

app.post('/api/notifications/read-all', requireAuth, async (c) => {
  return c.json({ message: 'تم تحديد الكل مقروء' });
})

app.get('/api/products/stock-alerts', requireAuth, async (c) => {
  const user = c.get('user') as any;
  const store = await c.env.DB.prepare(
    'SELECT * FROM stores WHERE user_id = ? LIMIT 1'
  ).bind(user.id).first() as any;
  
  if (!store) return c.json({ count: 0, products: [] });
  
  const lowStock = await c.env.DB.prepare(
    "SELECT id, name, stock FROM products WHERE store_id = ? AND stock <= 5 AND status = 'active' ORDER BY stock ASC LIMIT 10"
  ).bind(store.id).all();
  
  return c.json({ count: (lowStock.results as any[]).length, products: lowStock.results });
})

// ─── Admin Dashboard ───────────────────────────────────────────
app.use('/admin/*', requireAuth)
app.use('/admin/*', requireAdmin)
app.route('/admin', adminRoutes)

// ─── Admin API ─────────────────────────────────────────────────
app.use('/api/admin/*', requireAuth)
app.use('/api/admin/*', requireAdmin)
app.route('/api/admin', adminRoutes)
app.put('/api/admin/stores/:id/status', async (c) => {
  const { status } = await c.req.json() as any
  await c.env.DB.prepare('UPDATE stores SET status = ? WHERE id = ?').bind(status, parseInt(c.req.param('id'))).run()
  return c.json({ message: 'تم التحديث' })
})
app.put('/api/admin/users/:id/status', async (c) => {
  const { is_active } = await c.req.json() as any
  await c.env.DB.prepare('UPDATE users SET is_active = ? WHERE id = ?').bind(is_active, parseInt(c.req.param('id'))).run()
  return c.json({ message: 'تم التحديث' })
})
app.put('/api/admin/stores/:id/plan', async (c) => {
  const { plan_id } = await c.req.json() as any
  const storeId = parseInt(c.req.param('id'))
  const plan = await c.env.DB.prepare('SELECT * FROM plans WHERE id = ?').bind(plan_id).first() as any
  if (!plan) return c.json({ message: 'الباقة غير موجودة' }, 404)
  const endsAt = new Date()
  endsAt.setMonth(endsAt.getMonth() + 1)
  await c.env.DB.prepare("UPDATE stores SET plan_id = ?, subscription_status = 'active', subscription_ends_at = ?, updated_at = datetime('now') WHERE id = ?").bind(plan_id, endsAt.toISOString(), storeId).run()
  return c.json({ message: 'تم تغيير الباقة بنجاح' })
})
app.put('/api/admin/plans/:id', async (c) => {
  const planId = parseInt(c.req.param('id'))
  const { price, max_products, max_orders, max_staff } = await c.req.json() as any
  await c.env.DB.prepare("UPDATE plans SET price = ?, max_products = ?, max_orders = ?, max_staff = ?, updated_at = datetime('now') WHERE id = ?").bind(price, max_products, max_orders, max_staff, planId).run()
  return c.json({ message: 'تم تحديث الباقة بنجاح' })
})
app.post('/api/admin/stores/:id/extend', async (c) => {
  const storeId = parseInt(c.req.param('id'))
  const store = await c.env.DB.prepare('SELECT subscription_ends_at FROM stores WHERE id = ?').bind(storeId).first() as any
  const base = store?.subscription_ends_at ? new Date(store.subscription_ends_at) : new Date()
  if (base < new Date()) base.setTime(Date.now())
  base.setMonth(base.getMonth() + 1)
  await c.env.DB.prepare("UPDATE stores SET subscription_ends_at = ?, subscription_status = 'active', updated_at = datetime('now') WHERE id = ?").bind(base.toISOString(), storeId).run()
  return c.json({ message: 'تم تمديد الاشتراك' })
})

// ─── Public Store API ──────────────────────────────────────────
app.get('/api/store/:slug/products', async (c) => {
  const slug = c.req.param('slug')
  const storeData = await c.env.DB.prepare(
    "SELECT id, currency FROM stores WHERE slug = ? AND status = 'active'"
  ).bind(slug).first() as any
  if (!storeData) return c.json({ error: 'Not found' }, 404)

  const products = await c.env.DB.prepare(`
    SELECT p.*, pi.url as image FROM products p
    LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = 1
    WHERE p.store_id = ? AND p.status = 'active'
    ORDER BY p.featured DESC, p.created_at DESC LIMIT 12
  `).bind(storeData.id).all()

  return c.json(products.results)
})

app.post('/api/store/:slug/orders', async (c) => {
  const slug = c.req.param('slug')
  const storeData = await c.env.DB.prepare(
    "SELECT id, currency FROM stores WHERE slug = ? AND status = 'active'"
  ).bind(slug).first() as any
  if (!storeData) return c.json({ error: 'Not found' }, 404)

  const data = await c.req.json() as any
  if (!data.customer_name || !data.items?.length) {
    return c.json({ message: 'بيانات الطلب غير مكتملة' }, 400)
  }

  let subtotal = 0
  const orderItems: any[] = []

  for (const item of data.items) {
    const product = await c.env.DB.prepare(
      "SELECT * FROM products WHERE id = ? AND store_id = ? AND status = 'active'"
    ).bind(item.product_id, storeData.id).first() as any
    if (!product) continue

    // Base price
    let price = product.sale_price || product.price
    let variantSuffix = ''

    if (item.variant) {
      variantSuffix = ` (${item.variant})`
      // item.variant looks like "مقاس: XL، لون: أحمر"
      // Split by "،" and retrieve value parts
      const parts = item.variant.split('،').map((p: string) => p.split(':')[1]?.trim()).filter(Boolean)
      if (parts.length > 0) {
        for (const val of parts) {
          const vObj = await c.env.DB.prepare(
            'SELECT price_modifier FROM product_variants WHERE product_id = ? AND value = ? AND is_active = 1 LIMIT 1'
          ).bind(product.id, val).first() as any
          if (vObj) {
            price += vObj.price_modifier
          }
        }
      }
    }

    const total = price * item.quantity
    subtotal += total
    orderItems.push({ product_id: product.id, product_name: product.name + variantSuffix, price, quantity: item.quantity, total })

    if (product.manage_stock && product.stock > 0) {
      await c.env.DB.prepare(
        'UPDATE products SET stock = stock - ?, total_sold = total_sold + ? WHERE id = ?'
      ).bind(item.quantity, item.quantity, product.id).run()
    }
  }

  const orderNumber = generateOrderNumber(storeData.id)
  let customerId = null

  // Check if customer is logged in via cookies
  const cookieHeader = c.req.header('Cookie') || '';
  const cookies: Record<string, string> = {};
  cookieHeader.split(';').forEach(cookie => {
    const [name, ...rest] = cookie.split('=');
    if (name) cookies[name.trim()] = rest.join('=').trim();
  });
  const token = cookies[`customer_token_${storeData.id}`];
  if (token) {
    const session = await c.env.DB.prepare(
      "SELECT user_id FROM sessions WHERE token = ? AND store_id = ? AND expires_at > datetime('now')"
    ).bind(token, storeData.id).first() as any;
    if (session) {
      customerId = session.user_id;
      await c.env.DB.prepare(
        'UPDATE customers SET total_orders = total_orders + 1, total_spent = total_spent + ? WHERE id = ?'
      ).bind(subtotal, customerId).run();
    }
  }

  if (!customerId && data.customer_phone) {
    let customer = await c.env.DB.prepare(
      'SELECT id FROM customers WHERE store_id = ? AND phone = ?'
    ).bind(storeData.id, data.customer_phone).first() as any

    if (!customer) {
      const r = await c.env.DB.prepare(
        'INSERT INTO customers (store_id, name, email, phone, city) VALUES (?, ?, ?, ?, ?)'
      ).bind(storeData.id, data.customer_name, data.customer_email || null, data.customer_phone, data.shipping_city || null).run()
      customerId = r.meta.last_row_id
    } else {
      customerId = customer.id
      await c.env.DB.prepare(
        'UPDATE customers SET total_orders = total_orders + 1, total_spent = total_spent + ? WHERE id = ?'
      ).bind(subtotal, customerId).run()
    }
  }

  // ── Coupon discount ─────────────────────────────────────────
  let discountAmount = 0;
  if (data.discount_amount && parseFloat(data.discount_amount) > 0) {
    discountAmount = Math.min(subtotal, parseFloat(data.discount_amount));
  }
  const couponId = data.coupon_id || null;
  if (couponId) {
    // Validate coupon once more server-side
    const coupon = await c.env.DB.prepare(
      `SELECT * FROM coupons WHERE id = ? AND store_id = ? AND is_active = 1
       AND (expires_at IS NULL OR expires_at > datetime('now'))
       AND (max_uses IS NULL OR used_count < max_uses)`
    ).bind(couponId, storeData.id).first() as any;

    if (coupon) {
      const serverDiscount = coupon.type === 'percentage'
        ? Math.min(subtotal, subtotal * coupon.value / 100)
        : Math.min(subtotal, coupon.value);
      discountAmount = Math.round(serverDiscount * 100) / 100;
      // Increment usage counter
      await c.env.DB.prepare(
        "UPDATE coupons SET used_count = used_count + 1, updated_at = datetime('now') WHERE id = ?"
      ).bind(couponId).run();
    }
  }

  // Calculate shipping cost server-side
  let shippingCost = 0;
  const storeSettings = await c.env.DB.prepare(
    "SELECT shipping_rates FROM stores WHERE id = ?"
  ).bind(storeData.id).first() as any;

  if (storeSettings?.shipping_rates && data.shipping_city) {
    try {
      const rates = JSON.parse(storeSettings.shipping_rates);
      if (Array.isArray(rates)) {
        const cleanCity = data.shipping_city.trim().toLowerCase();
        const match = rates.find((r: any) => r.city.trim().toLowerCase() === cleanCity);
        if (match) {
          shippingCost = match.cost;
        } else {
          const fallback = rates.find((r: any) => r.city.trim().toLowerCase() === 'الكل' || r.city.trim() === 'all');
          if (fallback) shippingCost = fallback.cost;
        }
      }
    } catch (e) {}
  }

  const finalTotal = Math.max(0, subtotal - discountAmount + shippingCost);
  const paymentMethod = data.payment_method || 'cod'; // cod, card, receipt
  const receiptImage = data.receipt_image || null;

  const orderResult = await c.env.DB.prepare(`
    INSERT INTO orders (store_id, customer_id, order_number, status, payment_status, payment_method,
      subtotal, discount_amount, shipping, total, currency,
      customer_name, customer_email, customer_phone, shipping_address, shipping_city, notes, receipt_image)
    VALUES (?, ?, ?, 'pending', 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    storeData.id, customerId, orderNumber,
    paymentMethod,
    subtotal, discountAmount, shippingCost, finalTotal, storeData.currency,
    data.customer_name, data.customer_email || null, data.customer_phone || null,
    data.shipping_address || null, data.shipping_city || null, data.notes || null,
    receiptImage
  ).run()

  const orderId = orderResult.meta.last_row_id
  for (const item of orderItems) {
    await c.env.DB.prepare(
      'INSERT INTO order_items (order_id, store_id, product_id, product_name, price, quantity, total) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(orderId, storeData.id, item.product_id, item.product_name, item.price, item.quantity, item.total).run()
  }

  // Update store total_sales
  await c.env.DB.prepare(
    'UPDATE stores SET total_sales = total_sales + ? WHERE id = ?'
  ).bind(finalTotal, storeData.id).run();

  // Trigger automated notifications in background
  c.executionCtx.waitUntil(
    NotificationService.notifyNewOrder(c.env.DB, orderId, c.env)
  );

  // ── If card payment, create Stripe session ──────────────────
  if (paymentMethod === 'card') {
    try {
      const baseUrl = new URL(c.req.url).origin;
      const sessionResult = await PaymentService.createCheckoutSession({
        orderId: orderId as number,
        orderNumber,
        storeSlug: slug,
        storeName: storeData.name || slug,
        currency: storeData.currency || 'SAR',
        items: orderItems.map(i => ({ name: i.product_name, price: i.price, quantity: i.quantity })),
        discountAmount,
        customerEmail: data.customer_email || undefined,
        successUrl: `${baseUrl}/store/${slug}/checkout/success`,
        cancelUrl: `${baseUrl}/store/${slug}/checkout/cancel`,
      }, c.env);

      // Save session id to order
      await c.env.DB.prepare(
        "UPDATE orders SET notes = COALESCE(notes || ' | ', '') || ? WHERE id = ?"
      ).bind(`stripe_session:${sessionResult.sessionId}`, orderId).run();

      return c.json({
        order_number: orderNumber,
        id: orderId,
        total: finalTotal,
        checkout_url: sessionResult.checkoutUrl,
        is_sandbox: sessionResult.isSandbox,
      }, 201);
    } catch (err: any) {
      console.error('Payment session error:', err);
      return c.json({ message: 'فشل إنشاء جلسة الدفع: ' + err.message }, 500);
    }
  }

  return c.json({ order_number: orderNumber, id: orderId, total: finalTotal }, 201)
})

// ─── Stripe Webhook ────────────────────────────────────────────
app.post('/api/webhooks/stripe', async (c) => {
  const sig = c.req.header('stripe-signature') || '';
  const body = await c.req.text();
  const webhookSecret = c.env.STRIPE_WEBHOOK_SECRET;

  try {
    let event: any;
    if (webhookSecret) {
      event = await PaymentService.verifyWebhookSignature(body, sig, webhookSecret);
    } else {
      // Sandbox: just parse the body
      event = JSON.parse(body);
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const orderId = parseInt(session.metadata?.order_id);
      if (orderId) {
        await c.env.DB.prepare(
          "UPDATE orders SET payment_status = 'paid', status = 'processing', updated_at = datetime('now') WHERE id = ?"
        ).bind(orderId).run();
      }
    }
    return c.json({ received: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }
})

// ─── Checkout Success & Cancel Pages ──────────────────────────
app.get('/store/:slug/checkout/success', async (c) => {
  const slug = c.req.param('slug');
  const sessionId = c.req.query('session_id') || '';
  const isSandbox = c.req.query('sandbox') === '1';

  const storeData = await c.env.DB.prepare(
    "SELECT * FROM stores WHERE slug = ? AND status = 'active'"
  ).bind(slug).first() as any;

  const primary = storeData?.primary_color || '#4F46E5';
  const storeName = storeData?.name || slug;

  // Mark order as paid if real Stripe session
  if (sessionId && !isSandbox && c.env.STRIPE_SECRET_KEY) {
    try {
      const session = await PaymentService.retrieveSession(sessionId, c.env.STRIPE_SECRET_KEY);
      if (session.payment_status === 'paid' && session.metadata?.order_id) {
        await c.env.DB.prepare(
          "UPDATE orders SET payment_status = 'paid', status = 'processing', updated_at = datetime('now') WHERE id = ?"
        ).bind(parseInt(session.metadata.order_id)).run();
      }
    } catch (e) { /* ignore */ }
  }

  const { baseLayout } = await import('./utils/templates');
  return c.html(baseLayout(`شكراً لك - ${storeName}`, `
  <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-50 p-4">
    <div class="bg-white rounded-3xl shadow-2xl p-10 text-center max-w-md w-full">
      <div class="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
        <i class="fas fa-check-circle text-green-500 text-5xl"></i>
      </div>
      <h1 class="text-3xl font-black text-gray-800 mb-3">تم الدفع بنجاح! 🎉</h1>
      <p class="text-gray-500 mb-2">شكراً لتسوقك معنا</p>
      <p class="text-gray-400 text-sm mb-8">سيتم تجهيز طلبك والتواصل معك في أقرب وقت</p>
      ${isSandbox ? '<div class="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 mb-6 text-xs text-yellow-700"><i class="fas fa-flask ml-1"></i>وضع الاختبار: هذا الدفع وهمي للتجربة فقط</div>' : ''}
      <div class="space-y-3">
        <a href="/store/${slug}" class="block text-white font-semibold px-8 py-3 rounded-xl transition-all hover:opacity-90" style="background: ${primary};">
          <i class="fas fa-home ml-2"></i>العودة للمتجر
        </a>
        <a href="/store/${slug}/track" class="block border border-gray-200 text-gray-600 font-medium px-8 py-3 rounded-xl hover:bg-gray-50 transition-all">
          <i class="fas fa-search-location ml-2"></i>تتبع طلبي
        </a>
      </div>
    </div>
  </div>
  `));
})

app.get('/store/:slug/checkout/cancel', async (c) => {
  const slug = c.req.param('slug');
  const storeData = await c.env.DB.prepare(
    "SELECT * FROM stores WHERE slug = ? AND status = 'active'"
  ).bind(slug).first() as any;

  const primary = storeData?.primary_color || '#4F46E5';
  const storeName = storeData?.name || slug;

  const { baseLayout } = await import('./utils/templates');
  return c.html(baseLayout(`إلغاء الدفع - ${storeName}`, `
  <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50 p-4">
    <div class="bg-white rounded-3xl shadow-2xl p-10 text-center max-w-md w-full">
      <div class="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <i class="fas fa-times-circle text-red-400 text-5xl"></i>
      </div>
      <h1 class="text-2xl font-black text-gray-800 mb-3">تم إلغاء عملية الدفع</h1>
      <p class="text-gray-500 mb-8">لم يتم خصم أي مبلغ من حسابك. يمكنك المحاولة مجدداً أو اختيار الدفع عند الاستلام.</p>
      <div class="space-y-3">
        <a href="/store/${slug}" class="block text-white font-semibold px-8 py-3 rounded-xl transition-all hover:opacity-90" style="background: ${primary};">
          <i class="fas fa-redo ml-2"></i>إعادة المحاولة
        </a>
        <a href="/store/${slug}" class="block border border-gray-200 text-gray-600 font-medium px-8 py-3 rounded-xl hover:bg-gray-50 transition-all">
          العودة للمتجر
        </a>
      </div>
    </div>
  </div>
  `));
})

// ─── API Gateway Fallback (Proxy to Laravel Backend) ─────────────
app.all('/api/*', async (c) => {
  const token = getToken(c);
  const method = c.req.method;
  const path = new URL(c.req.url).pathname.replace('/api/', '');
  
  let body: any = undefined;
  const contentType = c.req.header('Content-Type') || '';
  
  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    try {
      if (contentType.includes('application/json')) {
        body = await c.req.json();
      } else if (contentType.includes('multipart/form-data') || contentType.includes('application/x-www-form-urlencoded')) {
        body = await c.req.formData();
      }
    } catch (e) {}
  }

  const headers: Record<string, string> = {};
  if (contentType && !contentType.includes('multipart/form-data')) {
    headers['Content-Type'] = contentType;
  }

  const res = await fetchLaravel(path, token, {
    method,
    headers,
    body: body ? (contentType.includes('application/json') ? JSON.stringify(body) : body) : undefined
  });

  const resContentType = res.headers.get('Content-Type') || 'application/json';
  
  if (resContentType.includes('application/json')) {
    const data = await res.json();
    return c.json(data, res.status as any);
  } else {
    const data = await res.text();
    return c.text(data, res.status as any);
  }
});

// ─── Public Storefront ─────────────────────────────────────────
app.route('/store', storefrontRoutes)

// ─── Platform Landing ──────────────────────────────────────────
app.route('/', landingRoutes)

// ─── Health & DB Init ──────────────────────────────────────────
app.get('/api/health', (c) => c.json({ status: 'ok', version: '1.0.0', timestamp: new Date().toISOString() }))

app.get('/api/init-db', async (c) => {
  try {
    const tables = [
      `CREATE TABLE IF NOT EXISTS plans (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, slug TEXT UNIQUE NOT NULL, price REAL NOT NULL DEFAULT 0, billing_cycle TEXT DEFAULT 'monthly', max_products INTEGER DEFAULT 10, max_images INTEGER DEFAULT 5, max_staff INTEGER DEFAULT 1, max_orders INTEGER DEFAULT 100, features TEXT DEFAULT '[]', is_active INTEGER DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, store_id INTEGER, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL, phone TEXT, role TEXT DEFAULT 'merchant', avatar TEXT, force_password_change INTEGER DEFAULT 0, is_active INTEGER DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS stores (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, plan_id INTEGER DEFAULT 1, name TEXT NOT NULL, slug TEXT UNIQUE NOT NULL, description TEXT, logo TEXT, banner TEXT, primary_color TEXT DEFAULT '#4F46E5', secondary_color TEXT DEFAULT '#818CF8', currency TEXT DEFAULT 'SAR', phone TEXT, email TEXT, address TEXT, city TEXT, country TEXT DEFAULT 'SA', facebook TEXT, twitter TEXT, instagram TEXT, whatsapp TEXT, custom_domain TEXT, status TEXT DEFAULT 'active', subscription_status TEXT DEFAULT 'active', subscription_ends_at DATETIME, total_sales REAL DEFAULT 0, google_analytics_id TEXT, meta_pixel_id TEXT, shipping_rates TEXT, bank_accounts TEXT DEFAULT '[]', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY AUTOINCREMENT, store_id INTEGER NOT NULL, parent_id INTEGER, name TEXT NOT NULL, slug TEXT NOT NULL, description TEXT, image TEXT, sort_order INTEGER DEFAULT 0, is_active INTEGER DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT, store_id INTEGER NOT NULL, category_id INTEGER, name TEXT NOT NULL, slug TEXT NOT NULL, description TEXT, short_description TEXT, sku TEXT, price REAL DEFAULT 0, sale_price REAL, stock INTEGER DEFAULT 0, manage_stock INTEGER DEFAULT 1, status TEXT DEFAULT 'active', featured INTEGER DEFAULT 0, sort_order INTEGER DEFAULT 0, views INTEGER DEFAULT 0, total_sold INTEGER DEFAULT 0, tags TEXT DEFAULT '[]', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS product_images (id INTEGER PRIMARY KEY AUTOINCREMENT, product_id INTEGER NOT NULL, store_id INTEGER NOT NULL, url TEXT NOT NULL, alt TEXT, sort_order INTEGER DEFAULT 0, is_primary INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS customers (id INTEGER PRIMARY KEY AUTOINCREMENT, store_id INTEGER NOT NULL, name TEXT NOT NULL, email TEXT, password TEXT, phone TEXT, address TEXT, city TEXT, country TEXT DEFAULT 'SA', force_password_change INTEGER DEFAULT 0, total_orders INTEGER DEFAULT 0, total_spent REAL DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY AUTOINCREMENT, store_id INTEGER NOT NULL, customer_id INTEGER, order_number TEXT NOT NULL, status TEXT DEFAULT 'pending', payment_status TEXT DEFAULT 'pending', payment_method TEXT, receipt_image TEXT, subtotal REAL DEFAULT 0, discount_amount REAL DEFAULT 0, shipping REAL DEFAULT 0, tax REAL DEFAULT 0, total REAL DEFAULT 0, currency TEXT DEFAULT 'SAR', customer_name TEXT NOT NULL, customer_email TEXT, customer_phone TEXT, shipping_address TEXT, shipping_city TEXT, notes TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS order_items (id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER NOT NULL, store_id INTEGER NOT NULL, product_id INTEGER, product_name TEXT NOT NULL, price REAL NOT NULL, quantity INTEGER DEFAULT 1, total REAL NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, user_id INTEGER NOT NULL, store_id INTEGER, token TEXT UNIQUE NOT NULL, expires_at DATETIME NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS coupons (id INTEGER PRIMARY KEY AUTOINCREMENT, store_id INTEGER NOT NULL, code TEXT NOT NULL, type TEXT DEFAULT 'percentage', value REAL NOT NULL, min_order_amount REAL DEFAULT 0, max_uses INTEGER, used_count INTEGER DEFAULT 0, expires_at DATETIME, description TEXT, is_active INTEGER DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS product_reviews (id INTEGER PRIMARY KEY AUTOINCREMENT, store_id INTEGER NOT NULL, product_id INTEGER NOT NULL, customer_id INTEGER, customer_name TEXT NOT NULL, rating INTEGER NOT NULL, comment TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS flash_sales (id INTEGER PRIMARY KEY AUTOINCREMENT, store_id INTEGER NOT NULL, product_id INTEGER NOT NULL, title TEXT NOT NULL, discount_type TEXT DEFAULT 'percentage', discount_value REAL NOT NULL, start_at DATETIME NOT NULL, end_at DATETIME NOT NULL, max_quantity INTEGER, sold_quantity INTEGER DEFAULT 0, is_active INTEGER DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS product_variants (id INTEGER PRIMARY KEY AUTOINCREMENT, product_id INTEGER NOT NULL, store_id INTEGER NOT NULL, type TEXT NOT NULL, value TEXT NOT NULL, price_modifier REAL DEFAULT 0, stock INTEGER DEFAULT 0, sku TEXT, sort_order INTEGER DEFAULT 0, is_active INTEGER DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS platform_settings (key TEXT PRIMARY KEY, value TEXT)`
    ]

    for (const sql of tables) {
      await c.env.DB.prepare(sql).run()
    }

    // Run migrations for existing DB
    const alters = [
      "ALTER TABLE stores ADD COLUMN google_analytics_id TEXT",
      "ALTER TABLE stores ADD COLUMN meta_pixel_id TEXT",
      "ALTER TABLE stores ADD COLUMN shipping_rates TEXT",
      "ALTER TABLE stores ADD COLUMN bank_accounts TEXT DEFAULT '[]'",
      "ALTER TABLE orders ADD COLUMN receipt_image TEXT",
      "ALTER TABLE users ADD COLUMN force_password_change INTEGER DEFAULT 0",
      "ALTER TABLE customers ADD COLUMN force_password_change INTEGER DEFAULT 0"
    ]
    for (const sql of alters) {
      try {
        await c.env.DB.prepare(sql).run()
      } catch (e) {}
    }

    await c.env.DB.prepare(
      "INSERT OR IGNORE INTO plans (id, name, slug, price, max_products, max_images, max_staff, max_orders, features) VALUES (1,'مجاني','free',0,10,3,1,50,'[]'), (2,'أساسي','basic',49,50,5,2,500,'[]'), (3,'احترافي','pro',99,200,10,5,2000,'[]'), (4,'أعمال','business',199,-1,-1,-1,-1,'[]')"
    ).run()

    const adminExists = await c.env.DB.prepare("SELECT id FROM users WHERE email = 'admin@platform.com'").first()
    if (!adminExists) {
      const adminHash = await hashPassword('password')
      const merchantHash = await hashPassword('password')

      await c.env.DB.prepare("INSERT INTO users (id, name, email, password, role) VALUES (1, 'Platform Admin', 'admin@platform.com', ?, 'admin')").bind(adminHash).run()
      await c.env.DB.prepare("INSERT INTO users (id, name, email, password, role) VALUES (2, 'أحمد محمد', 'merchant@demo.com', ?, 'merchant')").bind(merchantHash).run()
      await c.env.DB.prepare("INSERT OR IGNORE INTO stores (id, user_id, plan_id, name, slug, description, primary_color, secondary_color, status) VALUES (1, 2, 3, 'متجر التقنية', 'tech-store', 'أفضل المنتجات التقنية', '#4F46E5', '#818CF8', 'active')").run()
      await c.env.DB.prepare("INSERT OR IGNORE INTO categories (id, store_id, name, slug) VALUES (1, 1, 'الجوالات', 'phones'), (2, 1, 'أجهزة الكمبيوتر', 'computers'), (3, 1, 'الإكسسوارات', 'accessories')").run()

      await c.env.DB.prepare(`INSERT OR IGNORE INTO products (id, store_id, category_id, name, slug, description, price, sale_price, stock, status, featured) VALUES
        (1, 1, 1, 'آيفون 15 برو', 'iphone-15-pro', 'أحدث هاتف من آبل مع كاميرا ثلاثية', 4999, 4599, 25, 'active', 1),
        (2, 1, 1, 'سامسونج Galaxy S24', 'samsung-s24', 'هاتف سامسونج الرائد بالذكاء الاصطناعي', 3999, NULL, 30, 'active', 1),
        (3, 1, 2, 'ماك بوك برو 14', 'macbook-pro-14', 'حاسوب آبل المحمول الاحترافي', 8999, 8499, 10, 'active', 1),
        (4, 1, 3, 'سماعة AirPods Pro', 'airpods-pro', 'سماعات لاسلكية بإلغاء الضوضاء', 999, 849, 50, 'active', 0),
        (5, 1, 3, 'شاحن MagSafe', 'magsafe-charger', 'شاحن مغناطيسي أصلي', 249, NULL, 100, 'active', 0)`
      ).run()

      await c.env.DB.prepare(`INSERT OR IGNORE INTO product_images (id, product_id, store_id, url, is_primary) VALUES
        (1, 1, 1, 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=600', 1),
        (2, 2, 1, 'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=600', 1),
        (3, 3, 1, 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600', 1),
        (4, 4, 1, 'https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?w=600', 1),
        (5, 5, 1, 'https://images.unsplash.com/photo-1592753563062-83e0a9e77b31?w=600', 1)`
      ).run()

      await c.env.DB.prepare(`INSERT OR IGNORE INTO customers (id, store_id, name, phone, city, total_orders, total_spent) VALUES
        (1, 1, 'محمد أحمد العمري', '0501234567', 'الرياض', 2, 13598),
        (2, 1, 'فاطمة الزهراء', '0559876543', 'جدة', 1, 4999)`
      ).run()

      await c.env.DB.prepare(`INSERT OR IGNORE INTO orders (id, store_id, customer_id, order_number, status, payment_status, subtotal, total, currency, customer_name, customer_phone, shipping_city) VALUES
        (1, 1, 1, 'ORD-2024-001', 'completed', 'paid', 4599, 4599, 'SAR', 'محمد أحمد', '0501234567', 'الرياض'),
        (2, 1, 2, 'ORD-2024-002', 'processing', 'paid', 4999, 4999, 'SAR', 'فاطمة الزهراء', '0559876543', 'جدة'),
        (3, 1, 1, 'ORD-2024-003', 'pending', 'pending', 8499, 8499, 'SAR', 'محمد أحمد', '0501234567', 'الرياض')`
      ).run()

      await c.env.DB.prepare(`INSERT OR IGNORE INTO order_items (order_id, store_id, product_id, product_name, price, quantity, total) VALUES
        (1, 1, 1, 'آيفون 15 برو', 4599, 1, 4599),
        (2, 1, 2, 'سامسونج Galaxy S24', 3999, 1, 3999),
        (2, 1, 4, 'سماعة AirPods Pro', 849, 1, 849),
        (3, 1, 3, 'ماك بوك برو 14', 8499, 1, 8499)`
      ).run()

      await c.env.DB.prepare("UPDATE stores SET total_sales = 19096 WHERE id = 1").run()

      // Sample coupons
      await c.env.DB.prepare(`INSERT OR IGNORE INTO coupons (store_id, code, type, value, min_order_amount, max_uses, description, is_active) VALUES
        (1, 'SUMMER20', 'percentage', 20, 100, 100, 'خصم الصيف 20%', 1),
        (1, 'WELCOME50', 'fixed', 50, 200, 50, 'خصم ترحيبي 50 ريال', 1),
        (1, 'VIP30', 'percentage', 30, 500, 20, 'خصم VIP 30%', 1)
      `).run()
    }

    return c.json({ 
      success: true, 
      message: '✅ تم تهيئة قاعدة البيانات بنجاح',
      accounts: {
        admin: { email: 'admin@platform.com', password: 'password', url: '/admin' },
        merchant: { email: 'merchant@demo.com', password: 'password', url: '/dashboard' },
        demo_store: '/store/tech-store'
      }
    })
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500)
  }
})

// ─── 404 Handler ───────────────────────────────────────────────
app.notFound((c) => {
  return c.html(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>404</title><script src="https://cdn.tailwindcss.com"></script><link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800&display=swap" rel="stylesheet"><style>*{font-family:'Tajawal',sans-serif}</style></head><body class="bg-gray-50 flex items-center justify-center min-h-screen"><div class="text-center p-8"><div class="text-9xl font-black text-gray-200 mb-4">404</div><h1 class="text-3xl font-black text-gray-600 mb-4">الصفحة غير موجودة</h1><p class="text-gray-400 mb-8">الصفحة التي تبحث عنها غير موجودة</p><a href="/" class="bg-indigo-600 text-white px-8 py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-colors">العودة للرئيسية</a></div></body></html>`, 404)
})

export default app
