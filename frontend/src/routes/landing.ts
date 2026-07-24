// ============================================
// Platform Landing Page
// ============================================
import { Hono } from 'hono';
import { Bindings, Variables } from '../types/index';
import { baseLayout } from '../utils/templates';
import { getImageUrl, DEFAULT_STORE_LOGO } from '../utils/helpers';

interface LandingCache {
  platformName: string;
  supportEmail: string;
  supportWhatsapp: string;
  plans: any[];
  stores: any[];
  timestamp: number;
}

let landingCache: LandingCache | null = null;
const LANDING_CACHE_TTL = 300 * 1000; // 5 minutes cache

landing.get('/', async (c) => {
  c.header('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');

  const now = Date.now();
  if (landingCache && (now - landingCache.timestamp < LANDING_CACHE_TTL)) {
    return c.html(baseLayout(`${landingCache.platformName} - أنشئ متجرك في دقائق`, buildLandingBody(landingCache)));
  }

  let platformName = 'منصة سوق اليمن';
  let supportEmail = 'support@platform.com';
  let supportWhatsapp = '+967776461892';
  let plans: any[] = [];
  let stores: any[] = [];

  try {
    if (c.env?.DB) {
      const [settingsRes, plansRes, storesRes] = await Promise.all([
        c.env.DB.prepare('SELECT key, value FROM platform_settings').all().catch(() => null),
        c.env.DB.prepare('SELECT * FROM plans ORDER BY price ASC').all().catch(() => null),
        c.env.DB.prepare(`
          SELECT s.id, s.name, s.slug, s.logo, s.description
          FROM stores s
          WHERE s.status = 'active' AND (s.is_active = 1 OR s.is_active IS NULL)
          ORDER BY s.created_at DESC LIMIT 20
        `).all().catch(() => null)
      ]);

      if (settingsRes?.results) {
        for (const r of settingsRes.results as any[]) {
          if (r.key === 'platform_name' && r.value) platformName = r.value;
          if (r.key === 'support_email' && r.value) supportEmail = r.value;
          if (r.key === 'support_whatsapp' && r.value) supportWhatsapp = r.value;
        }
      }

      if (plansRes?.results && (plansRes.results as any[]).length > 0) {
        plans = plansRes.results as any[];
      }

      if (storesRes?.results) {
        stores = storesRes.results as any[];
      }
    }
  } catch (e) {
    console.error('[LANDING] Error fetching landing data:', e);
  }

  if (!plans.length) {
    plans = [
      { name: 'مجاني', price: 0, duration_days: 5, max_products: 5, max_orders: 50, max_staff: 1, slug: 'free' },
      { name: 'أساسي', price: 15000, duration_days: 30, max_products: 50, max_orders: 500, max_staff: 2, slug: 'basic' },
      { name: 'احترافي', price: 30000, duration_days: 30, max_products: 200, max_orders: 2000, max_staff: 5, slug: 'pro' },
      { name: 'أعمال', price: 60000, duration_days: 30, max_products: -1, max_orders: -1, max_staff: -1, slug: 'business' }
    ];
  }

  landingCache = { platformName, supportEmail, supportWhatsapp, plans, stores, timestamp: now };

  return c.html(baseLayout(`${platformName} - أنشئ متجرك في دقائق`, buildLandingBody(landingCache), {
    ogTitle: `${platformName} - أنشئ متجرك الإلكتروني في اليمن بسهولة`,
    ogDescription: 'منصة سوق اليمن - المنصة المتكاملة لإنشاء وإدارة المتاجر الإلكترونية في اليمن، دعم الدفع عبر البنوك المحلية وتتبع الطلبات مجاناً.',
    ogImage: '/pwa-icon.png',
    ogUrl: 'https://yemen-shop.onrender.com/'
  }));
});

