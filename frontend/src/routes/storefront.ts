// ============================================
// Public Store Frontend (Customer Facing)
// ============================================
import { Hono } from 'hono';
import { Bindings, Variables } from '../types/index';
import { formatCurrency, hashPassword, verifyPassword, generateToken, getImageUrl, DEFAULT_PRODUCT_IMAGE, DEFAULT_STORE_LOGO } from '../utils/helpers';
import { baseLayout } from '../utils/templates';

const store = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ─── Helpers: Customer Session Management ──────────────────────
function parseCookies(cookieStr: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieStr) return cookies;
  cookieStr.split(';').forEach(cookie => {
    const [name, ...rest] = cookie.split('=');
    if (name) cookies[name.trim()] = rest.join('=').trim();
  });
  return cookies;
}

async function getLoggedInCustomer(c: any, storeId: number): Promise<any | null> {
  const cookieHeader = c.req.header('Cookie') || '';
  const cookies = parseCookies(cookieHeader);
  const token = cookies[`customer_token_${storeId}`];
  if (!token) return null;

  try {
    const session = await c.env.DB.prepare(
      `SELECT s.*, c.id as cust_id, c.name as cust_name, c.email as cust_email, c.phone as cust_phone,
       c.address as cust_address, c.city as cust_city, c.country as cust_country
       FROM sessions s
       JOIN customers c ON s.user_id = c.id
       WHERE s.token = ? AND s.store_id = ? AND (s.expires_at IS NULL OR s.expires_at > ?)`
    ).bind(token, storeId, new Date().toISOString()).first() as any;

    if (!session) return null;
    return {
      id: session.cust_id,
      name: session.cust_name,
      email: session.cust_email,
      phone: session.cust_phone,
      address: session.cust_address,
      city: session.cust_city,
      country: session.cust_country
    };
  } catch (err) {
    console.error('getLoggedInCustomer error:', err);
    return null;
  }
}

export async function renderExpiredStorePage(c: any, storeData?: any) {
  let supportWhatsapp = '+967776461892';
  try {
    const supportRow = await c.env.DB.prepare("SELECT value FROM platform_settings WHERE key = 'support_whatsapp'").first() as any;
    if (supportRow?.value) supportWhatsapp = supportRow.value;
  } catch (e) {}

  const whatsappUrl = `https://wa.me/${supportWhatsapp.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`مرحباً، انتهى اشتراك متجري (${storeData?.name || ''}) وأرغب في تجديد الباقة وإعادة تفعيل المتجر.`)}`;

  return c.html(baseLayout('انتهت صلاحية الاشتراك', `
  <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900 p-4">
    <div class="max-w-md w-full bg-card rounded-3xl p-8 border border-std shadow-2xl text-center">
      <div class="w-20 h-20 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl shadow-inner">
        <i class="fas fa-exclamation-triangle"></i>
      </div>
      <h2 class="text-2xl font-black text-main mb-3">انتهت صلاحية اشتراك هذا المتجر</h2>
      <p class="text-sub text-sm mb-8 leading-relaxed">
        انتهت مدة اشتراك هذا المتجر، ولإعادة تفعيل المتجر يرجى التواصل مع إدارة الموقع أو الدعم الفني.
      </p>
      <a href="${whatsappUrl}" target="_blank" class="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3.5 px-6 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-600/20">
        <i class="fab fa-whatsapp text-xl"></i>
        <span>التواصل عبر واتساب</span>
      </a>
    </div>
  </div>
  `));
}

export function isStoreSubscriptionActive(storeData: any): boolean {
  if (!storeData) return false;
  if (storeData.status !== 'active') return false;
  if (storeData.subscription_status === 'expired' || storeData.subscription_status === 'pending_activation') return false;
  if (storeData.subscription_ends_at && new Date(storeData.subscription_ends_at) < new Date()) return false;
  return true;
}

function formatProductDescription(desc: string): string {
  if (!desc) return '';
  
  // Escape HTML to prevent XSS
  let escaped = desc
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
    
  const lines = escaped.split(/\r?\n/);
  let inList = false;
  const formattedLines = lines.map(line => {
    const trimmed = line.trim();
    
    // Match lists starting with -, *, ✓, or •
    const listMatch = trimmed.match(/^([-*✓•])\s*(.+)$/);
    
    if (listMatch) {
      const marker = listMatch[1];
      const content = listMatch[2];
      let icon = 'fa-circle text-[6px] text-primary-500';
      if (marker === '✓') icon = 'fa-check text-green-500 text-xs';
      
      let itemHtml = '';
      if (!inList) {
        inList = true;
        itemHtml += '<ul class="space-y-2 my-2.5 pr-2.5">';
      }
      itemHtml += `<li class="flex items-center gap-2.5 text-sub dark:text-gray-300 text-sm">
        <span class="flex-shrink-0 flex items-center justify-center"><i class="fas ${icon}"></i></span>
        <span>${content}</span>
      </li>`;
      return itemHtml;
    } else {
      let suffix = '';
      if (inList) {
        inList = false;
        suffix = '</ul>';
      }
      
      // Check if it looks like a section header (ends with : or starts with المواصفات/المميزات)
      if (trimmed.endsWith(':') || trimmed.startsWith('المواصفات') || trimmed.startsWith('المميزات')) {
        return suffix + `<h4 class="font-bold text-main dark:text-white text-sm mt-5 mb-2.5 flex items-center gap-2">
          <span class="w-1.5 h-3.5 bg-primary-600 rounded-full"></span>
          ${trimmed}
        </h4>`;
      }
      
      return suffix + (trimmed ? `<p class="mb-2 text-sub dark:text-gray-300 text-sm leading-relaxed">${trimmed}</p>` : '<div class="h-2"></div>');
    }
  });
  
  let result = formattedLines.join('\n');
  if (inList) {
    result += '</ul>';
  }
  
  return result;
}

