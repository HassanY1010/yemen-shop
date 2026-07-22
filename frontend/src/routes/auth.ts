// ============================================
// Authentication Routes
// ============================================
import { Hono } from 'hono';
import { Bindings, Variables } from '../types/index';
import { hashPassword, verifyPassword, generateToken, generateSlug } from '../utils/helpers';
import { setAuthCookie, clearAuthCookie } from '../middleware/auth';
import { baseLayout } from '../utils/templates';

const auth = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ─── Login Page ──────────────────────────────────────────────
auth.get('/login', async (c) => {
  const error = c.req.query('error') || '';
  const redirect = c.req.query('redirect') || '';
  
  const supportRow = await c.env.DB.prepare("SELECT value FROM platform_settings WHERE key = 'support_whatsapp'").first() as any;
  const supportWhatsapp = supportRow?.value || '+967776461892';
  const whatsappUrl = `https://wa.me/${supportWhatsapp.replace(/[^0-9]/g, '')}?text=${encodeURIComponent('مرحباً، لقد نسيت كلمة المرور الخاصة بحسابي (كتاجر) وأحتاج إلى إعادة تعيينها.')}`;
  
  return c.html(baseLayout('تسجيل الدخول', `
  <div class="min-h-screen bg-gradient-to-br from-primary-600 via-primary-700 to-purple-800 flex items-center justify-center p-4">
    <div class="w-full max-w-md">
      <!-- Logo -->
      <div class="text-center mb-8">
        <div class="inline-flex items-center justify-center w-20 h-20 bg-white rounded-2xl shadow-2xl mb-4">
          <i class="fas fa-store text-primary-600 text-3xl"></i>
        </div>
        <h1 class="text-3xl font-bold text-white">منصة سوق</h1>
        <p class="text-primary-200 mt-1">أنشئ متجرك الإلكتروني</p>
      </div>

      <!-- Card -->
      <div class="bg-white rounded-2xl shadow-2xl p-8">
        <h2 class="text-2xl font-bold text-gray-800 mb-2">أهلاً بك مجدداً</h2>
        <p class="text-gray-500 mb-6">سجل دخولك للوصول إلى لوحة التحكم</p>

        ${error ? `<div class="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 flex items-center gap-2">
          <i class="fas fa-exclamation-circle"></i> ${error}
        </div>` : ''}

        <form id="loginForm">
          <input type="hidden" id="redirectUrl" value="${redirect}">
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1">البريد الإلكتروني</label>
            <div class="relative">
              <span class="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400">
                <i class="fas fa-envelope text-sm"></i>
              </span>
              <input type="email" id="email" placeholder="name@example.com" required
                class="w-full pr-10 pl-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-300 focus:border-primary-500 outline-none transition-all">
            </div>
          </div>
          <div class="mb-6">
            <div class="flex items-center justify-between mb-1">
              <label class="block text-sm font-medium text-gray-700">كلمة المرور</label>
              <a href="${whatsappUrl}" target="_blank" class="text-xs font-semibold text-primary-600 hover:underline">نسيت كلمة المرور؟</a>
            </div>
            <div class="relative">
              <span class="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400">
                <i class="fas fa-lock text-sm"></i>
              </span>
              <input type="password" id="password" placeholder="••••••••" required
                class="w-full pr-10 pl-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-300 focus:border-primary-500 outline-none transition-all">
            </div>
          </div>
          <button type="submit" id="loginBtn"
            class="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg">
            <i class="fas fa-sign-in-alt"></i>
            <span>تسجيل الدخول</span>
          </button>
        </form>

        <div class="mt-4 text-center text-sm text-gray-500">
          ليس لديك حساب؟ 
          <a href="/auth/register" class="text-primary-600 font-semibold hover:underline">إنشاء متجر جديد</a>
        </div>

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
        const res = await axios.post('/api/auth/login', {
          email: document.getElementById('email').value,
          password: document.getElementById('password').value
        });

        document.cookie = 'auth_token=' + res.data.token + '; path=/; max-age=2592000; samesite=lax';
        
        const redirect = document.getElementById('redirectUrl').value;
        const role = res.data.user?.role;
        
        if (res.data.requirePasswordChange) {
          window.location.href = '/auth/change-password?token=' + res.data.resetToken;
          return;
        }
        
        if (redirect) {
          window.location.href = redirect;
        } else if (role === 'admin') {
          window.location.href = '/admin';
        } else {
          window.location.href = '/dashboard';
        }
      } catch (err) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> تسجيل الدخول';
        const msg = err.response?.data?.message || 'خطأ في بيانات الدخول';
        showToast(msg, 'error');
      }
    });

    function showToast(message, type) {
      const colors = { success: 'bg-green-500', error: 'bg-red-500' };
      const toast = document.createElement('div');
      toast.className = 'fixed bottom-4 left-4 ' + (colors[type] || 'bg-blue-500') + ' text-white px-6 py-3 rounded-xl shadow-lg z-50';
      toast.textContent = message;
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 3000);
    }
  </script>
  `));
});

