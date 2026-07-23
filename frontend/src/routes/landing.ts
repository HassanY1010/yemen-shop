// ============================================
// Platform Landing Page
// ============================================
import { Hono } from 'hono';
import { Bindings, Variables } from '../types/index';
import { baseLayout } from '../utils/templates';

const landing = new Hono<{ Bindings: Bindings; Variables: Variables }>();

landing.get('/', async (c) => {
  let platformName = 'منصة سوق';
  let supportEmail = 'support@platform.com';
  let supportWhatsapp = '+967776461892';

  try {
    const { ensurePlansSeeded } = await import('../middleware/tenant');
    if (c.env?.DB) {
      await ensurePlansSeeded(c.env.DB);
      const settingsRows = await c.env.DB.prepare('SELECT key, value FROM platform_settings').all() as any;
      if (settingsRows?.results) {
        for (const r of settingsRows.results) {
          if (r.key === 'platform_name' && r.value) platformName = r.value;
          if (r.key === 'support_email' && r.value) supportEmail = r.value;
          if (r.key === 'support_whatsapp' && r.value) supportWhatsapp = r.value;
        }
      }
    }
  } catch (e) {}

  let plans: any[] = [];
  try {
    if (c.env?.DB) {
      const res = await c.env.DB.prepare('SELECT * FROM plans ORDER BY price ASC').all() as any;
      if (res?.results && res.results.length > 0) plans = res.results;
    }
  } catch (e) {}

  if (!plans.length) {
    plans = [
      { name: 'مجاني', price: 0, duration_days: 5, max_products: 5, max_orders: 50, max_staff: 1, slug: 'free' },
      { name: 'أساسي', price: 15000, duration_days: 30, max_products: 50, max_orders: 500, max_staff: 2, slug: 'basic' },
      { name: 'احترافي', price: 30000, duration_days: 30, max_products: 200, max_orders: 2000, max_staff: 5, slug: 'pro' },
      { name: 'أعمال', price: 60000, duration_days: 30, max_products: -1, max_orders: -1, max_staff: -1, slug: 'business' }
    ];
  }

  return c.html(baseLayout(`${platformName} - أنشئ متجرك في دقائق`, `
  <!-- Navbar -->
  <nav class="bg-white/95 backdrop-blur-sm sticky top-0 z-50 border-b border-gray-100 shadow-sm">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center">
          <i class="fas fa-store text-white text-lg"></i>
        </div>
        <span class="text-2xl font-black text-gray-800">${platformName}</span>
      </div>
      <div class="hidden md:flex items-center gap-6 text-sm font-medium text-gray-600">
        <a href="#features" class="hover:text-primary-600 transition-colors">المميزات</a>
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
        <a href="#pricing"
           class="border-2 border-white/50 text-white hover:bg-white/10 font-semibold px-8 py-4 rounded-2xl text-lg transition-all backdrop-blur-sm flex items-center justify-center gap-2">
          <i class="fas fa-eye"></i>
          عرض الأسعار
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
          { num: '500+', label: 'متجر نشط' },
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

  <!-- Features -->
  <section id="features" class="py-24 px-4 bg-gray-50">
    <div class="max-w-7xl mx-auto">
      <div class="text-center mb-16">
        <h2 class="text-4xl font-black text-gray-800 mb-4">كل ما تحتاجه في ${platformName}</h2>
        <p class="text-xl text-gray-500 max-w-2xl mx-auto">أدوات متكاملة لإدارة متجرك الإلكتروني من صورة المنتج حتى تسليم الطلب</p>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        ${[
          { icon: 'box', color: 'bg-blue-500', title: 'إدارة المنتجات', desc: 'إضافة وتعديل المنتجات مع صور متعددة وأسعار مخصصة وإدارة المخزون بكل سهولة' },
          { icon: 'shopping-bag', color: 'bg-green-500', title: 'إدارة الطلبات', desc: 'استلام وتتبع الطلبات في الوقت الفعلي مع تحديث حالة الطلب وتواصل مع العملاء' },
          { icon: 'users', color: 'bg-purple-500', title: 'إدارة العملاء', desc: 'قاعدة بيانات كاملة للعملاء مع تتبع تاريخ الطلبات والإنفاق لكل عميل' },
          { icon: 'chart-line', color: 'bg-orange-500', title: 'تقارير وإحصائيات', desc: 'لوحة تحليلية شاملة لتتبع مبيعاتك ونمو متجرك وأداء المنتجات' },
          { icon: 'palette', color: 'bg-pink-500', title: 'تخصيص المظهر', desc: 'خصص ألوان وشعار متجرك ليعكس هوية علامتك التجارية بشكل احترافي' },
          { icon: 'shield-alt', color: 'bg-indigo-500', title: 'أمان وعزل البيانات', desc: 'نظام Multi-Tenant متطور يضمن عزل بيانات كل متجر بشكل آمن وكامل' },
          { icon: 'ticket-alt', color: 'bg-yellow-500', title: 'كوبونات الخصم', desc: 'إنشاء وإدارة كوبونات خصم متنوعة لجذب العملاء وزيادة المبيعات' },
          { icon: 'mobile-alt', color: 'bg-teal-500', title: 'تصميم متجاوب', desc: 'متجرك يعمل بشكل مثالي على جميع الأجهزة من الجوال حتى الحاسوب' },
          { icon: 'share-alt', color: 'bg-red-500', title: 'روابط التواصل', desc: 'ربط متجرك بحسابات التواصل الاجتماعي وواتساب للتواصل المباشر مع العملاء' },
        ].map(feat => `
        <div class="bg-white rounded-2xl p-6 shadow-sm card-hover border border-gray-100">
          <div class="w-14 h-14 ${feat.color} rounded-2xl flex items-center justify-center text-white text-2xl mb-5">
            <i class="fas fa-${feat.icon}"></i>
          </div>
          <h3 class="font-bold text-gray-800 text-lg mb-2">${feat.title}</h3>
          <p class="text-gray-500 text-sm leading-relaxed">${feat.desc}</p>
        </div>
        `).join('')}
      </div>
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
            <li><a href="#features" class="hover:text-white transition-colors">المميزات</a></li>
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
  </footer>
  `));
});

export default landing;