function storeLayout(
  storeName: string,
  content: string,
  storeData: any,
  customer: any = null,
  scripts: string = '',
  headExtra: string = ''
): string {
  const primary = storeData.primary_color || '#4F46E5';
  const secondary = storeData.secondary_color || '#818CF8';

  // Build tracking codes
  let trackingCodes = '';
  if (storeData.google_analytics_id) {
    trackingCodes += `
    <!-- Google Analytics -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=${storeData.google_analytics_id}"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '${storeData.google_analytics_id}');
    </script>
    `;
  }
  if (storeData.meta_pixel_id) {
    trackingCodes += `
    <!-- Meta Pixel -->
    <script>
      !function(f,b,e,v,n,t,s)
      {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};
      if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
      n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t,s)}(window, document,'script',
      'https://connect.facebook.net/en_US/fbevents.js');
      fbq('init', '${storeData.meta_pixel_id}');
      fbq('track', 'PageView');
    </script>
    <noscript><img height="1" width="1" style="display:none"
      src="https://www.facebook.com/tr?id=${storeData.meta_pixel_id}&ev=PageView&noscript=1"
    /></noscript>
    `;
  }

  const faviconTag = storeData.favicon 
    ? `<link rel="icon" href="${storeData.favicon}"><link rel="shortcut icon" href="${storeData.favicon}"><link rel="apple-touch-icon" href="${storeData.favicon}">`
    : '';
  const combinedHead = trackingCodes + faviconTag + headExtra;

  return baseLayout(storeName, `
  <!-- Store Header -->
  <header class="sticky top-0 z-50 bg-card shadow-sm border-b border-std">
    <div class="max-w-7xl mx-auto px-4 sm:px-6">
      <div class="flex items-center justify-between h-16">
        <!-- Logo -->
        <a href="/store/${storeData.slug}" class="flex items-center gap-3 hover:opacity-80 transition-opacity">
          ${storeData.logo 
            ? `<img src="${getImageUrl(storeData.logo, DEFAULT_STORE_LOGO)}" alt="${storeName}" class="w-10 h-10 object-cover rounded-xl" onerror="this.onerror=null;this.src='${DEFAULT_STORE_LOGO}';">` 
            : `<div class="w-10 h-10 rounded-xl text-white flex items-center justify-center font-bold text-lg" style="background: ${primary};">${storeName[0]}</div>`
          }
          <span class="font-bold text-main text-lg">${storeName}</span>
        </a>

        <!-- Search Bar (Desktop) -->
        <div class="hidden md:flex flex-1 max-w-md mx-8">
          <div class="relative w-full">
            <input type="text" id="headerSearch" placeholder="ابحث عن منتج..."
              class="w-full pr-10 pl-4 py-2 border border-std rounded-xl text-sm focus:ring-2 focus:outline-none bg-page text-main"
              onkeypress="if(event.key==='Enter') searchProducts()">
            <button onclick="searchProducts()" class="absolute right-3 top-2.5 text-mute hover:text-sub">
              <i class="fas fa-search text-sm"></i>
            </button>
          </div>
        </div>

        <!-- Right: Cart + Dark Mode -->
        <div class="flex items-center gap-2">
          <!-- Dark Mode Toggle -->
          <button onclick="toggleTheme()"
                  class="w-9 h-9 rounded-xl bg-gray-100 dark:bg-slate-700 text-sub hover:text-main flex items-center justify-center transition-colors">
            <i class="fas fa-sun theme-sun text-sm"></i>
            <i class="fas fa-moon theme-moon text-sm hidden"></i>
          </button>

          <!-- Customer Notifications Bell -->
          <div class="relative" id="notifContainer">
            <button onclick="toggleNotifications()" 
                    class="relative w-9 h-9 rounded-xl bg-gray-100 dark:bg-slate-700 text-sub hover:text-main flex items-center justify-center transition-colors"
                    data-tooltip="الإشعارات">
              <i class="fas fa-bell text-sm"></i>
              <span id="notifBadge" class="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center hidden">0</span>
            </button>
            <div id="notifDropdown" class="hidden absolute left-0 top-12 w-80 sm:w-96 bg-card border border-std rounded-2xl shadow-xl z-50 overflow-hidden text-right">
              <div class="p-3.5 border-b border-std flex items-center justify-between bg-gray-50/50 dark:bg-slate-800/50">
                <div class="flex items-center gap-2">
                  <h3 class="font-bold text-main text-sm">الإشعارات</h3>
                  <span id="notifHeaderCount" class="text-xs bg-primary-100 text-primary-600 px-2 py-0.5 rounded-full font-bold">0</span>
                </div>
                <button onclick="markAllRead()" class="text-xs text-primary-600 hover:underline font-semibold">تحديد الكل كمقروء</button>
              </div>
              <div id="notifList" class="max-h-80 overflow-y-auto divide-y divide-std">
                <div class="p-6 text-center text-mute text-sm">
                  <i class="fas fa-bell-slash text-2xl mb-2 block opacity-40"></i>
                  لا توجد إشعارات حالياً
                </div>
              </div>
            </div>
          </div>

          <!-- Customer Account / Login -->
          ${customer 
            ? `<a href="/store/${storeData.slug}/account" class="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-page dark:bg-slate-800 text-sub hover:text-main transition-colors border border-std" data-tooltip="حسابي">
                 <i class="fas fa-user-circle text-base text-primary-500" style="color:${primary}"></i>
                 <span class="hidden md:inline text-xs font-semibold">${customer.name.split(' ')[0]}</span>
               </a>`
            : `<a href="/store/${storeData.slug}/login" class="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-page dark:bg-slate-800 text-sub hover:text-main transition-colors border border-std" data-tooltip="تسجيل دخول">
                 <i class="fas fa-sign-in-alt text-base"></i>
                 <span class="hidden md:inline text-xs font-semibold">دخول</span>
               </a>`
          }

          <!-- Cart -->
          <button onclick="openCart()" class="relative flex items-center gap-2 px-4 py-2 rounded-xl text-white transition-all hover:opacity-90"
            style="background: ${primary};">
            <i class="fas fa-shopping-cart text-sm"></i>
            <span class="hidden sm:inline text-sm font-medium">السلة</span>
            <span id="cartBadge" class="bg-red-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center hidden">0</span>
          </button>
        </div>
      </div>
    </div>
  </header>

  <!-- Main Content -->
  <main class="min-h-screen bg-page">
    ${content}
  </main>

  <!-- Footer -->
  <footer class="bg-gray-900 dark:bg-slate-950 text-white py-12 mt-16">
    <div class="max-w-7xl mx-auto px-4 sm:px-6">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div>
          <div class="flex items-center gap-3 mb-4">
            <div class="w-10 h-10 rounded-xl text-white flex items-center justify-center font-bold" style="background: ${primary};">
              ${storeName[0]}
            </div>
            <span class="font-bold text-lg">${storeName}</span>
          </div>
          <p class="text-mute text-sm leading-relaxed">${storeData.description || 'مرحباً بك في متجرنا'}</p>
        </div>
        <div>
          <h4 class="font-bold mb-4">روابط سريعة</h4>
          <ul class="space-y-2 text-sm text-mute">
            <li><a href="/store/${storeData.slug}" class="hover:text-white transition-colors">الرئيسية</a></li>
            <li><a href="/store/${storeData.slug}/products" class="hover:text-white transition-colors">جميع المنتجات</a></li>
            <li><a href="/store/${storeData.slug}/track" class="hover:text-white transition-colors">تتبع طلبك</a></li>
          </ul>
        </div>
        <div>
          <h4 class="font-bold mb-4">تواصل معنا</h4>
          <div class="flex flex-wrap gap-2.5">
            ${storeData.whatsapp ? `<a href="https://wa.me/${storeData.whatsapp.replace(/\D/g, '')}" target="_blank" title="محادثة واتساب" class="w-9 h-9 bg-green-600 rounded-lg flex items-center justify-center hover:bg-green-700 transition-colors text-white"><i class="fab fa-whatsapp text-base"></i></a>` : ''}
            ${storeData.whatsapp_group ? `<a href="${storeData.whatsapp_group.startsWith('http') ? storeData.whatsapp_group : 'https://' + storeData.whatsapp_group}" target="_blank" title="قروب الواتساب" class="w-9 h-9 bg-emerald-600 rounded-lg flex items-center justify-center hover:bg-emerald-700 transition-colors text-white" data-tooltip="قروب الواتساب"><i class="fas fa-users text-sm"></i></a>` : ''}
            ${storeData.instagram ? `<a href="https://instagram.com/${storeData.instagram.replace('@', '')}" target="_blank" title="إنستغرام" class="w-9 h-9 bg-pink-600 rounded-lg flex items-center justify-center hover:bg-pink-700 transition-colors text-white"><i class="fab fa-instagram text-base"></i></a>` : ''}
            ${storeData.twitter ? `<a href="https://twitter.com/${storeData.twitter.replace('@', '')}" target="_blank" title="تويتر" class="w-9 h-9 bg-blue-400 rounded-lg flex items-center justify-center hover:bg-blue-500 transition-colors text-white"><i class="fab fa-twitter text-base"></i></a>` : ''}
            ${storeData.facebook ? `<a href="${storeData.facebook.startsWith('http') ? storeData.facebook : 'https://facebook.com/' + storeData.facebook}" target="_blank" title="فيسبوك" class="w-9 h-9 bg-blue-700 rounded-lg flex items-center justify-center hover:bg-blue-800 transition-colors text-white"><i class="fab fa-facebook-f text-base"></i></a>` : ''}
          </div>
          ${storeData.phone ? `<p class="mt-3 text-sm text-mute"><i class="fas fa-phone ml-2"></i>${storeData.phone}</p>` : ''}
          ${storeData.email ? `<p class="mt-1 text-sm text-mute"><i class="fas fa-envelope ml-2"></i>${storeData.email}</p>` : ''}
        </div>
      </div>
      <div class="border-t border-gray-800 mt-8 pt-6 pb-16 sm:pb-0 text-center text-sm text-mute">
        <p>جميع الحقوق محفوظة © ${new Date().getFullYear()} ${storeName} | مدعوم بـ <a href="/" class="text-primary-400 hover:underline">منصة سوق</a></p>
      </div>
    </div>
  </footer>

  <!-- Mobile Bottom Navigation Bar -->
  <nav class="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-std px-4 py-2 flex items-center justify-around shadow-2xl backdrop-blur-md bg-opacity-95">
    <a href="/store/${storeData.slug}" class="flex flex-col items-center gap-1 text-xs text-sub hover:text-primary-600 transition-colors">
      <i class="fas fa-home text-base" style="color:${primary}"></i>
      <span class="font-semibold">الرئيسية</span>
    </a>
    <a href="/store/${storeData.slug}/products" class="flex flex-col items-center gap-1 text-xs text-sub hover:text-primary-600 transition-colors">
      <i class="fas fa-th-large text-base"></i>
      <span>المنتجات</span>
    </a>
    <button onclick="openCart()" class="relative flex flex-col items-center gap-1 text-xs text-sub hover:text-primary-600 transition-colors">
      <i class="fas fa-shopping-cart text-base"></i>
      <span>السلة</span>
      <span id="mobileCartBadge" class="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center hidden">0</span>
    </button>
    <a href="${customer ? `/store/${storeData.slug}/account` : `/store/${storeData.slug}/login`}" class="flex flex-col items-center gap-1 text-xs text-sub hover:text-primary-600 transition-colors">
      <i class="fas fa-user text-base"></i>
      <span>${customer ? 'حسابي' : 'دخول'}</span>
    </a>
  </nav>

  <!-- Cart Sidebar -->
  <div id="cartOverlay" onclick="closeCart()" class="fixed inset-0 bg-black/50 z-40 hidden"></div>
  <div id="cartSidebar" style="transform: translateX(-100%);" class="fixed left-0 top-0 h-full w-full sm:w-96 bg-card border-r border-std shadow-2xl z-50 transition-transform duration-300 flex flex-col">
    <div class="flex items-center justify-between p-5 border-b border-std">
      <h3 class="font-bold text-main text-lg">سلة التسوق</h3>
      <button onclick="closeCart()" class="text-mute hover:text-sub text-xl">
        <i class="fas fa-times"></i>
      </button>
    </div>
    <div id="cartItems" class="flex-1 overflow-y-auto p-4 space-y-3"></div>
    <div class="p-5 border-t border-std bg-page">
      <div class="flex justify-between items-center mb-4">
        <span class="font-medium text-sub">الإجمالي</span>
        <span id="cartTotal" class="font-bold text-xl text-main">0 ${storeData.currency}</span>
      </div>
      <button onclick="proceedToCheckout()" id="checkoutBtn"
        class="w-full text-white font-semibold py-3 rounded-xl transition-all hover:opacity-90 disabled:opacity-50"
        style="background: ${primary};">
        إتمام الطلب
      </button>
    </div>
  </div>

  <!-- Checkout Modal -->
  <div id="checkoutModal" class="fixed inset-0 bg-black/60 flex items-center justify-center z-50 hidden p-4">
    <div class="bg-card border border-std rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
      <div class="p-6 border-b border-std flex items-center justify-between">
        <h3 class="font-bold text-main text-lg">إتمام الطلب</h3>
        <button onclick="closeCheckout()" class="text-mute hover:text-sub">
          <i class="fas fa-times text-xl"></i>
        </button>
      </div>
      <div class="p-6">
        <form id="checkoutForm">
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-sub mb-1">الاسم الكامل *</label>
              <input type="text" id="ckName" required placeholder="محمد أحمد" value="${customer ? customer.name : ''}"
                class="w-full px-4 py-2.5 border border-std rounded-xl focus:ring-2 focus:outline-none">
            </div>
            <div>
              <label class="block text-sm font-medium text-sub mb-1">رقم الهاتف *</label>
              <input type="tel" id="ckPhone" required placeholder="0500000000" dir="ltr" value="${customer ? customer.phone : ''}"
                class="w-full px-4 py-2.5 border border-std rounded-xl focus:ring-2 focus:outline-none">
            </div>
            <div>
              <label class="block text-sm font-medium text-sub mb-1">البريد الإلكتروني</label>
              <input type="email" id="ckEmail" placeholder="you@example.com" dir="ltr" value="${customer ? customer.email || '' : ''}"
                class="w-full px-4 py-2.5 border border-std rounded-xl focus:ring-2 focus:outline-none">
            </div>
            <div>
              <label class="block text-sm font-medium text-sub mb-1">المدينة</label>
              <input type="text" id="ckCity" placeholder="الرياض" value="${customer ? customer.city || '' : ''}"
                class="w-full px-4 py-2.5 border border-std rounded-xl focus:ring-2 focus:outline-none">
            </div>
            <div>
              <label class="block text-sm font-medium text-sub mb-1">العنوان</label>
              <textarea id="ckAddress" rows="2" placeholder="الحي، الشارع، رقم المبنى..."
                class="w-full px-4 py-2.5 border border-std rounded-xl focus:ring-2 focus:outline-none resize-none">${customer ? customer.address || '' : ''}</textarea>
            </div>
            <div>
              <label class="block text-sm font-medium text-sub mb-1">ملاحظات إضافية</label>
              <textarea id="ckNotes" rows="2" placeholder="أي ملاحظات خاصة بطلبك..."
                class="w-full px-4 py-2.5 border border-std rounded-xl focus:ring-2 focus:outline-none resize-none"></textarea>
            </div>

            <!-- Coupon Field -->
            <div class="border border-dashed border-gray-300 rounded-xl p-3.5">
              <label class="block text-sm font-medium text-sub mb-2"><i class="fas fa-ticket-alt ml-1 text-yellow-500"></i>كود الخصم (اختياري)</label>
              <div class="flex gap-2">
                <input type="text" id="ckCoupon" placeholder="أدخل كود الكوبون" dir="ltr"
                  class="flex-1 px-3 py-2 border border-std rounded-xl focus:ring-2 focus:outline-none text-sm uppercase">
                <button type="button" onclick="applyCoupon()"
                  class="px-4 py-2 text-white text-sm font-semibold rounded-xl transition-all hover:opacity-90 whitespace-nowrap"
                  style="background: ${primary};">تطبيق</button>
              </div>
              <div id="couponMsg" class="text-xs mt-1.5 hidden"></div>
            </div>
          </div>
          
          <!-- Order Summary -->
          <div class="mt-5 p-4 bg-page rounded-xl">
            <h4 class="font-medium text-sub mb-3 text-sm">ملخص الطلب</h4>
            <div id="checkoutSummary" class="space-y-2 text-sm"></div>
            <div id="discountRow" class="hidden flex justify-between text-sm text-green-600 font-semibold mt-1">
              <span><i class="fas fa-tag ml-1"></i>خصم الكوبون</span>
              <span id="discountVal">-0</span>
            </div>
            <div id="shippingRow" class="flex justify-between text-sm text-sub mt-1">
              <span><i class="fas fa-truck ml-1"></i>الشحن والتوصيل</span>
              <span id="shippingVal">0 ${storeData.currency}</span>
            </div>
            <div class="border-t border-std mt-3 pt-3 flex justify-between font-bold">
              <span>الإجمالي النهائي</span>
              <span id="checkoutTotal" class="text-primary-600"></span>
            </div>
          </div>

          <!-- Payment Method Selection -->
          <div class="mt-5 space-y-3">
            <h4 class="font-medium text-sub mb-2 text-sm">طريقة الدفع *</h4>
            
            <label class="flex items-center gap-3 p-3 border border-std rounded-xl cursor-pointer hover:bg-page transition-colors">
              <input type="radio" name="payment_method" value="cod" checked onchange="togglePaymentDetails()" class="w-4 h-4 text-primary-600 focus:ring-primary-500">
              <span class="flex-1 font-medium text-main text-sm">الدفع عند الاستلام</span>
              <i class="fas fa-hand-holding-usd text-gray-400"></i>
            </label>

            <label class="flex items-center gap-3 p-3 border border-std rounded-xl cursor-pointer hover:bg-page transition-colors">
              <input type="radio" name="payment_method" value="receipt" onchange="togglePaymentDetails()" class="w-4 h-4 text-primary-600 focus:ring-primary-500">
              <span class="flex-1 font-medium text-main text-sm">الدفع بإرفاق سند</span>
              <i class="fas fa-file-invoice-dollar text-gray-400"></i>
            </label>
          </div>

          <!-- Bank Transfer Details (Hidden by default) -->
          <div id="bankTransferDetails" class="hidden mt-4 p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-4">
            <h5 class="text-sm font-bold text-main">الحسابات البنكية والمحافظ المالية</h5>
            <p class="text-xs text-sub">يرجى تحويل المبلغ لأحد الحسابات التالية ثم إرفاق صورة السند:</p>
            <div id="bankAccountsList" class="space-y-2">
              <!-- Dynamically populated from storeData.bank_accounts -->
            </div>
            
            <div class="mt-4">
              <label class="block text-sm font-medium text-sub mb-1">إرفاق سند التحويل *</label>
              <input type="file" id="ckReceiptImage" accept="image/*" class="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 cursor-pointer border border-std rounded-xl p-2 bg-white">
            </div>
          </div>

          <!-- Submit Button -->
          <div class="mt-6">
            <button type="submit" id="submitOrderBtn"
              class="w-full text-white font-semibold py-3 rounded-xl transition-all hover:opacity-90"
              style="background: linear-gradient(135deg, ${primary}, ${secondary});">
              <i class="fas fa-check-circle ml-2"></i> تأكيد الطلب
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
  `, {
    scripts: `
  <script>
    const STORE_SLUG = '${storeData.slug}';
    const CURRENCY = '${storeData.currency}';
    const PRIMARY_COLOR = '${primary}';
    let cart = JSON.parse(localStorage.getItem('cart_${storeData.slug}') || '[]');
    
    function saveCart() { localStorage.setItem('cart_${storeData.slug}', JSON.stringify(cart)); }
    
    function addToCart(id, name, price, image, variant = '') {
      const cartKey = id + (variant ? '_' + variant : '');
      const existing = cart.find(i => (i.cartKey || i.id) === cartKey);
      if (existing) { existing.qty++; } 
      else { cart.push({ cartKey, id, name, price, image, qty: 1, variant }); }
      saveCart();
      updateCartUI();
      openCart();
      showToast(name + (variant ? ' (' + variant + ')' : '') + ' أُضيف للسلة ✓', 'success');
    }

    function removeFromCart(cartKey) {
      cart = cart.filter(i => (i.cartKey || i.id) !== cartKey);
      saveCart();
      updateCartUI();
    }

    function updateQty(cartKey, delta) {
      const item = cart.find(i => (i.cartKey || i.id) === cartKey);
      if (!item) return;
      item.qty += delta;
      if (item.qty <= 0) removeFromCart(cartKey);
      else { saveCart(); updateCartUI(); }
    }

    function getCartTotal() {
      return cart.reduce((sum, i) => sum + (i.price * i.qty), 0);
    }

    function updateCartUI() {
      const count = cart.reduce((sum, i) => sum + i.qty, 0);
      const badge = document.getElementById('cartBadge');
      if (badge) {
        badge.textContent = count;
        badge.classList.toggle('hidden', count === 0);
      }
      
      const cartItems = document.getElementById('cartItems');
      if (cartItems) {
        if (cart.length === 0) {
          cartItems.innerHTML = '<div class="text-center py-12 text-mute"><i class="fas fa-shopping-cart text-4xl mb-3 block"></i><p>السلة فارغة</p></div>';
        } else {
          cartItems.innerHTML = cart.map(item => {
            const key = item.cartKey || item.id;
            return \`
            <div class="flex items-center gap-3 bg-page rounded-xl p-3">
              <img src="\${item.image || '${DEFAULT_PRODUCT_IMAGE}'}" alt="\${item.name}" 
                   class="w-14 h-14 object-cover rounded-lg flex-shrink-0"
                   onerror="handleImgError(this)">
              <div class="flex-1 min-w-0">
                <p class="font-medium text-main text-sm line-clamp-1">\${item.name}</p>
                \${item.variant ? \`<p class="text-[10px] text-mute font-semibold mb-0.5">\${item.variant}</p>\` : ''}
                <p class="text-primary-600 font-bold text-sm">\${item.price.toLocaleString('ar-SA')} \${CURRENCY}</p>
              </div>
              <div class="flex items-center gap-2">
                <button onclick="updateQty('\${key}', -1)" class="w-7 h-7 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-sm transition-colors">-</button>
                <span class="font-bold text-sm w-5 text-center">\${item.qty}</span>
                <button onclick="updateQty('\${key}', 1)" class="w-7 h-7 rounded-full text-white flex items-center justify-center text-sm transition-colors" style="background:\${PRIMARY_COLOR}">+</button>
                <button onclick="removeFromCart('\${key}')" class="w-7 h-7 rounded-full bg-red-100 hover:bg-red-200 text-red-500 flex items-center justify-center text-sm ml-1 transition-colors"><i class="fas fa-trash text-xs"></i></button>
              </div>
            </div>\`;
          }).join('');
        }
      }

      const total = getCartTotal();
      const cartTotalEl = document.getElementById('cartTotal');
      if (cartTotalEl) cartTotalEl.textContent = total.toLocaleString('ar-SA') + ' ' + CURRENCY;
    }

    function openCart() {
      const sidebar = document.getElementById('cartSidebar');
      if (sidebar) sidebar.style.transform = 'translateX(0)';
      document.getElementById('cartOverlay')?.classList.remove('hidden');
    }
    
    function closeCart() {
      const sidebar = document.getElementById('cartSidebar');
      if (sidebar) sidebar.style.transform = 'translateX(-100%)';
      document.getElementById('cartOverlay')?.classList.add('hidden');
    }

    let appliedCoupon = null; // { coupon_id, discount, code }

    const IS_CUSTOMER_LOGGED_IN = ${!!customer};

    function proceedToCheckout() {
      if (cart.length === 0) return showToast('السلة فارغة', 'error');
      if (!IS_CUSTOMER_LOGGED_IN) {
        showToast('يرجى تسجيل الدخول أولاً لإتمام الطلب', 'info');
        setTimeout(() => {
          window.location.href = '/store/' + STORE_SLUG + '/login?redirect=/store/' + STORE_SLUG + '/checkout';
        }, 800);
        return;
      }
      window.location.href = '/store/' + STORE_SLUG + '/checkout';
    }

    function openCheckout() {
      appliedCoupon = null;
      const couponMsg = document.getElementById('couponMsg');
      const discountRow = document.getElementById('discountRow');
      if (couponMsg) { couponMsg.classList.add('hidden'); couponMsg.textContent = ''; }
      if (discountRow) discountRow.classList.add('hidden');
      const couponInput = document.getElementById('ckCoupon');
      if (couponInput) couponInput.value = '';

      const summary = document.getElementById('checkoutSummary');
      if (summary) {
        summary.innerHTML = cart.map(item => \`
          <div class="flex justify-between text-sub">
            <span>\${item.name} × \${item.qty}</span>
            <span>\${(item.price * item.qty).toLocaleString('ar-SA')} \${CURRENCY}</span>
          </div>
        \`).join('');
      }
      updateCheckoutTotal();
      document.getElementById('checkoutModal')?.classList.remove('hidden');
    }

    const SHIPPING_RATES = ${storeData.shipping_rates || '[]'};

    function getShippingCost(city) {
      if (!city) return 0;
      const cleanCity = city.trim().toLowerCase();
      const match = SHIPPING_RATES.find(r => r.city.trim().toLowerCase() === cleanCity);
      if (match) return match.cost;
      const fallback = SHIPPING_RATES.find(r => r.city.trim().toLowerCase() === 'الكل' || r.city.trim() === 'all');
      if (fallback) return fallback.cost;
      return 0;
    }

    function updateCheckoutTotal() {
      const subtotal = getCartTotal();
      const discount = appliedCoupon ? appliedCoupon.discount : 0;
      const city = document.getElementById('ckCity')?.value || '';
      const shippingCost = getShippingCost(city);

      const shippingVal = document.getElementById('shippingVal');
      if (shippingVal) {
        shippingVal.textContent = shippingCost > 0 ? shippingCost.toLocaleString('ar-SA') + ' ' + CURRENCY : 'شحن مجاني';
      }

      const finalTotal = Math.max(0, subtotal - discount + shippingCost);
      const totalEl = document.getElementById('checkoutTotal');
      if (totalEl) totalEl.textContent = finalTotal.toLocaleString('ar-SA') + ' ' + CURRENCY;

      const discountRow = document.getElementById('discountRow');
      const discountVal = document.getElementById('discountVal');
      if (discountRow && discountVal) {
        if (discount > 0) {
          discountRow.classList.remove('hidden');
          discountVal.textContent = '-' + discount.toLocaleString('ar-SA') + ' ' + CURRENCY;
        } else {
          discountRow.classList.add('hidden');
        }
      }
    }

    // Attach city input listener to dynamically calculate shipping cost
    setTimeout(() => {
      document.getElementById('ckCity')?.addEventListener('input', updateCheckoutTotal);
    }, 100);

    async function applyCoupon() {
      const code = document.getElementById('ckCoupon')?.value?.trim();
      const msgEl = document.getElementById('couponMsg');
      if (!code) return;
      msgEl.className = 'text-xs mt-1.5 text-mute';
      msgEl.textContent = 'جاري التحقق...';
      msgEl.classList.remove('hidden');

      try {
        const res = await fetch('/api/dashboard/coupons/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, store_id: ${storeData.id}, order_total: getCartTotal() })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message);

        appliedCoupon = { coupon_id: data.coupon_id, discount: data.discount, code };
        msgEl.className = 'text-xs mt-1.5 text-green-600 font-semibold';
        msgEl.textContent = '✓ تم تطبيق الكوبون! خصم ' + data.discount.toLocaleString('ar-SA') + ' ' + CURRENCY;
        updateCheckoutTotal();
      } catch(err) {
        appliedCoupon = null;
        msgEl.className = 'text-xs mt-1.5 text-red-500';
        msgEl.textContent = '✗ ' + (err.message || 'كوبون غير صحيح');
        updateCheckoutTotal();
      }
    }

    const BANK_ACCOUNTS = ${storeData.bank_accounts || '[]'};

    function togglePaymentDetails() {
      const method = document.querySelector('input[name="payment_method"]:checked')?.value;
      const detailsDiv = document.getElementById('bankTransferDetails');
      if (method === 'receipt') {
        detailsDiv.classList.remove('hidden');
        renderBankAccounts();
      } else {
        detailsDiv.classList.add('hidden');
      }
    }

    function renderBankAccounts() {
      const list = document.getElementById('bankAccountsList');
      if (!list) return;
      if (BANK_ACCOUNTS.length === 0) {
        list.innerHTML = '<p class="text-xs text-red-500">لا توجد حسابات بنكية مضافة حالياً.</p>';
        return;
      }
      list.innerHTML = BANK_ACCOUNTS.map(b => \`
        <div class="flex justify-between items-center bg-white p-3 border border-gray-200 rounded-lg shadow-sm">
          <div>
            <p class="text-sm font-bold text-gray-800">\${b.bank_name}</p>
            <p class="text-xs text-gray-500 font-mono mt-0.5" id="acc_\${b.account_number}">\${b.account_number}</p>
          </div>
          <button type="button" onclick="copyToClipboard('\${b.account_number}')" class="text-primary-600 hover:bg-primary-50 p-2 rounded-lg transition-colors text-xs flex items-center gap-1 border border-primary-100">
            <i class="fas fa-copy"></i> نسخ
          </button>
        </div>
      \`).join('');
    }

    function copyToClipboard(text) {
      navigator.clipboard.writeText(text).then(() => {
        showToast('تم نسخ رقم الحساب بنجاح', 'success');
      });
    }

    async function submitOrder() {
      const method = document.querySelector('input[name="payment_method"]:checked')?.value || 'cod';
      const btn = document.getElementById('submitOrderBtn');
      const originalHtml = btn?.innerHTML;
      
      const receiptInput = document.getElementById('ckReceiptImage');
      let receiptImageUrl = null;

      if (method === 'receipt') {
        if (!receiptInput.files || receiptInput.files.length === 0) {
          return showToast('يرجى إرفاق صورة سند التحويل أولاً', 'error');
        }
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin ml-2"></i>جاري رفع السند...'; }
        
        try {
          const formData = new FormData();
          formData.append('file', receiptInput.files[0]);
          const upRes = await fetch('/api/upload', { method: 'POST', body: formData });
          const upData = await upRes.json();
          if (!upRes.ok) throw new Error(upData.message || 'فشل رفع السند');
          receiptImageUrl = upData.url;
        } catch (err) {
          if (btn) { btn.disabled = false; btn.innerHTML = originalHtml; }
          return showToast(err.message, 'error');
        }
      }

      if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin ml-2"></i>جاري الإرسال...'; }

      try {
        const orderPayload = {
          customer_name: document.getElementById('ckName').value,
          customer_phone: document.getElementById('ckPhone').value,
          customer_email: document.getElementById('ckEmail').value,
          shipping_city: document.getElementById('ckCity').value,
          shipping_address: document.getElementById('ckAddress').value,
          notes: document.getElementById('ckNotes').value,
          items: cart.map(i => ({ product_id: i.id, quantity: i.qty, variant: i.variant || '' })),
          coupon_id: appliedCoupon ? (appliedCoupon.coupon_id || appliedCoupon.id) : null,
          discount_amount: appliedCoupon ? (appliedCoupon.discount || appliedCoupon.discount_amount || 0) : 0,
          payment_method: method,
          receipt_image: receiptImageUrl
        };

        const res = await fetch('/api/store/' + STORE_SLUG + '/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(orderPayload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'خطأ');

        cart = [];
        saveCart();
        updateCartUI();
        closeCheckout();

        document.body.innerHTML = \`
          <div class="min-h-screen flex items-center justify-center bg-page p-4">
            <div class="bg-card rounded-2xl shadow-xl p-10 text-center max-w-md w-full">
              <div class="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <i class="fas fa-check text-green-500 text-3xl"></i>
              </div>
              <h2 class="text-2xl font-bold text-main mb-2">تم استلام طلبك! 🎉</h2>
              <p class="text-mute mb-3">رقم الطلب: <strong style="color:${primary}">\${data.order_number}</strong></p>
              \${method === 'receipt' ? '<p class="text-orange-600 bg-orange-50 p-2 rounded-lg mb-3 text-sm font-semibold">بانتظار مراجعة السند المرفق لتأكيد الدفع</p>' : ''}
              <p class="text-mute mb-6">سيتواصل معك المتجر قريباً</p>
              <a href="/store/${storeData.slug}" class="text-white font-semibold px-8 py-3 rounded-xl transition-all hover:opacity-90 inline-block" 
                 style="background: ${primary};">
                العودة للمتجر
              </a>
            </div>
          </div>
        \`;
      } catch(err) {
        if (btn) { btn.disabled = false; btn.innerHTML = originalHtml; }
        showToast(err.message || 'خطأ في إرسال الطلب', 'error');
      }
    }

    document.getElementById('checkoutForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!document.getElementById('ckName').value || !document.getElementById('ckPhone').value) {
        return showToast('الاسم ورقم الهاتف مطلوبان', 'error');
      }
      await submitOrder();
    });



    // Initialize
    updateCartUI();
  </script>
  ${scripts ? `<script>\n${scripts}\n  </script>` : ''}
    `
  }, { headExtra: combinedHead });
}