function buildLandingBody(data: { platformName: string; supportEmail: string; supportWhatsapp: string; plans: any[]; stores: any[] }): string {
  const { platformName, supportEmail, supportWhatsapp, plans, stores } = data;
  return `
  <!-- Navbar -->
  <nav class="bg-white/95 backdrop-blur-sm sticky top-0 z-50 border-b border-gray-100 shadow-sm">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <img src="/pwa-icon.png" alt="${platformName}" onerror="handleImgError(this, 'logo')" class="w-10 h-10 object-contain rounded-xl shadow-md border border-gray-100 p-0.5 bg-white">
        <span class="text-2xl font-black text-gray-800">${platformName}</span>
      </div>
      <div class="hidden md:flex items-center gap-6 text-sm font-medium text-gray-600">
        <a href="#stores" class="hover:text-primary-600 transition-colors">المتاجر</a>
        <a href="#pricing" class="hover:text-primary-600 transition-colors">الأسعار</a>
        <a href="#how" class="hover:text-primary-600 transition-colors">كيف يعمل</a>
      </div>
      <div class="flex items-center gap-3">
        <a href="/auth/login" class="text-sm font-medium text-gray-600 hover:text-primary-600 transition-colors hidden sm:block">تسجيل الدخول</a>
        <a href="/auth/register" 
           class="bg-primary-600 hover:bg-primary-700 text-white font-semibold px-5 py-2 rounded-xl text-sm transition-all shadow-lg hover:shadow-primary-200">
          ابدأ مجاناً
        </a>
      </div>
    </div>
  </nav>

  <!-- Hero -->
  <section class="relative overflow-hidden gradient-primary text-white py-24 px-4">
    <div class="max-w-4xl mx-auto text-center">
      <div class="inline-flex items-center gap-2 bg-white/20 text-white text-sm font-medium px-4 py-2 rounded-full mb-6 backdrop-blur-sm">
        <span class="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
        مرحباً بكم في ${platformName}
      </div>
      <h1 class="text-5xl sm:text-6xl lg:text-7xl font-black mb-6 leading-tight">
        أنشئ متجرك<br>
        <span class="text-yellow-300">في دقائق</span>
      </h1>
      <p class="text-xl sm:text-2xl text-purple-100 mb-10 max-w-2xl mx-auto leading-relaxed">
        ${platformName} — منصة متكاملة لإنشاء متاجر إلكترونية احترافية بأدوات قوية وبسهولة تامة
      </p>
      <div class="flex flex-col sm:flex-row gap-4 justify-center">
        <a href="/auth/register" 
           class="bg-white text-primary-600 hover:bg-gray-50 font-bold px-10 py-4 rounded-2xl text-lg transition-all shadow-2xl hover:shadow-white/25 flex items-center justify-center gap-2">
          <i class="fas fa-rocket text-primary-500"></i>
          ابدأ تجربتك المجانية
        </a>
        <a href="#stores"
           class="border-2 border-white/50 text-white hover:bg-white/10 font-semibold px-8 py-4 rounded-2xl text-lg transition-all backdrop-blur-sm flex items-center justify-center gap-2">
          <i class="fas fa-store"></i>
          استكشف المتاجر
        </a>
      </div>
      <p class="mt-5 text-purple-200 text-sm">بدون بطاقة ائتمان • مجاني للأبد • لا حاجة للبرمجة</p>
    </div>

    <!-- Decorative -->
    <div class="absolute top-0 left-0 w-72 h-72 bg-white/5 rounded-full -translate-x-1/2 -translate-y-1/2"></div>
    <div class="absolute bottom-0 right-0 w-96 h-96 bg-white/5 rounded-full translate-x-1/3 translate-y-1/3"></div>
  </section>

  <!-- Stats Bar -->
  <section class="bg-white py-12 border-b border-gray-100">
    <div class="max-w-7xl mx-auto px-4 sm:px-6">
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
        ${[
          { num: stores.length ? stores.length + '+' : '500+', label: 'متجر نشط' },
          { num: '50K+', label: 'طلب شهرياً' },
          { num: '99.9%', label: 'وقت التشغيل' },
          { num: '24/7', label: 'دعم فني' },
        ].map(stat => `
        <div>
          <p class="text-4xl font-black text-primary-600 mb-1">${stat.num}</p>
          <p class="text-gray-500 font-medium">${stat.label}</p>
        </div>
        `).join('')}
      </div>
    </div>
  </section>

  <!-- Dynamic Active Stores Section -->
  <section id="stores" class="py-24 px-4 bg-gray-50 dark:bg-slate-900/50">
    <div class="max-w-7xl mx-auto">
      <div class="text-center mb-16">
        <div class="inline-flex items-center gap-2 bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 text-xs font-bold px-4 py-1.5 rounded-full mb-3 border border-primary-200 dark:border-primary-800">
          <i class="fas fa-store text-xs"></i> دليل المتاجر الإلكترونية
        </div>
        <h2 class="text-4xl font-black text-gray-800 dark:text-white mb-4">المتاجر المنشأة على المنصة</h2>
        <p class="text-xl text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">استكشف المتاجر الإلكترونية النشطة وقم بزيارتها وتسوق منها مباشرة</p>
      </div>

      ${stores.length > 0 ? `
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        ${stores.map((store: any) => {
          const logoUrl = getImageUrl(store.logo, DEFAULT_STORE_LOGO);
          const storeUrl = `/store/${store.slug}`;
          const storeDesc = store.description || store.tagline || `متجر إلكتروني متكامل عبر ${platformName}`;
          const primaryColor = store.primary_color || '#4F46E5';

          return `
          <div class="bg-white dark:bg-slate-800 rounded-3xl border border-gray-100 dark:border-slate-700/80 shadow-sm card-hover flex flex-col justify-between overflow-hidden relative group transition-all duration-300">
            <!-- Card Top Header / Banner -->
            <div class="h-28 relative overflow-hidden flex items-center justify-center" style="background: linear-gradient(135deg, ${primaryColor}dd, ${primaryColor}88);">
              <div class="absolute inset-0 opacity-20 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]"></div>
              <span class="absolute top-3 left-3 bg-white/20 backdrop-blur-md text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5 border border-white/30 shadow-sm">
                <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> نشط
              </span>
              <span class="absolute top-3 right-3 bg-black/20 backdrop-blur-md text-white text-xs font-semibold px-2.5 py-1 rounded-full">
                <i class="fas fa-box ml-1 text-xs"></i> ${store.products_count || 0} منتج
              </span>
            </div>

            <!-- Logo Avatar Floating -->
            <div class="px-6 -mt-10 mb-4 relative z-10 flex items-end justify-between">
              <a href="${storeUrl}" class="block group-hover:scale-105 transition-transform">
                <img src="${logoUrl}" alt="${store.name}" 
                     class="w-20 h-20 rounded-2xl border-4 border-white dark:border-slate-800 object-cover shadow-lg bg-white" 
                     onerror="this.onerror=null; this.src='${DEFAULT_STORE_LOGO}';">
              </a>
            </div>

            <!-- Store Info Body -->
            <div class="px-6 pb-6 flex-1 flex flex-col justify-between">
              <div>
                <a href="${storeUrl}" class="block group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                  <h3 class="font-black text-gray-900 dark:text-white text-lg leading-snug line-clamp-1 mb-1">${store.name}</h3>
                </a>
                <p class="text-xs font-mono text-primary-600 dark:text-primary-400 dir-ltr text-right mb-3 opacity-90 truncate">
                  /store/${store.slug}
                </p>
                <p class="text-gray-600 dark:text-gray-400 text-xs leading-relaxed line-clamp-2 mb-6 min-h-[32px]">
                  ${storeDesc}
                </p>
              </div>

              <!-- Visit Button -->
              <a href="${storeUrl}" 
                 class="w-full inline-flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-bold py-3 px-4 rounded-xl text-sm transition-all shadow-md hover:shadow-primary-200 group-hover:translate-y-[-2px]">
                <span>زيارة المتجر</span>
                <i class="fas fa-arrow-left text-xs transition-transform group-hover:-translate-x-1"></i>
              </a>
            </div>
          </div>`;
        }).join('')}
      </div>
      ` : `
      <!-- Empty State if no active stores exist -->
      <div class="text-center py-16 bg-white dark:bg-slate-800 rounded-3xl border border-gray-100 dark:border-slate-700/80 p-8 max-w-lg mx-auto shadow-sm">
        <div class="w-20 h-20 bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-full flex items-center justify-center mx-auto text-3xl mb-4">
          <i class="fas fa-store-slash"></i>
        </div>
        <h3 class="text-xl font-bold text-gray-800 dark:text-white mb-2">لا توجد متاجر متاحة حالياً</h3>
        <p class="text-gray-500 dark:text-gray-400 text-sm mb-6 leading-relaxed">
          كن أول من ينشئ متجره الإلكتروني عبر المنصة وابدأ بعرض منتجاتك واستقبال الطلبات اليوم!
        </p>
        <a href="/auth/register" class="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-bold px-6 py-3 rounded-xl text-sm transition-all shadow-lg">
          <i class="fas fa-plus-circle"></i> أنشئ متجرك الآن
        </a>
      </div>
      `}
    </div>
  </section>

  <!-- How It Works -->
  <section id="how" class="py-24 px-4">
    <div class="max-w-5xl mx-auto">
      <div class="text-center mb-16">
        <h2 class="text-4xl font-black text-gray-800 mb-4">كيف تبدأ؟</h2>
        <p class="text-xl text-gray-500">ابدأ رحلتك في 3 خطوات بسيطة</p>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
        ${[
          { num: '01', icon: 'user-plus', title: 'إنشاء حساب', desc: 'سجل بياناتك الأساسية ويُنشأ متجرك تلقائياً خلال ثوانٍ', color: 'from-blue-400 to-blue-600' },
          { num: '02', icon: 'box', title: 'أضف منتجاتك', desc: 'أضف منتجاتك بصورها وأسعارها وتفاصيلها الكاملة', color: 'from-purple-400 to-purple-600' },
          { num: '03', icon: 'rocket', title: 'انشر وابدأ البيع', desc: 'شارك رابط متجرك وابدأ في استقبال الطلبات فوراً', color: 'from-green-400 to-green-600' },
        ].map(step => `
        <div class="text-center">
          <div class="relative inline-block mb-6">
            <div class="w-20 h-20 bg-gradient-to-br ${step.color} rounded-2xl flex items-center justify-center text-white text-3xl mx-auto shadow-lg">
              <i class="fas fa-${step.icon}"></i>
            </div>
            <span class="absolute -top-2 -right-2 w-8 h-8 bg-primary-600 text-white text-sm font-black rounded-full flex items-center justify-center">${step.num}</span>
          </div>
          <h3 class="text-xl font-bold text-gray-800 mb-2">${step.title}</h3>
          <p class="text-gray-500 leading-relaxed">${step.desc}</p>
        </div>
        `).join('')}
      </div>
    </div>
  </section>

  <!-- Pricing -->
  <section id="pricing" class="py-24 px-4 bg-gray-50">
    <div class="max-w-6xl mx-auto">
      <div class="text-center mb-16">
        <h2 class="text-4xl font-black text-gray-800 mb-4">أسعار شفافة وبسيطة</h2>
        <p class="text-xl text-gray-500">اختر الباقة التي تناسب احتياجاتك، وقم بالترقية في أي وقت</p>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        ${plans.map((plan: any) => `
        <div class="bg-white rounded-2xl border-2 ${plan.slug === 'pro' ? 'border-primary-400 shadow-2xl shadow-primary-100 scale-105 relative' : 'border-gray-200 shadow-sm'} card-hover p-6">
          ${plan.slug === 'pro' ? `<div class="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary-600 text-white text-xs font-bold px-4 py-1 rounded-full">موصى به</div>` : ''}
          <h3 class="font-black text-gray-800 text-xl mb-2">${plan.name}</h3>
          <div class="mb-5">
            <span class="text-4xl font-black text-gray-800">${plan.price === 0 ? '0' : plan.price.toLocaleString('ar-SA')}</span>
            <span class="text-gray-500 text-sm mr-1">ريال / ${plan.price === 0 ? 'مجاني' : (plan.duration_days ? plan.duration_days + ' يوم' : 'شهرياً')}</span>
          </div>
          <ul class="space-y-2.5 mb-6 text-sm text-gray-600">
            <li class="flex items-center gap-2"><i class="fas fa-check text-green-500 text-xs w-4"></i>${plan.max_products === -1 ? 'منتجات غير محدودة' : plan.max_products + ' منتج'}</li>
            <li class="flex items-center gap-2"><i class="fas fa-check text-green-500 text-xs w-4"></i>${plan.max_orders === -1 ? 'طلبات غير محدودة' : plan.max_orders.toLocaleString('ar-SA') + ' طلب/شهر'}</li>
            <li class="flex items-center gap-2"><i class="fas fa-check text-green-500 text-xs w-4"></i>${plan.max_staff === -1 ? 'موظفون غير محدودين' : plan.max_staff + ' موظف'}</li>
            <li class="flex items-center gap-2"><i class="fas fa-check text-green-500 text-xs w-4"></i>لوحة تحكم كاملة</li>
            <li class="flex items-center gap-2"><i class="fas fa-check text-green-500 text-xs w-4"></i>SSL مجاني</li>
          </ul>
          <a href="/auth/register" 
             class="${plan.slug === 'pro' ? 'bg-primary-600 text-white hover:bg-primary-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'} font-semibold py-3 px-4 rounded-xl text-sm text-center block transition-all">
            ${plan.price === 0 ? 'ابدأ مجاناً' : 'اشترك الآن'}
          </a>
        </div>
        `).join('')}
      </div>
    </div>
  </section>

  <!-- CTA -->
  <section class="gradient-primary text-white py-24 px-4">
    <div class="max-w-3xl mx-auto text-center">
      <h2 class="text-4xl sm:text-5xl font-black mb-6">جاهز لإطلاق متجرك؟</h2>
      <p class="text-xl text-purple-100 mb-10">انضم لآلاف التجار الذين يديرون متاجرهم عبر ${platformName}</p>
      <a href="/auth/register"
         class="bg-white text-primary-600 hover:bg-gray-50 font-bold px-12 py-5 rounded-2xl text-xl transition-all shadow-2xl inline-flex items-center gap-3">
        <i class="fas fa-store"></i>
        أنشئ متجرك الآن — مجاناً
      </a>
      <p class="mt-5 text-purple-200 text-sm">لا يلزم بطاقة ائتمان • إلغاء في أي وقت</p>
    </div>
  </section>

  <!-- Footer -->
  <footer class="bg-gray-900 text-white py-16 px-4">
    <div class="max-w-7xl mx-auto">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
        <div class="md:col-span-2">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center">
              <i class="fas fa-store text-white"></i>
            </div>
            <span class="text-2xl font-black">${platformName}</span>
          </div>
          <p class="text-gray-400 leading-relaxed max-w-sm">
            ${platformName} — منصة SaaS رائدة لإنشاء وإدارة المتاجر الإلكترونية بأعلى معايير الجودة والأمان
          </p>
        </div>
        <div>
          <h4 class="font-bold mb-4 text-gray-200">روابط سريعة</h4>
          <ul class="space-y-2 text-sm text-gray-400">
            <li><a href="#stores" class="hover:text-white transition-colors">المتاجر</a></li>
            <li><a href="#pricing" class="hover:text-white transition-colors">الأسعار</a></li>
            <li><a href="/auth/register" class="hover:text-white transition-colors">إنشاء حساب</a></li>
            <li><a href="/auth/login" class="hover:text-white transition-colors">تسجيل الدخول</a></li>
          </ul>
        </div>
        <div>
          <h4 class="font-bold mb-4 text-gray-200">للتجار</h4>
          <ul class="space-y-2 text-sm text-gray-400">
            <li><a href="/dashboard" class="hover:text-white transition-colors">لوحة التحكم</a></li>
            <li><a href="/admin" class="hover:text-white transition-colors">لوحة الإدارة</a></li>
          </ul>
        </div>
      </div>
      <div class="border-t border-gray-800 pt-8 text-center text-sm text-gray-500">
        <p>© ${new Date().getFullYear()} ${platformName} - جميع الحقوق محفوظة</p>
      </div>
    </div>
  </footer>`;
}

export default landing;