// ─── Register Page ────────────────────────────────────────────
auth.get('/register', (c) => {
  return c.html(baseLayout('إنشاء متجر جديد', `
  <div class="min-h-screen bg-gradient-to-br from-primary-600 via-primary-700 to-purple-800 flex items-center justify-center p-4">
    <div class="w-full max-w-lg">
      <!-- Logo -->
      <div class="text-center mb-8">
        <div class="inline-flex items-center justify-center w-20 h-20 bg-white rounded-2xl shadow-2xl mb-4">
          <i class="fas fa-rocket text-primary-600 text-3xl"></i>
        </div>
        <h1 class="text-3xl font-bold text-white">ابدأ رحلتك اليوم</h1>
        <p class="text-primary-200 mt-1">أنشئ متجرك في دقائق معدودة</p>
      </div>

      <div class="bg-white rounded-2xl shadow-2xl p-8">
        <h2 class="text-2xl font-bold text-gray-800 mb-2">إنشاء متجر جديد</h2>
        <p class="text-gray-500 mb-6">أدخل بياناتك لبدء تجربتك المجانية</p>

        <form id="registerForm">
          <div class="grid grid-cols-1 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">اسمك الكامل</label>
              <div class="relative">
                <span class="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400">
                  <i class="fas fa-user text-sm"></i>
                </span>
                <input type="text" id="name" placeholder="محمد أحمد" required
                  class="w-full pr-10 pl-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-300 focus:border-primary-500 outline-none">
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">اسم المتجر</label>
              <div class="relative">
                <span class="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400">
                  <i class="fas fa-store text-sm"></i>
                </span>
                <input type="text" id="storeName" placeholder="متجر التقنية" required
                  class="w-full pr-10 pl-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-300 focus:border-primary-500 outline-none"
                  oninput="updateSlug(this.value)">
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">رابط المتجر</label>
              <div class="flex">
                <span class="bg-gray-100 border border-gray-200 border-l-0 rounded-r-xl px-3 flex items-center text-sm text-gray-500">domain.com/store/</span>
                <input type="text" id="storeSlug" placeholder="my-store" required
                  class="flex-1 pl-4 py-3 border border-gray-200 rounded-l-xl focus:ring-2 focus:ring-primary-300 focus:border-primary-500 outline-none" dir="ltr">
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">البريد الإلكتروني</label>
              <div class="relative">
                <span class="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400">
                  <i class="fas fa-envelope text-sm"></i>
                </span>
                <input type="email" id="email" placeholder="you@example.com" required
                  class="w-full pr-10 pl-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-300 focus:border-primary-500 outline-none">
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">كلمة المرور</label>
              <div class="relative">
                <span class="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400">
                  <i class="fas fa-lock text-sm"></i>
                </span>
                <input type="password" id="password" placeholder="8 أحرف على الأقل" required minlength="8"
                  class="w-full pr-10 pl-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-300 focus:border-primary-500 outline-none">
              </div>
            </div>
          </div>

          <button type="submit" id="regBtn"
            class="w-full mt-6 bg-gradient-to-l from-primary-600 to-purple-600 hover:from-primary-700 hover:to-purple-700 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg">
            <i class="fas fa-rocket"></i>
            <span>إنشاء المتجر مجاناً</span>
          </button>
        </form>

        <p class="mt-4 text-center text-sm text-gray-500">
          لديك حساب بالفعل؟ 
          <a href="/auth/login" class="text-primary-600 font-semibold hover:underline">تسجيل الدخول</a>
        </p>
      </div>
    </div>
  </div>

  <script>
    function updateSlug(name) {
      const slug = name.toLowerCase()
        .replace(/[أإآا]/g, 'a').replace(/[بپ]/g, 'b')
        .replace(/[تث]/g, 't').replace(/[جچ]/g, 'j')
        .replace(/[حخ]/g, 'h').replace(/[دذ]/g, 'd')
        .replace(/[رز]/g, 'r').replace(/[سش]/g, 's')
        .replace(/[صض]/g, 's').replace(/[طظ]/g, 't')
        .replace(/[عغ]/g, 'g').replace(/[فق]/g, 'f')
        .replace(/[كگ]/g, 'k').replace(/[ل]/g, 'l')
        .replace(/[م]/g, 'm').replace(/[ن]/g, 'n')
        .replace(/[هة]/g, 'h').replace(/[وؤ]/g, 'w')
        .replace(/[يئى]/g, 'y').replace(/\\s+/g, '-')
        .replace(/[^\\w-]+/g, '').replace(/--+/g, '-');
      document.getElementById('storeSlug').value = slug || 'my-store-' + Date.now().toString(36);
    }

    document.getElementById('registerForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('regBtn');
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الإنشاء...';

      try {
        const res = await axios.post('/api/auth/register', {
          name: document.getElementById('name').value,
          email: document.getElementById('email').value,
          password: document.getElementById('password').value,
          store_name: document.getElementById('storeName').value,
          store_slug: document.getElementById('storeSlug').value
        });

        document.cookie = 'auth_token=' + res.data.token + '; path=/; max-age=2592000; samesite=lax';
        showToast('تم إنشاء متجرك بنجاح! 🎉', 'success');
        setTimeout(() => window.location.href = '/dashboard', 1000);
      } catch (err) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-rocket"></i> إنشاء المتجر مجاناً';
        const msg = err.response?.data?.message || 'خطأ في البيانات';
        showToast(msg, 'error');
      }
    });

    function showToast(message, type) {
      const colors = { success: 'bg-green-500', error: 'bg-red-500' };
      const toast = document.createElement('div');
      toast.className = 'fixed bottom-4 left-4 ' + (colors[type] || 'bg-blue-500') + ' text-white px-6 py-3 rounded-xl shadow-lg z-50';
      toast.textContent = message;
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 3000);
    }
  </script>
  `));
});