// ─── Store Home Page ──────────────────────────────────────────
store.get('/:slug', async (c) => {
  const slug = c.req.param('slug');
  
  const storeData = await c.env.DB.prepare(
    "SELECT * FROM stores WHERE slug = ?"
  ).bind(slug).first() as any;

  if (!storeData) {
    return c.html(baseLayout('متجر غير موجود', `
    <div class="min-h-screen flex items-center justify-center bg-page">
      <div class="text-center p-8">
        <i class="fas fa-store-slash text-6xl text-gray-300 mb-4 block"></i>
        <h2 class="text-2xl font-bold text-sub mb-2">المتجر غير موجود</h2>
        <p class="text-mute mb-6">الرابط الذي طلبته غير صحيح أو تم حذف المتجر</p>
        <a href="/" class="bg-primary-600 text-white px-6 py-2.5 rounded-xl hover:bg-primary-700 transition-colors">
          العودة للرئيسية
        </a>
      </div>
    </div>
    `));
  }

  // Enforce subscription expiration & status
  if (!isStoreSubscriptionActive(storeData)) {
    return await renderExpiredStorePage(c, storeData);
  }

  const customer = await getLoggedInCustomer(c, storeData.id);
  const primary = storeData.primary_color || '#4F46E5';

  // Featured products
  const featuredProducts = await c.env.DB.prepare(`
    SELECT p.*, COALESCE(p.image, (SELECT url FROM product_images WHERE product_id = p.id ORDER BY is_primary DESC, id ASC LIMIT 1)) as primary_image FROM products p
    WHERE p.store_id = ? AND p.status = 'active'
    ORDER BY p.id DESC LIMIT 8
  `).bind(storeData.id).all();

  // All products (latest)
  const latestProducts = await c.env.DB.prepare(`
    SELECT p.*, COALESCE(p.image, (SELECT url FROM product_images WHERE product_id = p.id ORDER BY is_primary DESC, id ASC LIMIT 1)) as primary_image, c.name as cat_name FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.store_id = ? AND p.status = 'active'
    ORDER BY p.id DESC LIMIT 12
  `).bind(storeData.id).all();

  // Categories
  const categories = await c.env.DB.prepare(
    "SELECT c.*, COUNT(p.id) as count FROM categories c LEFT JOIN products p ON p.category_id = c.id AND p.status = 'active' WHERE c.store_id = ? GROUP BY c.id ORDER BY count DESC LIMIT 6"
  ).bind(storeData.id).all();

  // Active flash sales
  const nowIso = new Date().toISOString();
  const activeFlashSales = await c.env.DB.prepare(`
    SELECT * FROM flash_sales
    WHERE store_id = ? AND is_active = 1
      AND (
        (start_at IS NOT NULL AND start_at <= ? AND end_at >= ?) OR
        (starts_at IS NOT NULL AND starts_at <= ? AND ends_at >= ?)
      )
      AND (max_quantity IS NULL OR sold_quantity < max_quantity)
  `).bind(storeData.id, nowIso, nowIso, nowIso, nowIso).all();
  const flashSalesMap = new Map((activeFlashSales.results as any[]).map(s => [s.product_id, s]));

  function productCard(product: any): string {
    const flashSale = flashSalesMap.get(product.id);
    let price = product.sale_price || product.price;
    let hasDiscount = !!product.sale_price;
    let discountLabel = '';

    if (flashSale) {
      hasDiscount = true;
      price = flashSale.discount_type === 'percentage' 
        ? product.price * (1 - flashSale.discount_value / 100)
        : Math.max(0, product.price - flashSale.discount_value);
      discountLabel = flashSale.discount_type === 'percentage'
        ? `⚡ عرض ${flashSale.discount_value}%`
        : `⚡ خصم ${flashSale.discount_value} ${storeData.currency}`;
    } else if (product.sale_price) {
      discountLabel = `خصم ${Math.round((1 - product.sale_price / product.price) * 100)}%`;
    }

    return `
    <div class="bg-card rounded-2xl overflow-hidden shadow-sm card-hover border border-std cursor-pointer" 
         onclick="window.location.href='/store/${slug}/products/${product.id}'">
      <div class="relative aspect-square bg-page overflow-hidden">
        <img src="${getImageUrl(product.image || product.primary_image, DEFAULT_PRODUCT_IMAGE)}" 
             alt="${product.name}" class="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
             onerror="handleImgError(this)">
        ${hasDiscount ? `
          <div class="absolute top-2 right-2 ${flashSale ? 'bg-red-600' : 'bg-red-500'} text-white text-xs font-bold px-2 py-1 rounded-full shadow-md z-10">
            ${discountLabel}
          </div>` : ''}
        ${product.stock === 0 ? '<div class="absolute inset-0 bg-black/40 flex items-center justify-center z-10"><span class="bg-card text-sub text-xs font-bold px-3 py-1 rounded-full">نفد المخزون</span></div>' : ''}
      </div>
      <div class="p-4">
        <p class="text-xs text-mute mb-1">${product.cat_name || product.category_name || ''}</p>
        <h3 class="font-semibold text-main text-sm line-clamp-2 mb-2">${product.name}</h3>
        <div class="flex items-center justify-between">
          <div>
            <span class="font-bold text-base" style="color: ${primary};">${formatCurrency(price, storeData.currency)}</span>
            ${hasDiscount ? `<span class="text-mute line-through text-xs mr-1">${formatCurrency(product.price, storeData.currency)}</span>` : ''}
          </div>
          ${product.stock > 0 ? `
          <button onclick="event.stopPropagation(); addToCart(${product.id}, '${product.name.replace(/'/g, "\\'")}', ${price}, '${getImageUrl(product.image || product.primary_image, DEFAULT_PRODUCT_IMAGE)}')"
            class="w-9 h-9 rounded-xl text-white flex items-center justify-center hover:opacity-80 transition-all text-sm shadow"
            style="background: ${primary};">
            <i class="fas fa-plus"></i>
          </button>` : ''}
        </div>
      </div>
    </div>`;
  }

  return c.html(storeLayout(storeData.name, `
  <!-- Hero Banner -->
  <div class="relative overflow-hidden py-16 px-6" style="background: linear-gradient(135deg, ${primary}15, ${storeData.secondary_color}15);">
    <div class="max-w-7xl mx-auto">
      <div class="max-w-2xl">
        <h1 class="text-4xl sm:text-5xl font-black text-main mb-4 leading-tight">
          أهلاً في <span style="color: ${primary};">${storeData.name}</span>
        </h1>
        <p class="text-lg text-sub mb-8">${storeData.description || 'تسوق أفضل المنتجات بأسعار رائعة'}</p>
        <div class="flex flex-col sm:flex-row gap-3">
          <a href="/store/${slug}/products" 
             class="text-white font-semibold px-8 py-3 rounded-xl transition-all hover:opacity-90 flex items-center gap-2 justify-center"
             style="background: ${primary};">
            <i class="fas fa-shopping-bag"></i>
            تسوق الآن
          </a>
          <div class="flex flex-1">
            <input type="text" id="heroSearch" placeholder="ابحث عن أي منتج..."
              class="flex-1 px-4 py-3 border border-std rounded-r-xl text-sm focus:outline-none"
              onkeypress="if(event.key==='Enter') document.getElementById('headerSearch').value=this.value; searchProducts()">
            <button onclick="document.getElementById('headerSearch').value=document.getElementById('heroSearch').value; searchProducts()"
              class="text-white px-5 rounded-l-xl transition-all hover:opacity-90"
              style="background: ${primary};">
              <i class="fas fa-search"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
    <!-- Decorative circles -->
    <div class="absolute -left-16 -top-16 w-64 h-64 rounded-full opacity-10" style="background: ${primary};"></div>
    <div class="absolute -right-8 -bottom-8 w-48 h-48 rounded-full opacity-5" style="background: ${storeData.secondary_color};"></div>
  </div>

  <div class="max-w-7xl mx-auto px-4 sm:px-6 py-10">
    <!-- Categories -->
    ${(categories.results as any[]).length > 0 ? `
    <section class="mb-12">
      <h2 class="text-2xl font-bold text-main mb-6">تصفح التصنيفات</h2>
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        ${(categories.results as any[]).map(cat => `
        <a href="/store/${slug}/products?category=${cat.id}"
           class="bg-card rounded-2xl p-5 text-center shadow-sm border border-std card-hover hover:border-primary-400 transition-all">
          <div class="w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center" style="background: ${primary}20;">
            <i class="fas fa-folder text-xl" style="color: ${primary};"></i>
          </div>
          <p class="font-medium text-sub text-sm">${cat.name}</p>
          <p class="text-mute text-xs mt-1">${cat.count} منتج</p>
        </a>
        `).join('')}
      </div>
    </section>
    ` : ''}

    <!-- Featured Products -->
    ${(featuredProducts.results as any[]).length > 0 ? `
    <section class="mb-12">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h2 class="text-2xl font-bold text-main">منتجات مميزة</h2>
          <p class="text-mute text-sm mt-1">أفضل اختياراتنا لك</p>
        </div>
        <a href="/store/${slug}/products" class="text-sm font-medium hover:underline" style="color: ${primary};">
          عرض الكل <i class="fas fa-arrow-left text-xs"></i>
        </a>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        ${(featuredProducts.results as any[]).map((p: any) => productCard(p)).join('')}
      </div>
    </section>
    ` : ''}

    <!-- Latest Products -->
    <section>
      <div class="flex items-center justify-between mb-6">
        <div>
          <h2 class="text-2xl font-bold text-main">أحدث المنتجات</h2>
          <p class="text-mute text-sm mt-1">تشكيلة جديدة من أفضل المنتجات</p>
        </div>
        <a href="/store/${slug}/products" class="text-sm font-medium hover:underline" style="color: ${primary};">
          عرض الكل <i class="fas fa-arrow-left text-xs"></i>
        </a>
      </div>
      ${(latestProducts.results as any[]).length > 0 ? `
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        ${(latestProducts.results as any[]).map((p: any) => productCard(p)).join('')}
      </div>` : `
      <div class="text-center py-16 bg-card rounded-2xl border border-std">
        <i class="fas fa-box text-5xl text-gray-200 mb-4 block"></i>
        <p class="text-mute text-lg">لا توجد منتجات متاحة حالياً</p>
      </div>
      `}
    </section>
  </div>
  `, storeData, customer));
});

// ─── Products Page ────────────────────────────────────────────
store.get('/:slug/products', async (c) => {
  const slug = c.req.param('slug');
  const storeData = await c.env.DB.prepare(
    "SELECT * FROM stores WHERE slug = ? AND status = 'active'"
  ).bind(slug).first() as any;

  if (!storeData) return c.redirect('/');

  const customer = await getLoggedInCustomer(c, storeData.id);
  const primary = storeData.primary_color || '#4F46E5';
  const categoryId = c.req.query('category') || '';
  const search = c.req.query('search') || '';
  const sort = c.req.query('sort') || 'newest';
  const page = parseInt(c.req.query('page') || '1');
  const perPage = 12;
  const offset = (page - 1) * perPage;

  let query = `SELECT p.*, COALESCE(p.image,
      (SELECT url FROM product_images WHERE product_id = p.id ORDER BY is_primary DESC, id ASC LIMIT 1)
    ) as primary_image, c.name as cat_name FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.store_id = ? AND p.status = 'active'`;
  const params: any[] = [storeData.id];

  if (categoryId) { query += ' AND p.category_id = ?'; params.push(categoryId); }
  if (search) { query += ' AND (p.name LIKE ? OR p.description LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }

  const sortMap: Record<string, string> = {
    newest: 'p.created_at DESC',
    oldest: 'p.created_at ASC',
    price_asc: 'p.price ASC',
    price_desc: 'p.price DESC',
    popular: 'p.total_sold DESC',
  };
  query += ` ORDER BY ${sortMap[sort] || 'p.created_at DESC'} LIMIT ${perPage} OFFSET ${offset}`;

  const products = await c.env.DB.prepare(query).bind(...params).all();
  const totalCount = await c.env.DB.prepare(
    `SELECT COUNT(*) as count FROM products p WHERE p.store_id = ? AND p.status = 'active'${categoryId ? ' AND p.category_id = ?' : ''}`
  ).bind(storeData.id, ...(categoryId ? [categoryId] : [])).first() as any;

  const categories = await c.env.DB.prepare(
    'SELECT * FROM categories WHERE store_id = ? AND is_active = 1'
  ).bind(storeData.id).all();

  const activeCategory = categoryId ? (categories.results as any[]).find(c => c.id == categoryId) : null;

  // Fetch active flash sales
  const nowIso = new Date().toISOString();
  const activeFlashSales = await c.env.DB.prepare(`
    SELECT * FROM flash_sales
    WHERE store_id = ? AND is_active = 1
      AND (
        (start_at IS NOT NULL AND start_at <= ? AND end_at >= ?) OR
        (starts_at IS NOT NULL AND starts_at <= ? AND ends_at >= ?)
      )
      AND (max_quantity IS NULL OR sold_quantity < max_quantity)
  `).bind(storeData.id, nowIso, nowIso, nowIso, nowIso).all();
  const flashSalesMap = new Map((activeFlashSales.results as any[]).map(s => [s.product_id, s]));

  return c.html(storeLayout(storeData.name, `
  <div class="max-w-7xl mx-auto px-4 sm:px-6 py-8">
    <!-- Breadcrumb -->
    <nav class="flex items-center gap-2 text-sm text-mute mb-6">
      <a href="/store/${slug}" class="hover:text-sub">الرئيسية</a>
      <i class="fas fa-chevron-left text-xs"></i>
      <span class="text-sub">${activeCategory ? activeCategory.name : 'كل المنتجات'}</span>
      ${search ? `<i class="fas fa-chevron-left text-xs"></i><span class="text-sub">نتائج: "${search}"</span>` : ''}
    </nav>

    <div class="flex flex-col lg:flex-row gap-6">
      <!-- Sidebar -->
      <aside class="w-full lg:w-64 flex-shrink-0">
        <div class="bg-card rounded-2xl border border-std p-5 shadow-sm">
          <h3 class="font-bold text-main mb-4">التصنيفات</h3>
          <div class="space-y-1">
            <a href="/store/${slug}/products" 
               class="flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-all ${!categoryId ? 'font-bold text-white' : 'text-sub hover:bg-page'}"
               style="${!categoryId ? 'background:' + primary + ';' : ''}">
              <span>كل المنتجات</span>
              <span class="${!categoryId ? 'bg-card/20' : 'bg-gray-100'} px-2 py-0.5 rounded-full text-xs">${totalCount?.count || 0}</span>
            </a>
            ${(categories.results as any[]).map(cat => `
            <a href="/store/${slug}/products?category=${cat.id}" 
               class="flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-all ${categoryId == cat.id ? 'font-bold text-white' : 'text-sub hover:bg-page'}"
               style="${categoryId == cat.id ? 'background:' + primary + ';' : ''}">
              <span>${cat.name}</span>
            </a>
            `).join('')}
          </div>
        </div>
      </aside>

      <!-- Products Grid -->
      <div class="flex-1">
        <!-- Sort & Count Bar -->
        <div class="flex flex-wrap items-center justify-between gap-3 mb-5">
          <p class="text-sub text-sm">${totalCount?.count || 0} منتج</p>
          <select onchange="location.href='/store/${slug}/products?${categoryId ? 'category=' + categoryId + '&' : ''}${search ? 'search=' + search + '&' : ''}sort='+this.value"
            class="text-sm border border-std rounded-xl px-4 py-2 focus:outline-none">
            <option value="newest" ${sort === 'newest' ? 'selected' : ''}>الأحدث</option>
            <option value="price_asc" ${sort === 'price_asc' ? 'selected' : ''}>السعر: من الأقل</option>
            <option value="price_desc" ${sort === 'price_desc' ? 'selected' : ''}>السعر: من الأعلى</option>
            <option value="popular" ${sort === 'popular' ? 'selected' : ''}>الأكثر مبيعاً</option>
          </select>
        </div>

        ${(products.results as any[]).length > 0 ? `
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-4">
          ${(products.results as any[]).map((p: any) => {
            const flashSale = flashSalesMap.get(p.id);
            let price = p.sale_price || p.price;
            let hasDiscount = !!p.sale_price;
            let discountLabel = '';

            if (flashSale) {
              hasDiscount = true;
              price = flashSale.discount_type === 'percentage' 
                ? p.price * (1 - flashSale.discount_value / 100)
                : Math.max(0, p.price - flashSale.discount_value);
              discountLabel = flashSale.discount_type === 'percentage'
                ? `⚡ عرض ${flashSale.discount_value}%`
                : `⚡ خصم ${flashSale.discount_value} ${storeData.currency}`;
            } else if (p.sale_price) {
              discountLabel = `خصم ${Math.round((1 - p.sale_price / p.price) * 100)}%`;
            }

            return `
            <div class="bg-card rounded-2xl overflow-hidden shadow-sm card-hover border border-std cursor-pointer"
                 onclick="window.location.href='/store/${slug}/products/${p.id}'">
              <div class="relative aspect-square bg-page overflow-hidden">
                <img src="${getImageUrl(p.image || p.primary_image, DEFAULT_PRODUCT_IMAGE)}" 
                     alt="${p.name}" class="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                     onerror="handleImgError(this)">
                ${hasDiscount ? `
                  <div class="absolute top-2 right-2 ${flashSale ? 'bg-red-600' : 'bg-red-500'} text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-md z-10">
                    ${discountLabel}
                  </div>` : ''}
                ${p.stock === 0 ? '<div class="absolute inset-0 bg-black/40 flex items-center justify-center z-10"><span class="bg-card text-sub text-xs font-bold px-3 py-1 rounded-full">نفد</span></div>' : ''}
              </div>
              <div class="p-4">
                <p class="text-xs text-mute mb-1">${p.cat_name || ''}</p>
                <h3 class="font-semibold text-main text-sm line-clamp-2 mb-2">${p.name}</h3>
                <div class="flex items-center justify-between">
                  <div>
                    <span class="font-bold text-sm" style="color: ${primary};">${formatCurrency(price, storeData.currency)}</span>
                    ${hasDiscount ? `<span class="text-mute line-through text-xs mr-1">${formatCurrency(p.price, storeData.currency)}</span>` : ''}
                  </div>
                  ${p.stock > 0 ? `
                  <button onclick="event.stopPropagation(); addToCart(${p.id}, '${p.name.replace(/'/g, "\\'")}', ${price}, '${getImageUrl(p.image || p.primary_image, DEFAULT_PRODUCT_IMAGE)}')"
                    class="w-9 h-9 rounded-xl text-white flex items-center justify-center hover:opacity-80 transition-all text-sm shadow"
                    style="background: ${primary};">
                    <i class="fas fa-plus"></i>
                  </button>` : ''}
                </div>
              </div>
            </div>`;
          }).join('')}
        </div>
        ` : `
        <div class="bg-card rounded-2xl border border-std p-16 text-center">
          <i class="fas fa-box text-5xl text-gray-200 mb-4 block"></i>
          <h3 class="text-xl font-bold text-mute mb-2">لا توجد منتجات</h3>
          <p class="text-mute">لم يتم العثور على منتجات تطابق بحثك</p>
        </div>
        `}
      </div>
    </div>
  </div>
  `, storeData, customer));
});