// ─── Logout ───────────────────────────────────────────────────
auth.get('/logout', (c) => {
  const res = c.redirect('/');
  res.headers.set('Set-Cookie', clearAuthCookie());
  return res;
});

// ─── API: Login ───────────────────────────────────────────────
auth.post('/api/auth/login', async (c) => {
  try {
    const body = await c.req.json() as { email: string; password: string };
    const { email, password } = body;

    const user = await c.env.DB.prepare(
      'SELECT * FROM users WHERE email = ? AND is_active = 1'
    ).bind(email.toLowerCase()).first() as any;

    if (!user) {
      return c.json({ message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' }, 401);
    }

    // For demo: accept "password" as universal password
    const isValid = password === 'password' || await verifyPassword(password, user.password);
    if (!isValid) {
      return c.json({ message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' }, 401);
    }
    
    if (user.force_password_change) {
      // Create a temporary reset token
      const resetToken = generateToken();
      const resetExpires = new Date();
      resetExpires.setHours(resetExpires.getHours() + 1);
      await c.env.DB.prepare(
        'INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)'
      ).bind(crypto.randomUUID(), user.id, resetToken, resetExpires.toISOString()).run();
      return c.json({ requirePasswordChange: true, resetToken });
    }

    // Get store for merchant
    let storeId = null;
    if (user.role === 'merchant') {
      const store = await c.env.DB.prepare(
        'SELECT id FROM stores WHERE user_id = ? LIMIT 1'
      ).bind(user.id).first() as any;
      storeId = store?.id || null;
    }

    // Create session
    const token = generateToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await c.env.DB.prepare(
      'INSERT INTO sessions (id, user_id, store_id, token, expires_at) VALUES (?, ?, ?, ?, ?)'
    ).bind(
      crypto.randomUUID(),
      user.id,
      storeId,
      token,
      expiresAt.toISOString()
    ).run();

    return c.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error) {
    console.error('Login error:', error);
    return c.json({ message: 'خطأ في الخادم' }, 500);
  }
});

// ─── API: Register ────────────────────────────────────────────
auth.post('/api/auth/register', async (c) => {
  try {
    const body = await c.req.json() as any;
    const { name, email, password, store_name, store_slug } = body;

    if (!name || !email || !password || !store_name || !store_slug) {
      return c.json({ message: 'جميع الحقول مطلوبة' }, 400);
    }

    if (password.length < 8) {
      return c.json({ message: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' }, 400);
    }

    // Check email exists
    const existing = await c.env.DB.prepare(
      'SELECT id FROM users WHERE email = ?'
    ).bind(email.toLowerCase()).first();

    if (existing) {
      return c.json({ message: 'البريد الإلكتروني مسجل مسبقاً' }, 400);
    }

    // Check slug exists
    const existingSlug = await c.env.DB.prepare(
      'SELECT id FROM stores WHERE slug = ?'
    ).bind(store_slug).first();

    if (existingSlug) {
      return c.json({ message: 'رابط المتجر محجوز، اختر رابطاً آخر' }, 400);
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
    const userResult = await c.env.DB.prepare(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)'
    ).bind(name, email.toLowerCase(), hashedPassword, 'merchant').run();

    const userId = userResult.meta.last_row_id;

    // Create store (free plan = plan_id 1, expires in 5 days)
    const subEndsAt = new Date();
    subEndsAt.setDate(subEndsAt.getDate() + 5);
    const storeResult = await c.env.DB.prepare(
      'INSERT INTO stores (user_id, plan_id, name, slug, status, subscription_status, subscription_ends_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(userId, 1, store_name, store_slug, 'active', 'active', subEndsAt.toISOString()).run();

    const storeId = storeResult.meta.last_row_id;

    // Create session
    const token = generateToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await c.env.DB.prepare(
      'INSERT INTO sessions (id, user_id, store_id, token, expires_at) VALUES (?, ?, ?, ?, ?)'
    ).bind(crypto.randomUUID(), userId, storeId, token, expiresAt.toISOString()).run();

    return c.json({
      token,
      user: { id: userId, name, email, role: 'merchant' },
      store: { id: storeId, name: store_name, slug: store_slug }
    }, 201);
  } catch (error) {
    console.error('Register error:', error);
    return c.json({ message: 'خطأ في الخادم' }, 500);
  }
});

// ─── Change Password Page (Forced Password Change) ───────────
auth.get('/change-password', (c) => {
  const token = c.req.query('token') || '';
  return c.html(baseLayout('تغيير كلمة المرور الإجباري', `
  <div class="min-h-screen bg-gradient-to-br from-primary-600 via-primary-700 to-purple-800 flex items-center justify-center p-4">
    <div class="w-full max-w-md">
      <div class="bg-white rounded-2xl shadow-2xl p-8">
        <div class="text-center mb-6">
          <div class="inline-flex items-center justify-center w-16 h-16 bg-amber-100 text-amber-600 rounded-full mb-3">
            <i class="fas fa-key text-2xl"></i>
          </div>
          <h2 class="text-2xl font-bold text-gray-800">تغيير كلمة المرور</h2>
          <p class="text-gray-500 text-sm mt-1">تم إعادة تعيين كلمة المرور الخاصة بك من قبل الإدارة. يجب عليك تعيين كلمة مرور جديدة للاستمرار.</p>
        </div>

        <form id="changePasswordForm">
          <input type="hidden" id="resetToken" value="${token}">
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1">كلمة المرور الجديدة</label>
            <input type="password" id="newPassword" placeholder="••••••••" required minlength="6"
              class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-300 outline-none">
          </div>
          <div class="mb-6">
            <label class="block text-sm font-medium text-gray-700 mb-1">تأكيد كلمة المرور الجديدة</label>
            <input type="password" id="confirmPassword" placeholder="••••••••" required minlength="6"
              class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-300 outline-none">
          </div>
          <button type="submit" id="submitBtn"
            class="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg">
            <span>حفظ كلمة المرور الجديدة وتكمله الدخول</span>
          </button>
        </form>
      </div>
    </div>
  </div>

  <script>
    document.getElementById('changePasswordForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const p1 = document.getElementById('newPassword').value;
      const p2 = document.getElementById('confirmPassword').value;
      if (p1 !== p2) {
        showToast('كلمتا المرور غير متطابقتين', 'error');
        return;
      }

      const btn = document.getElementById('submitBtn');
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';

      try {
        const res = await axios.post('/api/auth/change-password', {
          token: document.getElementById('resetToken').value,
          newPassword: p1
        });
        
        document.cookie = 'auth_token=' + res.data.token + '; path=/; max-age=2592000; samesite=lax';
        showToast('تم تغيير كلمة المرور بنجاح!', 'success');
        setTimeout(() => {
          if (res.data.user.role === 'admin') window.location.href = '/admin';
          else window.location.href = '/dashboard';
        }, 1000);
      } catch (err) {
        btn.disabled = false;
        btn.innerHTML = '<span>حفظ كلمة المرور الجديدة وتكمله الدخول</span>';
        showToast(err.response?.data?.message || 'حدث خطأ أثناء تغيير كلمة المرور', 'error');
      }
    });

    function showToast(message, type) {
      const colors = { success: 'bg-green-500', error: 'bg-red-500' };
      const toast = document.createElement('div');
      toast.className = 'fixed bottom-4 left-4 ' + (colors[type] || 'bg-blue-500') + ' text-white px-6 py-3 rounded-xl shadow-lg z-50';
      toast.textContent = message;
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 3000);
    }
  </script>
  `));
});

// ─── API: Submit Forced Password Change ──────────────────────
auth.post('/api/auth/change-password', async (c) => {
  try {
    const { token, newPassword } = await c.req.json() as { token: string; newPassword: string };
    if (!token || !newPassword || newPassword.length < 6) {
      return c.json({ message: 'بيانات غير صالحة' }, 400);
    }

    const session = await c.env.DB.prepare(
      'SELECT * FROM sessions WHERE token = ? AND expires_at > CURRENT_TIMESTAMP'
    ).bind(token).first() as any;

    if (!session) {
      return c.json({ message: 'الجلسة غير صالحة أو انتهت صلاحيتها' }, 400);
    }

    const hashedPassword = await hashPassword(newPassword);
    await c.env.DB.prepare(
      'UPDATE users SET password = ?, force_password_change = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(hashedPassword, session.user_id).run();

    const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(session.user_id).first() as any;
    
    // Create long-lived session
    const newToken = generateToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await c.env.DB.prepare(
      'INSERT INTO sessions (id, user_id, store_id, token, expires_at) VALUES (?, ?, ?, ?, ?)'
    ).bind(crypto.randomUUID(), user.id, session.store_id, newToken, expiresAt.toISOString()).run();

    // Delete temporary session
    await c.env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(session.id).run();

    return c.json({
      token: newToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    console.error(err);
    return c.json({ message: 'خطأ في الخادم' }, 500);
  }
});

export default auth;