// ─── Product Detail Page ──────────────────────────────────────
store.get('/:slug/products/:id', async (c) => {
  const slug = c.req.param('slug');
  const productId = parseInt(c.req.param('id'));
  
  const storeData = await c.env.DB.prepare(
    "SELECT * FROM stores WHERE slug = ? AND status = 'active'"
  ).bind(slug).first() as any;

  if (!storeData) return c.redirect('/');
  const customer = await getLoggedInCustomer(c, storeData.id);
  const product = await c.env.DB.prepare(
    `SELECT p.*, c.name as cat_name FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.id = ? AND p.store_id = ? AND p.status = 'active'`
  ).bind(productId, storeData.id).first() as any;

  if (!product) return c.redirect(`/store/${slug}`);

  const images = await c.env.DB.prepare(
    'SELECT * FROM product_images WHERE product_id = ? ORDER BY sort_order'
  ).bind(productId).all();

  // Related products
  const related = await c.env.DB.prepare(
    `SELECT p.*, pi.url as image FROM products p
     LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = 1
     WHERE p.store_id = ? AND p.category_id = ? AND p.id != ? AND p.status = 'active' LIMIT 4`
  ).bind(storeData.id, product.category_id || 0, productId).all();

  // Update views safely
  try {
    await c.env.DB.prepare(
      'UPDATE products SET views = COALESCE(views, 0) + 1 WHERE id = ?'
    ).bind(productId).run();
  } catch (viewsErr: any) {
    console.error('[PRODUCT DETAIL] views update error:', viewsErr?.message);
  }

  // Fetch product reviews list
  const reviewsDb = await c.env.DB.prepare(
    "SELECT * FROM product_reviews WHERE product_id = ? AND store_id = ? ORDER BY created_at DESC"
  ).bind(productId, storeData.id).all();
  const reviewsList = reviewsDb.results as any[];

  // Fetch average rating stats
  const ratingStats = await c.env.DB.prepare(
    "SELECT AVG(rating) as avg_rating, COUNT(id) as total_reviews FROM product_reviews WHERE product_id = ? AND store_id = ?"
  ).bind(productId, storeData.id).first() as any;

  const avgRating = ratingStats?.avg_rating ? parseFloat(ratingStats.avg_rating).toFixed(1) : '0.0';
  const totalReviews = ratingStats?.total_reviews || 0;

  const primary = storeData.primary_color || '#4F46E5';
  
  // Fetch active flash sale
  const nowIso = new Date().toISOString();
  const flashSale = await c.env.DB.prepare(`
    SELECT * FROM flash_sales
    WHERE store_id = ? AND product_id = ? AND is_active = 1
      AND (
        (start_at IS NOT NULL AND start_at <= ? AND end_at >= ?) OR
        (starts_at IS NOT NULL AND starts_at <= ? AND ends_at >= ?)
      )
      AND (max_quantity IS NULL OR sold_quantity < max_quantity)
    ORDER BY id DESC LIMIT 1
  `).bind(storeData.id, productId, nowIso, nowIso, nowIso, nowIso).first() as any;

  // Fetch product variants
  const variantsDb = await c.env.DB.prepare(
    'SELECT * FROM product_variants WHERE product_id = ? AND is_active = 1 ORDER BY sort_order'
  ).bind(productId).all();
  const variantsList = variantsDb.results as any[];

  // Group variants by type
  const groupedVariants: Record<string, any[]> = {};
  variantsList.forEach(v => {
    if (!groupedVariants[v.type]) groupedVariants[v.type] = [];
    groupedVariants[v.type].push(v);
  });

  // Determine effective base price
  let basePrice = product.sale_price || product.price;
  if (flashSale) {
    if (flashSale.discount_type === 'percentage') {
      basePrice = product.price * (1 - flashSale.discount_value / 100);
    } else {
      basePrice = Math.max(0, product.price - flashSale.discount_value);
    }
  }
  const price = basePrice;

  const imageList = (images.results && images.results.length > 0) ? images.results as any[] : (product.image ? [{ url: product.image }] : []);
  const mainImage = getImageUrl(imageList[0]?.url || product.image, DEFAULT_PRODUCT_IMAGE);

  const headExtra = `
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="product">
  <meta property="og:title" content="${product.name.replace(/"/g, '&quot;')} - ${storeData.name.replace(/"/g, '&quot;')}">
  <meta property="og:description" content="${(product.short_description || product.description || '').slice(0, 160).replace(/"/g, '&quot;')}">
  <meta property="og:image" content="${mainImage}">
  <meta property="og:url" content="https://${c.req.header('host')}/store/${slug}/products/${product.id}">
  
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${product.name.replace(/"/g, '&quot;')}">
  <meta name="twitter:description" content="${(product.short_description || '').slice(0, 160).replace(/"/g, '&quot;')}">
  <meta name="twitter:image" content="${mainImage}">

  <!-- Schema.org JSON-LD Structured Data for Google -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org/",
    "@type": "Product",
    "name": ${JSON.stringify(product.name)},
    "image": [${JSON.stringify(mainImage)}],
    "description": ${JSON.stringify(product.short_description || product.description || product.name)},
    "sku": ${JSON.stringify(product.sku || 'PROD-' + product.id)},
    "offers": {
      "@type": "Offer",
      "url": ${JSON.stringify(`https://${c.req.header('host')}/store/${slug}/products/${product.id}`)},
      "priceCurrency": ${JSON.stringify(product.currency || storeData.currency || 'YER')},
      "price": ${JSON.stringify(price.toString())},
      "availability": ${product.stock > 0 ? '"https://schema.org/InStock"' : '"https://schema.org/OutOfStock"'},
      "itemCondition": "https://schema.org/NewCondition"
    }
  }
  </script>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "الرئيسية",
        "item": ${JSON.stringify(`https://${c.req.header('host')}/store/${slug}`)}
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "المنتجات",
        "item": ${JSON.stringify(`https://${c.req.header('host')}/store/${slug}/products`)}
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": ${JSON.stringify(product.name)},
        "item": ${JSON.stringify(`https://${c.req.header('host')}/store/${slug}/products/${product.id}`)}
      }
    ]
  }
  </script>
  `;

  return c.html(storeLayout(product.name, `
  <div class="max-w-7xl mx-auto px-4 sm:px-6 py-8">
    <!-- Breadcrumb -->
    <nav class="flex items-center gap-2 text-sm text-mute mb-6">
      <a href="/store/${slug}" class="hover:text-sub">الرئيسية</a>
      <i class="fas fa-chevron-left text-xs"></i>
      <a href="/store/${slug}/products" class="hover:text-sub">المنتجات</a>
      ${product.cat_name ? `<i class="fas fa-chevron-left text-xs"></i><a href="/store/${slug}/products?category=${product.category_id}" class="hover:text-sub">${product.cat_name}</a>` : ''}
      <i class="fas fa-chevron-left text-xs"></i>
      <span class="text-main font-medium line-clamp-1">${product.name}</span>
    </nav>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-10">
      <!-- Images -->
      <div>
        <div class="aspect-square bg-page rounded-2xl overflow-hidden mb-4">
          <img id="mainImage" src="${mainImage}" alt="${product.name}" 
               class="w-full h-full object-cover" onerror="handleImgError(this)">
        </div>
        ${imageList.length > 1 ? `
        <div class="grid grid-cols-5 gap-2">
          ${imageList.map((img, i) => `
          <div class="aspect-square rounded-xl overflow-hidden border-2 cursor-pointer transition-all ${i === 0 ? 'border-primary-400' : 'border-transparent hover:border-gray-300'}"
               onclick="document.getElementById('mainImage').src='${img.url}'; this.parentElement.querySelectorAll('div').forEach(d=>d.classList.remove('border-primary-400')); this.classList.add('border-primary-400')">
            <img src="${getImageUrl(img.url, DEFAULT_PRODUCT_IMAGE)}" alt="" class="w-full h-full object-cover" onerror="handleImgError(this)">
          </div>
          `).join('')}
        </div>` : ''}
      </div>

      <!-- Product Info -->
      <div>
        <h1 class="text-3xl font-black text-main mb-2">${product.name}</h1>
        
        <!-- Star Rating -->
        <div class="flex items-center gap-1.5 mb-5 text-xs font-semibold text-mute">
          <div class="flex items-center text-yellow-400">
            ${Array.from({ length: 5 }).map((_, idx) => {
              const fullStars = Math.floor(parseFloat(avgRating));
              const isFilled = idx < fullStars;
              return `<i class="${isFilled ? 'fas' : 'far'} fa-star mx-0.5"></i>`;
            }).join('')}
          </div>
          <span class="text-main font-bold">${avgRating}</span>
          <span class="text-gray-300">|</span>
          <span class="hover:underline cursor-pointer" onclick="document.getElementById('reviewsSection').scrollIntoView({ behavior: 'smooth' })">(${totalReviews} تقييم)</span>
        </div>

        <!-- Flash Sale Banner -->
        ${flashSale ? `
        <div class="bg-red-50 border border-red-100 rounded-2xl p-4 mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-sm">
          <div>
            <span class="bg-red-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider animate-pulse inline-block mb-1.5"><i class="fas fa-bolt"></i> عرض سريع (Flash Sale)</span>
            <h3 class="font-bold text-main text-sm">${flashSale.title}</h3>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-xs text-mute font-semibold">ينتهي خلال:</span>
            <div id="flashSaleTimer" class="flex gap-1 text-xs font-bold text-white font-mono" data-end="${new Date(flashSale.end_at).toISOString()}">
              <span class="bg-red-500 px-2 py-1 rounded">00</span>:
              <span class="bg-red-500 px-2 py-1 rounded">00</span>:
              <span class="bg-red-500 px-2 py-1 rounded">00</span>
            </div>
          </div>
        </div>` : ''}
        
        <div class="flex items-center gap-4 mb-5">
          <span id="productPriceDisplay" class="text-4xl font-black" style="color: ${primary};">${formatCurrency(price, storeData.currency)}</span>
          ${flashSale ? `
            <span id="productOriginalPriceDisplay" class="text-xl text-mute line-through">${formatCurrency(product.price, storeData.currency)}</span>
            <span class="bg-red-500 text-white text-sm font-bold px-3 py-1 rounded-full">
              خصم ${flashSale.discount_type === 'percentage' ? `${flashSale.discount_value}%` : `${formatCurrency(flashSale.discount_value, storeData.currency)}`}
            </span>
          ` : product.sale_price ? `
            <span id="productOriginalPriceDisplay" class="text-xl text-mute line-through">${formatCurrency(product.price, storeData.currency)}</span>
            <span id="productDiscountDisplay" class="bg-red-500 text-white text-sm font-bold px-3 py-1 rounded-full">
              خصم ${Math.round((1 - product.sale_price / product.price) * 100)}%
            </span>
          ` : ''}
        </div>

        <!-- Product Variants Selection -->
        ${Object.keys(groupedVariants).length > 0 ? `
        <div class="border-t border-b border-std py-5 my-5 space-y-4">
          ${Object.entries(groupedVariants).map(([type, list]) => `
            <div class="variant-group" data-type="${type}">
              <span class="block text-xs font-bold text-sub mb-2">${type}:</span>
              <div class="flex flex-wrap gap-2">
                ${list.map(v => `
                  <button type="button" 
                    onclick="selectVariant(this, '${type}', '${v.value}', ${v.price_modifier}, ${v.stock}, '${v.sku || ''}')"
                    class="variant-btn border border-std hover:border-primary-400 text-main text-xs font-semibold px-4 py-2 rounded-xl transition-all bg-card hover:bg-page/50">
                    ${v.value}
                    ${v.price_modifier !== 0 ? ` (${v.price_modifier > 0 ? '+' : ''}${v.price_modifier} ${storeData.currency})` : ''}
                  </button>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </div>` : ''}

        ${product.short_description ? `<div class="text-sub mb-4 text-base">${formatProductDescription(product.short_description)}</div>` : ''}
        
        <!-- Stock Status -->
        <div class="flex items-center gap-2 mb-6">
          ${product.stock > 0 
            ? `<span class="flex items-center gap-2 text-green-600 font-medium"><i class="fas fa-check-circle"></i> متوفر في المخزن (${product.stock} قطعة)</span>`
            : `<span class="flex items-center gap-2 text-red-500 font-medium"><i class="fas fa-times-circle"></i> نفد من المخزون</span>`
          }
        </div>

        <!-- Quantity & Add to Cart -->
        ${product.stock > 0 ? `
        <div class="flex items-center gap-4 mb-6">
          <div class="flex items-center gap-2 border border-std rounded-xl p-1">
            <button onclick="document.getElementById('qty').value = Math.max(1, parseInt(document.getElementById('qty').value)-1)"
              class="w-9 h-9 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center font-bold transition-colors">-</button>
            <input type="number" id="qty" value="1" min="1" max="${product.stock}"
              class="w-12 text-center font-bold text-main border-0 outline-none">
            <button onclick="document.getElementById('qty').value = Math.min(${product.stock}, parseInt(document.getElementById('qty').value)+1)"
              class="w-9 h-9 rounded-xl text-white flex items-center justify-center font-bold transition-all hover:opacity-90"
              style="background: ${primary};">+</button>
          </div>
          <span class="text-sm text-mute">حتى ${product.stock} قطعة</span>
        </div>
        <button onclick="addToCartMultiple()"
          class="w-full text-white font-semibold py-4 rounded-2xl transition-all hover:opacity-90 flex items-center justify-center gap-3 text-lg shadow-lg mb-4"
          style="background: linear-gradient(135deg, ${primary}, ${storeData.secondary_color});">
          <i class="fas fa-shopping-cart text-xl"></i>
          إضافة للسلة
        </button>` : `
        <div class="w-full bg-gray-200 text-mute font-semibold py-4 rounded-2xl text-center text-lg mb-4">
          نفد من المخزون
        </div>`}

        ${product.sku ? `<p class="text-xs text-mute mb-4">رمز المنتج: <span class="font-mono">${product.sku}</span></p>` : ''}

        <!-- Description -->
        ${product.description ? `
        <div class="border-t border-std pt-5 mt-5">
          <h3 class="font-bold text-main mb-3">وصف المنتج</h3>
          <div class="text-sub leading-relaxed text-sm">${formatProductDescription(product.description)}</div>
        </div>` : ''}
      </div>
    </div>

    <!-- Reviews Section -->
    <div id="reviewsSection" class="mt-16 border-t border-std pt-10">
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-10">
        
        <!-- Stats & Add Review Form -->
        <div>
          <h3 class="font-bold text-main text-lg mb-4">تقييمات وآراء العملاء</h3>
          
          <div class="bg-page dark:bg-slate-800/40 border border-std rounded-2xl p-5 mb-6 text-center">
            <h4 class="text-4xl font-black text-main">${avgRating}</h4>
            <div class="flex items-center justify-center text-yellow-400 my-2 text-sm">
              ${Array.from({ length: 5 }).map((_, idx) => {
                const fullStars = Math.floor(parseFloat(avgRating));
                const isFilled = idx < fullStars;
                return `<i class="${isFilled ? 'fas' : 'far'} fa-star mx-0.5"></i>`;
              }).join('')}
            </div>
            <p class="text-xs text-mute">بناءً على ${totalReviews} تقييم من المشترين</p>
          </div>

          <div class="bg-card border border-std rounded-2xl p-5 shadow-sm">
            <h4 class="font-bold text-main text-sm mb-3">أضف تقييمك للمنتج</h4>
            ${customer 
              ? `
              <form id="addReviewForm" class="space-y-3.5 text-right">
                <div>
                  <label class="block text-xs font-semibold text-sub mb-1">التقييم بالنجوم</label>
                  <div class="flex gap-1.5 text-xl text-yellow-400 cursor-pointer" id="starSelector">
                    <i class="fas fa-star" data-value="1"></i>
                    <i class="fas fa-star" data-value="2"></i>
                    <i class="fas fa-star" data-value="3"></i>
                    <i class="fas fa-star" data-value="4"></i>
                    <i class="fas fa-star" data-value="5"></i>
                  </div>
                  <input type="hidden" id="reviewRatingVal" value="5">
                </div>
                <div>
                  <label class="block text-xs font-semibold text-sub mb-1">تعليقك / رأيك</label>
                  <textarea id="reviewCommentText" rows="3" required placeholder="اكتب رأيك وتجربتك للمنتج هنا..."
                    class="w-full px-3 py-2.5 border border-std rounded-xl text-xs bg-page text-main focus:ring-2 focus:outline-none resize-none"></textarea>
                </div>
                <button type="submit" id="submitReviewBtn" class="w-full text-white text-xs font-bold py-2.5 rounded-xl transition-all hover:opacity-90 shadow-md"
                  style="background: linear-gradient(135deg, ${primary}, ${storeData.secondary_color});">
                  إرسال التقييم
                </button>
              </form>
              `
              : `
              <div class="text-center py-4 text-xs text-mute">
                <i class="fas fa-lock mb-2 text-lg text-gray-300 block"></i>
                يرجى <a href="/store/${slug}/login" class="font-bold hover:underline font-semibold" style="color: ${primary};">تسجيل الدخول</a> كعميل لكتابة تقييمك للمنتج.
              </div>
              `
            }
          </div>
        </div>

        <!-- Reviews List -->
        <div class="lg:col-span-2">
          <h3 class="font-bold text-main text-lg mb-5">المراجعات (${totalReviews})</h3>
          
          ${reviewsList.length === 0 
            ? `<p class="text-mute text-sm py-12 text-center bg-page/50 rounded-2xl border border-dashed border-std">لا توجد مراجعات لهذا المنتج بعد. كن أول من يقيم!</p>`
            : `
            <div class="space-y-4">
              ${reviewsList.map(rev => `
              <div class="border-b border-std pb-4">
                <div class="flex items-center justify-between gap-3 mb-1.5">
                  <div class="flex items-center gap-2">
                    <span class="font-bold text-sm text-sub">${rev.customer_name}</span>
                    <div class="flex items-center text-yellow-400 text-xs">
                      ${Array.from({ length: 5 }).map((_, idx) => {
                        const isFilled = idx < rev.rating;
                        return `<i class="${isFilled ? 'fas' : 'far'} fa-star mx-0.5"></i>`;
                      }).join('')}
                    </div>
                  </div>
                  <span class="text-xs text-mute">${new Date(rev.created_at || Date.now()).toLocaleDateString('ar-SA')}</span>
                </div>
                <p class="text-sub text-xs leading-relaxed pr-1">${rev.comment || 'بدون تعليق'}</p>
              </div>
              `).join('')}
            </div>
            `
          }
        </div>

      </div>
    </div>

    <!-- Related Products -->
    ${(related.results as any[]).length > 0 ? `
    <section class="mt-16">
      <h2 class="text-2xl font-bold text-main mb-6">منتجات ذات صلة</h2>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
        ${(related.results as any[]).map((p: any) => {
          const rPrice = p.sale_price || p.price;
          return `
          <div class="bg-card rounded-2xl overflow-hidden shadow-sm card-hover border border-std cursor-pointer"
               onclick="window.location.href='/store/${slug}/products/${p.id}'">
            <div class="aspect-square bg-page overflow-hidden">
              <img src="${p.image || 'https://via.placeholder.com/300x300?text=No+Image'}" 
                   alt="${p.name}" class="w-full h-full object-cover">
            </div>
            <div class="p-3">
              <p class="font-medium text-main text-sm line-clamp-2">${p.name}</p>
              <p class="font-bold text-sm mt-1" style="color: ${primary};">${formatCurrency(rPrice, storeData.currency)}</p>
            </div>
          </div>`;
        }).join('')}
      </div>
    </section>` : ''}
  </div>
  `, storeData, customer, `
    // ── Flash Sale Countdown ──
    const timer = document.getElementById('flashSaleTimer');
    if (timer) {
      const end = new Date(timer.dataset.end).getTime();
      function updateTimer() {
        const diff = end - Date.now();
        if (diff <= 0) {
          timer.innerHTML = '<span class="text-red-500 font-bold">انتهى العرض!</span>';
          setTimeout(() => location.reload(), 1500);
          return;
        }
        const hrs = Math.floor(diff / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((diff % (1000 * 60)) / 1000);
        const spans = timer.querySelectorAll('span');
        if (spans.length === 3) {
          spans[0].textContent = String(hrs).padStart(2, '0');
          spans[1].textContent = String(mins).padStart(2, '0');
          spans[2].textContent = String(secs).padStart(2, '0');
        }
      }
      updateTimer();
      setInterval(updateTimer, 1000);
    }

    // ── Product Variants Selection ──
    window.selectedVariants = {};
    function selectVariant(btn, type, value, modifier, stock, sku) {
      const group = btn.closest('.variant-group');
      if (group) {
        group.querySelectorAll('.variant-btn').forEach(b => {
          b.classList.remove('border-primary-500', 'ring-2', 'ring-primary-100', 'bg-primary-50/20', 'text-primary-700', 'font-bold');
          b.classList.add('border-std', 'bg-card', 'text-main');
        });
      }
      btn.classList.add('border-primary-500', 'ring-2', 'ring-primary-100', 'bg-primary-50/20', 'text-primary-700', 'font-bold');
      btn.classList.remove('border-std', 'bg-card', 'text-main');

      window.selectedVariants[type] = { value, modifier, stock, sku };

      if (typeof window.updateDynamicPriceAndSku === 'function') window.updateDynamicPriceAndSku();
    }
    window.selectVariant = selectVariant;

    function updateDynamicPriceAndSku() {
      const basePrice = ${price};
      const originalBasePrice = ${product.price};
      let finalPrice = basePrice;
      let finalOriginalPrice = originalBasePrice;
      
      Object.values(window.selectedVariants || {}).forEach(v => {
        finalPrice += v.modifier;
        finalOriginalPrice += v.modifier;
      });

      const priceEl = document.getElementById('productPriceDisplay');
      if (priceEl) priceEl.textContent = fmtCurrency(finalPrice, CURRENCY);
      
      const origPriceEl = document.getElementById('productOriginalPriceDisplay');
      if (origPriceEl) origPriceEl.textContent = fmtCurrency(finalOriginalPrice, CURRENCY);
      
      const discEl = document.getElementById('productDiscountDisplay');
      if (discEl) {
        const pct = Math.round((1 - finalPrice / finalOriginalPrice) * 100);
        discEl.textContent = 'خصم ' + pct + '%';
      }
    }
    window.updateDynamicPriceAndSku = updateDynamicPriceAndSku;

    function addToCartMultiple() {
      const qtyEl = document.getElementById('qty');
      const qty = qtyEl ? (parseInt(qtyEl.value) || 1) : 1;
      
      const groups = document.querySelectorAll('.variant-group');
      const missing = [];
      groups.forEach(g => {
        const type = g.dataset.type;
        if (!window.selectedVariants[type]) missing.push(type);
      });

      if (missing.length > 0) {
        return showToast('يرجى تحديد: ' + missing.join('، '), 'warning');
      }

      const variantStr = Object.entries(window.selectedVariants || {}).map(([type, v]) => type + ': ' + v.value).join('، ');
      
      const basePrice = ${price};
      let finalPrice = basePrice;
      Object.values(window.selectedVariants || {}).forEach(v => {
        finalPrice += v.modifier;
      });

      for (let i = 0; i < qty; i++) {
        addToCart(${product.id}, ${JSON.stringify(product.name)}, finalPrice, ${JSON.stringify(getImageUrl(mainImage, DEFAULT_PRODUCT_IMAGE))}, variantStr);
      }
    }
    window.addToCartMultiple = addToCartMultiple;

    // Star Selector interactivity
    const stars = document.querySelectorAll('#starSelector i');
    const ratingInput = document.getElementById('reviewRatingVal');
    if (stars && ratingInput) {
      stars.forEach(star => {
        star.addEventListener('click', function() {
          const val = parseInt(this.getAttribute('data-value'));
          ratingInput.value = val;
          stars.forEach((s, idx) => {
            if (idx < val) {
              s.className = 'fas fa-star';
            } else {
              s.className = 'far fa-star';
            }
          });
        });
      });
    }

    // Submit Review via API
    document.getElementById('addReviewForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('submitReviewBtn');
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الإرسال...';
      
      try {
        const res = await fetch('/store/${slug}/products/${product.id}/reviews', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rating: document.getElementById('reviewRatingVal').value,
            comment: document.getElementById('reviewCommentText').value
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'خطأ في الإرسال');
        
        showToast('تمت إضافة مراجعتك بنجاح', 'success');
        setTimeout(() => window.location.reload(), 900);
      } catch(err) {
        btn.disabled = false;
        btn.innerHTML = 'إرسال التقييم';
        showToast(err.message || 'فشل إرسال التقييم', 'error');
      }
    });
  `, headExtra));
});

// ─── Order Tracking Page ──────────────────────────────────────
store.get('/:slug/track', async (c) => {
  const slug = c.req.param('slug');
  const orderNumber = c.req.query('order')?.trim() || '';
  const phone = c.req.query('phone')?.trim() || '';

  const storeData = await c.env.DB.prepare(
    "SELECT * FROM stores WHERE slug = ? AND status = 'active'"
  ).bind(slug).first() as any;

  if (!storeData) return c.redirect('/');
  const customer = await getLoggedInCustomer(c, storeData.id);
  const primary = storeData.primary_color || '#4F46E5';
  const secondary = storeData.secondary_color || '#818CF8';

  let order: any = null;
  let itemsList: any[] = [];
  let errorMsg = '';

  if (orderNumber && phone) {
    order = await c.env.DB.prepare(
      "SELECT * FROM orders WHERE store_id = ? AND order_number = ? AND (customer_phone = ? OR customer_phone = ?)"
    ).bind(
      storeData.id, 
      orderNumber, 
      phone,
      phone.replace(/^0/, '+966')
    ).first() as any;

    if (order) {
      const items = await c.env.DB.prepare(
        "SELECT * FROM order_items WHERE order_id = ?"
      ).bind(order.id).all();
      itemsList = items.results as any[];
    } else {
      errorMsg = 'الطلب غير موجود. يرجى التأكد من صحة رقم الطلب ورقم الهاتف.';
    }
  }

  let trackingContent = '';

  if (!order) {
    trackingContent = `
    <div class="max-w-md mx-auto px-4 py-16">
      <div class="bg-card rounded-2xl border border-std p-8 shadow-sm text-center">
        <div class="w-16 h-16 bg-primary-50 rounded-full flex items-center justify-center mx-auto mb-6" style="background: ${primary}15;">
          <i class="fas fa-search-location text-2xl" style="color: ${primary};"></i>
        </div>
        <h2 class="text-2xl font-bold text-main mb-2">تتبع حالة طلبك</h2>
        <p class="text-mute text-sm mb-6">أدخل رقم الطلب ورقم الهاتف لتتبع طلبك مباشرة</p>
        
        ${errorMsg ? `<div class="bg-red-50 text-red-500 p-3.5 rounded-xl text-xs font-semibold mb-5 text-right"><i class="fas fa-exclamation-circle ml-1.5"></i>${errorMsg}</div>` : ''}

        <form method="GET" class="space-y-4 text-right">
          <div>
            <label class="block text-sm font-medium text-sub mb-1.5">رقم الطلب</label>
            <input type="text" name="order" value="${orderNumber}" required placeholder="مثال: ORD-12345" dir="ltr"
              class="w-full px-4 py-2.5 border border-std rounded-xl focus:ring-2 focus:outline-none text-center font-bold text-sub">
          </div>
          <div>
            <label class="block text-sm font-medium text-sub mb-1.5">رقم الهاتف المسجل بالطلب</label>
            <input type="tel" name="phone" value="${phone}" required placeholder="0500000000" dir="ltr"
              class="w-full px-4 py-2.5 border border-std rounded-xl focus:ring-2 focus:outline-none text-center font-bold text-sub">
          </div>
          <button type="submit" class="w-full text-white font-semibold py-3 rounded-xl transition-all hover:opacity-90 mt-2 shadow-lg"
            style="background: linear-gradient(135deg, ${primary}, ${secondary});">
            تتبع الطلب <i class="fas fa-arrow-left mr-1.5 text-xs"></i>
          </button>
        </form>
      </div>
    </div>
    `;
  } else {
    const statusSteps = [
      { status: 'pending', label: 'تم استلام الطلب', icon: 'fa-check', desc: 'تلقينا طلبك وسنقوم بمراجعته قريباً' },
      { status: 'processing', label: 'قيد التجهيز', icon: 'fa-box-open', desc: 'نعمل حالياً على تجهيز وتعبئة طلبك' },
      { status: 'completed', label: 'تم التوصيل', icon: 'fa-truck', desc: 'تم تسليم الشحنة للعميل بنجاح' }
    ];

    const currentStatusIndex = statusSteps.findIndex(s => s.status === order.status);
    const isCancelled = order.status === 'cancelled';

    let timelineHtml = '';
    
    if (isCancelled) {
      timelineHtml = `
      <div class="bg-red-50 border border-red-100 rounded-2xl p-5 flex items-center gap-4 text-red-700 mb-8">
        <div class="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
          <i class="fas fa-times-circle text-xl"></i>
        </div>
        <div>
          <h4 class="font-bold text-base">تم إلغاء هذا الطلب</h4>
          <p class="text-sm opacity-90 mt-0.5">يرجى التواصل مع إدارة المتجر لمزيد من التفاصيل.</p>
        </div>
      </div>
      `;
    } else {
      timelineHtml = `
      <div class="mb-10">
        <h3 class="font-bold text-main text-lg mb-6">مرحلة الطلب الحالية</h3>
        <div class="relative pl-6 border-r-2 border-std space-y-8 pr-4">
          ${statusSteps.map((step, idx) => {
            const isCompleted = idx <= currentStatusIndex;
            const isActive = idx === currentStatusIndex;
            return `
            <div class="relative">
              <span class="absolute -right-[27px] top-0 w-5 h-5 rounded-full flex items-center justify-center border-4 transition-all duration-300 ${
                isCompleted 
                  ? 'bg-card border-primary-500' 
                  : 'bg-gray-100 border-std'
              }" style="${isCompleted ? 'border-color:' + primary + ';' : ''}">
                ${isCompleted ? `<span class="w-1.5 h-1.5 rounded-full" style="background:${primary}"></span>` : ''}
              </span>
              <div class="flex items-start gap-3">
                <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${
                  isCompleted 
                    ? 'text-white' 
                    : 'bg-page text-gray-300'
                }" style="${isCompleted ? 'background:' + primary + ';' : ''}">
                  <i class="fas ${step.icon} text-sm"></i>
                </div>
                <div>
                  <h4 class="font-bold text-sm ${isCompleted ? 'text-main' : 'text-mute'}">${step.label}</h4>
                  <p class="text-xs text-mute mt-1">${step.desc}</p>
                </div>
              </div>
            </div>
            `;
          }).join('')}
        </div>
      </div>
      `;
    }

    trackingContent = `
    <div class="max-w-3xl mx-auto px-4 py-8">
      <a href="/store/${slug}/track" class="inline-flex items-center gap-1.5 text-sm text-mute hover:text-sub mb-6">
        <i class="fas fa-chevron-right text-xs"></i> بحث جديد
      </a>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="md:col-span-2 bg-card rounded-2xl border border-std p-6 shadow-sm">
          <div class="flex items-center justify-between border-b border-std pb-4 mb-6">
            <div>
              <p class="text-xs text-mute">رقم الطلب</p>
              <h2 class="text-lg font-bold text-main">${order.order_number}</h2>
            </div>
            <div class="text-left">
              <p class="text-xs text-mute">التاريخ</p>
              <p class="text-sm font-semibold text-sub">${new Date(order.created_at || Date.now()).toLocaleDateString('ar-SA')}</p>
            </div>
          </div>

          ${timelineHtml}

          <div class="flex flex-col sm:flex-row gap-3 border-t border-std pt-6">
            <button onclick="downloadInvoice()"
               class="flex-1 bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 px-4 rounded-xl text-center text-sm transition-colors flex items-center justify-center gap-2"
               style="background: ${primary};">
              <i class="fas fa-file-pdf"></i> تحميل الفاتورة (PDF)
            </button>
            ${storeData.whatsapp ? `
            <a href="https://wa.me/${storeData.whatsapp}?text=استفسار عن الطلب ${order.order_number}" target="_blank"
               class="flex-1 border border-std hover:bg-page text-sub font-semibold py-3 px-4 rounded-xl text-center text-sm transition-colors flex items-center justify-center gap-2">
              <i class="fab fa-whatsapp text-lg text-green-600"></i> تواصل واتساب
            </a>` : ''}
            ${storeData.phone ? `
            <a href="tel:${storeData.phone}"
               class="border border-std hover:bg-page text-sub font-semibold py-3 px-6 rounded-xl text-center text-sm transition-colors flex items-center justify-center gap-2">
              <i class="fas fa-phone text-blue-600"></i> اتصال
            </a>` : ''}
          </div>
        </div>

        <div class="space-y-6">
          <div class="bg-card rounded-2xl border border-std p-5 shadow-sm">
            <h3 class="font-bold text-main text-sm mb-4 border-b border-std pb-3">ملخص المنتجات</h3>
            <div class="space-y-3">
              ${itemsList.map(item => `
              <div class="flex justify-between text-xs gap-3">
                <span class="text-sub font-medium line-clamp-1">${item.product_name} × ${item.quantity}</span>
                <span class="text-main font-bold whitespace-nowrap">${item.total.toLocaleString('ar-SA')} ${order.currency}</span>
              </div>
              `).join('')}
            </div>
            
            <div class="border-t border-std mt-4 pt-4 space-y-2 text-xs">
              <div class="flex justify-between text-mute">
                <span>المجموع الفرعي:</span>
                <span>${order.subtotal.toLocaleString('ar-SA')} ${order.currency}</span>
              </div>
              <div class="flex justify-between text-red-500 font-semibold">
                <span>الخصم:</span>
                <span>-${(order.discount_amount || 0).toLocaleString('ar-SA')} ${order.currency}</span>
              </div>
              <div class="flex justify-between text-sm font-bold text-main border-t border-std pt-2 mt-2">
                <span>الإجمالي الكلي:</span>
                <span style="color: ${primary};">${order.total.toLocaleString('ar-SA')} ${order.currency}</span>
              </div>
            </div>
          </div>

          <div class="bg-card rounded-2xl border border-std p-5 shadow-sm text-xs space-y-3">
            <h3 class="font-bold text-main text-sm border-b border-std pb-3">بيانات التوصيل</h3>
            <div>
              <span class="text-mute block mb-0.5">المستلم:</span>
              <span class="text-sub font-semibold">${order.customer_name}</span>
            </div>
            <div>
              <span class="text-mute block mb-0.5">المدينة والعنوان:</span>
              <span class="text-sub font-semibold">${order.shipping_city || ''} - ${order.shipping_address || ''}</span>
            </div>
            ${order.notes ? `
            <div>
              <span class="text-mute block mb-0.5">ملاحظات العميل:</span>
              <p class="text-sub italic bg-page p-2 rounded-lg border border-std mt-1">${order.notes}</p>
            </div>` : ''}
          </div>
        </div>
      </div>
    </div>
    `;
  }

  const downloadScript = order ? `
    window.downloadInvoice = function() {
      const storeName = ${JSON.stringify(storeData.name)};
      const orderNumber = ${JSON.stringify(order.order_number)};
      const orderDate = ${JSON.stringify(new Date(order.created_at || Date.now()).toLocaleDateString('ar-SA'))};
      const customerName = ${JSON.stringify(order.customer_name)};
      const customerPhone = ${JSON.stringify(order.customer_phone || '')};
      const customerAddress = ${JSON.stringify((order.shipping_city || '') + ' - ' + (order.shipping_address || ''))};
      const currency = ${JSON.stringify(order.currency)};
      const primaryColor = ${JSON.stringify(storeData.primary_color || '#4F46E5')};
      const subtotal = ${order.subtotal};
      const discount = ${order.discount_amount || 0};
      const shipping = ${order.shipping || 0};
      const total = ${order.total};
      const items = ${JSON.stringify(itemsList)};

      let itemsRows = "";
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        itemsRows += "<tr>" +
          "<td style='padding: 12px 15px; font-size: 13px; color: #1e293b; font-weight: 500; border-bottom: 1px solid #e2e8f0; text-align: right;'>" + item.product_name + "</td>" +
          "<td style='padding: 12px 15px; font-size: 13px; color: #475569; border-bottom: 1px solid #e2e8f0; text-align: center;'>" + Number(item.price).toLocaleString() + " " + currency + "</td>" +
          "<td style='padding: 12px 15px; font-size: 13px; color: #475569; border-bottom: 1px solid #e2e8f0; text-align: center;'>" + item.quantity + "</td>" +
          "<td style='padding: 12px 15px; font-size: 13px; color: #1e293b; font-weight: 700; border-bottom: 1px solid #e2e8f0; text-align: left;'>" + Number(item.total).toLocaleString() + " " + currency + "</td>" +
          "</tr>";
      }

      const invoiceHtml = 
        "<!DOCTYPE html>" +
        "<html dir='rtl' lang='ar'>" +
        "<head>" +
        "  <meta charset='utf-8'>" +
        "  <title>فاتورة رقم " + orderNumber + "</title>" +
        "  <link href='https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800&display=swap' rel='stylesheet'>" +
        "  <style>" +
        "    body { font-family: 'Tajawal', sans-serif; direction: rtl; padding: 40px; color: #333; background: #fff; margin: 0; }" +
        "    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #eeeff2; padding-bottom: 20px; margin-bottom: 30px; }" +
        "    .header h1 { font-size: 26px; font-weight: 800; color: #1e293b; margin: 0; }" +
        "    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }" +
        "    .info-card { background-color: #f8fafc; border-radius: 12px; padding: 18px; border: 1px solid #e2e8f0; }" +
        "    .info-card h3 { font-size: 14px; font-weight: 700; color: #475569; margin: 0 0 10px 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }" +
        "    .info-card p { font-size: 13px; margin: 5px 0; color: #1e293b; }" +
        "    .info-card p span { color: #64748b; }" +
        "    table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }" +
        "    th { padding: 12px 15px; font-size: 13px; font-weight: 700; color: #475569; background-color: #f1f5f9; border-bottom: 2px solid #cbd5e1; text-align: right; }" +
        "    td { padding: 12px 15px; font-size: 13px; color: #1e293b; border-bottom: 1px solid #e2e8f0; text-align: right; }" +
        "    .totals-container { display: flex; justify-content: flex-end; margin-bottom: 40px; }" +
        "    .totals-box { width: 240px; background-color: #f8fafc; border-radius: 12px; padding: 15px; border: 1px solid #e2e8f0; }" +
        "    .total-row { display: flex; justify-content: space-between; font-size: 13px; color: #64748b; margin-bottom: 6px; }" +
        "    .total-row.final { font-size: 15px; font-weight: 800; color: #1e293b; border-top: 1px solid #e2e8f0; padding-top: 8px; margin-top: 8px; }" +
        "    .footer { text-align: center; border-top: 1px solid #e2e8f0; padding-top: 20px; color: #94a3b8; font-size: 12px; margin-top: 40px; }" +
        "  </style>" +
        "</head>" +
        "<body>" +
        "  <div class='header'>" +
        "    <div>" +
        "      <h1>" + storeName + "</h1>" +
        "      <p style='font-size: 14px; color: #64748b; margin: 4px 0 0 0;'>فاتورة الطلب رقم: #" + orderNumber + "</p>" +
        "    </div>" +
        "    <div style='text-align: left;'>" +
        "      <p style='font-size: 14px; color: #64748b; margin: 0;'>التاريخ: " + orderDate + "</p>" +
        "    </div>" +
        "  </div>" +
        "  <div class='info-grid'>" +
        "    <div class='info-card'>" +
        "      <h3>معلومات العميل</h3>" +
        "      <p><span>الاسم:</span> <strong>" + customerName + "</strong></p>" +
        "      <p><span>الهاتف:</span> <strong>" + customerPhone + "</strong></p>" +
        "      <p><span>العنوان:</span> <strong>" + customerAddress + "</strong></p>" +
        "    </div>" +
        "    <div class='info-card' style='text-align: right;'>" +
        "      <h3 style='text-align: right;'>معلومات المتجر</h3>" +
        "      <p><span>المتجر:</span> <strong>" + storeName + "</strong></p>" +
        "    </div>" +
        "  </div>" +
        "  <table>" +
        "    <thead>" +
        "      <tr>" +
        "        <th>المنتج</th>" +
        "        <th style='text-align: center;'>السعر</th>" +
        "        <th style='text-align: center;'>الكمية</th>" +
        "        <th style='text-align: left;'>الإجمالي</th>" +
        "      </tr>" +
        "    </thead>" +
        "    <tbody>" +
        itemsRows +
        "    </tbody>" +
        "  </table>" +
        "  <div class='totals-container'>" +
        "    <div class='totals-box'>" +
        "      <div class='total-row'>" +
        "        <span>المجموع الفرعي:</span>" +
        "        <span>" + Number(subtotal).toLocaleString() + " " + currency + "</span>" +
        "      </div>" +
        (discount > 0 ? 
        "      <div class='total-row' style='color: #ef4444;'>" +
        "        <span>الخصم:</span>" +
        "        <span>-" + Number(discount).toLocaleString() + " " + currency + "</span>" +
        "      </div>" : "") +
        (shipping > 0 ? 
        "      <div class='total-row'>" +
        "        <span>الشحن:</span>" +
        "        <span>" + Number(shipping).toLocaleString() + " " + currency + "</span>" +
        "      </div>" : "") +
        "      <div class='total-row final'>" +
        "        <span>الإجمالي:</span>" +
        "        <span style='color: " + primaryColor + "'>" + Number(total).toLocaleString() + " " + currency + "</span>" +
        "      </div>" +
        "    </div>" +
        "  </div>" +
        "  <div class='footer'>" +
        "    <p>شكراً لتسوقكم معنا من " + storeName + "</p>" +
        "    <p>تم إنشاء هذه الفاتورة تلقائياً</p>" +
        "  </div>" +
        "</body>" +
        "</html>";

      const win = window.open('', '_blank');
      if (win) {
        win.document.open();
        win.document.write(invoiceHtml);
        win.document.close();
        setTimeout(function() {
          try { win.focus(); win.print(); } catch(e){}
        }, 300);
      } else {
        let iframe = document.getElementById('printInvoiceIframe');
        if (iframe) iframe.remove();
        iframe = document.createElement('iframe');
        iframe.id = 'printInvoiceIframe';
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);

        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write(invoiceHtml);
        doc.close();

        setTimeout(function() {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        }, 300);
      }
    };
  ` : '';

  return c.html(storeLayout(storeData.name + ' - تتبع طلبك', trackingContent, storeData, customer, downloadScript));
});

// ─── Checkout Page ──────────────────────────────────────────────
store.get('/:slug/checkout', async (c) => {
  const slug = c.req.param('slug');
  const storeData = await c.env.DB.prepare("SELECT * FROM stores WHERE slug = ? AND status = 'active'").bind(slug).first() as any;
  if (!storeData) return c.redirect('/');

  const customer = await getLoggedInCustomer(c, storeData.id);
  if (!customer) {
    return c.redirect(`/store/${slug}/login?redirect=/store/${slug}/checkout`);
  }
  const primary = storeData.primary_color || '#4F46E5';
  const secondary = storeData.secondary_color || '#818CF8';

  const checkoutHtml = `
  <div class="max-w-6xl mx-auto px-4 py-8">
    <div class="flex flex-col lg:flex-row gap-8">
      
      <!-- Checkout Form -->
      <div class="flex-1 bg-card border border-std rounded-2xl p-6 shadow-sm">
        <h2 class="text-2xl font-bold text-main mb-6 flex items-center gap-2">
          <i class="fas fa-shopping-bag text-primary-500" style="color: ${primary};"></i> إتمام الطلب
        </h2>
        
        <form id="checkoutPageForm" class="space-y-5 text-right">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-sub mb-1.5">الاسم بالكامل *</label>
              <input type="text" id="ckPageName" required placeholder="محمد أحمد" value="${customer ? customer.name : ''}"
                class="w-full px-4 py-2.5 border border-std rounded-xl focus:ring-2 focus:outline-none">
            </div>
            <div>
              <label class="block text-sm font-medium text-sub mb-1.5">رقم الهاتف *</label>
              <input type="tel" id="ckPagePhone" required placeholder="776461892" value="${customer ? customer.phone : ''}" dir="ltr"
                class="w-full px-4 py-2.5 border border-std rounded-xl focus:ring-2 focus:outline-none">
            </div>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-sub mb-1.5">البريد الإلكتروني (اختياري)</label>
            <input type="email" id="ckPageEmail" placeholder="name@example.com" value="${customer ? customer.email || '' : ''}" dir="ltr"
              class="w-full px-4 py-2.5 border border-std rounded-xl focus:ring-2 focus:outline-none">
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-sub mb-1.5">المدينة *</label>
              <input type="text" id="ckPageCity" required placeholder="غيل باوزير" value="${customer ? customer.city || '' : ''}"
                class="w-full px-4 py-2.5 border border-std rounded-xl focus:ring-2 focus:outline-none">
            </div>
            <div>
              <label class="block text-sm font-medium text-sub mb-1.5">العنوان *</label>
              <input type="text" id="ckPageAddress" required placeholder="الشارع، الحي..." value="${customer ? customer.address || '' : ''}"
                class="w-full px-4 py-2.5 border border-std rounded-xl focus:ring-2 focus:outline-none">
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-sub mb-1.5">ملاحظات إضافية</label>
            <textarea id="ckPageNotes" rows="3" placeholder="أي ملاحظات خاصة بطلبك..."
              class="w-full px-4 py-2.5 border border-std rounded-xl focus:ring-2 focus:outline-none resize-none"></textarea>
          </div>

          <div class="border-t border-std pt-5 mt-5">
            <h3 class="font-bold text-main mb-4">طريقة الدفع</h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <label class="border border-primary-500 bg-primary-50/10 rounded-xl p-4 flex items-center justify-between cursor-pointer text-sm font-semibold text-main transition-all" id="labelCod">
                <div class="flex items-center gap-3">
                  <input type="radio" name="payment_method" value="cod" checked onchange="togglePaymentMethod('cod')"
                    class="text-primary-600 focus:ring-primary-500">
                  <span>الدفع عند الاستلام (COD)</span>
                </div>
                <i class="fas fa-hand-holding-usd text-lg text-primary-500" style="color: ${primary};"></i>
              </label>

              <label class="border border-std hover:border-std rounded-xl p-4 flex items-center justify-between cursor-pointer text-sm font-semibold text-main transition-all" id="labelReceipt">
                <div class="flex items-center gap-3">
                  <input type="radio" name="payment_method" value="receipt" onchange="togglePaymentMethod('receipt')"
                    class="text-primary-600 focus:ring-primary-500">
                  <span>الدفع بإرفاق سند</span>
                </div>
                <i class="fas fa-file-invoice-dollar text-lg text-gray-400"></i>
              </label>
            </div>

            <!-- Receipt & Bank Accounts Container -->
            <div id="pageReceiptBox" class="hidden space-y-4 p-4 rounded-xl bg-page border border-std mb-4">
              <div>
                <h4 class="font-bold text-sm text-main mb-2">الحسابات البنكية للمتجر:</h4>
                <div id="pageBankAccountsList" class="space-y-2 text-xs text-sub">
                  <!-- Dynamically populated -->
                </div>
              </div>
              <div class="border-t border-std pt-3">
                <label class="block text-xs font-bold text-sub mb-1.5">إرفاق صورة سند الدفع *</label>
                <input type="file" id="pageReceiptFile" accept="image/*"
                  class="w-full text-xs text-sub border border-std rounded-xl p-2 bg-card file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100">
              </div>
            </div>
          </div>

          <button type="submit" id="submitPageOrderBtn" class="w-full text-white font-bold py-3.5 rounded-xl mt-6 transition-all hover:opacity-90 shadow-lg text-center text-sm"
            style="background: linear-gradient(135deg, ${primary}, ${secondary});">
            تأكيد الطلب
          </button>
        </form>
      </div>

      <!-- Order Summary Card -->
      <div class="w-full lg:w-96 flex-shrink-0">
        <div class="bg-card border border-std rounded-2xl p-6 shadow-sm sticky top-24">
          <h3 class="font-bold text-main text-lg mb-5 border-b border-std pb-3">ملخص الطلب</h3>
          
          <!-- Items List -->
          <div id="checkoutPageItems" class="space-y-4 max-h-80 overflow-y-auto mb-5 pr-1">
            <!-- Rendered by client script -->
          </div>

          <!-- Coupon Code -->
          <div class="border-t border-std pt-5 mb-5">
            <label class="block text-xs font-bold text-sub mb-2">كود الخصم (اختياري)</label>
            <div class="flex gap-2">
              <input type="text" id="ckPageCoupon" placeholder="كود الكوبون"
                class="flex-1 px-3 py-2 text-sm border border-std rounded-xl focus:ring-2 focus:outline-none">
              <button onclick="applyPageCoupon()" class="px-4 py-2 border border-std text-sub hover:bg-page rounded-xl text-xs font-semibold">
                تطبيق
              </button>
            </div>
            <div id="couponPageMsg" class="text-xs mt-2 hidden"></div>
          </div>

          <!-- Price breakdown -->
          <div class="border-t border-std pt-4 space-y-3 text-sm">
            <div class="flex justify-between text-sub">
              <span>المجموع الفرعي:</span>
              <span id="ckPageSubtotal">0 ${storeData.currency}</span>
            </div>
            <div class="flex justify-between text-green-600 hidden" id="discountPageRow">
              <span>الخصم الكوبون:</span>
              <span id="ckPageDiscount">0 ${storeData.currency}</span>
            </div>
            <div class="flex justify-between text-sub">
              <span>تكلفة التوصيل:</span>
              <span id="ckPageShipping">0 ${storeData.currency}</span>
            </div>
            <div class="flex justify-between font-black text-base text-main border-t border-std pt-3">
              <span>الإجمالي النهائي:</span>
              <span id="ckPageTotal" style="color: ${primary};">0 ${storeData.currency}</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>
  `;

  return c.html(storeLayout(storeData.name + ' - إتمام الطلب', checkoutHtml, storeData, customer, `
    // ── Checkout Page Client Script (Self-Contained) ──
    (function() {
      const slug = '${storeData.slug}';
      const currency = '${storeData.currency}';
      const primaryColor = '${primary}';
      const shippingRates = ${storeData.shipping_rates || '[]'};
      
      let cart = JSON.parse(localStorage.getItem('cart_' + slug) || '[]');
      let appliedCoupon = null;

      function getShippingCost(city) {
        if (!city) return 0;
        const cleanCity = city.trim().toLowerCase();
        const match = shippingRates.find(r => r.city.trim().toLowerCase() === cleanCity);
        if (match) return match.cost;
        const fallback = shippingRates.find(r => r.city.trim().toLowerCase() === 'الكل' || r.city.trim() === 'all');
        if (fallback) return fallback.cost;
        return 0;
      }

      function renderItems() {
        const container = document.getElementById('checkoutPageItems');
        if (!container) return;
        if (cart.length === 0) {
          container.innerHTML = '<div class="text-center py-8 text-mute text-xs">السلة فارغة، جاري إعادتك للمتجر...</div>';
          showToast('السلة فارغة، جاري إعادتك للمتجر...', 'warning');
          setTimeout(() => {
            window.location.href = '/store/' + slug;
          }, 2000);
          return;
        }
        
        container.innerHTML = cart.map(item => {
          const itemPrice = parseFloat(item.price) || 0;
          const itemQty = parseInt(item.qty) || 1;
          const itemTotal = itemPrice * itemQty;
          return '<div class="flex items-center gap-3 border-b border-std pb-3">' +
            '<div class="w-12 h-12 rounded-lg bg-page overflow-hidden flex-shrink-0">' +
              '<img src="' + (item.image || 'https://via.placeholder.com/150') + '" class="w-full h-full object-cover">' +
            '</div>' +
            '<div class="flex-1 min-w-0">' +
              '<h4 class="font-bold text-main text-xs truncate">' + item.name + '</h4>' +
              '<p class="text-[10px] text-mute mt-0.5 truncate">' + (item.variant || '') + '</p>' +
              '<div class="flex justify-between items-center mt-1">' +
                '<span class="text-xs font-bold text-sub">' + itemQty + ' × ' + itemPrice.toLocaleString('ar-SA') + ' ' + currency + '</span>' +
                '<span class="text-xs font-black text-main">' + itemTotal.toLocaleString('ar-SA') + ' ' + currency + '</span>' +
              '</div>' +
            '</div>' +
          '</div>';
        }).join('');
      }

      function updateTotals() {
        const subtotal = cart.reduce((sum, i) => sum + (parseFloat(i.price) * parseInt(i.qty)), 0);
        document.getElementById('ckPageSubtotal').textContent = subtotal.toLocaleString('ar-SA') + ' ' + currency;
        
        const city = document.getElementById('ckPageCity').value;
        const shipping = getShippingCost(city);
        document.getElementById('ckPageShipping').textContent = shipping === 0 ? 'شحن مجاني' : shipping.toLocaleString('ar-SA') + ' ' + currency;

        let discount = 0;
        if (appliedCoupon) {
          if (appliedCoupon.type === 'percentage') {
            discount = (subtotal * appliedCoupon.value) / 100;
          } else {
            discount = appliedCoupon.value;
          }
          document.getElementById('discountPageRow').classList.remove('hidden');
          document.getElementById('ckPageDiscount').textContent = '-' + discount.toLocaleString('ar-SA') + ' ' + currency;
        } else {
          document.getElementById('discountPageRow').classList.add('hidden');
        }

        const total = Math.max(0, subtotal - discount + shipping);
        document.getElementById('ckPageTotal').textContent = total.toLocaleString('ar-SA') + ' ' + currency;
      }

      // Expose coupon apply and togglePaymentMethod to window
      window.applyPageCoupon = async function() {
        const code = document.getElementById('ckPageCoupon').value.trim();
        const msgEl = document.getElementById('couponPageMsg');
        if (!code) return;

        try {
          const subtotal = cart.reduce((sum, i) => sum + (parseFloat(i.price) * parseInt(i.qty)), 0);
          const res = await fetch('/api/store/' + slug + '/coupons/validate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, order_total: subtotal })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.message || 'كود غير صحيح');

          appliedCoupon = {
            coupon_id: data.id,
            value: data.value,
            type: data.type
          };
          msgEl.className = 'text-xs mt-2 text-green-600';
          msgEl.textContent = 'تم تطبيق الكود بنجاح! خصم ' + (data.type === 'percentage' ? data.value + '%' : data.value + ' ' + currency);
          msgEl.classList.remove('hidden');
          updateTotals();
        } catch (err) {
          appliedCoupon = null;
          msgEl.className = 'text-xs mt-2 text-red-500';
          msgEl.textContent = err.message;
          msgEl.classList.remove('hidden');
          updateTotals();
        }
      };

      const PAGE_BANK_ACCOUNTS = ${storeData.bank_accounts || '[]'};

      window.togglePaymentMethod = function(method) {
        const labelCod = document.getElementById('labelCod');
        const labelReceipt = document.getElementById('labelReceipt');
        const receiptBox = document.getElementById('pageReceiptBox');
        
        if (method === 'cod') {
          labelCod.className = 'border border-primary-500 bg-primary-50/10 rounded-xl p-4 flex items-center justify-between cursor-pointer text-sm font-semibold text-main transition-all';
          if (labelReceipt) {
            labelReceipt.className = 'border border-std hover:border-std rounded-xl p-4 flex items-center justify-between cursor-pointer text-sm font-semibold text-main transition-all';
            labelReceipt.querySelector('i').className = 'fas fa-file-invoice-dollar text-lg text-gray-400';
            labelReceipt.querySelector('i').style.color = '';
          }
          if (receiptBox) receiptBox.classList.add('hidden');
        } else {
          labelCod.className = 'border border-std hover:border-std rounded-xl p-4 flex items-center justify-between cursor-pointer text-sm font-semibold text-main transition-all';
          if (labelReceipt) {
            labelReceipt.className = 'border border-primary-500 bg-primary-50/10 rounded-xl p-4 flex items-center justify-between cursor-pointer text-sm font-semibold text-main transition-all';
            labelReceipt.querySelector('i').className = 'fas fa-file-invoice-dollar text-lg text-primary-500';
            labelReceipt.querySelector('i').style.color = primaryColor;
          }
          if (receiptBox) {
            receiptBox.classList.remove('hidden');
            const list = document.getElementById('pageBankAccountsList');
            if (list) {
              if (PAGE_BANK_ACCOUNTS.length === 0) {
                list.innerHTML = '<p class="text-mute">لا توجد حسابات بنكية مضافة حالياً.</p>';
              } else {
                list.innerHTML = PAGE_BANK_ACCOUNTS.map(b => \`
                  <div class="bg-card p-2.5 rounded-lg border border-std flex items-center justify-between">
                    <div>
                      <span class="font-bold text-main">\${b.bank_name}</span>
                      <p class="text-mute">\${b.account_name} - \${b.account_number}</p>
                      \${b.iban ? \`<p class="text-mute font-mono text-[10px]">IBAN: \${b.iban}</p>\` : ''}
                    </div>
                  </div>
                \`).join('');
              }
            }
          }
        }
      };

      // Bind event listeners
      document.getElementById('ckPageCity')?.addEventListener('input', updateTotals);

      document.getElementById('checkoutPageForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (cart.length === 0) {
          return showToast('السلة فارغة', 'error');
        }

        const method = document.querySelector('input[name="payment_method"]:checked').value;
        const btn = document.getElementById('submitPageOrderBtn');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin ml-2"></i>جاري إرسال الطلب...';

        try {
          const subtotal = cart.reduce((sum, i) => sum + (parseFloat(i.price) * parseInt(i.qty)), 0);
          const city = document.getElementById('ckPageCity').value;
          const shipping = getShippingCost(city);
          let discount = 0;
          if (appliedCoupon) {
            if (appliedCoupon.type === 'percentage') {
              discount = (subtotal * appliedCoupon.value) / 100;
            } else {
              discount = appliedCoupon.value;
            }
          }

          let receiptImageUrl = null;
          if (method === 'receipt') {
            const receiptInput = document.getElementById('pageReceiptFile');
            if (!receiptInput || !receiptInput.files || receiptInput.files.length === 0) {
              btn.disabled = false;
              btn.innerHTML = 'تأكيد الطلب';
              return showToast('يرجى إرفاق صورة سند الدفع للاستمرار', 'error');
            }
            // Convert file to base64
            receiptImageUrl = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = e => resolve(e.target.result);
              reader.onerror = reject;
              reader.readAsDataURL(receiptInput.files[0]);
            });
          }

          const payload = {
            customer_name: document.getElementById('ckPageName').value,
            customer_phone: document.getElementById('ckPagePhone').value,
            customer_email: document.getElementById('ckPageEmail').value,
            shipping_city: city,
            shipping_address: document.getElementById('ckPageAddress').value,
            notes: document.getElementById('ckPageNotes').value,
            items: cart.map(i => ({ product_id: i.id, quantity: i.qty, variant: i.variant || '' })),
            coupon_id: appliedCoupon ? (appliedCoupon.coupon_id || appliedCoupon.id) : null,
            discount_amount: discount,
            payment_method: method,
            receipt_image: receiptImageUrl
          };

          const res = await fetch('/api/store/' + slug + '/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.message || 'خطأ في معالجة الطلب');

          if (method === 'card' && data.checkout_url) {
            window.location.href = data.checkout_url;
            return;
          }

          // Clear local storage cart
          localStorage.removeItem('cart_' + slug);
          if (typeof updateCartUI === 'function') updateCartUI();

          document.body.innerHTML = '<div class="min-h-screen flex items-center justify-center bg-page p-4">' +
            '<div class="bg-card rounded-2xl shadow-xl p-10 text-center max-w-md w-full border border-std animate-fade-in">' +
              '<div class="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">' +
                '<i class="fas fa-check text-2xl text-green-500"></i>' +
              '</div>' +
              '<h2 class="text-2xl font-black text-main mb-3">تم إرسال طلبك بنجاح!</h2>' +
              '<p class="text-sub text-sm mb-6 leading-relaxed">شكراً لطلبك. رقم طلبك هو <strong class="text-main">#' + data.order_number + '</strong>. سيقوم فريقنا بالتواصل معك قريباً.</p>' +
              '<div class="space-y-3">' +
                '<a href="/store/' + slug + '" class="block w-full py-3 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition-colors text-sm" style="background:' + primaryColor + '">العودة للتسوق</a>' +
                '<a href="/store/' + slug + '/track?order=' + data.order_number + '&phone=' + payload.customer_phone + '" class="block w-full py-3 border border-std text-sub rounded-xl font-semibold hover:bg-page transition-colors text-sm">تتبع حالة الطلب</a>' +
              '</div>' +
            '</div>' +
          '</div>';
        } catch (err) {
          btn.disabled = false;
          btn.innerHTML = 'تأكيد الطلب';
          showToast(err.message || 'حدث خطأ غير متوقع', 'error');
        }
      });

      renderItems();
      updateTotals();
    })();
  `));
});

// ─── Customer Auth: Login Page ──────────────────────────────────
store.get('/:slug/login', async (c) => {
  const slug = c.req.param('slug');
  const storeData = await c.env.DB.prepare("SELECT * FROM stores WHERE slug = ? AND status = 'active'").bind(slug).first() as any;
  if (!storeData) return c.redirect('/');

  const redirectParam = c.req.query('redirect') || '';
  const customer = await getLoggedInCustomer(c, storeData.id);
  if (customer) {
    const targetUrl = redirectParam && redirectParam.startsWith(`/store/${slug}`) ? redirectParam : `/store/${slug}/account`;
    return c.redirect(targetUrl);
  }

  const primary = storeData.primary_color || '#4F46E5';
  const secondary = storeData.secondary_color || '#818CF8';

  const loginHtml = `
  <div class="max-w-md mx-auto px-4 py-16">
    <div class="bg-card rounded-2xl border border-std p-8 shadow-md">
      <div class="text-center mb-6">
        <div class="w-16 h-16 bg-primary-50 rounded-full flex items-center justify-center mx-auto mb-4" style="background: ${primary}15;">
          <i class="fas fa-user text-2xl" style="color: ${primary};"></i>
        </div>
        <h2 class="text-2xl font-bold text-main">تسجيل دخول العميل</h2>
        <p class="text-mute text-xs mt-1">سجل الدخول لمتابعة طلباتك السابقة وعناوين الشحن</p>
      </div>

      <form id="customerLoginForm" class="space-y-4 text-right">
        <input type="hidden" id="custRedirect" value="${redirectParam}">
        <div>
          <label class="block text-sm font-medium text-sub mb-1.5">البريد الإلكتروني / رقم الهاتف *</label>
          <input type="text" id="custLoginId" required placeholder="name@example.com أو 0500000000"
            class="w-full px-4 py-2.5 border border-std rounded-xl focus:ring-2 focus:outline-none">
        </div>
        <div>
          <div class="flex items-center justify-between mb-1.5">
            <label class="block text-sm font-medium text-sub">كلمة المرور *</label>
            <a href="https://wa.me/967776461892?text=${encodeURIComponent('مرحباً، لقد نسيت كلمة المرور الخاصة بحسابي كعميل وأحتاج إلى إعادة تعيينها.')}" target="_blank" class="text-xs font-semibold hover:underline" style="color: ${primary};">نسيت كلمة المرور؟</a>
          </div>
          <input type="password" id="custLoginPassword" required placeholder="••••••••"
            class="w-full px-4 py-2.5 border border-std rounded-xl focus:ring-2 focus:outline-none">
        </div>
        
        <button type="submit" id="custLoginBtn" class="w-full text-white font-semibold py-3 rounded-xl transition-all hover:opacity-90 mt-2 shadow-lg"
          style="background: linear-gradient(135deg, ${primary}, ${secondary});">
          تسجيل الدخول
        </button>
      </form>
      
      <div class="mt-6 text-center text-xs text-mute border-t border-std pt-4">
        ليس لديك حساب عميل؟ 
        <a href="/store/${slug}/register${redirectParam ? '?redirect=' + encodeURIComponent(redirectParam) : ''}" class="font-bold hover:underline" style="color: ${primary};">إنشاء حساب جديد</a>
      </div>
    </div>
  </div>
  `;

  return c.html(storeLayout(storeData.name + ' - دخول العميل', loginHtml, storeData, null, `
      document.getElementById('customerLoginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('custLoginBtn');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري التحقق...';
        
        try {
          const res = await fetch('/store/${slug}/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              loginId: document.getElementById('custLoginId').value,
              password: document.getElementById('custLoginPassword').value,
              redirect: document.getElementById('custRedirect').value
            })
          });
          const data = await res.json();
          if (!res.ok) {
            if (res.status === 404) {
              showToast(data.message || 'عذراً، الحساب غير مسجل. جاري تحويلك للتسجيل...', 'error');
              setTimeout(() => {
                window.location.href = '/store/${slug}/register' + (document.getElementById('custRedirect').value ? '?redirect=' + encodeURIComponent(document.getElementById('custRedirect').value) : '');
              }, 2500);
              return;
            }
            throw new Error(data.message || 'خطأ في التحقق');
          }
          
          if (data.requirePasswordChange) {
            window.location.href = '/store/' + '${slug}' + '/change-password?token=' + data.resetToken;
            return;
          }
          showToast('تم تسجيل الدخول بنجاح', 'success');
          setTimeout(() => window.location.href = data.redirect, 900);
        } catch (err) {
          btn.disabled = false;
          btn.innerHTML = 'تسجيل الدخول';
          showToast(err.message || 'خطأ في تسجيل الدخول', 'error');
        }
      });
  `));
});

store.post('/:slug/login', async (c) => {
  const slug = c.req.param('slug');
  const storeData = await c.env.DB.prepare("SELECT id FROM stores WHERE slug = ? AND status = 'active'").bind(slug).first() as any;
  if (!storeData) return c.json({ message: 'Store not found' }, 404);

  const { loginId, password, redirect } = await c.req.json() as any;
  if (!loginId || !password) return c.json({ message: 'البريد/الهاتف وكلمة المرور مطلوبة' }, 400);

  // Search by email or phone
  const customer = await c.env.DB.prepare(
    "SELECT * FROM customers WHERE store_id = ? AND (email = ? OR phone = ?)"
  ).bind(storeData.id, loginId.toLowerCase(), loginId).first() as any;

  if (!customer) {
    return c.json({ message: 'عذراً، هذا الحساب غير مسجل في هذا المتجر. جاري تحويلك لإنشاء حساب جديد...' }, 404);
  }

  if (!customer.password) {
    return c.json({ message: 'الحساب موجود ولكن يحتاج لتعيين كلمة مرور. جاري تحويلك لصفحة التسجيل...' }, 404);
  }

  const isValid = await verifyPassword(password, customer.password);
  if (!isValid) {
    return c.json({ message: 'كلمة المرور التي أدخلتها غير صحيحة. يرجى المحاولة مرة أخرى.' }, 401);
  }

  if (customer.force_password_change) {
    const resetToken = generateToken();
    const resetExpires = new Date(Date.now() + 3600 * 1000).toISOString();
    await c.env.DB.prepare(
      'INSERT INTO sessions (id, user_id, store_id, token, expires_at) VALUES (?, ?, ?, ?, ?)'
    ).bind(crypto.randomUUID(), customer.id, storeData.id, resetToken, resetExpires).run();
    return c.json({ requirePasswordChange: true, resetToken });
  }

  // Create session
  const token = generateToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30); // 30 days session

  await c.env.DB.prepare(
    'INSERT INTO sessions (id, user_id, store_id, token, expires_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(crypto.randomUUID(), customer.id, storeData.id, token, expiresAt.toISOString()).run();

  const targetRedirect = redirect && redirect.startsWith(`/store/${slug}`) ? redirect : `/store/${slug}/account`;

  // Set cookie
  const response = c.json({ success: true, redirect: targetRedirect });
  response.headers.set('Set-Cookie', `customer_token_${storeData.id}=${token}; Path=/; Max-Age=2592000; SameSite=Lax; HttpOnly`);
  return response;
});

// ─── Customer Auth: Change Password Page ──────────────────────
store.get('/:slug/change-password', async (c) => {
  const slug = c.req.param('slug');
  const token = c.req.query('token') || '';
  const storeData = await c.env.DB.prepare("SELECT * FROM stores WHERE slug = ? AND status = 'active'").bind(slug).first() as any;
  if (!storeData) return c.redirect('/');

  const primary = storeData.primary_color || '#4F46E5';
  const secondary = storeData.secondary_color || '#818CF8';

  const html = `
  <div class="max-w-md mx-auto px-4 py-16">
    <div class="bg-card rounded-2xl border border-std p-8 shadow-md text-right">
      <div class="text-center mb-6">
        <div class="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4 text-amber-600">
          <i class="fas fa-key text-2xl"></i>
        </div>
        <h2 class="text-2xl font-bold text-main">تغيير كلمة المرور الإجباري</h2>
        <p class="text-mute text-xs mt-1">قام مدير المتجر بتغيير كلمة المرور الخاصة بك. يرجى تعيين كلمة مرور جديدة للحساب.</p>
      </div>

      <form id="custChangePasswordForm" class="space-y-4">
        <input type="hidden" id="custResetToken" value="${token}">
        <div>
          <label class="block text-sm font-medium text-sub mb-1.5">كلمة المرور الجديدة *</label>
          <input type="password" id="custNewPassword" required minlength="6" placeholder="••••••••"
            class="w-full px-4 py-2.5 border border-std rounded-xl focus:ring-2 focus:outline-none">
        </div>
        <div>
          <label class="block text-sm font-medium text-sub mb-1.5">تأكيد كلمة المرور *</label>
          <input type="password" id="custConfirmPassword" required minlength="6" placeholder="••••••••"
            class="w-full px-4 py-2.5 border border-std rounded-xl focus:ring-2 focus:outline-none">
        </div>
        
        <button type="submit" id="custChangeBtn" class="w-full text-white font-semibold py-3 rounded-xl transition-all hover:opacity-90 mt-2 shadow-lg"
          style="background: linear-gradient(135deg, ${primary}, ${secondary});">
          حفظ كلمة المرور والدخول
        </button>
      </form>
    </div>
  </div>
  `;

  return c.html(storeLayout(storeData.name + ' - تغيير كلمة المرور', html, storeData, null, `
    document.getElementById('custChangePasswordForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const p1 = document.getElementById('custNewPassword').value;
      const p2 = document.getElementById('custConfirmPassword').value;
      if (p1 !== p2) {
        showToast('كلمتا المرور غير متطابقتين', 'error');
        return;
      }
      
      const btn = document.getElementById('custChangeBtn');
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';

      try {
        const res = await fetch('/store/${slug}/change-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: document.getElementById('custResetToken').value,
            newPassword: p1
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'حدث خطأ أثناء التعديل');
        
        showToast('تم تغيير كلمة المرور بنجاح!', 'success');
        setTimeout(() => window.location.href = '/store/${slug}/account', 1000);
      } catch (err) {
        btn.disabled = false;
        btn.innerHTML = 'حفظ كلمة المرور والدخول';
        showToast(err.message, 'error');
      }
    });
  `));
});

store.post('/:slug/change-password', async (c) => {
  const slug = c.req.param('slug');
  const storeData = await c.env.DB.prepare("SELECT id FROM stores WHERE slug = ? AND status = 'active'").bind(slug).first() as any;
  if (!storeData) return c.json({ message: 'Store not found' }, 404);

  const { token, newPassword } = await c.req.json() as any;
  if (!token || !newPassword || newPassword.length < 6) return c.json({ message: 'بيانات غير صالحة' }, 400);

  const session = await c.env.DB.prepare('SELECT * FROM sessions WHERE token = ? AND expires_at > CURRENT_TIMESTAMP').bind(token).first() as any;
  if (!session) return c.json({ message: 'الجلسة غير صالحة أو انتهت' }, 400);

  const hashedPassword = await hashPassword(newPassword);
  await c.env.DB.prepare('UPDATE customers SET password = ?, force_password_change = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .bind(hashedPassword, session.user_id).run();

  // Create session token
  const newToken = generateToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  await c.env.DB.prepare(
    'INSERT INTO sessions (id, user_id, store_id, token, expires_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(crypto.randomUUID(), session.user_id, storeData.id, newToken, expiresAt.toISOString()).run();

  await c.env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(session.id).run();

  const response = c.json({ success: true });
  response.headers.set('Set-Cookie', `customer_token_${storeData.id}=${newToken}; Path=/; Max-Age=2592000; SameSite=Lax; HttpOnly`);
  return response;
});

// ─── Customer Auth: Register Page ───────────────────────────────
store.get('/:slug/register', async (c) => {
  const slug = c.req.param('slug');
  const storeData = await c.env.DB.prepare("SELECT * FROM stores WHERE slug = ? AND status = 'active'").bind(slug).first() as any;
  if (!storeData) return c.redirect('/');

  const customer = await getLoggedInCustomer(c, storeData.id);
  if (customer) return c.redirect(`/store/${slug}/account`);

  const primary = storeData.primary_color || '#4F46E5';
  const secondary = storeData.secondary_color || '#818CF8';

  const registerHtml = `
  <div class="max-w-md mx-auto px-4 py-16">
    <div class="bg-card rounded-2xl border border-std p-8 shadow-md">
      <div class="text-center mb-6">
        <div class="w-16 h-16 bg-primary-50 rounded-full flex items-center justify-center mx-auto mb-4" style="background: ${primary}15;">
          <i class="fas fa-user-plus text-2xl" style="color: ${primary};"></i>
        </div>
        <h2 class="text-2xl font-bold text-main">حساب عميل جديد</h2>
        <p class="text-mute text-xs mt-1">سجل حساباً لمراجعة وإدارة مشترياتك في المتجر</p>
      </div>

      <form id="customerRegisterForm" class="space-y-4 text-right">
        <div>
          <label class="block text-sm font-medium text-sub mb-1.5">الاسم الكامل *</label>
          <input type="text" id="custRegName" required placeholder="محمد أحمد"
            class="w-full px-4 py-2.5 border border-std rounded-xl focus:ring-2 focus:outline-none">
        </div>
        <div>
          <label class="block text-sm font-medium text-sub mb-1.5">رقم الهاتف *</label>
          <input type="tel" id="custRegPhone" required placeholder="0500000000" dir="ltr"
            class="w-full px-4 py-2.5 border border-std rounded-xl focus:ring-2 focus:outline-none">
        </div>
        <div>
          <label class="block text-sm font-medium text-sub mb-1.5">البريد الإلكتروني *</label>
          <input type="email" id="custRegEmail" required placeholder="name@example.com" dir="ltr"
            class="w-full px-4 py-2.5 border border-std rounded-xl focus:ring-2 focus:outline-none">
        </div>
        <div>
          <label class="block text-sm font-medium text-sub mb-1.5">كلمة المرور *</label>
          <input type="password" id="custRegPassword" required minlength="6" placeholder="6 أحرف كحد أدنى"
            class="w-full px-4 py-2.5 border border-std rounded-xl focus:ring-2 focus:outline-none">
        </div>
        
        <button type="submit" id="custRegBtn" class="w-full text-white font-semibold py-3 rounded-xl transition-all hover:opacity-90 mt-2 shadow-lg"
          style="background: linear-gradient(135deg, ${primary}, ${secondary});">
          إنشاء الحساب والبدء
        </button>
      </form>
      
      <div class="mt-6 text-center text-xs text-mute border-t border-std pt-4">
        لديك حساب عميل بالفعل؟ 
        <a href="/store/${slug}/login" class="font-bold hover:underline" style="color: ${primary};">تسجيل الدخول</a>
      </div>
    </div>
  </div>
  `;

  return c.html(storeLayout(storeData.name + ' - حساب عميل جديد', registerHtml, storeData, null, `
      document.getElementById('customerRegisterForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('custRegBtn');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الإنشاء...';
        
        try {
          const res = await fetch('/store/${slug}/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: document.getElementById('custRegName').value,
              phone: document.getElementById('custRegPhone').value,
              email: document.getElementById('custRegEmail').value,
              password: document.getElementById('custRegPassword').value
            })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.message || 'خطأ في التسجيل');
          
          showToast('تم إنشاء الحساب بنجاح', 'success');
          setTimeout(() => window.location.href = data.redirect, 900);
        } catch (err) {
          btn.disabled = false;
          btn.innerHTML = 'إنشاء الحساب والبدء';
          showToast(err.message || 'خطأ في إنشاء الحساب', 'error');
        }
      });
  `));
});

store.post('/:slug/register', async (c) => {
  try {
    const slug = c.req.param('slug');
    const storeData = await c.env.DB.prepare("SELECT id FROM stores WHERE slug = ? AND status = 'active'").bind(slug).first() as any;
    if (!storeData) return c.json({ message: 'Store not found' }, 404);

    const { name, email, phone, password } = await c.req.json() as any;
    if (!name || !email || !phone || !password) {
      return c.json({ message: 'جميع الحقول مطلوبة' }, 400);
    }

    // Check if customer email or phone already registered in this store
    const existing = await c.env.DB.prepare(
      "SELECT id FROM customers WHERE store_id = ? AND (email = ? OR phone = ?)"
    ).bind(storeData.id, email.toLowerCase(), phone).first();

    if (existing) {
      return c.json({ message: 'البريد الإلكتروني أو رقم الهاتف مسجل مسبقاً في هذا المتجر' }, 400);
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Insert customer
    const result = await c.env.DB.prepare(
      `INSERT INTO customers (store_id, name, email, phone, password, total_orders, total_spent)
       VALUES (?, ?, ?, ?, ?, 0, 0)`
    ).bind(storeData.id, name, email.toLowerCase(), phone, hashedPassword).run();

    const customerId = result.meta.last_row_id;

    // Create session
    const token = generateToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await c.env.DB.prepare(
      'INSERT INTO sessions (id, user_id, store_id, token, expires_at) VALUES (?, ?, ?, ?, ?)'
    ).bind(crypto.randomUUID(), customerId, storeData.id, token, expiresAt.toISOString()).run();

    const response = c.json({ success: true, redirect: `/store/${slug}/account` }, 201);
    response.headers.set('Set-Cookie', `customer_token_${storeData.id}=${token}; Path=/; Max-Age=2592000; SameSite=Lax; HttpOnly`);
    return response;
  } catch (error: any) {
    console.error('Customer registration error:', error);
    return c.json({ message: 'حدث خطأ أثناء التسجيل: ' + error.message }, 500);
  }
});

// ─── Customer Auth: Logout ─────────────────────────────────────
store.get('/:slug/logout', async (c) => {
  const slug = c.req.param('slug');
  const storeData = await c.env.DB.prepare("SELECT id FROM stores WHERE slug = ? AND status = 'active'").bind(slug).first() as any;
  
  const redirectRes = c.redirect(`/store/${slug}`);
  if (storeData) {
    redirectRes.headers.set('Set-Cookie', `customer_token_${storeData.id}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT`);
  }
  return redirectRes;
});

// ─── Customer Dashboard Page ───────────────────────────────────
store.get('/:slug/account', async (c) => {
  const slug = c.req.param('slug');
  const storeData = await c.env.DB.prepare("SELECT * FROM stores WHERE slug = ? AND status = 'active'").bind(slug).first() as any;
  if (!storeData) return c.redirect('/');

  const customer = await getLoggedInCustomer(c, storeData.id);
  if (!customer) return c.redirect(`/store/${slug}/login`);

  const primary = storeData.primary_color || '#4F46E5';
  const secondary = storeData.secondary_color || '#818CF8';

  // Fetch customer orders
  const orders = await c.env.DB.prepare(
    'SELECT * FROM orders WHERE customer_id = ? AND store_id = ? ORDER BY created_at DESC'
  ).bind(customer.id, storeData.id).all();

  const ordersList = orders.results as any[];

  const statusMap: Record<string, { label: string; cls: string }> = {
    pending: { label: 'قيد الانتظار', cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
    processing: { label: 'قيد التجهيز', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    completed: { label: 'مكتمل', cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
    cancelled: { label: 'ملغي', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' }
  };

  const accountHtml = `
  <div class="max-w-4xl mx-auto px-4 py-8">
    <div class="flex flex-col md:flex-row gap-6">
      
      <!-- Customer Info Sidebar -->
      <aside class="w-full md:w-64 flex-shrink-0">
        <div class="bg-card rounded-2xl border border-std p-5 shadow-sm text-center">
          <div class="w-20 h-20 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-4 text-primary-600 text-2xl font-bold" style="background:${primary}15; color:${primary};">
            ${customer.name[0].toUpperCase()}
          </div>
          <h3 class="font-bold text-main text-base">${customer.name}</h3>
          <p class="text-xs text-mute mt-1">${customer.email}</p>
          <p class="text-xs text-mute mt-0.5">${customer.phone}</p>
          
          <div class="border-t border-std mt-5 pt-4 space-y-1">
            <button onclick="showTab('orders')" id="btn-orders" class="w-full text-right px-4 py-2 rounded-xl text-sm font-semibold transition-all bg-primary-50 text-primary-600" style="background:${primary}10; color:${primary};">
              <i class="fas fa-shopping-bag ml-2"></i> طلباتي السابقة
            </button>
            <button onclick="showTab('address')" id="btn-address" class="w-full text-right px-4 py-2 rounded-xl text-sm font-semibold transition-all text-sub hover:bg-page">
              <i class="fas fa-map-marker-alt ml-2"></i> عنوان التوصيل
            </button>
            <button onclick="showTab('password')" id="btn-password" class="w-full text-right px-4 py-2 rounded-xl text-sm font-semibold transition-all text-sub hover:bg-page">
              <i class="fas fa-lock ml-2"></i> تغيير كلمة المرور
            </button>
            <a href="/store/${slug}/logout" class="w-full text-right px-4 py-2 rounded-xl text-sm font-semibold transition-all text-red-500 hover:bg-red-50 block">
              <i class="fas fa-sign-out-alt ml-2"></i> تسجيل الخروج
            </a>
          </div>
        </div>
      </aside>

      <!-- Main Dashboard Panels -->
      <div class="flex-1">
        
        <!-- Panel 1: Orders -->
        <div id="panel-orders" class="bg-card rounded-2xl border border-std p-6 shadow-sm">
          <h3 class="font-bold text-main text-lg mb-5"><i class="fas fa-shopping-bag text-primary-500" style="color:${primary};"></i> طلباتي السابقة</h3>
          
          ${ordersList.length === 0 ? `
            <div class="text-center py-12 text-mute">
              <i class="fas fa-shopping-bag text-5xl mb-3 block text-gray-200"></i>
              <p class="text-sm">لم تقم بإجراء أي طلبات حتى الآن</p>
              <a href="/store/${slug}/products" class="inline-block mt-4 text-white font-semibold px-6 py-2.5 rounded-xl text-xs" style="background:${primary}">تصفح المنتجات</a>
            </div>
          ` : `
            <div class="space-y-4">
              ${ordersList.map(o => {
                const badge = statusMap[o.status] || { label: o.status, cls: 'bg-gray-100 text-sub' };
                return `
                <div class="border border-std rounded-xl p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-3 hover:border-std transition-colors">
                  <div>
                    <span class="text-xs text-mute">رقم الطلب</span>
                    <h4 class="font-bold text-main text-sm mt-0.5">${o.order_number}</h4>
                    <p class="text-xs text-mute mt-1">تاريخ الطلب: ${new Date(o.created_at || Date.now()).toLocaleDateString('ar-SA')}</p>
                  </div>
                  <div>
                    <span class="text-xs text-mute block mb-1">الحالة</span>
                    <span class="px-2.5 py-1 rounded-full text-xs font-semibold ${badge.cls}">${badge.label}</span>
                  </div>
                  <div class="sm:text-left">
                    <span class="text-xs text-mute block sm:text-left">المبلغ الإجمالي</span>
                    <span class="font-black text-sm text-main" style="color:${primary}">${o.total.toLocaleString('ar-SA')} ${o.currency}</span>
                  </div>
                  <div class="flex items-center gap-2 mt-2 sm:mt-0">
                    <a href="/store/${slug}/track?order=${o.order_number}&phone=${customer.phone}"
                      class="px-4 py-2 border border-std hover:bg-page text-sub rounded-xl text-xs font-semibold text-center flex-1 sm:flex-none">
                      تتبع
                    </a>
                  </div>
                </div>
                `;
              }).join('')}
            </div>
          `}
        </div>

        <!-- Panel 2: Address -->
        <div id="panel-address" class="hidden bg-card rounded-2xl border border-std p-6 shadow-sm">
          <h3 class="font-bold text-main text-lg mb-5"><i class="fas fa-map-marker-alt text-primary-500" style="color:${primary}"></i> بيانات الشحن الافتراضية</h3>
          
          <form id="shippingProfileForm" class="space-y-4 text-right">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-sub mb-1.5">الاسم بالكامل *</label>
                <input type="text" id="profName" value="${customer.name}" required
                  class="w-full px-4 py-2.5 border border-std rounded-xl focus:ring-2 focus:outline-none">
              </div>
              <div>
                <label class="block text-sm font-medium text-sub mb-1.5">رقم الهاتف *</label>
                <input type="tel" id="profPhone" value="${customer.phone}" required dir="ltr"
                  class="w-full px-4 py-2.5 border border-std rounded-xl focus:ring-2 focus:outline-none">
              </div>
              <div>
                <label class="block text-sm font-medium text-sub mb-1.5">البريد الإلكتروني *</label>
                <input type="email" id="profEmail" value="${customer.email || ''}" required dir="ltr"
                  class="w-full px-4 py-2.5 border border-std rounded-xl focus:ring-2 focus:outline-none">
              </div>
              <div>
                <label class="block text-sm font-medium text-sub mb-1.5">المدينة</label>
                <input type="text" id="profCity" value="${customer.city || ''}" placeholder="الرياض"
                  class="w-full px-4 py-2.5 border border-std rounded-xl focus:ring-2 focus:outline-none">
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium text-sub mb-1.5">العنوان الافتراضي</label>
              <textarea id="profAddress" rows="3" placeholder="الشارع، الحي، المعالم المميزة..."
                class="w-full px-4 py-2.5 border border-std rounded-xl focus:ring-2 focus:outline-none resize-none">${customer.address || ''}</textarea>
            </div>
            
            <button type="submit" id="profSaveBtn" class="bg-primary-600 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-primary-700 transition-colors" style="background:${primary}">
              حفظ بيانات العنوان
            </button>
          </form>
        </div>

        <!-- Panel 3: Password -->
        <div id="panel-password" class="hidden bg-card rounded-2xl border border-std p-6 shadow-sm">
          <h3 class="font-bold text-main text-lg mb-5"><i class="fas fa-lock text-primary-500" style="color:${primary}"></i> تغيير كلمة المرور</h3>
          
          <form id="customerPasswordForm" class="space-y-4 text-right">
            <div>
              <label class="block text-sm font-medium text-sub mb-1.5">كلمة المرور الحالية *</label>
              <input type="password" id="cpOldPassword" required
                class="w-full px-4 py-2.5 border border-std rounded-xl focus:ring-2 focus:outline-none">
            </div>
            <div>
              <label class="block text-sm font-medium text-sub mb-1.5">كلمة المرور الجديدة *</label>
              <input type="password" id="cpNewPassword" required minlength="6"
                class="w-full px-4 py-2.5 border border-std rounded-xl focus:ring-2 focus:outline-none">
            </div>
            <div>
              <label class="block text-sm font-medium text-sub mb-1.5">تأكيد كلمة المرور الجديدة *</label>
              <input type="password" id="cpConfirmPassword" required minlength="6"
                class="w-full px-4 py-2.5 border border-std rounded-xl focus:ring-2 focus:outline-none">
            </div>
            
            <button type="submit" id="cpSaveBtn" class="bg-primary-600 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-primary-700 transition-colors" style="background:${primary}">
              حفظ كلمة المرور
            </button>
          </form>
        </div>

      </div>
    </div>
  </div>
  `;

  return c.html(storeLayout(storeData.name + ' - بوابة العميل', accountHtml, storeData, customer, `
      function showTab(tab) {
        const panels = ['orders', 'address', 'password'];
        panels.forEach(p => {
          const panel = document.getElementById('panel-' + p);
          const btn = document.getElementById('btn-' + p);
          if (p === tab) {
            panel.classList.remove('hidden');
            btn.className = 'w-full text-right px-4 py-2 rounded-xl text-sm font-semibold transition-all bg-primary-50 text-primary-600';
            btn.style.background = '${primary}10';
            btn.style.color = '${primary}';
          } else {
            panel.classList.add('hidden');
            btn.className = 'w-full text-right px-4 py-2 rounded-xl text-sm font-semibold transition-all text-sub hover:bg-page';
            btn.style.background = 'none';
            btn.style.color = '';
          }
        });
      }

      document.getElementById('shippingProfileForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('profSaveBtn');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';

        try {
          const res = await fetch('/store/${slug}/account/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: document.getElementById('profName').value,
              phone: document.getElementById('profPhone').value,
              email: document.getElementById('profEmail').value,
              city: document.getElementById('profCity').value,
              address: document.getElementById('profAddress').value
            })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.message || 'خطأ في الحفظ');

          showToast('تم تحديث العنوان والبيانات بنجاح', 'success');
        } catch (err) {
          showToast(err.message || 'خطأ أثناء الحفظ', 'error');
        } finally {
          btn.disabled = false;
          btn.innerHTML = 'حفظ بيانات العنوان';
        }
      });

      document.getElementById('customerPasswordForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const oldPass = document.getElementById('cpOldPassword').value;
        const newPass = document.getElementById('cpNewPassword').value;
        const confPass = document.getElementById('cpConfirmPassword').value;

        if (newPass !== confPass) {
          return showToast('كلمة المرور الجديدة وتأكيدها غير متطابقين', 'error');
        }

        const btn = document.getElementById('cpSaveBtn');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';

        try {
          const res = await fetch('/store/${slug}/account/password', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ oldPassword: oldPass, newPassword: newPass })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.message || 'خطأ في التحديث');

          showToast('تم تغيير كلمة المرور بنجاح', 'success');
          document.getElementById('customerPasswordForm').reset();
        } catch (err) {
          showToast(err.message || 'خطأ أثناء التحديث', 'error');
        } finally {
          btn.disabled = false;
          btn.innerHTML = 'حفظ كلمة المرور';
        }
      });
  `));
});

store.post('/:slug/account/profile', async (c) => {
  const slug = c.req.param('slug');
  const storeData = await c.env.DB.prepare("SELECT id FROM stores WHERE slug = ? AND status = 'active'").bind(slug).first() as any;
  if (!storeData) return c.json({ message: 'Store not found' }, 404);

  const customer = await getLoggedInCustomer(c, storeData.id);
  if (!customer) return c.json({ message: 'Unauthorized' }, 401);

  const { name, phone, email, city, address } = await c.req.json() as any;
  if (!name || !phone || !email) {
    return c.json({ message: 'الاسم والهاتف والبريد مطلوبين' }, 400);
  }

  // Update profile
  await c.env.DB.prepare(
    `UPDATE customers
     SET name = ?, phone = ?, email = ?, city = ?, address = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND store_id = ?`
  ).bind(name, phone, email, city || null, address || null, customer.id, storeData.id).run();

  return c.json({ success: true, message: 'تم تحديث البيانات بنجاح' });
});

store.put('/:slug/account/password', async (c) => {
  const slug = c.req.param('slug');
  const storeData = await c.env.DB.prepare("SELECT id FROM stores WHERE slug = ? AND status = 'active'").bind(slug).first() as any;
  if (!storeData) return c.json({ message: 'Store not found' }, 404);

  const customer = await getLoggedInCustomer(c, storeData.id);
  if (!customer) return c.json({ message: 'Unauthorized' }, 401);

  const { oldPassword, newPassword } = await c.req.json() as any;
  if (!oldPassword || !newPassword) return c.json({ message: 'كلمة المرور القديمة والجديدة مطلوبة' }, 400);
  if (newPassword.length < 6) return c.json({ message: 'كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل' }, 400);

  // Get current customer password
  const currentCustomer = await c.env.DB.prepare(
    "SELECT password FROM customers WHERE id = ? AND store_id = ?"
  ).bind(customer.id, storeData.id).first() as any;

  if (!currentCustomer) return c.json({ message: 'Customer not found' }, 404);

  if (currentCustomer.password) {
    const isValid = await verifyPassword(oldPassword, currentCustomer.password);
    if (!isValid) return c.json({ message: 'كلمة المرور الحالية غير صحيحة' }, 400);
  }

  const hashedNew = await hashPassword(newPassword);

  await c.env.DB.prepare(
    'UPDATE customers SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND store_id = ?'
  ).bind(hashedNew, customer.id, storeData.id).run();

  return c.json({ success: true, message: 'تم تغيير كلمة المرور بنجاح' });
});

// ─── Post Product Review ──────────────────────────────────────
store.post('/:slug/products/:id/reviews', async (c) => {
  const slug = c.req.param('slug');
  const productId = parseInt(c.req.param('id'));

  const storeData = await c.env.DB.prepare(
    "SELECT id FROM stores WHERE slug = ? AND status = 'active'"
  ).bind(slug).first() as any;

  if (!storeData) return c.json({ message: 'المتجر غير موجود' }, 404);

  const customer = await getLoggedInCustomer(c, storeData.id);
  if (!customer) {
    return c.json({ message: 'يجب تسجيل الدخول كعميل أولاً لكتابة مراجعة' }, 401);
  }

  const { rating, comment } = await c.req.json() as any;
  const ratingVal = parseInt(rating);
  
  if (isNaN(ratingVal) || ratingVal < 1 || ratingVal > 5) {
    return c.json({ message: 'التقييم يجب أن يكون بين 1 و 5 نجوم' }, 400);
  }

  // Insert review
  await c.env.DB.prepare(
    `INSERT INTO product_reviews (store_id, product_id, customer_id, customer_name, rating, comment)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(storeData.id, productId, customer.id, customer.name, ratingVal, comment || null).run();

  return c.json({ success: true, message: 'تم إضافة مراجعتك بنجاح' });
});

// ─── Sitemap.xml Route ─────────────────────────────────────────
store.get('/:slug/sitemap.xml', async (c) => {
  const slug = c.req.param('slug');
  const storeData = await c.env.DB.prepare(
    "SELECT id, slug FROM stores WHERE slug = ? AND status = 'active'"
  ).bind(slug).first() as any;

  if (!storeData) return c.text('Not found', 404);

  const [products, categories] = await Promise.all([
    c.env.DB.prepare("SELECT id, slug, updated_at FROM products WHERE store_id = ? AND status = 'active'").bind(storeData.id).all(),
    c.env.DB.prepare("SELECT id, slug, updated_at FROM categories WHERE store_id = ? AND is_active = 1").bind(storeData.id).all()
  ]);

  const host = c.req.header('host') || 'platform.com';
  const proto = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https';
  const baseUrl = `${proto}://${host}/store/${storeData.slug}`;

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>`;

  // Append categories
  for (const cat of (categories.results as any[])) {
    xml += `
  <url>
    <loc>${baseUrl}/products?category=${cat.id}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
  }

  // Append products
  for (const prod of (products.results as any[])) {
    const lastmod = prod.updated_at ? new Date(prod.updated_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    xml += `
  <url>
    <loc>${baseUrl}/products/${prod.id}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>`;
  }

  xml += `\n</urlset>`;

  c.header('Content-Type', 'application/xml');
  return c.body(xml);
});

export default store;

