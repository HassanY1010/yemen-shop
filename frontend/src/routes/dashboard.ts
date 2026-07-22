// ============================================
// Merchant Dashboard Routes — Enhanced v2
// ============================================
import { Hono } from 'hono';
import { Bindings, Variables } from '../types/index';
import { dashboardLayout } from '../utils/templates';
import { formatCurrency, getOrderStatusLabel, getOrderStatusColor } from '../utils/helpers';
import { getToken } from '../middleware/auth';

const dashboard = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ─── Helper: Get Store ────────────────────────────────────────
async function getStore(dbOrContext: any, userId?: number) {
  if (dbOrContext && typeof dbOrContext.get === 'function') {
    return dbOrContext.get('store');
  }
  if (dbOrContext && typeof dbOrContext.prepare === 'function' && userId !== undefined) {
    return dbOrContext.prepare(
      'SELECT * FROM stores WHERE user_id = ? LIMIT 1'
    ).bind(userId).first();
  }
  return null;
}

// ─── Stat Card Helper ─────────────────────────────────────────
function statCard(label: string, value: string | number, icon: string, colorClass: string, sub: string = ''): string {
  return `
  <div class="bg-card rounded-2xl border border-std p-5 shadow-sm card-hover relative overflow-hidden">
    <div class="flex items-start justify-between mb-3">
      <div class="w-11 h-11 rounded-xl ${colorClass} flex items-center justify-center flex-shrink-0">
        <i class="fas fa-${icon} text-lg"></i>
      </div>
    </div>
    <p class="text-2xl font-black text-main leading-tight">${value}</p>
    <p class="text-sub text-sm mt-1 font-medium">${label}</p>
    ${sub ? `<p class="text-mute text-xs mt-0.5">${sub}</p>` : ''}
  </div>`;
}

// ─── Dashboard Overview ───────────────────────────────────────
dashboard.get('/', async (c) => {
  const user = c.get('user')!;
    const store = await getStore(c);
    if (!store) return c.redirect('/auth/register');

  const token = getToken(c);
  let overview: any = {};
  let analytics: any = {};

  try {
    const [overviewRes, analyticsRes] = await Promise.all([
      fetchLaravel('dashboard/overview', token),
      fetchLaravel('dashboard/analytics', token)
    ]);
    if (overviewRes.ok && analyticsRes.ok) {
      overview = await overviewRes.json();
      analytics = await analyticsRes.json();
    } else {
      throw new Error('Laravel fetch bypassed');
    }
  } catch (e) {
    const [ordersCnt, prodsCnt, custCnt, revRes, pendingCnt, recentOrd] = await Promise.all([
      c.env.DB.prepare('SELECT COUNT(*) as count FROM orders WHERE store_id = ?').bind(store.id).first() as any,
      c.env.DB.prepare('SELECT COUNT(*) as count FROM products WHERE store_id = ?').bind(store.id).first() as any,
      c.env.DB.prepare('SELECT COUNT(*) as count FROM customers WHERE store_id = ?').bind(store.id).first() as any,
      c.env.DB.prepare("SELECT COALESCE(SUM(total), 0) as revenue FROM orders WHERE store_id = ? AND payment_status = 'paid'").bind(store.id).first() as any,
      c.env.DB.prepare("SELECT COUNT(*) as count FROM orders WHERE store_id = ? AND status = 'pending'").bind(store.id).first() as any,
      c.env.DB.prepare('SELECT * FROM orders WHERE store_id = ? ORDER BY id DESC LIMIT 5').bind(store.id).all() as any,
    ]);

    overview = {
      stats: {
        orders: ordersCnt?.count || 0,
        products: prodsCnt?.count || 0,
        customers: custCnt?.count || 0,
        revenue: revRes?.revenue || 0,
        pending_orders: pendingCnt?.count || 0,
        low_stock: 0
      },
      recent_orders: recentOrd?.results || []
    };
    analytics = { top_products: [] };
  }

  const stats = overview.stats || {};
  const ordersTotal = { count: stats.orders || 0 };
  const productsTotal = { count: stats.products || 0 };
  const customersTotal = { count: stats.customers || 0 };
  const revenueResult = { revenue: stats.revenue || 0 };
  const pendingCount = { count: stats.pending_orders || 0 };
  const lowStockCount = { count: stats.low_stock || 0 };

  const recentOrders = { results: overview.recent_orders || [] };
  
  const chartLabels = JSON.stringify(['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو']);
  const chartRevenue = JSON.stringify([0, 0, 0, 0, 0, stats.revenue || 0]);
  const chartOrders = JSON.stringify([0, 0, 0, 0, 0, stats.orders || 0]);

  const topProducts = { results: analytics.top_products || [] };

  const plan = store.plan || { name: 'مجاني' };

  return c.html(dashboardLayout('لوحة التحكم', `
  <!-- Welcome Banner -->
  <div class="bg-gradient-to-l from-primary-600 via-primary-700 to-purple-700 rounded-2xl p-6 mb-6 text-white relative overflow-hidden">
    <div class="absolute top-0 left-0 w-full h-full opacity-10">
      <div class="absolute top-4 left-10 w-32 h-32 rounded-full bg-white"></div>
      <div class="absolute bottom-0 left-40 w-24 h-24 rounded-full bg-white"></div>
    </div>
    <div class="relative flex items-center justify-between flex-wrap gap-4">
      <div>
        <p class="text-primary-200 text-sm font-medium">مرحباً بك 👋</p>
        <h2 class="text-2xl font-black mt-0.5">${store.name}</h2>
        <p class="text-primary-200 text-sm mt-1">باقة: <strong class="text-white">${plan?.name || 'مجاني'}</strong></p>
      </div>
      <div class="flex gap-3">
        <a href="/store/${store.slug}" target="_blank"
           class="flex items-center gap-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white font-medium px-4 py-2 rounded-xl text-sm transition-colors">
          <i class="fas fa-external-link-alt text-xs"></i> عرض المتجر
        </a>
        <a href="/dashboard/products/create"
           class="flex items-center gap-2 bg-white text-primary-600 hover:bg-primary-50 font-bold px-4 py-2 rounded-xl text-sm transition-colors shadow-lg">
          <i class="fas fa-plus text-xs"></i> منتج جديد
        </a>
      </div>
    </div>
  </div>

  ${(pendingCount?.count > 0 || lowStockCount?.count > 0) ? `
  <!-- Alerts -->
  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
    ${pendingCount?.count > 0 ? `
    <a href="/dashboard/orders?status=pending" class="flex items-center gap-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors">
      <div class="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
        <i class="fas fa-clock text-blue-600"></i>
      </div>
      <div>
        <p class="font-bold text-blue-800 dark:text-blue-300">${pendingCount.count} طلب جديد</p>
        <p class="text-xs text-blue-600 dark:text-blue-400">ينتظر معالجتك الآن</p>
      </div>
      <i class="fas fa-arrow-left text-blue-500 mr-auto text-sm"></i>
    </a>` : ''}
    ${lowStockCount?.count > 0 ? `
    <a href="/dashboard/products" class="flex items-center gap-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-2xl p-4 hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors">
      <div class="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
        <i class="fas fa-exclamation-triangle text-orange-600"></i>
      </div>
      <div>
        <p class="font-bold text-orange-800 dark:text-orange-300">${lowStockCount.count} منتج</p>
        <p class="text-xs text-orange-600 dark:text-orange-400">قارب على النفاد في المخزن</p>
      </div>
      <i class="fas fa-arrow-left text-orange-500 mr-auto text-sm"></i>
    </a>` : ''}
  </div>` : ''}

  <!-- Stats Cards -->
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6" data-check-stock>
    ${statCard('إجمالي المبيعات', formatCurrency(revenueResult?.revenue || 0, store.currency), 'chart-line', 'bg-primary-50 dark:bg-primary-900/30 text-primary-600', 'الطلبات المكتملة')}
    ${statCard('الطلبات', ordersTotal?.count || 0, 'shopping-bag', 'bg-blue-50 dark:bg-blue-900/30 text-blue-600', `${pendingCount?.count || 0} في الانتظار`)}
    ${statCard('المنتجات', productsTotal?.count || 0, 'box', 'bg-green-50 dark:bg-green-900/30 text-green-600', `${lowStockCount?.count || 0} قارب على النفاد`)}
    ${statCard('العملاء', customersTotal?.count || 0, 'users', 'bg-purple-50 dark:bg-purple-900/30 text-purple-600', 'عميل مسجّل')}
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
    <!-- Revenue Chart -->
    <div class="lg:col-span-2 bg-card rounded-2xl border border-std p-5 shadow-sm">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-bold text-main">تطور المبيعات</h3>
        <span class="text-xs text-mute bg-gray-100 dark:bg-slate-700 px-3 py-1 rounded-full">آخر 6 أشهر</span>
      </div>
      <canvas id="salesChart" height="90"></canvas>
    </div>

    <!-- Recent Orders -->
    <div class="bg-card rounded-2xl border border-std p-5 shadow-sm">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-bold text-main">آخر الطلبات</h3>
        <a href="/dashboard/orders" class="text-primary-600 text-xs hover:underline font-medium">عرض الكل</a>
      </div>
      ${(recentOrders.results as any[]).length > 0 ? `
      <div class="space-y-2.5">
        ${(recentOrders.results as any[]).map(order => `
        <a href="/dashboard/orders/${order.id}" class="flex items-center justify-between p-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors gap-3">
          <div class="flex-1 min-w-0">
            <p class="text-xs font-bold text-primary-600">${order.order_number}</p>
            <p class="text-xs text-sub truncate">${order.customer_name}</p>
          </div>
          <div class="text-right flex-shrink-0">
            <p class="text-xs font-bold text-main">${formatCurrency(order.total, store.currency)}</p>
            <span class="text-xs px-1.5 py-0.5 rounded-full ${getOrderStatusColor(order.status)}">${getOrderStatusLabel(order.status)}</span>
          </div>
        </a>
        `).join('')}
      </div>
      ` : `<div class="text-center py-8 text-mute"><i class="fas fa-inbox text-3xl mb-2 block opacity-30"></i><p class="text-sm">لا توجد طلبات</p></div>`}
    </div>
  </div>

  <!-- Top Products -->
  <div class="bg-card rounded-2xl border border-std p-5 shadow-sm">
    <div class="flex items-center justify-between mb-4">
      <h3 class="font-bold text-main">أكثر المنتجات مبيعاً</h3>
      <a href="/dashboard/products" class="text-primary-600 text-xs hover:underline font-medium">إدارة المنتجات</a>
    </div>
    ${(topProducts.results as any[]).length > 0 ? `
    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      ${(topProducts.results as any[]).map(p => `
      <div class="text-center p-3 border border-std rounded-xl hover:border-primary-300 dark:hover:border-primary-600 transition-colors group">
        <div class="relative w-14 h-14 mx-auto mb-2">
          <img src="${p.image || 'https://via.placeholder.com/56'}" alt="${p.name}"
               class="w-full h-full object-cover rounded-xl">
        </div>
        <p class="text-xs font-medium text-main line-clamp-2 leading-tight">${p.name}</p>
        <p class="text-primary-600 font-black text-sm mt-1">${formatCurrency(p.price, store.currency)}</p>
        <p class="text-mute text-xs">${p.total_sold} مبيعة</p>
      </div>
      `).join('')}
    </div>` : `<p class="text-center text-mute py-6 text-sm"><i class="fas fa-box text-2xl mb-2 block opacity-30"></i>لا توجد مبيعات بعد</p>`}
  </div>
  `, user, store, 'overview', `
  <script>
    new Chart(document.getElementById('salesChart'), {
      type: 'line',
      data: {
        labels: ${chartLabels},
        datasets: [
          {
            label: 'المبيعات',
            data: ${chartRevenue},
            borderColor: '#4F46E5',
            backgroundColor: 'rgba(79,70,229,0.08)',
            fill: true,
            tension: 0.4,
            pointBackgroundColor: '#4F46E5',
            pointRadius: 4,
          },
          {
            label: 'الطلبات',
            data: ${chartOrders},
            borderColor: '#22C55E',
            backgroundColor: 'transparent',
            tension: 0.4,
            yAxisID: 'y1',
            pointBackgroundColor: '#22C55E',
            pointRadius: 4,
          }
        ]
      },
      options: {
        responsive: true,
        interaction: { mode: 'index' },
        plugins: { legend: { labels: { color: document.documentElement.className === 'dark' ? '#94a3b8' : '#64748b' } } },
        scales: {
          x: { grid: { display: false }, ticks: { color: document.documentElement.className === 'dark' ? '#64748b' : '#94a3b8' } },
          y: { beginAtZero: true, ticks: { color: document.documentElement.className === 'dark' ? '#64748b' : '#94a3b8' } },
          y1: { position: 'left', grid: { display: false }, ticks: { color: '#22C55E' }, beginAtZero: true }
        }
      }
    });
  </script>
  `, user, store, 'overview'));
});

// ─── Products List ────────────────────────────────────────────
dashboard.get('/products', async (c) => {
  const user = c.get('user')!;
  const store = await getStore(c.env.DB, user.id);
  if (!store) return c.redirect('/auth/register');

  const page = parseInt(c.req.query('page') || '1');
  const search = c.req.query('search') || '';
  const category = c.req.query('category') || '';
  const statusFilter = c.req.query('status') || '';
  const perPage = 12;
  const offset = (page - 1) * perPage;

  let query = `SELECT p.*, 
      (SELECT url FROM product_images WHERE product_id = p.id LIMIT 1) as image,
      c.name as category_name
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.store_id = ? AND p.status != 'deleted'`;
  const params: any[] = [store.id];

  if (search) { query += ' AND (p.name LIKE ? OR p.sku LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
  if (category) { query += ' AND p.category_id = ?'; params.push(category); }
  if (statusFilter) { query += ' AND p.status = ?'; params.push(statusFilter); }

  query += ` ORDER BY p.id DESC LIMIT ${perPage} OFFSET ${offset}`;

  const [products, totalCount, categories] = await Promise.all([
    c.env.DB.prepare(query).bind(...params).all(),
    c.env.DB.prepare(`SELECT COUNT(*) as count FROM products WHERE store_id = ? AND status != 'deleted'`).bind(store.id).first() as Promise<any>,
    c.env.DB.prepare('SELECT * FROM categories WHERE store_id = ?').bind(store.id).all(),
  ]);

  const totalPages = Math.ceil((totalCount?.count || 0) / perPage);

  return c.html(dashboardLayout('المنتجات', `
  <!-- Header -->
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
    <div>
      <p class="text-mute text-sm">${totalCount?.count || 0} منتج إجمالاً</p>
    </div>
    <a href="/dashboard/products/create"
       class="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors shadow-lg">
      <i class="fas fa-plus"></i> إضافة منتج
    </a>
  </div>

  <!-- Filters -->
  <div class="bg-card rounded-xl border border-std p-4 mb-6 flex flex-wrap gap-3 items-center">
    <div class="relative flex-1 min-w-44">
      <i class="fas fa-search absolute right-3 top-3 text-mute text-sm"></i>
      <input type="text" id="searchInput" value="${search}" placeholder="بحث..."
        class="w-full pr-9 pl-4 py-2.5 border border-std rounded-xl text-sm bg-page text-main focus:ring-2 focus:ring-primary-300 outline-none"
        onkeypress="if(event.key==='Enter') applyFilter()">
    </div>
    <select id="categoryFilter" onchange="applyFilter()"
      class="px-3 py-2.5 border border-std rounded-xl text-sm bg-page text-main focus:ring-2 focus:ring-primary-300 outline-none">
      <option value="">كل التصنيفات</option>
      ${(categories.results as any[]).map(cat =>
        `<option value="${cat.id}" ${category == cat.id ? 'selected' : ''}>${cat.name}</option>`
      ).join('')}
    </select>
    <select id="statusFilter" onchange="applyFilter()"
      class="px-3 py-2.5 border border-std rounded-xl text-sm bg-page text-main focus:ring-2 focus:ring-primary-300 outline-none">
      <option value="">كل الحالات</option>
      <option value="active" ${statusFilter === 'active' ? 'selected' : ''}>نشط</option>
      <option value="inactive" ${statusFilter === 'inactive' ? 'selected' : ''}>معطل</option>
    </select>
    <button onclick="applyFilter()" class="bg-primary-600 text-white px-4 py-2.5 rounded-xl text-sm hover:bg-primary-700 transition-colors flex-shrink-0">
      <i class="fas fa-filter ml-1"></i> تطبيق
    </button>
  </div>

  <!-- Products Grid -->
  ${(products.results as any[]).length > 0 ? `
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
    ${(products.results as any[]).map(product => `
    <div class="bg-card rounded-2xl border border-std overflow-hidden card-hover shadow-sm group">
      <div class="relative aspect-square bg-gray-50 dark:bg-slate-800">
        <img src="${product.image || 'https://via.placeholder.com/300x300?text=No+Image'}"
             alt="${product.name}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300">
        ${product.featured ? '<span class="absolute top-2 right-2 bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-1 rounded-full shadow"><i class="fas fa-star text-xs ml-1"></i>مميز</span>' : ''}
        ${product.stock === 0 ? '<div class="absolute inset-0 bg-black/50 flex items-center justify-center"><span class="bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full">نفد المخزون</span></div>' : product.stock <= 5 ? '<span class="absolute bottom-2 right-2 bg-orange-400 text-white text-xs font-bold px-2 py-1 rounded-full">مخزن منخفض</span>' : ''}
        ${product.status === 'inactive' ? '<span class="absolute top-2 left-2 bg-gray-700/80 text-white text-xs px-2 py-0.5 rounded-full">معطل</span>' : ''}
      </div>
      <div class="p-4">
        <p class="text-xs text-primary-600 dark:text-primary-400 font-medium mb-1">${product.category_name || 'بدون تصنيف'}</p>
        <h3 class="font-semibold text-main text-sm line-clamp-2 mb-2">${product.name}</h3>
        <div class="flex items-center justify-between mb-3">
          <div>
            ${product.sale_price ? `
              <span class="text-primary-600 font-bold text-sm">${formatCurrency(product.sale_price, store.currency)}</span>
              <span class="text-mute line-through text-xs mr-1">${formatCurrency(product.price, store.currency)}</span>
            ` : `<span class="text-primary-600 font-bold text-sm">${formatCurrency(product.price, store.currency)}</span>`}
          </div>
          <span class="text-xs text-mute flex items-center gap-1">
            <i class="fas fa-cubes text-xs"></i>${product.stock}
          </span>
        </div>
        <div class="flex items-center gap-2 pt-3 border-t border-std">
          <a href="/dashboard/products/${product.id}/edit"
             class="flex-1 text-center bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-900/50 text-xs font-medium py-2 rounded-xl transition-colors">
            <i class="fas fa-edit ml-1"></i>تعديل
          </a>
          <button onclick="deleteProduct(${product.id})"
             class="flex-1 text-center bg-red-50 dark:bg-red-900/20 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 text-xs font-medium py-2 rounded-xl transition-colors">
            <i class="fas fa-trash ml-1"></i>حذف
          </button>
        </div>
      </div>
    </div>
    `).join('')}
  </div>

  <!-- Pagination -->
  ${totalPages > 1 ? `
  <div class="flex items-center justify-center gap-2 mt-6">
    ${page > 1 ? `<a href="?page=${page-1}${search ? '&search='+encodeURIComponent(search) : ''}" class="px-4 py-2 bg-card border border-std rounded-xl text-sm text-sub hover:border-primary-400 transition-colors">السابق</a>` : ''}
    ${Array.from({length: Math.min(5, totalPages)}, (_, i) => i + 1).map(p => `
    <a href="?page=${p}${search ? '&search='+encodeURIComponent(search) : ''}" class="w-9 h-9 flex items-center justify-center rounded-xl text-sm font-medium transition-colors ${p === page ? 'bg-primary-600 text-white' : 'bg-card border border-std text-sub hover:border-primary-400'}">${p}</a>
    `).join('')}
    ${page < totalPages ? `<a href="?page=${page+1}${search ? '&search='+encodeURIComponent(search) : ''}" class="px-4 py-2 bg-card border border-std rounded-xl text-sm text-sub hover:border-primary-400 transition-colors">التالي</a>` : ''}
  </div>` : ''}
  ` : `
  <div class="bg-card rounded-2xl border border-std p-16 text-center shadow-sm">
    <div class="w-20 h-20 bg-gray-100 dark:bg-slate-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
      <i class="fas fa-box text-3xl text-mute"></i>
    </div>
    <h3 class="text-xl font-bold text-main mb-2">لا توجد منتجات</h3>
    <p class="text-mute mb-6">ابدأ بإضافة منتجاتك الأولى لمتجرك</p>
    <a href="/dashboard/products/create" class="bg-primary-600 text-white px-6 py-2.5 rounded-xl inline-flex items-center gap-2 hover:bg-primary-700 transition-colors shadow-lg">
      <i class="fas fa-plus"></i> إضافة أول منتج
    </a>
  </div>
  `}
  `, user, store, 'products', `
  <script>
    function applyFilter() {
      const s = document.getElementById('searchInput').value;
      const c = document.getElementById('categoryFilter').value;
      const st = document.getElementById('statusFilter').value;
      let url = '/dashboard/products?';
      if (s) url += 'search=' + encodeURIComponent(s) + '&';
      if (c) url += 'category=' + c + '&';
      if (st) url += 'status=' + st;
      window.location.href = url;
    }
    async function deleteProduct(id) {
      if (!confirmDelete('هل أنت متأكد من حذف هذا المنتج؟')) return;
      try {
        await axios.delete('/api/dashboard/products/' + id);
        showToast('تم حذف المنتج', 'success');
        setTimeout(() => location.reload(), 900);
      } catch(err) { showToast(err.response?.data?.message || 'خطأ في الحذف', 'error'); }
    }
  </script>
  `));
});

// ─── Create Product ───────────────────────────────────────────
dashboard.get('/products/create', async (c) => {
  const user = c.get('user')!;
  const store = await getStore(c.env.DB, user.id);
  if (!store) return c.redirect('/auth/register');
  const categories = await c.env.DB.prepare('SELECT * FROM categories WHERE store_id = ? AND is_active = 1 ORDER BY sort_order').bind(store.id).all();
  return c.html(dashboardLayout('إضافة منتج جديد', productForm(store, categories.results as any[], null), user, store, 'products'));
});

// ─── Edit Product ─────────────────────────────────────────────
dashboard.get('/products/:id/edit', async (c) => {
  const user = c.get('user')!;
  const store = await getStore(c.env.DB, user.id);
  if (!store) return c.redirect('/auth/register');
  const productId = parseInt(c.req.param('id'));
  const product = await c.env.DB.prepare(
    'SELECT * FROM products WHERE id = ? AND store_id = ?'
  ).bind(productId, store.id).first() as any;
  if (!product) return c.redirect('/dashboard/products');

  const imagesDb = await c.env.DB.prepare(
    'SELECT url FROM product_images WHERE product_id = ? ORDER BY sort_order'
  ).bind(productId).all();
  product.image_urls = (imagesDb.results as any[]).map((img: any) => img.url).join(',');

  const variants = await c.env.DB.prepare(
    'SELECT * FROM product_variants WHERE product_id = ? AND store_id = ? AND is_active = 1 ORDER BY sort_order'
  ).bind(productId, store.id).all();
  product.variants = variants.results || [];

  const categories = await c.env.DB.prepare('SELECT * FROM categories WHERE store_id = ? AND is_active = 1').bind(store.id).all();
  return c.html(dashboardLayout('تعديل المنتج', productForm(store, categories.results as any[], product), user, store, 'products'));
});

// ─── Orders List ──────────────────────────────────────────────
dashboard.get('/orders', async (c) => {
  const user = c.get('user')!;
  const store = await getStore(c.env.DB, user.id);
  if (!store) return c.redirect('/auth/register');

  const status = c.req.query('status') || '';
  const search = c.req.query('search') || '';
  const page = parseInt(c.req.query('page') || '1');
  const perPage = 15;
  const offset = (page - 1) * perPage;

  let query = 'SELECT * FROM orders WHERE store_id = ?';
  const params: any[] = [store.id];
  if (status) { query += ' AND status = ?'; params.push(status); }
  if (search) { query += ' AND (order_number LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
  query += ` ORDER BY created_at DESC LIMIT ${perPage} OFFSET ${offset}`;

  const [orders, totalCount, statusCounts] = await Promise.all([
    c.env.DB.prepare(query).bind(...params).all(),
    c.env.DB.prepare('SELECT COUNT(*) as count FROM orders WHERE store_id = ?').bind(store.id).first() as Promise<any>,
    c.env.DB.prepare("SELECT status, COUNT(*) as cnt FROM orders WHERE store_id = ? GROUP BY status").bind(store.id).all(),
  ]);

  const statusMap: Record<string, number> = {};
  (statusCounts.results as any[]).forEach(r => { statusMap[r.status] = r.cnt; });
  const statusTabs = [
    { val: '', label: 'الكل', count: totalCount?.count || 0 },
    { val: 'pending', label: 'جديد', count: statusMap['pending'] || 0 },
    { val: 'processing', label: 'قيد المعالجة', count: statusMap['processing'] || 0 },
    { val: 'completed', label: 'مكتمل', count: statusMap['completed'] || 0 },
    { val: 'cancelled', label: 'ملغي', count: statusMap['cancelled'] || 0 },
  ];

  return c.html(dashboardLayout('الطلبات', `
  <!-- Header -->
  <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-5">
    <!-- Status Tabs -->
    <div class="flex gap-1 bg-card p-1 rounded-xl border border-std overflow-x-auto flex-shrink-0">
      ${statusTabs.map(tab => `
      <a href="/dashboard/orders${tab.val ? '?status=' + tab.val : ''}"
         class="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${status === tab.val ? 'bg-primary-600 text-white shadow' : 'text-sub hover:bg-gray-100 dark:hover:bg-slate-700'}">
        ${tab.label}
        <span class="text-xs px-1.5 py-0.5 rounded-full font-bold ${status === tab.val ? 'bg-white/20 text-white' : 'bg-gray-100 dark:bg-slate-700 text-mute'}">${tab.count}</span>
      </a>
      `).join('')}
    </div>
    <div class="flex items-center gap-2 w-full sm:w-auto">
      <!-- Search -->
      <div class="relative flex-1 sm:w-56">
        <i class="fas fa-search absolute right-3 top-3 text-mute text-xs"></i>
        <input type="text" id="orderSearch" value="${search}" placeholder="بحث..."
          class="w-full pr-8 pl-3 py-2.5 border border-std rounded-xl text-sm bg-page text-main focus:ring-2 focus:ring-primary-300 outline-none"
          onkeypress="if(event.key==='Enter'){window.location='/dashboard/orders?search='+encodeURIComponent(this.value)${status ? "+'&status='+'" + status + "'" : ''}}">
      </div>
      <a href="/api/dashboard/orders/export"
         class="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-3 py-2.5 rounded-xl transition-colors shadow-sm flex-shrink-0"
         data-tooltip="تصدير CSV">
        <i class="fas fa-file-csv"></i>
        <span class="hidden sm:inline">تصدير</span>
      </a>
    </div>
  </div>

  <div class="bg-card rounded-2xl border border-std shadow-sm overflow-hidden">
    <div class="overflow-x-auto">
      <table class="w-full">
        <thead class="bg-gray-50 dark:bg-slate-800">
          <tr>
            <th class="text-right px-5 py-3 text-xs font-medium text-mute">رقم الطلب</th>
            <th class="text-right px-5 py-3 text-xs font-medium text-mute">العميل</th>
            <th class="text-right px-5 py-3 text-xs font-medium text-mute hidden sm:table-cell">المبلغ</th>
            <th class="text-right px-5 py-3 text-xs font-medium text-mute">الحالة</th>
            <th class="text-right px-5 py-3 text-xs font-medium text-mute hidden md:table-cell">الدفع</th>
            <th class="text-right px-5 py-3 text-xs font-medium text-mute hidden lg:table-cell">التاريخ</th>
            <th class="text-right px-5 py-3 text-xs font-medium text-mute">إجراء</th>
          </tr>
        </thead>
        <tbody>
          ${(orders.results as any[]).length > 0 ? (orders.results as any[]).map(order => `
          <tr class="border-t border-std hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
            <td class="px-5 py-3.5">
              <a href="/dashboard/orders/${order.id}" class="text-primary-600 dark:text-primary-400 font-bold hover:underline text-sm">${order.order_number}</a>
            </td>
            <td class="px-5 py-3.5">
              <p class="font-medium text-main text-sm">${order.customer_name}</p>
              <p class="text-mute text-xs">${order.customer_phone || ''}</p>
            </td>
            <td class="px-5 py-3.5 font-bold text-main hidden sm:table-cell">${formatCurrency(order.total, store.currency)}</td>
            <td class="px-5 py-3.5">
              <select onchange="updateOrderStatus(${order.id}, this.value)"
                class="text-xs border border-std rounded-full px-2 py-1 font-medium cursor-pointer bg-card text-main ${getOrderStatusColor(order.status)}">
                <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>جديد</option>
                <option value="processing" ${order.status === 'processing' ? 'selected' : ''}>قيد المعالجة</option>
                <option value="completed" ${order.status === 'completed' ? 'selected' : ''}>مكتمل</option>
                <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>ملغي</option>
              </select>
            </td>
            <td class="px-5 py-3.5 hidden md:table-cell">
              <span class="px-2.5 py-1 rounded-full text-xs font-medium ${order.payment_status === 'paid' ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400'}">
                ${order.payment_status === 'paid' ? '<i class="fas fa-check-circle ml-1"></i>مدفوع' : '<i class="fas fa-clock ml-1"></i>معلق'}
              </span>
            </td>
            <td class="px-5 py-3.5 text-sub text-sm hidden lg:table-cell">${new Date(order.created_at).toLocaleDateString('ar-SA')}</td>
            <td class="px-5 py-3.5">
              <a href="/dashboard/orders/${order.id}"
                 class="w-8 h-8 flex items-center justify-center text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors" data-tooltip="تفاصيل">
                <i class="fas fa-eye text-sm"></i>
              </a>
            </td>
          </tr>
          `).join('') : `
          <tr><td colspan="7" class="text-center py-16 text-mute">
            <i class="fas fa-inbox text-4xl mb-3 block opacity-20"></i>
            <p>لا توجد طلبات</p>
          </td></tr>`}
        </tbody>
      </table>
    </div>
  </div>
  `, user, store, 'orders', `
  <script>
    async function updateOrderStatus(orderId, status) {
      try {
        await axios.put('/api/dashboard/orders/' + orderId + '/status', { status });
        showToast('تم تحديث حالة الطلب', 'success');
        setTimeout(() => location.reload(), 900);
      } catch(err) { showToast('خطأ في التحديث', 'error'); }
    }
  </script>
  `));
});

// ─── Order Details ────────────────────────────────────────────
dashboard.get('/orders/:id', async (c) => {
  const user = c.get('user')!;
  const store = await getStore(c.env.DB, user.id);
  if (!store) return c.redirect('/auth/register');

  const orderId = parseInt(c.req.param('id'));
  const order = await c.env.DB.prepare('SELECT * FROM orders WHERE id = ? AND store_id = ?').bind(orderId, store.id).first() as any;
  if (!order) return c.redirect('/dashboard/orders');

  const orderItems = await c.env.DB.prepare(
    `SELECT oi.*, img.url as product_image 
     FROM order_items oi
     LEFT JOIN product_images img ON oi.product_id = img.product_id AND img.is_primary = 1
     WHERE oi.order_id = ?`
  ).bind(orderId).all();

  return c.html(dashboardLayout(`الطلب #${order.order_number}`, `
  <!-- Back & Actions -->
  <div class="flex items-center justify-between mb-5 no-print">
    <a href="/dashboard/orders" class="flex items-center gap-2 text-sub hover:text-primary-600 transition-colors text-sm font-medium">
      <i class="fas fa-arrow-right"></i> العودة
    </a>
    <div class="flex items-center gap-2">
      <button onclick="downloadInvoicePDF()"
              class="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-medium px-4 py-2 rounded-xl text-sm transition-colors shadow-sm">
        <i class="fas fa-file-pdf"></i> تحميل الفاتورة (PDF)
      </button>
      <button onclick="window.print()"
              class="flex items-center gap-2 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-sub font-medium px-4 py-2 rounded-xl text-sm transition-colors">
        <i class="fas fa-print"></i> طباعة
      </button>
      ${order.customer_phone ? `
      <a href="https://wa.me/${order.customer_phone.replace(/\D/g,'')}?text=${encodeURIComponent(`مرحباً ${order.customer_name}، بخصوص طلبك رقم #${order.order_number}`)}"
         target="_blank"
         class="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white font-medium px-4 py-2 rounded-xl text-sm transition-colors">
        <i class="fab fa-whatsapp"></i> واتساب
      </a>` : ''}
    </div>
  </div>

  <!-- Print Header -->
  <div class="print-only mb-6 text-center border-b pb-4">
    <h1 class="text-2xl font-bold">${store.name}</h1>
    <p class="text-gray-600 text-sm mt-1">فاتورة الطلب رقم: #${order.order_number}</p>
    <p class="text-sm text-gray-500 mt-0.5">${new Date(order.created_at).toLocaleDateString('ar-SA')}</p>
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
    <!-- Items + Totals -->
    <div class="lg:col-span-2 space-y-5">
      <div class="bg-card rounded-2xl border border-std shadow-sm overflow-hidden">
        <div class="p-5 border-b border-std flex items-center justify-between">
          <h3 class="font-bold text-main">المنتجات المطلوبة</h3>
          <span class="text-xs bg-gray-100 dark:bg-slate-700 text-mute px-2.5 py-1 rounded-full">${(orderItems.results as any[]).length} منتج</span>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 dark:bg-slate-800">
              <tr>
                <th class="text-right px-5 py-3 font-medium text-mute">المنتج</th>
                <th class="text-right px-5 py-3 font-medium text-mute">السعر</th>
                <th class="text-right px-5 py-3 font-medium text-mute">الكمية</th>
                <th class="text-right px-5 py-3 font-medium text-mute">الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              ${(orderItems.results as any[]).map(item => `
              <tr class="border-t border-std hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                <td class="px-5 py-3.5 font-medium text-main">${item.product_name}</td>
                <td class="px-5 py-3.5 text-sub">${formatCurrency(item.price, store.currency)}</td>
                <td class="px-5 py-3.5 text-sub">${item.quantity}</td>
                <td class="px-5 py-3.5 font-bold text-main">${formatCurrency(item.total, store.currency)}</td>
              </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        <div class="p-5 border-t border-std">
          <div class="flex justify-end">
            <div class="space-y-2 text-sm min-w-52">
              <div class="flex justify-between gap-8"><span class="text-sub">المجموع الفرعي:</span><span class="font-medium text-main">${formatCurrency(order.subtotal, store.currency)}</span></div>
              ${(order.discount_amount || 0) > 0 ? `<div class="flex justify-between gap-8"><span class="text-green-600"><i class="fas fa-tag ml-1"></i>خصم:</span><span class="font-medium text-green-600">-${formatCurrency(order.discount_amount, store.currency)}</span></div>` : ''}
              ${(order.shipping || 0) > 0 ? `<div class="flex justify-between gap-8"><span class="text-sub">الشحن:</span><span class="font-medium text-main">${formatCurrency(order.shipping, store.currency)}</span></div>` : ''}
              <div class="flex justify-between gap-8 pt-2 border-t border-std font-black text-base">
                <span class="text-main">الإجمالي:</span>
                <span class="text-primary-600">${formatCurrency(order.total, store.currency)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      ${order.notes ? `
      <div class="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded-2xl p-5">
        <h3 class="font-bold text-yellow-800 dark:text-yellow-300 mb-2 flex items-center gap-2">
          <i class="fas fa-sticky-note"></i> ملاحظات العميل
        </h3>
        <p class="text-yellow-700 dark:text-yellow-400 text-sm">${order.notes}</p>
      </div>` : ''}

      <!-- Products Images Showcase -->
      ${(orderItems.results as any[]).some(item => item.product_image) ? `
      <div class="bg-card rounded-2xl border border-std p-5 shadow-sm mt-5">
        <h3 class="font-bold text-main mb-4 flex items-center gap-2 text-sm">
          <i class="fas fa-images text-primary-500"></i> صور المنتجات المطلوبة
        </h3>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
          ${(orderItems.results as any[]).map(item => item.product_image ? `
          <div class="bg-card rounded-2xl border border-std p-3 shadow-sm flex flex-col gap-2 hover:border-std transition-colors">
            <div class="aspect-square rounded-xl overflow-hidden bg-page border border-std flex items-center justify-center">
              <img src="${item.product_image}" class="w-full h-full object-cover">
            </div>
            <p class="text-xs font-bold text-main truncate text-center mb-0" title="${item.product_name}">${item.product_name}</p>
          </div>
          ` : '').join('')}
        </div>
      </div>` : ''}
    </div>

    <!-- Side Panel -->
    <div class="space-y-4">
      <!-- Order Status -->
      <div class="bg-card rounded-2xl border border-std shadow-sm p-5 no-print">
        <h3 class="font-bold text-main mb-4 flex items-center gap-2">
          <i class="fas fa-flag text-primary-500"></i> حالة الطلب
        </h3>
        <select id="orderStatus"
          class="w-full px-4 py-2.5 border border-std rounded-xl text-sm bg-page text-main focus:ring-2 focus:ring-primary-300 outline-none mb-3">
          <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>🕒 جديد</option>
          <option value="processing" ${order.status === 'processing' ? 'selected' : ''}>⚙️ قيد المعالجة</option>
          <option value="completed" ${order.status === 'completed' ? 'selected' : ''}>✅ مكتمل</option>
          <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>❌ ملغي</option>
        </select>
        <button id="saveStatusBtn" onclick="saveOrderStatus(${order.id})"
          class="w-full mb-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
          style="background: ${store.primary_color || '#4F46E5'}">
          <i class="fas fa-save"></i> حفظ الحالة
        </button>
        <div class="p-3 rounded-xl text-center text-sm font-bold ${getOrderStatusColor(order.status)}">
          ${getOrderStatusLabel(order.status)}
        </div>
      </div>

      <!-- Customer -->
      <div class="bg-card rounded-2xl border border-std shadow-sm p-5">
        <h3 class="font-bold text-main mb-4 flex items-center gap-2">
          <i class="fas fa-user-circle text-blue-500"></i> معلومات العميل
        </h3>
        <div class="space-y-2">
          <div class="flex items-center gap-3 p-2.5 bg-gray-50 dark:bg-slate-800 rounded-xl">
            <i class="fas fa-user text-mute w-4 text-center"></i>
            <span class="text-sm text-main font-medium">${order.customer_name}</span>
          </div>
          ${order.customer_phone ? `
          <div class="flex items-center gap-3 p-2.5 bg-gray-50 dark:bg-slate-800 rounded-xl">
            <i class="fas fa-phone text-mute w-4 text-center"></i>
            <span class="text-sm text-main" dir="ltr">${order.customer_phone}</span>
          </div>
          <div class="flex items-center gap-3 p-2.5 bg-gray-50 dark:bg-slate-800 rounded-xl">
            <i class="fas fa-envelope text-mute w-4 text-center"></i>
              <span class="text-sm text-main text-xs" dir="ltr">${order.customer_email}</span>
          </div>` : ''}
          ${order.shipping_city ? `
          <div class="flex items-center gap-3 p-2.5 bg-gray-50 dark:bg-slate-800 rounded-xl">
            <i class="fas fa-map-marker-alt text-mute w-4 text-center"></i>
            <span class="text-sm text-main">${[order.shipping_address, order.shipping_city].filter(Boolean).join(' - ')}</span>
          </div>` : ''}
        </div>
      </div>

      <!-- Payment -->
      <div class="bg-card rounded-2xl border border-std shadow-sm p-5">
        <h3 class="font-bold text-main mb-3 flex items-center gap-2">
          <i class="fas fa-credit-card text-green-500"></i> حالة الدفع
        </h3>
        <select id="paymentStatus"
          class="w-full px-4 py-2 border border-std rounded-xl text-sm bg-page text-main focus:ring-2 focus:ring-primary-300 outline-none mb-3">
          <option value="pending" ${order.payment_status === 'pending' ? 'selected' : ''}>⏳ في الانتظار (معلق)</option>
          <option value="paid" ${order.payment_status === 'paid' ? 'selected' : ''}>✅ تم الدفع (مدفوع)</option>
          <option value="refunded" ${order.payment_status === 'refunded' ? 'selected' : ''}>↩️ مسترجع</option>
        </select>
        <button id="savePaymentStatusBtn" onclick="savePaymentStatus(${order.id})"
          class="w-full mb-3 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 rounded-xl text-xs transition-colors flex items-center justify-center gap-2">
          <i class="fas fa-check"></i> تحديث حالة الدفع
        </button>
        <div class="flex items-center justify-between p-3 rounded-xl ${order.payment_status === 'paid' ? 'bg-green-50 dark:bg-green-900/20' : 'bg-yellow-50 dark:bg-yellow-900/20'}">
          <span class="text-sm font-medium ${order.payment_status === 'paid' ? 'text-green-700 dark:text-green-400' : 'text-yellow-700 dark:text-yellow-400'}">
            <i class="fas fa-${order.payment_status === 'paid' ? 'check-circle' : 'clock'} ml-1"></i>
            ${order.payment_status === 'paid' ? 'تم الدفع (مدفوع)' : 'في الانتظار (معلق)'}
          </span>
          <span class="font-black text-main">${formatCurrency(order.total, store.currency)}</span>
        </div>

        ${order.payment_method === 'receipt' && order.receipt_image ? `
        <div class="mt-4 border-t border-std pt-4">
          <h4 class="text-sm font-bold text-main mb-2">سند التحويل المرفق</h4>
          <div onclick="openReceiptModal()" class="cursor-pointer group relative block w-full border border-std rounded-xl overflow-hidden shadow-sm hover:opacity-95 transition-opacity">
            <img src="${order.receipt_image}" alt="سند التحويل" class="w-full h-auto max-h-64 object-contain bg-page">
            <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-xs font-semibold gap-2">
              <i class="fas fa-search-plus text-base"></i> تكبير وعرض سند التحويل
            </div>
          </div>
          <p class="text-xs text-mute mt-2 text-center">اضغط على الصورة لعرضها بنمط المكبر التفاعلي وتحميلها</p>
        </div>
        ` : ''}
      </div>
    </div>
  </div>
  `, user, store, 'orders', `
  <script>
    const CURRENT_RECEIPT_IMAGE = ${JSON.stringify(order.receipt_image || '')};

    window.openReceiptModal = function() {
      if (!CURRENT_RECEIPT_IMAGE) return;
      let modal = document.getElementById('receiptLightboxModal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'receiptLightboxModal';
        modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in';
        modal.innerHTML = \`
          <div class="relative max-w-4xl w-full max-h-[90vh] flex flex-col items-center justify-center bg-card rounded-2xl p-4 shadow-2xl border border-std text-right">
            <button onclick="closeReceiptModal()" class="absolute -top-3 -right-3 w-10 h-10 bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-red-700 transition-colors z-10 font-bold text-lg">
              &times;
            </button>
            <div class="w-full overflow-auto max-h-[75vh] flex justify-center items-center p-2">
              <img id="receiptModalImg" src="" alt="سند الدفع" class="max-w-full max-h-full object-contain rounded-lg shadow">
            </div>
            <div class="mt-4 flex gap-3 w-full justify-center">
              <a id="receiptDownloadBtn" download="receipt.png" href="" class="px-5 py-2.5 bg-primary-600 text-white text-xs font-bold rounded-xl flex items-center gap-2 hover:bg-primary-700 transition-colors shadow-lg">
                <i class="fas fa-download"></i> تحميل صورة السند
              </a>
              <button onclick="closeReceiptModal()" class="px-5 py-2.5 bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-gray-200 text-xs font-bold rounded-xl hover:bg-gray-200 transition-colors">
                إغلاق
              </button>
            </div>
          </div>
        \`;
        document.body.appendChild(modal);
      }
      document.getElementById('receiptModalImg').src = CURRENT_RECEIPT_IMAGE;
      document.getElementById('receiptDownloadBtn').href = CURRENT_RECEIPT_IMAGE;
      modal.classList.remove('hidden');
    };

    window.closeReceiptModal = function() {
      const modal = document.getElementById('receiptLightboxModal');
      if (modal) modal.classList.add('hidden');
    };

    window.saveOrderStatus = async function(id) {
      const status = document.getElementById('orderStatus').value;
      const btn = document.getElementById('saveStatusBtn');
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';
      }
      try {
        const token = document.cookie.split(';').find(c => c.trim().startsWith('auth_token='))?.split('=')?.[1] || '';
        const res = await fetch('/api/dashboard/orders/' + id + '/status', {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
          },
          body: JSON.stringify({ status })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'فشل الحفظ');
        if (typeof showToast === 'function') showToast('تم حفظ حالة الطلب بنجاح', 'success');
        setTimeout(() => location.reload(), 600);
      } catch (err) {
        if (typeof showToast === 'function') showToast(err.message || 'حدث خطأ أثناء حفظ الحالة', 'error');
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = '<i class="fas fa-save"></i> حفظ الحالة';
        }
      }
    };

    window.savePaymentStatus = async function(id) {
      const payment_status = document.getElementById('paymentStatus').value;
      const btn = document.getElementById('savePaymentStatusBtn');
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';
      }
      try {
        const token = document.cookie.split(';').find(c => c.trim().startsWith('auth_token='))?.split('=')?.[1] || '';
        const res = await fetch('/api/dashboard/orders/' + id + '/payment-status', {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
          },
          body: JSON.stringify({ payment_status })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'فشل الحفظ');
        if (typeof showToast === 'function') showToast('تم تحديث حالة الدفع بنجاح', 'success');
        setTimeout(() => location.reload(), 600);
      } catch (err) {
        if (typeof showToast === 'function') showToast(err.message || 'حدث خطأ أثناء حفظ حالة الدفع', 'error');
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = '<i class="fas fa-check"></i> تحديث حالة الدفع';
        }
      }
    };

    window.downloadInvoicePDF = function() {
      const storeName = ${JSON.stringify(store.name)};
      const orderNumber = ${JSON.stringify(order.order_number)};
      const orderDate = ${JSON.stringify(new Date(order.created_at || Date.now()).toLocaleDateString('ar-SA'))};
      const customerName = ${JSON.stringify(order.customer_name)};
      const customerPhone = ${JSON.stringify(order.customer_phone || '')};
      const customerAddress = ${JSON.stringify((order.shipping_city || '') + ' - ' + (order.shipping_address || ''))};
      const currency = ${JSON.stringify(store.currency)};
      const primaryColor = ${JSON.stringify(store.primary_color || '#4F46E5')};
      const subtotal = ${order.subtotal};
      const discount = ${order.discount_amount || 0};
      const shipping = ${order.shipping || 0};
      const total = ${order.total};
      const items = ${JSON.stringify(orderItems.results)};

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
  </script>
  `));
});

// ─── Customers List ───────────────────────────────────────────
dashboard.get('/customers', async (c) => {
  const user = c.get('user')!;
  const store = await getStore(c.env.DB, user.id);
  if (!store) return c.redirect('/auth/register');

  const search = c.req.query('search') || '';
  const sort = c.req.query('sort') || 'created_at';

  let query = 'SELECT * FROM customers WHERE store_id = ?';
  const params: any[] = [store.id];
  if (search) { query += ' AND (name LIKE ? OR phone LIKE ? OR email LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
  query += ` ORDER BY ${['total_spent', 'total_orders', 'created_at'].includes(sort) ? sort : 'created_at'} DESC`;

  const customers = await c.env.DB.prepare(query).bind(...params).all();
  const totalSpent = (customers.results as any[]).reduce((s: number, c: any) => s + (c.total_spent || 0), 0);

  return c.html(dashboardLayout('العملاء', `
  <!-- Stats -->
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
    ${statCard('إجمالي العملاء', (customers.results as any[]).length, 'users', 'bg-primary-50 dark:bg-primary-900/30 text-primary-600')}
    ${statCard('العملاء المتكررون', (customers.results as any[]).filter((c:any) => c.total_orders > 1).length, 'user-check', 'bg-green-50 dark:bg-green-900/30 text-green-600')}
    ${statCard('إجمالي إنفاقهم', formatCurrency(totalSpent, store.currency), 'wallet', 'bg-blue-50 dark:bg-blue-900/30 text-blue-600')}
    ${statCard('متوسط الإنفاق', formatCurrency(customers.results.length > 0 ? totalSpent / customers.results.length : 0, store.currency), 'chart-bar', 'bg-purple-50 dark:bg-purple-900/30 text-purple-600')}
  </div>

  <!-- Filters -->
  <div class="flex flex-wrap gap-3 mb-5 items-center">
    <div class="relative flex-1 min-w-48">
      <i class="fas fa-search absolute right-3 top-3 text-mute text-sm"></i>
      <input type="text" id="custSearch" value="${search}" placeholder="بحث في العملاء..."
        class="w-full pr-9 pl-4 py-2.5 border border-std rounded-xl text-sm bg-page text-main focus:ring-2 focus:ring-primary-300 outline-none"
        onkeypress="if(event.key==='Enter') window.location='/dashboard/customers?search='+encodeURIComponent(this.value)">
    </div>
    <select onchange="window.location='/dashboard/customers?sort='+this.value"
      class="px-3 py-2.5 border border-std rounded-xl text-sm bg-page text-main focus:ring-2 focus:ring-primary-300 outline-none">
      <option value="created_at" ${sort === 'created_at' ? 'selected' : ''}>الأحدث</option>
      <option value="total_spent" ${sort === 'total_spent' ? 'selected' : ''}>الأعلى إنفاقاً</option>
      <option value="total_orders" ${sort === 'total_orders' ? 'selected' : ''}>الأكثر طلبات</option>
    </select>
  </div>

  <div class="bg-card rounded-2xl border border-std shadow-sm overflow-hidden">
    <div class="overflow-x-auto">
      <table class="w-full">
        <thead class="bg-gray-50 dark:bg-slate-800">
          <tr>
            <th class="text-right px-5 py-3 text-xs font-medium text-mute">العميل</th>
            <th class="text-right px-5 py-3 text-xs font-medium text-mute hidden sm:table-cell">الهاتف</th>
            <th class="text-right px-5 py-3 text-xs font-medium text-mute hidden md:table-cell">المدينة</th>
            <th class="text-right px-5 py-3 text-xs font-medium text-mute">الطلبات</th>
            <th class="text-right px-5 py-3 text-xs font-medium text-mute">الإنفاق</th>
            <th class="text-right px-5 py-3 text-xs font-medium text-mute hidden lg:table-cell">التسجيل</th>
          </tr>
        </thead>
        <tbody>
          ${(customers.results as any[]).length > 0 ? (customers.results as any[]).map((customer, idx) => `
          <tr class="border-t border-std hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
            <td class="px-5 py-4">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0
                  ${idx % 4 === 0 ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600' :
                    idx % 4 === 1 ? 'bg-green-100 dark:bg-green-900/30 text-green-600' :
                    idx % 4 === 2 ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600' :
                    'bg-orange-100 dark:bg-orange-900/30 text-orange-600'}">
                  ${customer.name[0]}
                </div>
                <div>
                  <p class="font-semibold text-main text-sm">${customer.name}</p>
                  <p class="text-mute text-xs">${customer.email || 'بدون بريد'}</p>
                </div>
              </div>
            </td>
            <td class="px-5 py-4 text-sub text-sm hidden sm:table-cell" dir="ltr">${customer.phone || '-'}</td>
            <td class="px-5 py-4 text-sub text-sm hidden md:table-cell">${customer.city || '-'}</td>
            <td class="px-5 py-4">
              <span class="bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 font-bold text-sm px-2.5 py-0.5 rounded-full">${customer.total_orders}</span>
              ${customer.total_orders > 1 ? '<span class="text-xs text-green-600 mr-1.5 font-medium">متكرر</span>' : ''}
            </td>
            <td class="px-5 py-4 font-bold text-main text-sm">${formatCurrency(customer.total_spent, store.currency)}</td>
            <td class="px-5 py-4 text-sub text-sm hidden lg:table-cell">${new Date(customer.created_at).toLocaleDateString('ar-SA')}</td>
          </tr>
          `).join('') : `
          <tr><td colspan="6" class="text-center py-16 text-mute">
            <i class="fas fa-users text-4xl mb-3 block opacity-20"></i>
            <p>لا توجد عملاء بعد</p>
          </td></tr>`}
        </tbody>
      </table>
    </div>
  </div>
  `, user, store, 'customers'));
});

// ─── Categories ───────────────────────────────────────────────
dashboard.get('/categories', async (c) => {
  const user = c.get('user')!;
  const store = await getStore(c.env.DB, user.id);
  if (!store) return c.redirect('/auth/register');

  const categories = await c.env.DB.prepare(
    `SELECT c.*, COUNT(p.id) as products_count
     FROM categories c
     LEFT JOIN products p ON p.category_id = c.id AND p.status != 'deleted'
     WHERE c.store_id = ? GROUP BY c.id ORDER BY c.sort_order`
  ).bind(store.id).all();

  return c.html(dashboardLayout('التصنيفات', `
  <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
    <div>
      <h2 class="text-xl font-black text-main flex items-center gap-2">
        <i class="fas fa-folder text-primary-500"></i> تصنيفات المتجر
      </h2>
      <p class="text-sub text-sm mt-0.5">${(categories.results as any[]).length} تصنيف مضاف في متجرك</p>
    </div>
    <div class="flex items-center gap-2 flex-wrap sm:flex-nowrap w-full sm:w-auto">
      <button onclick="showPresetsModal()"
        class="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold px-4 py-2.5 rounded-xl inline-flex items-center gap-2 shadow-lg transition-all text-sm flex-1 sm:flex-initial justify-center">
        <i class="fas fa-magic"></i> إضافة من التصنيفات الجاهزة ⚡
      </button>
      <button onclick="showAddCategory()"
        class="bg-primary-600 hover:bg-primary-700 text-white font-semibold px-4 py-2.5 rounded-xl inline-flex items-center gap-2 shadow-lg transition-colors text-sm flex-1 sm:flex-initial justify-center">
        <i class="fas fa-plus"></i> تصنيف يدوي
      </button>
    </div>
  </div>

  <!-- Ready-Made Presets Modal -->
  <div id="presetsModal" class="modal-overlay hidden" onclick="if(event.target===this)hidePresetsModal()">
    <div class="modal-box max-w-3xl w-full" onclick="event.stopPropagation()">
      <div class="p-5 border-b border-std flex items-center justify-between">
        <div>
          <h3 class="font-bold text-main text-lg flex items-center gap-2">
            <span>⚡</span> تصنيفات جاهزة ومقترحة لاختيارها
          </h3>
          <p class="text-xs text-sub mt-0.5">حدد التصنيفات المناسبة لنشاط متجرك لإضافتها فوراً بنقرة واحدة</p>
        </div>
        <button onclick="hidePresetsModal()" class="w-8 h-8 flex items-center justify-center text-mute hover:text-main hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
          <i class="fas fa-times"></i>
        </button>
      </div>

      <div class="p-5 max-h-[60vh] overflow-y-auto space-y-4">
        <!-- Search filter inside modal -->
        <div class="relative">
          <input type="text" id="presetSearch" oninput="filterPresets()" placeholder="ابحث في التصنيفات المقترحة..."
            class="w-full pr-10 pl-4 py-2.5 border border-std rounded-xl text-sm bg-page text-main focus:ring-2 focus:ring-purple-300 outline-none">
          <i class="fas fa-search absolute right-3.5 top-3 text-mute text-sm"></i>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3" id="presetsGrid">
          <!-- Populated dynamically via JS -->
        </div>
      </div>

      <div class="p-4 border-t border-std flex items-center justify-between bg-gray-50 dark:bg-slate-800/50 rounded-b-2xl">
        <div class="flex items-center gap-3">
          <button onclick="selectAllPresets()" class="text-xs text-purple-600 font-bold hover:underline">تحديد الكل</button>
          <span class="text-gray-300">|</span>
          <button onclick="deselectAllPresets()" class="text-xs text-mute hover:underline">إلغاء التحديد</button>
          <span class="text-xs font-bold text-main mr-2" id="selectedPresetsCount">0 محدد</span>
        </div>
        <div class="flex gap-2">
          <button onclick="hidePresetsModal()" class="px-4 py-2 text-sm font-medium text-sub hover:bg-gray-200 dark:hover:bg-slate-700 rounded-xl transition-colors">إلغاء</button>
          <button onclick="importSelectedPresets()" id="btnImportPresets" disabled
            class="px-6 py-2 text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow transition-all flex items-center gap-1.5">
            <i class="fas fa-download"></i> إضافة التصنيفات المحددة
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Manual Add/Edit Modal -->
  <div id="categoryModal" class="modal-overlay hidden" onclick="if(event.target===this)hideModal()">
    <div class="modal-box" onclick="event.stopPropagation()">
      <div class="p-5 border-b border-std flex items-center justify-between">
        <h3 class="font-bold text-main text-lg" id="modalTitle">إضافة تصنيف</h3>
        <button onclick="hideModal()" class="w-8 h-8 flex items-center justify-center text-mute hover:text-main hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <form id="categoryForm" class="p-5 space-y-4">
        <input type="hidden" id="categoryId" value="">
        <div>
          <label class="block text-sm font-medium text-sub mb-1.5">اسم التصنيف *</label>
          <input type="text" id="catName" placeholder="مثال: الإلكترونيات" required
            class="w-full px-4 py-2.5 border border-std rounded-xl text-sm bg-page text-main focus:ring-2 focus:ring-primary-300 outline-none">
        </div>
        <div>
          <label class="block text-sm font-medium text-sub mb-1.5">الوصف (اختياري)</label>
          <textarea id="catDesc" rows="2" placeholder="وصف التصنيف..."
            class="w-full px-4 py-2.5 border border-std rounded-xl text-sm bg-page text-main focus:ring-2 focus:ring-primary-300 outline-none resize-none"></textarea>
        </div>
        <div class="flex gap-3 pt-2">
          <button type="submit" class="flex-1 bg-primary-600 text-white py-2.5 rounded-xl font-semibold hover:bg-primary-700 transition-colors">
            <i class="fas fa-save ml-1"></i> حفظ
          </button>
          <button type="button" onclick="hideModal()" class="flex-1 bg-gray-100 dark:bg-slate-700 text-sub py-2.5 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors">
            إلغاء
          </button>
        </div>
      </form>
    </div>
  </div>

  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
    ${(categories.results as any[]).length > 0 ? (categories.results as any[]).map(cat => `
    <div class="bg-card rounded-2xl border border-std p-5 card-hover shadow-sm group">
      <div class="flex items-start justify-between mb-4">
        <div class="w-12 h-12 bg-primary-50 dark:bg-primary-900/30 text-primary-600 rounded-xl flex items-center justify-center">
          <i class="fas fa-folder text-xl"></i>
        </div>
        <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onclick="editCategory(${cat.id}, '${cat.name.replace(/'/g, "\\'")}', '${(cat.description || '').replace(/'/g, "\\'")}')"
            class="w-8 h-8 flex items-center justify-center text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors">
            <i class="fas fa-edit text-sm"></i>
          </button>
          <button onclick="deleteCategory(${cat.id})"
            class="w-8 h-8 flex items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
            <i class="fas fa-trash text-sm"></i>
          </button>
        </div>
      </div>
      <h3 class="font-bold text-main text-lg">${cat.name}</h3>
      ${cat.description ? `<p class="text-sub text-sm mt-1 line-clamp-2">${cat.description}</p>` : ''}
      <p class="text-primary-600 dark:text-primary-400 text-sm mt-3 font-medium">
        <i class="fas fa-box ml-1"></i>${cat.products_count} منتج
      </p>
    </div>
    `).join('') : `
    <div class="col-span-3 bg-card rounded-2xl border border-std p-12 text-center shadow-sm">
      <div class="w-20 h-20 bg-purple-50 dark:bg-purple-900/30 text-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <i class="fas fa-magic text-3xl"></i>
      </div>
      <h3 class="text-xl font-bold text-main mb-2">لا توجد تصنيفات بعد</h3>
      <p class="text-sub text-sm mb-6 max-w-md mx-auto">يمكنك إخفاض جهدك وااختيار تصنيفات جاهزة لمجال متجرك بنقرة واحدة، أو إضافة تصنيف يدوي جديد.</p>
      <div class="flex justify-center gap-3">
        <button onclick="showPresetsModal()" class="bg-purple-600 text-white font-bold px-6 py-2.5 rounded-xl hover:bg-purple-700 transition-all shadow-lg flex items-center gap-2">
          <i class="fas fa-bolt"></i> اختر تصنيفات جاهزة الآن
        </button>
        <button onclick="showAddCategory()" class="bg-gray-100 dark:bg-slate-700 text-main font-semibold px-6 py-2.5 rounded-xl hover:bg-gray-200 transition-colors">
          إضافة يدوي
        </button>
      </div>
    </div>
    `}
  </div>
  `, user, store, 'categories', `
  <script>
    const PRESETS = [
      { icon: 'mobile-alt', name: 'الجوالات والهواتف', desc: 'أحدث الهواتف الذكية ومستلزماتها' },
      { icon: 'laptop', name: 'أجهزة الكمبيوتر واللابتوب', desc: 'أجهزة كمبيوتر ولابتوبات وملحقاتها' },
      { icon: 'headphones', name: 'السماعات والصوتيات', desc: 'سماعات لاسلكية وسبيكرات ومكبرات صوت' },
      { icon: 'clock', name: 'الساعات والأنشطة الذكية', desc: 'ساعات ذكية وأجهزة تتبع اللياقة' },
      { icon: 'plug', name: 'الشواحن والبطاريات', desc: 'شواحن سريعة، بنوك طاقة وكوابل توصيل' },
      { icon: 'gamepad', name: 'ألعاب الفيديو والكونسول', desc: 'ألعاب وأجهزة بلايستيشن وإكس بوكس ومستلزماتها' },
      { icon: 'tshirt', name: 'الملابس والأزياء', desc: 'ملابس رجالية، نسائية وملابس أطفال' },
      { icon: 'shoe-prints', name: 'الأحذية والحقائب', desc: 'أحذية رياضية ورسمية وحقائب جلدية' },
      { icon: 'spray-can', name: 'العطور ومستحضرات التجميل', desc: 'عطور أصلية ومستحضرات التجميل والعناية' },
      { icon: 'tv', name: 'الأجهزة المنزلية الذكية', desc: 'شاشات وأجهزة منزلية وكهربائية ذات جودة' },
      { icon: 'coffee', name: 'القهوة والمشروبات', desc: 'أجود أنواع القهوة وآلات ومعدات التحضير' },
      { icon: 'utensils', name: 'المطاعم والأغذية', desc: 'وجبات ومأكولات طازجة ومشروبات' },
      { icon: 'shopping-basket', name: 'السوبرماركت والبقالة', desc: 'مواد غذائية واستهلاكية يومية' },
      { icon: 'car', name: 'مستلزمات السيارات', desc: 'إكسسوارات، قطع غيار ومنظفات سيارات' },
      { icon: 'dumbbell', name: 'الرياضة واللياقة البدنية', desc: 'معدات وأدوات رياضية ومكملات غذائية' },
      { icon: 'baby', name: 'مستلزمات الأطفال والبيبي', desc: 'ألعاب، مستلزمات حديثي الولادة وعناية' },
      { icon: 'book', name: 'الكتب والأدوات المكتبية', desc: 'كتب ودواوين أدبية ومستلزمات دراسية' },
      { icon: 'gift', name: 'الهدايا والورد', desc: 'تنسيقات ورد هدايا وتوزيعات مناسبات' },
      { icon: 'couch', name: 'الأثاث والديكور', desc: 'مفروشات وديكورات وإكسسوارات منازل' },
      { icon: 'first-aid', name: 'المستلزمات الطبية والصحة', desc: 'أجهزة ومستلزمات صحية ووقائية' }
    ];

    const selectedPresets = new Set();

    function renderPresets(items = PRESETS) {
      const grid = document.getElementById('presetsGrid');
      if (!grid) return;
      grid.innerHTML = items.map((p, idx) => {
        const isSelected = selectedPresets.has(p.name);
        return \`
        <div onclick="togglePreset('\${p.name.replace(/'/g, "\\'")}')" 
          class="p-3.5 border rounded-2xl cursor-pointer transition-all flex items-start gap-3 select-none \${isSelected ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 shadow-sm' : 'border-std bg-card hover:border-purple-300'}\">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 \${isSelected ? 'bg-purple-600 text-white' : 'bg-gray-100 dark:bg-slate-700 text-sub'}\">
            <i class="fas fa-\${p.icon} text-base"></i>
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between">
              <h4 class="font-bold text-main text-sm truncate">\${p.name}</h4>
              <i class="fas fa-\${isSelected ? 'check-circle text-purple-600' : 'circle text-gray-300'} text-base flex-shrink-0"></i>
            </div>
            <p class="text-xs text-sub mt-0.5 line-clamp-1">\${p.desc}</p>
          </div>
        </div>
        \`;
      }).join('');

      document.getElementById('selectedPresetsCount').textContent = selectedPresets.size + ' محدد';
      document.getElementById('btnImportPresets').disabled = selectedPresets.size === 0;
    }

    function togglePreset(name) {
      if (selectedPresets.has(name)) selectedPresets.delete(name);
      else selectedPresets.add(name);
      renderPresets();
    }

    function selectAllPresets() {
      PRESETS.forEach(p => selectedPresets.add(p.name));
      renderPresets();
    }

    function deselectAllPresets() {
      selectedPresets.clear();
      renderPresets();
    }

    function filterPresets() {
      const q = document.getElementById('presetSearch').value.toLowerCase().trim();
      const filtered = PRESETS.filter(p => p.name.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q));
      renderPresets(filtered);
    }

    function showPresetsModal() {
      selectedPresets.clear();
      renderPresets();
      document.getElementById('presetsModal').classList.remove('hidden');
    }

    function hidePresetsModal() {
      document.getElementById('presetsModal').classList.add('hidden');
    }

    async function importSelectedPresets() {
      if (selectedPresets.size === 0) return;
      const btn = document.getElementById('btnImportPresets');
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الإضافة...';

      const itemsToImport = PRESETS.filter(p => selectedPresets.has(p.name));
      try {
        await Promise.all(itemsToImport.map(p => 
          axios.post('/api/dashboard/categories', { name: p.name, description: p.desc })
        ));
        showToast('تمت إضافة التصنيفات بنجاح ⚡', 'success');
        hidePresetsModal();
        setTimeout(() => location.reload(), 800);
      } catch(err) {
        showToast(err.response?.data?.message || 'خطأ أثناء الإضافة', 'error');
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-download"></i> إضافة التصنيفات المحددة';
      }
    }

    function showAddCategory() {
      document.getElementById('modalTitle').textContent = 'إضافة تصنيف جديد';
      document.getElementById('categoryId').value = '';
      document.getElementById('catName').value = '';
      document.getElementById('catDesc').value = '';
      document.getElementById('categoryModal').classList.remove('hidden');
      setTimeout(() => document.getElementById('catName').focus(), 100);
    }
    function editCategory(id, name, desc) {
      document.getElementById('modalTitle').textContent = 'تعديل التصنيف';
      document.getElementById('categoryId').value = id;
      document.getElementById('catName').value = name;
      document.getElementById('catDesc').value = desc;
      document.getElementById('categoryModal').classList.remove('hidden');
    }
    function hideModal() { document.getElementById('categoryModal').classList.add('hidden'); }
    document.getElementById('categoryForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('categoryId').value;
      const data = { name: document.getElementById('catName').value, description: document.getElementById('catDesc').value };
      try {
        if (id) { await axios.put('/api/dashboard/categories/' + id, data); showToast('تم تحديث التصنيف', 'success'); }
        else { await axios.post('/api/dashboard/categories', data); showToast('تم إضافة التصنيف', 'success'); }
        hideModal();
        setTimeout(() => location.reload(), 800);
      } catch(err) { showToast(err.response?.data?.message || 'خطأ', 'error'); }
    });
    async function deleteCategory(id) {
      if (!confirmDelete('هل تريد حذف هذا التصنيف؟ سيُحذف من المنتجات أيضاً.')) return;
      try {
        await axios.delete('/api/dashboard/categories/' + id);
        showToast('تم حذف التصنيف', 'success');
        setTimeout(() => location.reload(), 800);
      } catch { showToast('خطأ', 'error'); }
    }
  </script>
  `));
});

// ─── Coupons ──────────────────────────────────────────────────
dashboard.get('/coupons', async (c) => {
  const user = c.get('user')!;
  const store = await getStore(c.env.DB, user.id);
  if (!store) return c.redirect('/auth/register');

  const coupons = await c.env.DB.prepare('SELECT * FROM coupons WHERE store_id = ? ORDER BY created_at DESC').bind(store.id).all();

  const activeCount = (coupons.results as any[]).filter((c:any) => c.is_active && !(c.expires_at && new Date(c.expires_at) < new Date())).length;
  const totalUsed = (coupons.results as any[]).reduce((s:number, c:any) => s + (c.used_count || 0), 0);
  const expiredCount = (coupons.results as any[]).filter((c:any) => c.expires_at && new Date(c.expires_at) < new Date()).length;

  return c.html(dashboardLayout('الكوبونات', `
  <!-- Header -->
  <div class="flex items-center justify-between mb-6">
    <p class="text-mute text-sm">${(coupons.results as any[]).length} كوبون</p>
    <button onclick="openCouponModal()"
       class="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors shadow-lg">
      <i class="fas fa-plus"></i> إضافة كوبون
    </button>
  </div>

  <!-- Stats -->
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
    ${statCard('إجمالي الكوبونات', (coupons.results as any[]).length, 'ticket-alt', 'bg-primary-50 dark:bg-primary-900/30 text-primary-600')}
    ${statCard('الكوبونات الفعالة', activeCount, 'check-circle', 'bg-green-50 dark:bg-green-900/30 text-green-600')}
    ${statCard('مرات الاستخدام', totalUsed, 'chart-bar', 'bg-blue-50 dark:bg-blue-900/30 text-blue-600')}
    ${statCard('منتهية الصلاحية', expiredCount, 'clock', 'bg-red-50 dark:bg-red-900/30 text-red-600')}
  </div>

  <!-- Table -->
  <div class="bg-card rounded-2xl border border-std shadow-sm overflow-hidden">
    <div class="p-5 border-b border-std"><h3 class="font-bold text-main">قائمة الكوبونات</h3></div>
    ${(coupons.results as any[]).length > 0 ? `
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-gray-50 dark:bg-slate-800">
          <tr>
            <th class="text-right px-5 py-3 font-medium text-mute">الكود</th>
            <th class="text-right px-5 py-3 font-medium text-mute hidden sm:table-cell">النوع</th>
            <th class="text-right px-5 py-3 font-medium text-mute">الخصم</th>
            <th class="text-right px-5 py-3 font-medium text-mute">الاستخدامات</th>
            <th class="text-right px-5 py-3 font-medium text-mute hidden md:table-cell">الانتهاء</th>
            <th class="text-right px-5 py-3 font-medium text-mute">الحالة</th>
            <th class="text-right px-5 py-3 font-medium text-mute">إجراءات</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-std">
          ${(coupons.results as any[]).map(coupon => {
            const isExpired = coupon.expires_at && new Date(coupon.expires_at) < new Date();
            const isMaxed = coupon.max_uses && coupon.used_count >= coupon.max_uses;
            const isActive = coupon.is_active && !isExpired && !isMaxed;
            return `
          <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
            <td class="px-5 py-3.5">
              <div class="flex items-center gap-2">
                <code class="bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 px-2.5 py-1 rounded-lg font-mono font-bold">${coupon.code}</code>
                <button onclick="copyText('${coupon.code}', 'تم نسخ الكود!')" class="text-mute hover:text-primary-600 transition-colors" data-tooltip="نسخ">
                  <i class="fas fa-copy text-xs"></i>
                </button>
              </div>
              ${coupon.description ? `<p class="text-xs text-mute mt-1 pr-1">${coupon.description}</p>` : ''}
            </td>
            <td class="px-5 py-3.5 hidden sm:table-cell">
              <span class="px-2 py-1 rounded-full text-xs font-medium ${coupon.type === 'percentage' ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-600' : 'bg-orange-50 dark:bg-orange-900/20 text-orange-600'}">
                ${coupon.type === 'percentage' ? '%' : store.currency}
              </span>
            </td>
            <td class="px-5 py-3.5 font-bold text-main">
              ${coupon.type === 'percentage' ? coupon.value + '%' : formatCurrency(coupon.value, store.currency)}
            </td>
            <td class="px-5 py-3.5">
              <div class="flex items-center gap-1.5">
                <span class="font-medium text-main">${coupon.used_count || 0}</span>
                ${coupon.max_uses ? `<span class="text-mute">/ ${coupon.max_uses}</span>` : ''}
              </div>
              ${coupon.max_uses ? `
              <div class="mt-1 h-1 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden w-16">
                <div class="h-full rounded-full ${isMaxed ? 'bg-red-500' : 'bg-primary-500'}" style="width:${Math.min(100,(coupon.used_count||0)/coupon.max_uses*100)}%"></div>
              </div>` : ''}
            </td>
            <td class="px-5 py-3.5 text-sub hidden md:table-cell">
              ${coupon.expires_at ? `<span class="${isExpired ? 'text-red-500 font-medium' : ''}">${isExpired ? '⚠ ' : ''}${new Date(coupon.expires_at).toLocaleDateString('ar-SA')}</span>` : '<span class="text-mute">∞</span>'}
            </td>
            <td class="px-5 py-3.5">
              <span class="px-2.5 py-1 rounded-full text-xs font-medium ${isActive ? 'bg-green-50 dark:bg-green-900/20 text-green-600' : 'bg-gray-100 dark:bg-slate-700 text-gray-500'}">
                ${isActive ? '✓ فعال' : '✗ معطل'}
              </span>
            </td>
            <td class="px-5 py-3.5">
              <div class="flex items-center gap-1">
                <button onclick="editCoupon(${JSON.stringify(coupon).replace(/"/g,'&quot;')})"
                        class="w-8 h-8 flex items-center justify-center text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors" data-tooltip="تعديل">
                  <i class="fas fa-edit text-sm"></i>
                </button>
                <button onclick="toggleCoupon(${coupon.id}, ${coupon.is_active})"
                        class="w-8 h-8 flex items-center justify-center ${coupon.is_active ? 'text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20' : 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'} rounded-lg transition-colors" data-tooltip="${coupon.is_active ? 'تعطيل' : 'تفعيل'}">
                  <i class="fas fa-${coupon.is_active ? 'toggle-off' : 'toggle-on'} text-sm"></i>
                </button>
                <button onclick="deleteCoupon(${coupon.id})"
                        class="w-8 h-8 flex items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" data-tooltip="حذف">
                  <i class="fas fa-trash text-sm"></i>
                </button>
              </div>
            </td>
          </tr>`;}).join('')}
        </tbody>
      </table>
    </div>` : `
    <div class="p-12 text-center">
      <div class="w-16 h-16 bg-primary-50 dark:bg-primary-900/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <i class="fas fa-ticket-alt text-2xl text-primary-400"></i>
      </div>
      <h3 class="font-bold text-main mb-1">لا توجد كوبونات بعد</h3>
      <p class="text-mute text-sm">أضف كوبون خصم أول لمتجرك</p>
    </div>`}
  </div>

  <!-- Coupon Modal -->
  <div id="couponModal" class="modal-overlay hidden" onclick="if(event.target===this)closeCouponModal()">
    <div class="modal-box" onclick="event.stopPropagation()">
      <div class="p-5 border-b border-std flex items-center justify-between">
        <h3 class="font-bold text-main text-lg" id="modalTitle">إضافة كوبون</h3>
        <button onclick="closeCouponModal()" class="w-8 h-8 flex items-center justify-center text-mute hover:text-main hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <form id="couponForm" class="p-5 space-y-4">
        <input type="hidden" id="couponId">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-sub mb-1.5">كود الخصم *</label>
            <div class="flex gap-2">
              <input type="text" id="couponCode" placeholder="SUMMER20" required
                class="flex-1 px-3 py-2.5 border border-std rounded-xl text-sm bg-page text-main focus:ring-2 focus:ring-primary-300 outline-none uppercase"
                style="text-transform: uppercase">
              <button type="button" onclick="generateCode()"
                      class="px-3 py-2.5 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-sub rounded-xl text-sm transition-colors" data-tooltip="توليد عشوائي">
                <i class="fas fa-random"></i>
              </button>
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-sub mb-1.5">نوع الخصم *</label>
            <select id="couponType" required onchange="updateValueLabel()"
              class="w-full px-3 py-2.5 border border-std rounded-xl text-sm bg-page text-main focus:ring-2 focus:ring-primary-300 outline-none">
              <option value="percentage">نسبة مئوية (%)</option>
              <option value="fixed">مبلغ ثابت (${store.currency})</option>
            </select>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-sub mb-1.5" id="valueLabel">قيمة الخصم *</label>
            <div class="relative">
              <input type="number" id="couponValue" placeholder="20" min="0" required step="0.01"
                class="w-full px-3 pl-8 py-2.5 border border-std rounded-xl text-sm bg-page text-main focus:ring-2 focus:ring-primary-300 outline-none">
              <span id="valueSuffix" class="absolute left-3 top-1/2 -translate-y-1/2 text-mute text-sm">%</span>
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-sub mb-1.5">الحد الأدنى للطلب</label>
            <input type="number" id="couponMin" placeholder="0" min="0" step="0.01"
              class="w-full px-3 py-2.5 border border-std rounded-xl text-sm bg-page text-main focus:ring-2 focus:ring-primary-300 outline-none">
          </div>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-sub mb-1.5">الحد الأقصى للاستخدام</label>
            <input type="number" id="couponMaxUses" placeholder="∞" min="1"
              class="w-full px-3 py-2.5 border border-std rounded-xl text-sm bg-page text-main focus:ring-2 focus:ring-primary-300 outline-none">
          </div>
          <div>
            <label class="block text-sm font-medium text-sub mb-1.5">تاريخ الانتهاء</label>
            <input type="date" id="couponExpiry"
              class="w-full px-3 py-2.5 border border-std rounded-xl text-sm bg-page text-main focus:ring-2 focus:ring-primary-300 outline-none">
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium text-sub mb-1.5">وصف الكوبون</label>
          <input type="text" id="couponDesc" placeholder="عرض الصيف - خصم 20%"
            class="w-full px-3 py-2.5 border border-std rounded-xl text-sm bg-page text-main focus:ring-2 focus:ring-primary-300 outline-none">
        </div>
        <label class="flex items-center gap-3 cursor-pointer p-3 bg-gray-50 dark:bg-slate-800 rounded-xl">
          <input type="checkbox" id="couponActive" checked class="w-4 h-4 text-primary-600 rounded">
          <span class="text-sm text-sub">تفعيل الكوبون فور الإنشاء</span>
        </label>
        <div class="flex gap-3 pt-1">
          <button type="submit"
            class="flex-1 bg-primary-600 hover:bg-primary-700 text-white font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2">
            <i class="fas fa-save"></i>
            <span id="submitBtnText">إضافة الكوبون</span>
          </button>
          <button type="button" onclick="closeCouponModal()"
            class="px-6 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-sub font-semibold py-2.5 rounded-xl transition-colors">
            إلغاء
          </button>
        </div>
      </form>
    </div>
  </div>
  `, user, store, 'coupons', `
  <script>
    function generateCode() {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let code = '';
      for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
      document.getElementById('couponCode').value = code;
    }
    function updateValueLabel() {
      const type = document.getElementById('couponType').value;
      document.getElementById('valueLabel').textContent = type === 'percentage' ? 'نسبة الخصم *' : 'مبلغ الخصم *';
      document.getElementById('valueSuffix').textContent = type === 'percentage' ? '%' : '${store.currency}';
    }
    function openCouponModal(coupon = null) {
      document.getElementById('couponModal').classList.remove('hidden');
      document.getElementById('couponId').value = coupon?.id || '';
      document.getElementById('couponCode').value = coupon?.code || '';
      document.getElementById('couponType').value = coupon?.type || 'percentage';
      document.getElementById('couponValue').value = coupon?.value || '';
      document.getElementById('couponMin').value = coupon?.min_order_amount || '';
      document.getElementById('couponMaxUses').value = coupon?.max_uses || '';
      document.getElementById('couponExpiry').value = coupon?.expires_at ? coupon.expires_at.split('T')[0] : '';
      document.getElementById('couponDesc').value = coupon?.description || '';
      document.getElementById('couponActive').checked = coupon ? !!coupon.is_active : true;
      document.getElementById('modalTitle').textContent = coupon ? 'تعديل الكوبون' : 'إضافة كوبون جديد';
      document.getElementById('submitBtnText').textContent = coupon ? 'تحديث الكوبون' : 'إضافة الكوبون';
      updateValueLabel();
    }
    function closeCouponModal() { document.getElementById('couponModal').classList.add('hidden'); }
    function editCoupon(coupon) { openCouponModal(coupon); }
    async function toggleCoupon(id, current) {
      try {
        await axios.put('/api/dashboard/coupons/' + id, { is_active: !current ? 1 : 0 });
        showToast(current ? 'تم تعطيل الكوبون' : 'تم تفعيل الكوبون', 'success');
        setTimeout(() => location.reload(), 800);
      } catch { showToast('خطأ', 'error'); }
    }
    async function deleteCoupon(id) {
      if (!confirmDelete('هل تريد حذف هذا الكوبون؟')) return;
      try {
        await axios.delete('/api/dashboard/coupons/' + id);
        showToast('تم حذف الكوبون', 'success');
        setTimeout(() => location.reload(), 800);
      } catch { showToast('خطأ', 'error'); }
    }
    document.getElementById('couponForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('couponId').value;
      const data = {
        code: document.getElementById('couponCode').value.toUpperCase(),
        type: document.getElementById('couponType').value,
        value: parseFloat(document.getElementById('couponValue').value),
        min_order_amount: document.getElementById('couponMin').value ? parseFloat(document.getElementById('couponMin').value) : null,
        max_uses: document.getElementById('couponMaxUses').value ? parseInt(document.getElementById('couponMaxUses').value) : null,
        expires_at: document.getElementById('couponExpiry').value || null,
        description: document.getElementById('couponDesc').value || null,
        is_active: document.getElementById('couponActive').checked ? 1 : 0,
      };
      try {
        if (id) { await axios.put('/api/dashboard/coupons/' + id, data); showToast('تم تحديث الكوبون', 'success'); }
        else { await axios.post('/api/dashboard/coupons', data); showToast('تم إضافة الكوبون', 'success'); }
        closeCouponModal();
        setTimeout(() => location.reload(), 800);
      } catch (err) { showToast(err.response?.data?.message || 'خطأ في الحفظ', 'error'); }
    });
  </script>
  `));
});

// ─── Staff Management ─────────────────────────────────────────
dashboard.get('/staff', async (c) => {
  const user = c.get('user')!;
  const store = await getStore(c.env.DB, user.id);
  if (!store) return c.redirect('/auth/register');

  const staff = await c.env.DB.prepare(`
    SELECT u.id, u.name, u.email, u.phone, u.role, u.created_at, u.is_active
    FROM users u WHERE u.store_id = ? AND u.role = 'staff'
    ORDER BY u.created_at DESC
  `).bind(store.id).all();

  return c.html(dashboardLayout('إدارة الموظفين', `
  <!-- Header -->
  <div class="flex items-center justify-between mb-6">
    <p class="text-mute text-sm">${(staff.results as any[]).length} موظف</p>
    <button onclick="document.getElementById('staffModal').classList.remove('hidden')"
       class="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors shadow-lg">
      <i class="fas fa-user-plus"></i> إضافة موظف
    </button>
  </div>

  <!-- Info Banner -->
  <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4 mb-6 flex items-start gap-3">
    <i class="fas fa-info-circle text-blue-500 mt-0.5 flex-shrink-0"></i>
    <div>
      <p class="text-sm font-semibold text-blue-800 dark:text-blue-300">حول إدارة الموظفين</p>
      <p class="text-xs text-blue-600 dark:text-blue-400 mt-0.5">يمكن للموظفين إدارة الطلبات والمنتجات، لكن لا يمكنهم تغيير إعدادات المتجر أو الاشتراكات.</p>
    </div>
  </div>

  <!-- Staff Grid -->
  ${(staff.results as any[]).length > 0 ? `
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    ${(staff.results as any[]).map(s => `
    <div class="bg-card rounded-2xl border border-std p-5 shadow-sm card-hover">
      <div class="flex items-start justify-between mb-4">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-bold text-lg shadow-md">
            ${s.name[0].toUpperCase()}
          </div>
          <div>
            <h3 class="font-bold text-main">${s.name}</h3>
            <p class="text-sm text-mute" dir="ltr">${s.email}</p>
          </div>
        </div>
        <span class="px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0 ${s.is_active ? 'bg-green-50 dark:bg-green-900/20 text-green-600' : 'bg-gray-100 dark:bg-slate-700 text-gray-500'}">
          ${s.is_active ? '● نشط' : '○ معطل'}
        </span>
      </div>
      ${s.phone ? `<p class="text-xs text-sub mb-3 flex items-center gap-2"><i class="fas fa-phone text-mute"></i>${s.phone}</p>` : ''}
      <div class="border-t border-std pt-3 flex items-center justify-between">
        <p class="text-xs text-mute"><i class="fas fa-calendar ml-1"></i>${new Date(s.created_at).toLocaleDateString('ar-SA')}</p>
        <div class="flex gap-1">
          <button onclick="toggleStaff(${s.id}, ${s.is_active})"
                  class="w-8 h-8 flex items-center justify-center ${s.is_active ? 'text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20' : 'text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20'} rounded-lg transition-colors" data-tooltip="${s.is_active ? 'تعطيل' : 'تفعيل'}">
            <i class="fas fa-${s.is_active ? 'user-slash' : 'user-check'} text-sm"></i>
          </button>
          <button onclick="removeStaff(${s.id})"
                  class="w-8 h-8 flex items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" data-tooltip="إزالة">
            <i class="fas fa-user-times text-sm"></i>
          </button>
        </div>
      </div>
    </div>
    `).join('')}
  </div>` : `
  <div class="bg-card rounded-2xl border border-std p-12 text-center shadow-sm">
    <div class="w-16 h-16 bg-primary-50 dark:bg-primary-900/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
      <i class="fas fa-user-tie text-2xl text-primary-400"></i>
    </div>
    <h3 class="font-bold text-main mb-2">لا يوجد موظفون</h3>
    <p class="text-mute text-sm">أضف موظفين لمساعدتك في إدارة المتجر</p>
  </div>`}

  <!-- Add Staff Modal -->
  <div id="staffModal" class="modal-overlay hidden" onclick="if(event.target===this)this.classList.add('hidden')">
    <div class="modal-box" onclick="event.stopPropagation()">
      <div class="p-5 border-b border-std flex items-center justify-between">
        <h3 class="font-bold text-main text-lg">دعوة موظف جديد</h3>
        <button onclick="document.getElementById('staffModal').classList.add('hidden')" class="w-8 h-8 flex items-center justify-center text-mute hover:text-main hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <form id="staffForm" class="p-5 space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-sub mb-1.5">الاسم الكامل *</label>
            <input type="text" id="staffName" required placeholder="محمد أحمد"
              class="w-full px-4 py-2.5 border border-std rounded-xl text-sm bg-page text-main focus:ring-2 focus:ring-primary-300 outline-none">
          </div>
          <div>
            <label class="block text-sm font-medium text-sub mb-1.5">رقم الجوال</label>
            <input type="tel" id="staffPhone" placeholder="05xxxxxxxx" dir="ltr"
              class="w-full px-4 py-2.5 border border-std rounded-xl text-sm bg-page text-main focus:ring-2 focus:ring-primary-300 outline-none">
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium text-sub mb-1.5">البريد الإلكتروني *</label>
          <input type="email" id="staffEmail" required dir="ltr" placeholder="staff@example.com"
            class="w-full px-4 py-2.5 border border-std rounded-xl text-sm bg-page text-main focus:ring-2 focus:ring-primary-300 outline-none">
        </div>
        <div>
          <label class="block text-sm font-medium text-sub mb-1.5">كلمة المرور *</label>
          <input type="password" id="staffPassword" required placeholder="8 أحرف على الأقل"
            class="w-full px-4 py-2.5 border border-std rounded-xl text-sm bg-page text-main focus:ring-2 focus:ring-primary-300 outline-none">
        </div>
        <div class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-3">
          <p class="text-xs text-yellow-800 dark:text-yellow-300 flex items-center gap-2">
            <i class="fas fa-lock"></i> شارك بيانات الدخول مع الموظف بشكل آمن
          </p>
        </div>
        <div class="flex gap-3 pt-1">
          <button type="submit" class="flex-1 bg-primary-600 hover:bg-primary-700 text-white font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2">
            <i class="fas fa-user-plus"></i> إضافة الموظف
          </button>
          <button type="button" onclick="document.getElementById('staffModal').classList.add('hidden')"
            class="px-6 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-sub font-semibold py-2.5 rounded-xl transition-colors">
            إلغاء
          </button>
        </div>
      </form>
    </div>
  </div>
  `, user, store, 'staff', `
  <script>
    async function toggleStaff(id, isActive) {
      try {
        await axios.put('/api/dashboard/staff/' + id, { is_active: !isActive ? 1 : 0 });
        showToast(isActive ? 'تم تعطيل الموظف' : 'تم تفعيل الموظف', 'success');
        setTimeout(() => location.reload(), 800);
      } catch { showToast('خطأ', 'error'); }
    }
    async function removeStaff(id) {
      if (!confirmDelete('هل تريد إزالة هذا الموظف نهائياً؟')) return;
      try {
        await axios.delete('/api/dashboard/staff/' + id);
        showToast('تم إزالة الموظف', 'success');
        setTimeout(() => location.reload(), 800);
      } catch { showToast('خطأ', 'error'); }
    }
    document.getElementById('staffForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await axios.post('/api/dashboard/staff', {
          name: document.getElementById('staffName').value,
          email: document.getElementById('staffEmail').value,
          password: document.getElementById('staffPassword').value,
          phone: document.getElementById('staffPhone').value || null,
        });
        showToast('تم إضافة الموظف بنجاح', 'success');
        document.getElementById('staffModal').classList.add('hidden');
        setTimeout(() => location.reload(), 800);
      } catch (err) { showToast(err.response?.data?.message || 'خطأ في الإضافة', 'error'); }
    });
  </script>
  `));
});

// ─── Advanced Analytics ───────────────────────────────────────
dashboard.get('/analytics', async (c) => {
  const user = c.get('user')!;
  const store = await getStore(c.env.DB, user.id);
  if (!store) return c.redirect('/auth/register');

  const [monthlyRevenue, topProducts, ordersByStatus, dailyOrders, customerStats, hourlyOrders] = await Promise.all([
    c.env.DB.prepare(`
      SELECT strftime('%Y-%m', created_at) as month,
             COUNT(*) as orders,
             COALESCE(SUM(total), 0) as revenue,
             COALESCE(AVG(total), 0) as avg_order
      FROM orders WHERE store_id = ?
      GROUP BY month ORDER BY month DESC LIMIT 12
    `).bind(store.id).all(),

    c.env.DB.prepare(`
      SELECT p.name, p.price, p.total_sold,
             COALESCE(SUM(oi.total), 0) as revenue,
             pi.url as image
      FROM products p
      LEFT JOIN order_items oi ON oi.product_id = p.id
      LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = 1
      WHERE p.store_id = ? AND p.status = 'active'
      GROUP BY p.id ORDER BY p.total_sold DESC LIMIT 10
    `).bind(store.id).all(),

    c.env.DB.prepare(`
      SELECT status, COUNT(*) as count FROM orders
      WHERE store_id = ? GROUP BY status
    `).bind(store.id).all(),

    c.env.DB.prepare(`
      SELECT strftime('%Y-%m-%d', created_at) as day,
             COUNT(*) as orders
      FROM orders WHERE store_id = ?
        AND created_at >= datetime('now', '-30 days')
      GROUP BY day ORDER BY day
    `).bind(store.id).all(),

    c.env.DB.prepare(`
      SELECT COUNT(*) as total,
             COUNT(CASE WHEN total_orders > 1 THEN 1 END) as returning_customers,
             COALESCE(AVG(total_spent), 0) as avg_spent,
             COALESCE(SUM(total_spent), 0) as total_revenue
      FROM customers WHERE store_id = ?
    `).bind(store.id).first() as Promise<any>,

    c.env.DB.prepare(`
      SELECT strftime('%H', created_at) as hour, COUNT(*) as count
      FROM orders WHERE store_id = ?
      GROUP BY hour ORDER BY hour
    `).bind(store.id).all(),
  ]);

  const months = (monthlyRevenue.results as any[]).reverse();
  const totalRevenue = months.reduce((s: number, m: any) => s + m.revenue, 0);
  const totalOrders = months.reduce((s: number, m: any) => s + m.orders, 0);
  const avgOrder = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const statusColors = ['#4F46E5', '#06B6D4', '#22C55E', '#EF4444'];
  const statusMap: Record<string, string> = { pending: 'قيد الانتظار', processing: 'قيد المعالجة', completed: 'مكتمل', cancelled: 'ملغي' };

  return c.html(dashboardLayout('التحليلات المتقدمة', `
  <!-- KPI Cards -->
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
    <div class="rounded-2xl p-5 text-white shadow-lg bg-gradient-to-br from-primary-600 to-primary-700">
      <i class="fas fa-chart-line text-white/70 text-xl mb-3 block"></i>
      <p class="text-2xl font-black leading-tight">${formatCurrency(totalRevenue, store.currency)}</p>
      <p class="text-xs mt-1 text-white/80">إجمالي الإيرادات</p>
      <p class="text-xs mt-0.5 text-white/60">آخر 12 شهر</p>
    </div>
    <div class="rounded-2xl p-5 text-white shadow-lg bg-gradient-to-br from-cyan-500 to-blue-600">
      <i class="fas fa-shopping-cart text-white/70 text-xl mb-3 block"></i>
      <p class="text-2xl font-black leading-tight">${formatCurrency(avgOrder, store.currency)}</p>
      <p class="text-xs mt-1 text-white/80">متوسط قيمة الطلب</p>
      <p class="text-xs mt-0.5 text-white/60">${totalOrders} طلب</p>
    </div>
    <div class="rounded-2xl p-5 text-white shadow-lg bg-gradient-to-br from-green-500 to-emerald-600">
      <i class="fas fa-users text-white/70 text-xl mb-3 block"></i>
      <p class="text-2xl font-black leading-tight">${customerStats?.total || 0}</p>
      <p class="text-xs mt-1 text-white/80">إجمالي العملاء</p>
      <p class="text-xs mt-0.5 text-white/60">${customerStats?.returning_customers || 0} متكرر</p>
    </div>
    <div class="rounded-2xl p-5 text-white shadow-lg bg-gradient-to-br from-purple-500 to-pink-600">
      <i class="fas fa-wallet text-white/70 text-xl mb-3 block"></i>
      <p class="text-2xl font-black leading-tight">${formatCurrency(customerStats?.avg_spent || 0, store.currency)}</p>
      <p class="text-xs mt-1 text-white/80">متوسط إنفاق العميل</p>
      <p class="text-xs mt-0.5 text-white/60">لكل عميل</p>
    </div>
  </div>

  <!-- Revenue + Status Charts -->
  <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
    <div class="lg:col-span-2 bg-card rounded-2xl border border-std p-5 shadow-sm">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-bold text-main">الإيرادات الشهرية</h3>
        <span class="text-xs text-mute bg-gray-100 dark:bg-slate-700 px-2.5 py-1 rounded-full">آخر 12 شهر</span>
      </div>
      <canvas id="revenueChart" height="80"></canvas>
    </div>
    <div class="bg-card rounded-2xl border border-std p-5 shadow-sm">
      <h3 class="font-bold text-main mb-4">توزيع الطلبات حسب الحالة</h3>
      <canvas id="statusChart" height="140"></canvas>
      <div class="mt-4 space-y-2">
        ${(ordersByStatus.results as any[]).map((s: any, i: number) => `
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <div class="w-3 h-3 rounded-full flex-shrink-0" style="background:${statusColors[i%4]}"></div>
            <span class="text-sm text-sub">${statusMap[s.status] || s.status}</span>
          </div>
          <span class="font-bold text-main text-sm">${s.count}</span>
        </div>
        `).join('')}
      </div>
    </div>
  </div>

  <!-- Daily + Hourly Charts -->
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
    <div class="bg-card rounded-2xl border border-std p-5 shadow-sm">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-bold text-main">الطلبات اليومية</h3>
        <span class="text-xs text-mute">آخر 30 يوم</span>
      </div>
      <canvas id="dailyChart" height="100"></canvas>
    </div>
    <div class="bg-card rounded-2xl border border-std p-5 shadow-sm">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-bold text-main">توزيع الطلبات حسب الساعة</h3>
        <span class="text-xs text-mute">النشاط اليومي</span>
      </div>
      <canvas id="hourlyChart" height="100"></canvas>
    </div>
  </div>

  <!-- Top Products -->
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <!-- Chart -->
    <div class="bg-card rounded-2xl border border-std p-5 shadow-sm">
      <h3 class="font-bold text-main mb-4">أكثر المنتجات مبيعاً (إيراد)</h3>
      <div class="space-y-3">
        ${(topProducts.results as any[]).slice(0, 5).map((p: any, i: number) => {
          const maxRevenue = Math.max(...(topProducts.results as any[]).map((x: any) => x.revenue), 1);
          return `
        <div class="flex items-center gap-3">
          <span class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0
            ${i===0 ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600' : i===1 ? 'bg-gray-100 dark:bg-slate-700 text-gray-500' : i===2 ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600' : 'bg-primary-50 dark:bg-primary-900/20 text-primary-500'}">${i+1}</span>
          <img src="${p.image || 'https://via.placeholder.com/36'}" class="w-9 h-9 rounded-lg object-cover flex-shrink-0">
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-main truncate">${p.name}</p>
            <div class="mt-1 h-1.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
              <div class="h-full bg-gradient-to-l from-primary-500 to-primary-400 rounded-full transition-all" style="width:${Math.round((p.revenue/maxRevenue)*100)}%"></div>
            </div>
          </div>
          <div class="text-right flex-shrink-0">
            <p class="text-sm font-black text-primary-600">${formatCurrency(p.revenue, store.currency)}</p>
            <p class="text-xs text-mute">${p.total_sold} بيعة</p>
          </div>
        </div>`; }).join('')}
      </div>
    </div>

    <!-- Full Table -->
    <div class="bg-card rounded-2xl border border-std shadow-sm overflow-hidden">
      <div class="p-5 border-b border-std"><h3 class="font-bold text-main">تفاصيل أداء المنتجات</h3></div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 dark:bg-slate-800">
            <tr>
              <th class="text-right px-4 py-2.5 font-medium text-mute text-xs">#</th>
              <th class="text-right px-4 py-2.5 font-medium text-mute text-xs">المنتج</th>
              <th class="text-right px-4 py-2.5 font-medium text-mute text-xs">مبيعات</th>
              <th class="text-right px-4 py-2.5 font-medium text-mute text-xs">إيراد</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-std">
            ${(topProducts.results as any[]).map((p: any, i: number) => `
            <tr class="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
              <td class="px-4 py-3 text-mute font-bold text-xs">${i+1}</td>
              <td class="px-4 py-3">
                <div class="flex items-center gap-2">
                  <img src="${p.image || 'https://via.placeholder.com/28'}" class="w-7 h-7 rounded-lg object-cover flex-shrink-0">
                  <span class="font-medium text-main text-xs line-clamp-1">${p.name}</span>
                </div>
              </td>
              <td class="px-4 py-3 font-bold text-main text-xs">${p.total_sold}</td>
              <td class="px-4 py-3 font-bold text-green-600 text-xs">${formatCurrency(p.revenue, store.currency)}</td>
            </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </div>
  `, user, store, 'analytics', `
  <script>
    const isDark = document.documentElement.className === 'dark';
    const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)';
    const tickColor = isDark ? '#64748b' : '#94a3b8';

    // Revenue Chart
    new Chart(document.getElementById('revenueChart'), {
      type: 'bar',
      data: {
        labels: ${JSON.stringify(months.map((m: any) => m.month))},
        datasets: [
          { label: 'الإيرادات', data: ${JSON.stringify(months.map((m: any) => m.revenue))}, backgroundColor: 'rgba(79,70,229,0.85)', borderRadius: 6, yAxisID: 'y' },
          { label: 'الطلبات', data: ${JSON.stringify(months.map((m: any) => m.orders))}, type: 'line', borderColor: '#22C55E', backgroundColor: 'transparent', tension: 0.4, yAxisID: 'y1', pointRadius: 3 }
        ]
      },
      options: {
        responsive: true, interaction: { mode: 'index' },
        plugins: { legend: { labels: { color: tickColor } } },
        scales: {
          x: { grid: { color: gridColor }, ticks: { color: tickColor } },
          y: { grid: { color: gridColor }, ticks: { color: tickColor }, beginAtZero: true },
          y1: { position: 'left', grid: { display: false }, ticks: { color: '#22C55E' }, beginAtZero: true }
        }
      }
    });

    // Status Doughnut
    const statusData = ${JSON.stringify((ordersByStatus.results as any[]))};
    const statusNames = { pending: 'قيد الانتظار', processing: 'قيد المعالجة', completed: 'مكتمل', cancelled: 'ملغي' };
    new Chart(document.getElementById('statusChart'), {
      type: 'doughnut',
      data: {
        labels: statusData.map(s => statusNames[s.status] || s.status),
        datasets: [{ data: statusData.map(s => s.count), backgroundColor: ['#4F46E5','#06B6D4','#22C55E','#EF4444'], borderWidth: 0, hoverOffset: 4 }]
      },
      options: { responsive: true, cutout: '72%', plugins: { legend: { display: false } } }
    });

    // Daily Orders
    const dailyData = ${JSON.stringify((dailyOrders.results as any[]))};
    new Chart(document.getElementById('dailyChart'), {
      type: 'line',
      data: {
        labels: dailyData.map(d => d.day.slice(5)),
        datasets: [{ label: 'الطلبات', data: dailyData.map(d => d.orders), borderColor: '#4F46E5', backgroundColor: 'rgba(79,70,229,0.08)', fill: true, tension: 0.4, pointRadius: 3 }]
      },
      options: {
        responsive: true, plugins: { legend: { display: false } },
        scales: { x: { grid: { color: gridColor }, ticks: { color: tickColor, maxTicksLimit: 8 } }, y: { grid: { color: gridColor }, ticks: { color: tickColor }, beginAtZero: true } }
      }
    });

    // Hourly Chart
    const hourlyData = ${JSON.stringify((hourlyOrders.results as any[]))};
    const allHours = Array.from({length:24}, (_,i) => String(i).padStart(2,'0'));
    const hourCounts = allHours.map(h => (hourlyData.find(d => d.hour === h)?.count || 0));
    new Chart(document.getElementById('hourlyChart'), {
      type: 'bar',
      data: {
        labels: allHours.map(h => h+':00'),
        datasets: [{ label: 'الطلبات', data: hourCounts, backgroundColor: 'rgba(6,182,212,0.75)', borderRadius: 4 }]
      },
      options: {
        responsive: true, plugins: { legend: { display: false } },
        scales: { x: { grid: { display: false }, ticks: { color: tickColor, maxTicksLimit: 8 } }, y: { grid: { color: gridColor }, ticks: { color: tickColor }, beginAtZero: true } }
      }
    });
  </script>
  `));
});

// ─── User Profile ─────────────────────────────────────────────
dashboard.get('/profile', async (c) => {
  const user = c.get('user')!;
  const store = await getStore(c.env.DB, user.id);
  const fullUser = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first() as any;
  console.log("PROFILE DBG: user", user, "store", store, "fullUser", fullUser);

  // Get some quick stats
  const orderCount = store ? await c.env.DB.prepare('SELECT COUNT(*) as c FROM orders WHERE store_id = ?').bind((store as any).id).first() as any : { c: 0 };
  const productCount = store ? await c.env.DB.prepare("SELECT COUNT(*) as c FROM products WHERE store_id = ? AND status != 'deleted'").bind((store as any).id).first() as any : { c: 0 };

  return c.html(dashboardLayout('الملف الشخصي', `
  <div class="max-w-3xl mx-auto space-y-6">

    <!-- Profile Hero -->
    <div class="bg-card rounded-2xl border border-std shadow-sm overflow-hidden">
      <div class="h-32 bg-gradient-to-r from-primary-600 via-primary-700 to-purple-700 relative">
        <div class="absolute inset-0 opacity-20">
          <div class="absolute top-4 left-8 w-24 h-24 rounded-full bg-white/30"></div>
          <div class="absolute bottom-0 left-48 w-16 h-16 rounded-full bg-white/20"></div>
        </div>
      </div>
      <div class="px-6 pb-6 relative">
        <div class="flex items-end justify-between -mt-10 mb-4">
          <div class="w-20 h-20 rounded-2xl bg-white dark:bg-slate-800 shadow-xl flex items-center justify-center text-3xl font-black text-primary-600 border-4 border-white dark:border-slate-700">
            ${fullUser?.name?.[0]?.toUpperCase() || 'م'}
          </div>
          <span class="inline-flex items-center gap-1.5 px-3 py-1 bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 text-xs font-bold rounded-full mb-1">
            <i class="fas fa-${user.role === 'admin' ? 'shield-alt' : 'store'}"></i>
            ${user.role === 'admin' ? 'مدير المنصة' : 'صاحب متجر'}
          </span>
        </div>
        <h2 class="text-xl font-black text-main">${fullUser?.name}</h2>
        <p class="text-sub text-sm" dir="ltr">${fullUser?.email}</p>
        <p class="text-mute text-xs mt-1"><i class="fas fa-calendar ml-1"></i>عضو منذ ${new Date(fullUser?.created_at).toLocaleDateString('ar-SA')}</p>

        <!-- Quick Stats -->
        ${store ? `
        <div class="grid grid-cols-3 gap-4 mt-5 pt-5 border-t border-std">
          <div class="text-center">
            <p class="text-2xl font-black text-primary-600">${orderCount?.c || 0}</p>
            <p class="text-xs text-mute">الطلبات</p>
          </div>
          <div class="text-center border-x border-std">
            <p class="text-2xl font-black text-green-600">${productCount?.c || 0}</p>
            <p class="text-xs text-mute">المنتجات</p>
          </div>
          <div class="text-center">
            <p class="text-2xl font-black text-purple-600">${(store as any).name?.[0]}</p>
            <p class="text-xs text-mute">المتجر: <span class="font-medium">${(store as any).name}</span></p>
          </div>
        </div>` : ''}
      </div>
    </div>

    <!-- Edit Profile -->
    <div class="bg-card rounded-2xl border border-std shadow-sm p-6">
      <h3 class="font-bold text-main mb-5 flex items-center gap-2">
        <i class="fas fa-user-edit text-primary-500"></i> تعديل بيانات الحساب
      </h3>
      <form id="profileForm" class="space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-sub mb-1.5">الاسم الكامل *</label>
            <input type="text" id="pName" value="${fullUser?.name || ''}" required
              class="w-full px-4 py-2.5 border border-std rounded-xl text-sm bg-page text-main focus:ring-2 focus:ring-primary-300 outline-none">
          </div>
          <div>
            <label class="block text-sm font-medium text-sub mb-1.5">البريد الإلكتروني</label>
            <input type="email" value="${fullUser?.email || ''}" disabled dir="ltr"
              class="w-full px-4 py-2.5 border border-std rounded-xl text-sm bg-gray-50 dark:bg-slate-800 text-mute cursor-not-allowed">
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium text-sub mb-1.5">رقم الجوال</label>
          <input type="tel" id="pPhone" value="${fullUser?.phone || ''}" placeholder="+966xxxxxxxxx" dir="ltr"
            class="w-full px-4 py-2.5 border border-std rounded-xl text-sm bg-page text-main focus:ring-2 focus:ring-primary-300 outline-none">
        </div>
        <button type="submit"
          class="bg-primary-600 hover:bg-primary-700 text-white font-semibold px-8 py-2.5 rounded-xl transition-colors flex items-center gap-2">
          <i class="fas fa-save"></i> حفظ التغييرات
        </button>
      </form>
    </div>

    <!-- Change Password -->
    <div class="bg-card rounded-2xl border border-std shadow-sm p-6">
      <h3 class="font-bold text-main mb-5 flex items-center gap-2">
        <i class="fas fa-lock text-orange-500"></i> تغيير كلمة المرور
      </h3>
      <form id="passwordForm" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-sub mb-1.5">كلمة المرور الحالية *</label>
          <input type="password" id="pCurrentPwd" required placeholder="••••••••"
            class="w-full px-4 py-2.5 border border-std rounded-xl text-sm bg-page text-main focus:ring-2 focus:ring-primary-300 outline-none">
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-sub mb-1.5">كلمة المرور الجديدة *</label>
            <input type="password" id="pNewPwd" required placeholder="8 أحرف على الأقل" minlength="8"
              class="w-full px-4 py-2.5 border border-std rounded-xl text-sm bg-page text-main focus:ring-2 focus:ring-primary-300 outline-none">
          </div>
          <div>
            <label class="block text-sm font-medium text-sub mb-1.5">تأكيد كلمة المرور *</label>
            <input type="password" id="pConfirmPwd" required placeholder="••••••••"
              class="w-full px-4 py-2.5 border border-std rounded-xl text-sm bg-page text-main focus:ring-2 focus:ring-primary-300 outline-none">
          </div>
        </div>
        <button type="submit"
          class="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-8 py-2.5 rounded-xl transition-colors flex items-center gap-2">
          <i class="fas fa-key"></i> تغيير كلمة المرور
        </button>
      </form>
    </div>

    <!-- Preferences -->
    <div class="bg-card rounded-2xl border border-std shadow-sm p-6">
      <h3 class="font-bold text-main mb-5 flex items-center gap-2">
        <i class="fas fa-sliders-h text-blue-500"></i> التفضيلات
      </h3>
      <div class="space-y-3">
        <div class="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-800 rounded-xl">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-slate-100 dark:bg-slate-700 rounded-xl flex items-center justify-center">
              <i class="fas fa-moon text-slate-600 dark:text-slate-300"></i>
            </div>
            <div>
              <p class="text-sm font-semibold text-main">الوضع الليلي</p>
              <p class="text-xs text-mute">تبديل المظهر الليلي/النهاري</p>
            </div>
          </div>
          <button onclick="toggleTheme()" class="theme-toggle border-0 cursor-pointer"></button>
        </div>
        <div class="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-800 rounded-xl">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center">
              <i class="fas fa-bell text-blue-600"></i>
            </div>
            <div>
              <p class="text-sm font-semibold text-main">الإشعارات</p>
              <p class="text-xs text-mute">طلبات جديدة وتنبيهات المخزن</p>
            </div>
          </div>
          <label class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" class="sr-only peer" checked>
            <div class="w-11 h-6 bg-gray-200 dark:bg-slate-600 rounded-full peer peer-checked:bg-primary-500 transition-colors"></div>
            <span class="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5 shadow"></span>
          </label>
        </div>
        ${store ? `
        <div class="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-800 rounded-xl">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-green-50 dark:bg-green-900/20 rounded-xl flex items-center justify-center">
              <i class="fas fa-store text-green-600"></i>
            </div>
            <div>
              <p class="text-sm font-semibold text-main">رابط متجري</p>
              <p class="text-xs text-mute">/store/${(store as any).slug}</p>
            </div>
          </div>
          <a href="/store/${(store as any).slug}" target="_blank" class="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1">
            <i class="fas fa-external-link-alt text-xs"></i> فتح
          </a>
        </div>` : ''}
      </div>
    </div>

    <!-- Danger Zone -->
    <div class="bg-red-50 dark:bg-red-900/10 rounded-2xl border border-red-200 dark:border-red-800 p-6">
      <h3 class="font-bold text-red-700 dark:text-red-400 mb-3 flex items-center gap-2">
        <i class="fas fa-exclamation-triangle"></i> منطقة الخطر
      </h3>
      <p class="text-sm text-red-600 dark:text-red-400 mb-4">هذه الإجراءات لا يمكن التراجع عنها.</p>
      <a href="/auth/logout"
         class="inline-flex items-center gap-2 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-700 dark:text-red-400 px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors">
        <i class="fas fa-sign-out-alt"></i> تسجيل الخروج
      </a>
    </div>
  </div>
  `, user, store as any, 'profile', `
  <script>
    document.getElementById('profileForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await axios.put('/api/dashboard/profile', {
          name: document.getElementById('pName').value,
          phone: document.getElementById('pPhone').value,
        });
        showToast('تم حفظ التغييرات بنجاح', 'success');
      } catch (err) { showToast(err.response?.data?.message || 'خطأ في الحفظ', 'error'); }
    });
    document.getElementById('passwordForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const np = document.getElementById('pNewPwd').value;
      const cp = document.getElementById('pConfirmPwd').value;
      if (np !== cp) { showToast('كلمتا المرور غير متطابقتان', 'error'); return; }
      try {
        await axios.put('/api/dashboard/password', {
          current_password: document.getElementById('pCurrentPwd').value,
          new_password: np,
        });
        showToast('تم تغيير كلمة المرور بنجاح', 'success');
        e.target.reset();
      } catch (err) { showToast(err.response?.data?.message || 'كلمة المرور الحالية غير صحيحة', 'error'); }
    });
  </script>
  `));
});

// ─── Store Settings ───────────────────────────────────────────
dashboard.get('/settings', async (c) => {
  const user = c.get('user')!;
  const store = await getStore(c.env.DB, user.id);
  if (!store) return c.redirect('/auth/register');

  const plans = await c.env.DB.prepare('SELECT * FROM plans WHERE is_active = 1').all();
  const currentPlan = await c.env.DB.prepare('SELECT * FROM plans WHERE id = ?').bind(store.plan_id).first() as any;

  return c.html(dashboardLayout('إعدادات المتجر', `
  <div class="max-w-4xl">
    <!-- Tabs -->
    <div class="flex gap-1.5 mb-6 bg-card p-1.5 rounded-xl border border-std overflow-x-auto">
      ${['general', 'appearance', 'shipping', 'bank_accounts', 'integrations', 'social', 'password'].map((tab, i) => `
      <button onclick="showTab('${tab}')" id="tab-${tab}"
        class="px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${i === 0 ? 'bg-primary-600 text-white shadow' : 'text-sub hover:bg-gray-100 dark:hover:bg-slate-700'}">
        ${['معلومات المتجر', 'المظهر والألوان', 'إعدادات الشحن', 'الحسابات البنكية', 'التتبع والربط', 'التواصل الاجتماعي', 'تغيير كلمة المرور'][i]}
      </button>
      `).join('')}
    </div>

    <!-- General Tab -->
    <div id="tab-content-general" class="bg-card rounded-2xl border border-std p-6 shadow-sm">
      <h3 class="font-bold text-main mb-5 flex items-center gap-2"><i class="fas fa-store text-primary-500"></i> معلومات المتجر</h3>
      <form id="generalForm" class="space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-sub mb-1.5">اسم المتجر *</label>
            <input type="text" id="sName" value="${store.name}" required
              class="w-full px-4 py-2.5 border border-std rounded-xl text-sm bg-page text-main focus:ring-2 focus:ring-primary-300 outline-none">
          </div>
          <div>
            <label class="block text-sm font-medium text-sub mb-1.5">رابط المتجر</label>
            <div class="flex">
              <span class="bg-gray-50 dark:bg-slate-700 border border-std border-l-0 rounded-r-xl px-3 flex items-center text-xs text-mute">/store/</span>
              <input type="text" value="${store.slug}" disabled dir="ltr"
                class="flex-1 pl-4 py-2.5 border border-std rounded-l-xl bg-gray-50 dark:bg-slate-800 text-mute text-sm cursor-not-allowed">
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-sub mb-1.5">البريد الإلكتروني</label>
            <input type="email" id="sEmail" value="${store.email || ''}"
              class="w-full px-4 py-2.5 border border-std rounded-xl text-sm bg-page text-main focus:ring-2 focus:ring-primary-300 outline-none">
          </div>
          <div>
            <label class="block text-sm font-medium text-sub mb-1.5">رقم الهاتف</label>
            <input type="text" id="sPhone" value="${store.phone || ''}" dir="ltr"
              class="w-full px-4 py-2.5 border border-std rounded-xl text-sm bg-page text-main focus:ring-2 focus:ring-primary-300 outline-none">
          </div>
          <div>
            <label class="block text-sm font-medium text-sub mb-1.5">المدينة</label>
            <input type="text" id="sCity" value="${store.city || ''}"
              class="w-full px-4 py-2.5 border border-std rounded-xl text-sm bg-page text-main focus:ring-2 focus:ring-primary-300 outline-none">
          </div>
          <div>
            <label class="block text-sm font-medium text-sub mb-1.5">العملة</label>
            <select id="sCurrency"
              class="w-full px-4 py-2.5 border border-std rounded-xl text-sm bg-page text-main focus:ring-2 focus:ring-primary-300 outline-none">
              <option value="YER" ${(!store.currency || store.currency === 'YER') ? 'selected' : ''}>ريال يمني (YER)</option>
              <option value="SAR" ${store.currency === 'SAR' ? 'selected' : ''}>ريال سعودي (SAR)</option>
              <option value="USD" ${store.currency === 'USD' ? 'selected' : ''}>دولار أمريكي (USD)</option>
            </select>
          </div>
        </div>
        <div class="mt-4">
          <label class="block text-sm font-medium text-sub mb-1.5">النطاق المخصص (Custom Domain)</label>
          <input type="text" id="sCustomDomain" value="${store.custom_domain || ''}" placeholder="www.mybrand.com" dir="ltr"
            class="w-full px-4 py-2.5 border border-std rounded-xl text-sm bg-page text-main focus:ring-2 focus:ring-primary-300 outline-none">
          <p class="text-xs text-mute mt-1.5">مثال: <code>www.mybrand.com</code>. يرجى توجيه سجل الـ CNAME لنطاقك المخصص إلى نطاق المنصة.</p>
        </div>
        <div>
          <label class="block text-sm font-medium text-sub mb-1.5">وصف المتجر</label>
          <textarea id="sDesc" rows="3"
            class="w-full px-4 py-2.5 border border-std rounded-xl text-sm bg-page text-main focus:ring-2 focus:ring-primary-300 outline-none resize-none">${store.description || ''}</textarea>
        </div>
        <button type="submit" class="bg-primary-600 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-primary-700 transition-colors flex items-center gap-2">
          <i class="fas fa-save"></i> حفظ التغييرات
        </button>
      </form>
    </div>

    <!-- Appearance Tab -->
    <div id="tab-content-appearance" class="hidden bg-card rounded-2xl border border-std p-6 shadow-sm">
      <h3 class="font-bold text-main mb-5 flex items-center gap-2"><i class="fas fa-palette text-purple-500"></i> المظهر والألوان</h3>
      <form id="appearanceForm" class="space-y-5">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-sub mb-2">اللون الأساسي</label>
            <div class="flex items-center gap-3">
              <input type="color" id="primaryColor" value="${store.primary_color}"
                class="w-12 h-12 rounded-xl border border-std cursor-pointer p-1">
              <input type="text" id="primaryColorText" value="${store.primary_color}" dir="ltr"
                class="flex-1 px-3 py-2.5 border border-std rounded-xl text-sm bg-page text-main focus:ring-2 focus:ring-primary-300 outline-none">
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-sub mb-2">اللون الثانوي</label>
            <div class="flex items-center gap-3">
              <input type="color" id="secondaryColor" value="${store.secondary_color}"
                class="w-12 h-12 rounded-xl border border-std cursor-pointer p-1">
              <input type="text" id="secondaryColorText" value="${store.secondary_color}" dir="ltr"
                class="flex-1 px-3 py-2.5 border border-std rounded-xl text-sm bg-page text-main focus:ring-2 focus:ring-primary-300 outline-none">
            </div>
          </div>
        </div>
        <div class="p-4 border border-std rounded-xl">
          <p class="text-xs text-mute mb-2">معاينة:</p>
          <div id="colorPreview" class="h-20 rounded-xl transition-all" style="background: linear-gradient(135deg, ${store.primary_color}, ${store.secondary_color});"></div>
        </div>
        <div>
          <label class="block text-sm font-medium text-sub mb-2">شعار المتجر</label>
          <div class="flex gap-2.5">
            <input type="text" id="sLogo" value="${store.logo || ''}" placeholder="https://example.com/logo.png" dir="ltr"
              class="flex-1 px-4 py-2.5 border border-std rounded-xl text-sm bg-page text-main focus:ring-2 focus:ring-primary-300 outline-none">
            <div class="relative">
              <input type="file" id="logoUploadInput" accept="image/*" class="absolute inset-0 opacity-0 cursor-pointer w-28" onchange="uploadStoreLogo(this)">
              <button type="button" class="w-28 h-full bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl text-sm transition-colors flex items-center justify-center gap-1.5 shadow-sm">
                <i class="fas fa-upload"></i> رفع الشعار
              </button>
            </div>
          </div>
          <p class="text-xs text-mute mt-1">أدخل رابط شعار خارجي أو قم برفع ملف مباشرة من جهازك</p>
        </div>
        <button type="submit" class="bg-primary-600 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-primary-700 transition-colors flex items-center gap-2">
          <i class="fas fa-save"></i> حفظ المظهر
        </button>
      </form>
    </div>

    <!-- Shipping Tab -->
    <div id="tab-content-shipping" class="hidden bg-card rounded-2xl border border-std p-6 shadow-sm">
      <div class="flex items-center justify-between mb-5">
        <div>
          <h3 class="font-bold text-main flex items-center gap-2"><i class="fas fa-shipping-fast text-indigo-500"></i> الشحن متعدد المناطق</h3>
          <p class="text-xs text-mute mt-0.5 font-medium">حدد سعر الشحن لكل مدينة لتحديثها تلقائياً عند دفع العملاء</p>
        </div>
        <button type="button" onclick="addShippingRateRow()"
          class="flex items-center gap-1.5 text-xs bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-900/50 px-3 py-2 rounded-xl transition-all font-semibold shadow-sm">
          <i class="fas fa-plus"></i> إضافة مدينة
        </button>
      </div>
      <form id="shippingForm" class="space-y-4">
        <div id="shippingRatesContainer" class="space-y-3">
          <!-- Dynamically populated -->
        </div>
        <button type="submit" class="bg-primary-600 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-primary-700 transition-colors flex items-center gap-2 mt-4 shadow-md">
          <i class="fas fa-save"></i> حفظ أسعار الشحن
        </button>
      </form>
      </form>
    </div>

    <!-- Bank Accounts Tab -->
    <div id="tab-content-bank_accounts" class="hidden bg-card rounded-2xl border border-std p-6 shadow-sm">
      <h3 class="font-bold text-main mb-5 flex items-center gap-2"><i class="fas fa-money-check text-green-500"></i> الحسابات البنكية للمتجر</h3>
      <p class="text-xs text-mute mb-5 font-medium">أضف الحسابات البنكية أو المحافظ المالية ليتمكن العملاء من الدفع عبر إرفاق السند.</p>
      
      <div id="bankAccountsList" class="space-y-3 mb-6">
        <!-- Rendered by JS -->
      </div>
      
      <div class="bg-page p-4 rounded-xl border border-dashed border-std">
        <h4 class="font-medium text-sm text-sub mb-3">إضافة حساب جديد</h4>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs text-mute mb-1">اسم البنك / المحفظة</label>
            <input type="text" id="newBankName" placeholder="مثال: بنك الراجحي" class="w-full px-3 py-2 border border-std rounded-lg text-sm focus:outline-none focus:border-primary-500">
          </div>
          <div>
            <label class="block text-xs text-mute mb-1">رقم الحساب / الآيبان</label>
            <input type="text" id="newBankAccount" placeholder="SA..." dir="ltr" class="w-full px-3 py-2 border border-std rounded-lg text-sm focus:outline-none focus:border-primary-500">
          </div>
        </div>
        <button type="button" onclick="addBankAccount()" class="mt-3 bg-gray-100 hover:bg-gray-200 text-sub px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
          <i class="fas fa-plus ml-1"></i> إضافة الحساب
        </button>
      </div>

      <button type="button" onclick="saveBankAccounts()" class="bg-primary-600 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-primary-700 transition-colors flex items-center gap-2 mt-6 shadow-md">
        <i class="fas fa-save"></i> حفظ جميع الحسابات
      </button>
    </div>

    <!-- Integrations Tab -->
    <div id="tab-content-integrations" class="hidden bg-card rounded-2xl border border-std p-6 shadow-sm">
      <h3 class="font-bold text-main mb-5 flex items-center gap-2"><i class="fas fa-chart-line text-blue-500"></i> خدمات التتبع والربط</h3>
      <p class="text-xs text-mute mb-5 font-medium">اربط متجرك بأدوات التتبع لقياس الحملات الإعلانية ومراقبة سلوك الزوار</p>
      <form id="integrationsForm" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-sub mb-1.5">معرف تتبع Google Analytics (G-XXXXXXX)</label>
          <input type="text" id="sGoogleAnalytics" value="${store.google_analytics_id || ''}" placeholder="G-XXXXXXXXXX" dir="ltr"
            class="w-full px-4 py-2.5 border border-std rounded-xl text-sm bg-page text-main focus:ring-2 focus:ring-primary-300 outline-none">
        </div>
        <div>
          <label class="block text-sm font-medium text-sub mb-1.5">معرف Meta Pixel (Facebook Pixel ID)</label>
          <input type="text" id="sMetaPixel" value="${store.meta_pixel_id || ''}" placeholder="123456789012345" dir="ltr"
            class="w-full px-4 py-2.5 border border-std rounded-xl text-sm bg-page text-main focus:ring-2 focus:ring-primary-300 outline-none">
        </div>
        <button type="submit" class="bg-primary-600 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-primary-700 transition-colors flex items-center gap-2 mt-4 shadow-md">
          <i class="fas fa-save"></i> حفظ أدوات التتبع
        </button>
      </form>
    </div>

    <!-- Social Tab -->
    <div id="tab-content-social" class="hidden bg-card rounded-2xl border border-std p-6 shadow-sm">
      <h3 class="font-bold text-main mb-5 flex items-center gap-2"><i class="fas fa-share-alt text-blue-500"></i> روابط التواصل الاجتماعي</h3>
      <form id="socialForm" class="space-y-4">
        ${[
          { id: 'sWhatsapp', icon: 'whatsapp', iconType: 'fab', label: 'رقم الواتساب', value: store.whatsapp || '', ph: '966500000000', color: 'text-green-500' },
          { id: 'sWhatsappGroup', icon: 'users', iconType: 'fas', label: 'رابط قروب الواتساب', value: store.whatsapp_group || '', ph: 'https://chat.whatsapp.com/...', color: 'text-emerald-500' },
          { id: 'sInstagram', icon: 'instagram', iconType: 'fab', label: 'إنستغرام', value: store.instagram || '', ph: '@username', color: 'text-pink-500' },
          { id: 'sTwitter', icon: 'twitter', iconType: 'fab', label: 'تويتر (X)', value: store.twitter || '', ph: '@username', color: 'text-blue-400' },
          { id: 'sFacebook', icon: 'facebook', iconType: 'fab', label: 'فيسبوك', value: store.facebook || '', ph: 'facebook.com/yourpage', color: 'text-blue-600' },
        ].map(s => `
        <div>
          <label class="block text-sm font-medium text-sub mb-1.5">
            <i class="${s.iconType} fa-${s.icon} ${s.color} ml-1"></i>${s.label}
          </label>
          <input type="text" id="${s.id}" value="${s.value}" placeholder="${s.ph}" dir="ltr"
            class="w-full px-4 py-2.5 border border-std rounded-xl text-sm bg-page text-main focus:ring-2 focus:ring-primary-300 outline-none">
        </div>
        `).join('')}
        <button type="submit" class="bg-primary-600 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-primary-700 transition-colors flex items-center gap-2">
          <i class="fas fa-save"></i> حفظ الروابط
        </button>
      </form>
    </div>

    <!-- Password Tab -->
    <div id="tab-content-password" class="hidden bg-card rounded-2xl border border-std p-6 shadow-sm">
      <h3 class="font-bold text-main mb-5 flex items-center gap-2">
        <i class="fas fa-lock text-orange-500"></i> تغيير كلمة المرور
      </h3>
      <form id="settingsPasswordForm" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-sub mb-1.5">كلمة المرور الحالية *</label>
          <input type="password" id="sCurrentPwd" required placeholder="••••••••"
            class="w-full px-4 py-2.5 border border-std rounded-xl text-sm bg-page text-main focus:ring-2 focus:ring-primary-300 outline-none">
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-sub mb-1.5">كلمة المرور الجديدة *</label>
            <input type="password" id="sNewPwd" required placeholder="6 أحرف على الأقل" minlength="6"
              class="w-full px-4 py-2.5 border border-std rounded-xl text-sm bg-page text-main focus:ring-2 focus:ring-primary-300 outline-none">
          </div>
          <div>
            <label class="block text-sm font-medium text-sub mb-1.5">تأكيد كلمة المرور *</label>
            <input type="password" id="sConfirmPwd" required placeholder="••••••••"
              class="w-full px-4 py-2.5 border border-std rounded-xl text-sm bg-page text-main focus:ring-2 focus:ring-primary-300 outline-none">
          </div>
        </div>
        <button type="submit" id="saveSettingsPwdBtn"
          class="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-8 py-2.5 rounded-xl transition-colors flex items-center gap-2 shadow-sm">
          <i class="fas fa-key"></i> حفظ كلمة المرور الجديدة
        </button>
      </form>
    </div>
  </div>
  `, user, store, 'settings', `
  <script>
    const STORE_BANK_ACCOUNTS = ${store.bank_accounts || '[]'};

    function renderBankAccountsList() {
      const list = document.getElementById('bankAccountsList');
      if (!list) return;
      if (STORE_BANK_ACCOUNTS.length === 0) {
        list.innerHTML = '<p class="text-xs text-mute italic">لا توجد حسابات مضافة بعد.</p>';
        return;
      }
      list.innerHTML = STORE_BANK_ACCOUNTS.map((b, i) => \`
        <div class="flex items-center justify-between p-3 border border-std rounded-lg bg-white">
          <div>
            <p class="text-sm font-bold text-main">\${b.bank_name}</p>
            <p class="text-xs text-mute font-mono mt-0.5">\${b.account_number}</p>
          </div>
          <button type="button" onclick="removeBankAccount(\${i})" class="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors">
            <i class="fas fa-trash-alt"></i>
          </button>
        </div>
      \`).join('');
    }

    function addBankAccount() {
      const nameInput = document.getElementById('newBankName');
      const accInput = document.getElementById('newBankAccount');
      if (!nameInput.value || !accInput.value) {
        return showToast('يرجى تعبئة جميع حقول الحساب', 'error');
      }
      STORE_BANK_ACCOUNTS.push({ bank_name: nameInput.value, account_number: accInput.value });
      nameInput.value = '';
      accInput.value = '';
      renderBankAccountsList();
    }

    function removeBankAccount(index) {
      STORE_BANK_ACCOUNTS.splice(index, 1);
      renderBankAccountsList();
    }

    async function saveBankAccounts() {
      try {
        await axios.put('/api/dashboard/store', {
          bank_accounts: JSON.stringify(STORE_BANK_ACCOUNTS)
        });
        showToast('تم حفظ الحسابات بنجاح', 'success');
      } catch (err) {
        showToast(err.response?.data?.message || 'خطأ في الحفظ', 'error');
      }
    }

    // Render initially
    setTimeout(renderBankAccountsList, 100);

    function showTab(tab) {
      ['general', 'appearance', 'shipping', 'bank_accounts', 'integrations', 'social', 'password', 'subscription'].forEach(t => {
        const content = document.getElementById('tab-content-' + t);
        const btn = document.getElementById('tab-' + t);
        if (t === tab) {
          content?.classList.remove('hidden');
          btn?.classList.replace('text-sub', 'text-white');
          btn?.classList.add('bg-primary-600', 'shadow');
          btn?.classList.remove('hover:bg-gray-100', 'dark:hover:bg-slate-700');
        } else {
          content?.classList.add('hidden');
          btn?.classList.remove('bg-primary-600', 'shadow', 'text-white');
          btn?.classList.add('text-sub', 'hover:bg-gray-100', 'dark:hover:bg-slate-700');
        }
      });
    }

    document.getElementById('primaryColor')?.addEventListener('input', function() {
      document.getElementById('primaryColorText').value = this.value;
      updatePreview();
    });
    document.getElementById('secondaryColor')?.addEventListener('input', function() {
      document.getElementById('secondaryColorText').value = this.value;
      updatePreview();
    });
    function updatePreview() {
      const p = document.getElementById('primaryColor').value;
      const s = document.getElementById('secondaryColor').value;
      document.getElementById('colorPreview').style.background = 'linear-gradient(135deg,' + p + ',' + s + ')';
    }

    document.getElementById('generalForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await axios.put('/api/dashboard/store', {
          name: document.getElementById('sName').value,
          email: document.getElementById('sEmail').value,
          phone: document.getElementById('sPhone').value,
          city: document.getElementById('sCity').value,
          currency: document.getElementById('sCurrency').value,
          description: document.getElementById('sDesc').value,
          custom_domain: document.getElementById('sCustomDomain').value ? document.getElementById('sCustomDomain').value.trim().toLowerCase() : null
        });
        showToast('تم حفظ المعلومات', 'success');
      } catch (err) { 
        showToast(err.response?.data?.message || 'خطأ في الحفظ', 'error'); 
      }
    });

    document.getElementById('appearanceForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await axios.put('/api/dashboard/store', {
          primary_color: document.getElementById('primaryColor').value,
          secondary_color: document.getElementById('secondaryColor').value,
          logo: document.getElementById('sLogo').value,
        });
        showToast('تم حفظ الألوان', 'success');
      } catch { showToast('خطأ في الحفظ', 'error'); }
    });

    document.getElementById('socialForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await axios.put('/api/dashboard/store', {
          whatsapp: document.getElementById('sWhatsapp').value,
          whatsapp_group: document.getElementById('sWhatsappGroup')?.value,
          instagram: document.getElementById('sInstagram').value,
          twitter: document.getElementById('sTwitter').value,
          facebook: document.getElementById('sFacebook').value,
        });
        showToast('تم حفظ روابط التواصل بنجاح', 'success');
      } catch { showToast('خطأ في الحفظ', 'error'); }
    });

    document.getElementById('settingsPasswordForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const current_password = document.getElementById('sCurrentPwd').value;
      const new_password = document.getElementById('sNewPwd').value;
      const confirm_password = document.getElementById('sConfirmPwd').value;

      if (new_password !== confirm_password) {
        showToast('كلمة المرور الجديدة وتأكيدها غير متطابقين', 'error');
        return;
      }

      const btn = document.getElementById('saveSettingsPwdBtn');
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';
      }

      try {
        const token = document.cookie.split(';').find(c => c.trim().startsWith('auth_token='))?.split('=')?.[1] || '';
        const res = await fetch('/api/dashboard/password', {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
          },
          body: JSON.stringify({ current_password, new_password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'فشل تغيير كلمة المرور');
        showToast('تم تغيير كلمة المرور بنجاح', 'success');
        e.target.reset();
      } catch (err) {
        showToast(err.message || 'حدث خطأ أثناء تغيير كلمة المرور', 'error');
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = '<i class="fas fa-key"></i> حفظ كلمة المرور الجديدة';
        }
      }
    });

    async function uploadStoreLogo(input) {
      if (!input.files || input.files.length === 0) return;
      const file = input.files[0];
      const formData = new FormData();
      formData.append('file', file);
      
      const btn = input.nextElementSibling;
      const oldHTML = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> رفع...';
      
      try {
        const res = await axios.post('/api/dashboard/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        if (res.data && res.data.url) {
          document.getElementById('sLogo').value = res.data.url;
          showToast('تم رفع الشعار بنجاح', 'success');
        } else {
          showToast('خطأ أثناء الرفع', 'error');
        }
      } catch (err) {
        showToast(err.response?.data?.message || 'خطأ أثناء الرفع', 'error');
      } finally {
        btn.disabled = false;
        btn.innerHTML = oldHTML;
        input.value = '';
      }
    }

    async function subscribePlan(planId) {
      if (!confirm('هل تريد تغيير الباقة؟')) return;
      try {
        await axios.post('/api/dashboard/subscribe', { plan_id: planId });
        showToast('تم تحديث الاشتراك', 'success');
        setTimeout(() => location.reload(), 1000);
      } catch { showToast('خطأ في التحديث', 'error'); }
    }

    // ── Shipping Rates Logic ──
    const initialShippingRates = ${store.shipping_rates || '[]'};
    function addShippingRateRow(data = { city: '', cost: 0 }) {
      const container = document.getElementById('shippingRatesContainer');
      if (!container) return;
      const div = document.createElement('div');
      div.className = 'shipping-rate-row grid grid-cols-3 gap-3 p-3 bg-gray-50/50 dark:bg-slate-800/40 border border-std rounded-xl items-end relative fade-in';
      div.innerHTML = \`
        <div class="col-span-2">
          <label class="block text-[11px] text-mute mb-1 font-semibold">اسم المدينة (مثال: الرياض أو "الكل")</label>
          <input type="text" value="\${data.city}" placeholder="المدينة" class="ship-city w-full px-3 py-2 border border-std rounded-lg text-xs bg-page text-main focus:outline-none">
        </div>
        <div class="flex items-center gap-2">
          <div class="flex-1">
            <label class="block text-[11px] text-mute mb-1 font-semibold">التكلفة (${store.currency})</label>
            <input type="number" value="\${data.cost}" placeholder="0.00" step="0.1" class="ship-cost w-full px-3 py-2 border border-std rounded-lg text-xs bg-page text-main focus:outline-none text-center" dir="ltr">
          </div>
          <button type="button" onclick="this.parentElement.parentElement.remove()" class="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors flex-shrink-0 mb-0.5">
            <i class="fas fa-trash-alt text-sm"></i>
          </button>
        </div>\`;
      container.appendChild(div);
    }
    if (initialShippingRates && initialShippingRates.length > 0) {
      initialShippingRates.forEach(r => addShippingRateRow(r));
    } else {
      addShippingRateRow({ city: 'الكل', cost: 20 });
    }

    document.getElementById('shippingForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const rows = Array.from(document.querySelectorAll('.shipping-rate-row'));
        const rates = rows.map(r => ({
          city: r.querySelector('.ship-city').value.trim(),
          cost: parseFloat(r.querySelector('.ship-cost').value) || 0
        })).filter(r => r.city);

        await axios.put('/api/dashboard/store', {
          shipping_rates: JSON.stringify(rates)
        });
        showToast('تم حفظ أسعار الشحن بنجاح', 'success');
      } catch (err) {
        showToast('خطأ في الحفظ', 'error');
      }
    });

    document.getElementById('integrationsForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await axios.put('/api/dashboard/store', {
          google_analytics_id: document.getElementById('sGoogleAnalytics').value.trim() || null,
          meta_pixel_id: document.getElementById('sMetaPixel').value.trim() || null
        });
        showToast('تم حفظ أدوات التتبع بنجاح', 'success');
      } catch (err) {
        showToast('خطأ في الحفظ', 'error');
      }
    });

    if (window.location.hash === '#subscription') showTab('subscription');
  </script>
  `));
});

// ─── Subscription Status & Renewal Page ──────────────────────────
dashboard.get('/subscription', async (c) => {
  const user = c.get('user')!;
  const store = await getStore(c.env.DB, user.id);
  if (!store) return c.redirect('/auth/register');

  const plans = await c.env.DB.prepare('SELECT * FROM plans WHERE is_active = 1 ORDER BY price ASC').all();
  const currentPlan = await c.env.DB.prepare('SELECT * FROM plans WHERE id = ?').bind(store.plan_id).first() as any;

  // Counts for limits calculation
  const [prodCountRes, catCountRes, staffCountRes] = await Promise.all([
    c.env.DB.prepare("SELECT COUNT(*) as count FROM products WHERE store_id = ? AND status != 'deleted'").bind(store.id).first() as any,
    c.env.DB.prepare("SELECT COUNT(*) as count FROM categories WHERE store_id = ?").bind(store.id).first() as any,
    c.env.DB.prepare("SELECT COUNT(*) as count FROM store_staff WHERE store_id = ? AND is_active = 1").bind(store.id).first() as any,
  ]);

  const prodCount = prodCountRes?.count || 0;
  const catCount = catCountRes?.count || 0;
  const staffCount = staffCountRes?.count || 0;

  const now = new Date();
  const endsAt = store.subscription_ends_at ? new Date(store.subscription_ends_at) : null;
  const startsAt = store.subscription_starts_at ? new Date(store.subscription_starts_at) : null;
  const daysLeft = endsAt ? Math.max(0, Math.ceil((endsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))) : 0;
  const isExpired = !endsAt || endsAt < now || store.subscription_status === 'expired';
  const isPending = store.subscription_status === 'pending_activation';

  let statusBadge = '<span class="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-bold rounded-full text-xs flex items-center gap-1.5"><i class="fas fa-check-circle"></i> نشط</span>';
  if (isPending) {
    statusBadge = '<span class="px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-bold rounded-full text-xs flex items-center gap-1.5 animate-pulse"><i class="fas fa-clock"></i> بانتظار التفعيل بواسطة المدير</span>';
  } else if (isExpired) {
    statusBadge = '<span class="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 font-bold rounded-full text-xs flex items-center gap-1.5"><i class="fas fa-times-circle"></i> منتهي الصلاحية</span>';
  }

  const supportRow = await c.env.DB.prepare("SELECT value FROM platform_settings WHERE key = 'support_whatsapp'").first() as any;
  const supportWhatsapp = supportRow?.value || '+967776461892';
  const whatsappUrl = `https://wa.me/${supportWhatsapp.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`مرحباً، أود تجديد وتفعيل اشتراك متجري (${store.name}) في منصة سوق.`)}`;

  return c.html(dashboardLayout('شاشة حالة الاشتراك والباقة', `
  <div class="max-w-5xl mx-auto space-y-6">

    ${isExpired ? `
    <div class="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-2xl p-5 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
      <div class="flex items-center gap-4 text-right">
        <div class="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center text-xl flex-shrink-0">
          <i class="fas fa-store-slash"></i>
        </div>
        <div>
          <h3 class="font-bold text-red-800 dark:text-red-300 text-base">اشتراك المتجر منتهي حالياً</h3>
          <p class="text-xs text-red-600 dark:text-red-400 mt-1">تم إيقاف ظهور المتجر للزوار وتعطيل جميع الوظائف. يرجى طلب التجديد أو التواصل مع الدعم الفني لإعادة التفعيل.</p>
        </div>
      </div>
      <a href="${whatsappUrl}" target="_blank" class="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 whitespace-nowrap shadow-md">
        <i class="fab fa-whatsapp text-sm"></i> التواصل عبر واتساب للتجديد
      </a>
    </div>` : ''}

    ${isPending ? `
    <div class="bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-200 dark:border-amber-800 rounded-2xl p-5 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
      <div class="flex items-center gap-4 text-right">
        <div class="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center text-xl flex-shrink-0 animate-bounce">
          <i class="fas fa-hourglass-half"></i>
        </div>
        <div>
          <h3 class="font-bold text-amber-800 dark:text-amber-300 text-base">طلب التجديد بانتظار التفعيل بواسطة المدير</h3>
          <p class="text-xs text-amber-600 dark:text-amber-400 mt-1">تم إرسال طلب تفعيل الباقة لمدير النظام. سيتم تفعيل حسابك فور تأكيد الاشتراك.</p>
        </div>
      </div>
      <a href="${whatsappUrl}" target="_blank" class="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 whitespace-nowrap shadow-md">
        <i class="fab fa-whatsapp text-sm"></i> متابعة الطلب مع الدعم
      </a>
    </div>` : ''}

    <!-- Top Card Overview -->
    <div class="bg-card rounded-2xl border border-std p-6 shadow-sm">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-std pb-6">
        <div>
          <div class="flex items-center gap-3 mb-2">
            <h2 class="text-2xl font-black text-main">${currentPlan?.name || 'الباقة الحالية'}</h2>
            ${statusBadge}
          </div>
          <p class="text-sub text-sm">تفاصيل اشتراك متجرك والقيود المتاحة حسب الباقة</p>
        </div>
        <div class="flex gap-3">
          <button onclick="requestPlanRenewal()" class="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold rounded-xl transition-all shadow-lg flex items-center gap-2">
            <i class="fas fa-sync-alt"></i> طلب تجديد / ترقية الباقة
          </button>
          <a href="${whatsappUrl}" target="_blank" class="px-5 py-3 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-xl transition-all shadow-md flex items-center gap-2">
            <i class="fab fa-whatsapp"></i> الدعم الفني
          </a>
        </div>
      </div>

      <!-- Dates Grid -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
        <div class="bg-page p-4 rounded-xl border border-std">
          <span class="text-xs text-mute font-medium block mb-1">تاريخ بداية الاشتراك</span>
          <span class="text-sm font-bold text-main">${startsAt ? startsAt.toLocaleDateString('ar-SA') : '—'}</span>
        </div>
        <div class="bg-page p-4 rounded-xl border border-std">
          <span class="text-xs text-mute font-medium block mb-1">تاريخ انتهاء الاشتراك</span>
          <span class="text-sm font-bold text-main">${endsAt ? endsAt.toLocaleDateString('ar-SA') : '—'}</span>
        </div>
        <div class="bg-page p-4 rounded-xl border border-std">
          <span class="text-xs text-mute font-medium block mb-1">الأيام المتبقية</span>
          <span class="text-sm font-black ${daysLeft <= 3 ? 'text-red-500' : 'text-primary-600'}">${daysLeft} أيام متبقية</span>
        </div>
      </div>
    </div>

    <!-- Usage & Limits -->
    <div class="bg-card rounded-2xl border border-std p-6 shadow-sm">
      <h3 class="font-bold text-main text-base mb-5 flex items-center gap-2">
        <i class="fas fa-chart-bar text-primary-500"></i> استهلاك موارد الباقة والقيود
      </h3>
      <div class="space-y-5">
        <!-- Products Limit -->
        <div>
          <div class="flex justify-between text-xs font-bold mb-1.5">
            <span class="text-sub"><i class="fas fa-box ml-1 text-blue-500"></i> عدد المنتجات</span>
            <span class="text-main">${prodCount} / ${currentPlan?.max_products === -1 ? 'غير محدود' : currentPlan?.max_products}</span>
          </div>
          <div class="w-full bg-gray-200 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
            <div class="bg-blue-600 h-full rounded-full transition-all" style="width: ${currentPlan?.max_products === -1 ? '15%' : Math.min(100, Math.round((prodCount / currentPlan?.max_products) * 100))}%"></div>
          </div>
        </div>

        <!-- Categories Limit -->
        <div>
          <div class="flex justify-between text-xs font-bold mb-1.5">
            <span class="text-sub"><i class="fas fa-folder ml-1 text-purple-500"></i> عدد الأقسام</span>
            <span class="text-main">${catCount} / ${currentPlan?.max_categories === -1 ? 'غير محدود' : currentPlan?.max_categories}</span>
          </div>
          <div class="w-full bg-gray-200 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
            <div class="bg-purple-600 h-full rounded-full transition-all" style="width: ${currentPlan?.max_categories === -1 ? '15%' : Math.min(100, Math.round((catCount / currentPlan?.max_categories) * 100))}%"></div>
          </div>
        </div>

        <!-- Staff Limit -->
        <div>
          <div class="flex justify-between text-xs font-bold mb-1.5">
            <span class="text-sub"><i class="fas fa-user-tie ml-1 text-emerald-500"></i> عدد الموظفين</span>
            <span class="text-main">${staffCount} / ${currentPlan?.max_staff === -1 ? 'غير محدود' : currentPlan?.max_staff}</span>
          </div>
          <div class="w-full bg-gray-200 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
            <div class="bg-emerald-600 h-full rounded-full transition-all" style="width: ${currentPlan?.max_staff === -1 ? '15%' : Math.min(100, Math.round((staffCount / currentPlan?.max_staff) * 100))}%"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Available Plans Selection -->
    <div class="bg-card rounded-2xl border border-std p-6 shadow-sm">
      <h3 class="font-bold text-main text-base mb-5 flex items-center gap-2">
        <i class="fas fa-tags text-amber-500"></i> جميع الباقات المتاحة للمنصة
      </h3>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        ${(plans.results as any[]).map(plan => `
        <div class="bg-page rounded-2xl border-2 p-5 flex flex-col justify-between transition-all ${plan.id === store.plan_id ? 'border-primary-500 shadow-md bg-primary-50/20' : 'border-std'}">
          <div>
            ${plan.id === store.plan_id ? '<div class="text-[10px] bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 font-bold px-2.5 py-0.5 rounded-full inline-block mb-2">باقتك الحالية</div>' : ''}
            <h4 class="font-bold text-main text-base">${plan.name}</h4>
            <p class="text-xl font-black text-primary-600 mt-2">
              ${plan.price === 0 ? '0 ريال / 5 أيام' : `${plan.price.toLocaleString('ar-SA')} <span class="text-xs font-normal text-mute">ريال / شهر</span>`}
            </p>
            <ul class="mt-4 space-y-2 text-xs text-sub border-t border-std pt-3">
              <li class="flex items-center justify-between"><span class="text-mute">المتاجر:</span><span class="font-bold text-main">${plan.max_stores === -1 ? 'غير محدود' : plan.max_stores}</span></li>
              <li class="flex items-center justify-between"><span class="text-mute">المنتجات:</span><span class="font-bold text-main">${plan.max_products === -1 ? 'غير محدود' : plan.max_products}</span></li>
              <li class="flex items-center justify-between"><span class="text-mute">الطلبات الشهرية:</span><span class="font-bold text-main">${plan.max_orders === -1 ? 'غير محدود' : plan.max_orders.toLocaleString('ar-SA')}</span></li>
              <li class="flex items-center justify-between"><span class="text-mute">الموظفون:</span><span class="font-bold text-main">${plan.max_staff === -1 ? 'غير محدود' : plan.max_staff}</span></li>
            </ul>
          </div>
          <button onclick="requestPlanRenewal(${plan.id})" class="w-full mt-5 bg-primary-600 hover:bg-primary-700 text-white py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm">
            ${plan.id === store.plan_id ? 'طلب تجديد الباقة' : 'تعديل / اختيار الباقة'}
          </button>
        </div>
        `).join('')}
      </div>
    </div>
  </div>
  `, user, store, 'subscription', `
  <script>
    async function requestPlanRenewal(planId) {
      if (!confirm('هل ترغب في إرسال طلب تجديد/تفعيل الاشتراك لمدير النظام؟')) return;
      try {
        try {
          await axios.post('/dashboard/subscription/renew', { plan_id: planId });
        } catch(e) {
          await axios.post('/api/dashboard/subscription/renew', { plan_id: planId });
        }
        showToast('تم إرسال طلب الاشتراك بنجاح. حالة الاشتراك: بانتظار التفعيل من المدير', 'success');
        setTimeout(() => location.reload(), 1200);
      } catch (err) {
        showToast(err.response?.data?.message || 'حدث خطأ في الطلب', 'error');
      }
    }
  </script>
  `));
});

dashboard.post('/subscription/renew', async (c) => {
  const user = c.get('user')!;
  const store = await getStore(c.env.DB, user.id);
  if (!store) return c.json({ message: 'المتجر غير موجود' }, 404);

  const body = await c.req.json().catch(() => ({})) as any;
  const planId = body?.plan_id || store.plan_id;
  const plan = await c.env.DB.prepare('SELECT name FROM plans WHERE id = ?').bind(planId).first() as any;

  await c.env.DB.prepare(`
    UPDATE stores 
    SET plan_id = ?, subscription_status = 'pending_activation', updated_at = datetime('now') 
    WHERE id = ?
  `).bind(planId, store.id).run();

  const { NotificationService } = await import('../services/notification');
  // Admin Notification
  await NotificationService.createNotification(c.env.DB, {
    user_type: 'admin',
    title: 'طلب تفعيل باقة 💳',
    message: `طلب المتجر (${store.name}) تفعيل/تجديد باقة ${plan?.name || ''}`,
    link: '/admin/subscriptions?filter=pending',
    type: 'subscription'
  });

  // Merchant Notification
  await NotificationService.createNotification(c.env.DB, {
    user_type: 'merchant',
    user_id: user.id,
    store_id: store.id,
    title: 'تم إرسال طلب تفعيل الباقة',
    message: `طلبك لتفعيل/تجديد باقة ${plan?.name || ''} بانتظار تفعيل مدير النظام.`,
    link: '/dashboard/subscription',
    type: 'subscription'
  });

  return c.json({ success: true, message: 'تم إرسال طلب تجديد/تفعيل الباقة إلى الإدارة' });
});

// ─── Product Form Helper ──────────────────────────────────────
function productForm(store: any, categories: any[], product: any | null): string {
  const isEdit = !!product;
  const images = product?.image_urls ? product.image_urls.split(',') : [];

  return `
  <div class="max-w-3xl">
    <a href="/dashboard/products" class="inline-flex items-center gap-2 text-sub hover:text-primary-600 transition-colors text-sm font-medium mb-5">
      <i class="fas fa-arrow-right"></i> العودة للمنتجات
    </a>

    <form id="productForm" class="space-y-5">
      <!-- Info -->
      <div class="bg-card rounded-2xl border border-std p-6 shadow-sm">
        <h3 class="font-bold text-main mb-5 flex items-center gap-2"><i class="fas fa-box text-primary-500"></i> معلومات المنتج</h3>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-sub mb-1.5">اسم المنتج *</label>
            <input type="text" id="pName" value="${product?.name || ''}" required placeholder="مثال: آيفون 15 برو"
              class="w-full px-4 py-2.5 border border-std rounded-xl text-sm bg-page text-main focus:ring-2 focus:ring-primary-300 outline-none">
          </div>
          <div>
            <label class="block text-sm font-medium text-sub mb-1.5">التصنيف</label>
            <select id="pCategory"
              class="w-full px-4 py-2.5 border border-std rounded-xl text-sm bg-page text-main focus:ring-2 focus:ring-primary-300 outline-none">
              <option value="">بدون تصنيف</option>
              ${categories.map(cat => `<option value="${cat.id}" ${product?.category_id == cat.id ? 'selected' : ''}>${cat.name}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-sub mb-1.5">الوصف القصير</label>
            <input type="text" id="pShortDesc" value="${product?.short_description || ''}" placeholder="ملخص سريع للمنتج"
              class="w-full px-4 py-2.5 border border-std rounded-xl text-sm bg-page text-main focus:ring-2 focus:ring-primary-300 outline-none">
          </div>
          <div>
            <label class="block text-sm font-medium text-sub mb-1.5">الوصف الكامل</label>
            <textarea id="pDesc" rows="4" placeholder="وصف تفصيلي شامل..."
              class="w-full px-4 py-2.5 border border-std rounded-xl text-sm bg-page text-main focus:ring-2 focus:ring-primary-300 outline-none resize-none">${product?.description || ''}</textarea>
          </div>
        </div>
      </div>

      <!-- Pricing & Inventory -->
      <div class="bg-card rounded-2xl border border-std p-6 shadow-sm">
        <h3 class="font-bold text-main mb-5 flex items-center gap-2"><i class="fas fa-tag text-green-500"></i> التسعير والمخزون</h3>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label class="block text-sm font-medium text-sub mb-1.5">عملة المنتج *</label>
            <select id="pCurrency" onchange="updateCurrencySymbols(this.value)"
              class="w-full px-4 py-2.5 border border-std rounded-xl text-sm bg-page text-main focus:ring-2 focus:ring-primary-300 outline-none font-bold">
              <option value="YER" ${(!product?.currency || product?.currency === 'YER') ? 'selected' : ''}>ريال يمني (YER / ر.ي)</option>
              <option value="SAR" ${product?.currency === 'SAR' ? 'selected' : ''}>ريال سعودي (SAR / ر.س)</option>
              <option value="USD" ${product?.currency === 'USD' ? 'selected' : ''}>دولار أمريكي (USD / $)</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-sub mb-1.5">السعر الأساسي *</label>
            <div class="relative">
              <span class="p-currency-symbol absolute inset-y-0 left-0 flex items-center pl-3 text-mute text-xs font-bold">${product?.currency === 'USD' ? '$' : product?.currency === 'SAR' ? 'ر.س' : 'ر.ي'}</span>
              <input type="number" id="pPrice" value="${product?.price || ''}" required step="0.01" min="0" placeholder="0.00"
                class="w-full pr-4 pl-12 py-2.5 border border-std rounded-xl text-sm bg-page text-main focus:ring-2 focus:ring-primary-300 outline-none font-semibold" dir="ltr">
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-sub mb-1.5">سعر الخصم</label>
            <div class="relative">
              <span class="p-currency-symbol absolute inset-y-0 left-0 flex items-center pl-3 text-mute text-xs font-bold">${product?.currency === 'USD' ? '$' : product?.currency === 'SAR' ? 'ر.س' : 'ر.ي'}</span>
              <input type="number" id="pSalePrice" value="${product?.sale_price || ''}" step="0.01" min="0" placeholder="اختياري"
                class="w-full pr-4 pl-12 py-2.5 border border-std rounded-xl text-sm bg-page text-main focus:ring-2 focus:ring-primary-300 outline-none font-semibold" dir="ltr">
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-sub mb-1.5">المخزون</label>
            <input type="number" id="pStock" value="${product?.stock ?? 0}" min="0"
              class="w-full px-4 py-2.5 border border-std rounded-xl text-sm bg-page text-main focus:ring-2 focus:ring-primary-300 outline-none" dir="ltr">
          </div>
          <div>
            <label class="block text-sm font-medium text-sub mb-1.5">رمز SKU</label>
            <input type="text" id="pSku" value="${product?.sku || ''}" placeholder="اختياري" dir="ltr"
              class="w-full px-4 py-2.5 border border-std rounded-xl text-sm bg-page text-main focus:ring-2 focus:ring-primary-300 outline-none">
          </div>
        </div>
      </div>

      <!-- Images -->
      <div class="bg-card rounded-2xl border border-std p-6 shadow-sm">
        <h3 class="font-bold text-main mb-5 flex items-center gap-2"><i class="fas fa-images text-blue-500"></i> صور المنتج</h3>
        <div id="imageContainer" class="space-y-2 mb-3">
          ${images.map((img: string, i: number) => `
          <div class="flex items-center gap-3 p-2.5 bg-gray-50 dark:bg-slate-800 border border-std rounded-xl">
            <img src="${img}" class="w-12 h-12 object-cover rounded-lg flex-shrink-0" onerror="this.src='https://via.placeholder.com/48'">
            <input type="text" value="${img}" dir="ltr" class="flex-1 px-3 py-1.5 border border-std rounded-lg text-sm bg-page text-main image-input">
            <button type="button" onclick="this.parentElement.remove()" class="text-red-400 hover:text-red-600 p-1 flex-shrink-0"><i class="fas fa-times"></i></button>
          </div>
          `).join('')}
        </div>
        <div class="flex flex-wrap gap-3 mb-4">
          <button type="button" onclick="addImageField()"
            class="flex items-center gap-2 text-sm bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-primary-600 px-4 py-2 rounded-xl transition-colors font-medium">
            <i class="fas fa-plus-circle"></i> إضافة رابط صورة
          </button>
        </div>
        
        <!-- Local Upload Box -->
        <div class="p-5 border-2 border-dashed border-std rounded-2xl text-center bg-gray-50/50 dark:bg-slate-800/40 hover:bg-gray-100/50 dark:hover:bg-slate-700/50 cursor-pointer relative transition-all duration-200 group">
          <input type="file" id="imageUploadInput" accept="image/*" multiple class="absolute inset-0 opacity-0 cursor-pointer" onchange="uploadProductImages(this)">
          <div class="space-y-2">
            <div class="w-12 h-12 rounded-full bg-primary-50 dark:bg-primary-950/50 flex items-center justify-center mx-auto text-primary-500 group-hover:scale-110 transition-transform">
              <i class="fas fa-cloud-upload-alt text-xl"></i>
            </div>
            <div>
              <p class="text-sm font-bold text-main">اختر صور المنتج أو اسحبها هنا</p>
              <p class="text-xs text-mute mt-1">الرفع محلي مباشرة على الخادم (PNG, JPG, JPEG, WebP, GIF)</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Product Variants (Sizes & Colors) -->
      <div class="bg-card rounded-2xl border border-std p-6 shadow-sm">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h3 class="font-bold text-main flex items-center gap-2"><i class="fas fa-tags text-purple-500"></i> خيارات المنتج (خيارات المقاس والألوان)</h3>
            <p class="text-xs text-mute mt-0.5 font-medium">أضف خيارات متعددة مثل المقاسات أو الألوان مع تعديل السعر والمخزون الخاص بكل منها</p>
          </div>
          <button type="button" onclick="addVariantRow()"
            class="flex items-center gap-1.5 text-xs bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-900/50 px-3 py-2 rounded-xl transition-all font-semibold">
            <i class="fas fa-plus"></i> خيار جديد
          </button>
        </div>
        <div id="variantsContainer" class="space-y-3">
          <!-- Dynamically populated -->
        </div>
      </div>

      <!-- Options -->
      <div class="bg-card rounded-2xl border border-std p-6 shadow-sm">
        <h3 class="font-bold text-main mb-4 flex items-center gap-2"><i class="fas fa-sliders-h text-purple-500"></i> خيارات</h3>
        <div class="flex flex-wrap gap-5">
          <label class="flex items-center gap-2.5 cursor-pointer">
            <input type="checkbox" id="pFeatured" ${product?.featured ? 'checked' : ''}
              class="w-4 h-4 text-primary-600 rounded border-std">
            <span class="text-sm text-main font-medium">⭐ منتج مميز</span>
          </label>
          <label class="flex items-center gap-2.5 cursor-pointer">
            <input type="checkbox" id="pActive" ${!product || product?.status === 'active' ? 'checked' : ''}
              class="w-4 h-4 text-primary-600 rounded border-std">
            <span class="text-sm text-main font-medium">✓ نشط في المتجر</span>
          </label>
        </div>
      </div>

      <div class="flex gap-3">
        <button type="submit"
          class="bg-primary-600 hover:bg-primary-700 text-white font-bold px-8 py-2.5 rounded-xl transition-colors flex items-center gap-2 shadow-lg">
          <i class="fas fa-${isEdit ? 'save' : 'plus'}"></i>
          ${isEdit ? 'تحديث المنتج' : 'إضافة المنتج'}
        </button>
        <a href="/dashboard/products"
          class="bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-sub font-semibold px-6 py-2.5 rounded-xl transition-colors">
          إلغاء
        </a>
      </div>
    </form>
  </div>

  <script>
    function updateCurrencySymbols(val) {
      const sym = val === 'USD' ? '$' : val === 'SAR' ? 'ر.س' : 'ر.ي';
      document.querySelectorAll('.p-currency-symbol').forEach(el => el.textContent = sym);
    }
    // ── Variants Logic ──
    const initialVariants = ${JSON.stringify(product?.variants || [])};
    function addVariantRow(data = { type: 'مقاس', value: '', price_modifier: 0, stock: 0, sku: '' }) {
      const container = document.getElementById('variantsContainer');
      const div = document.createElement('div');
      div.className = 'variant-row grid grid-cols-2 sm:grid-cols-5 gap-3 p-3.5 bg-gray-50/50 dark:bg-slate-800/40 border border-std rounded-xl items-end relative fade-in';
      div.innerHTML = \`
        <div>
          <label class="block text-[11px] text-mute mb-1 font-semibold">النوع</label>
          <select class="v-type w-full px-3 py-2 border border-std rounded-lg text-xs bg-page text-main focus:outline-none">
            <option value="مقاس" \${data.type === 'مقاس' ? 'selected' : ''}>مقاس (Size)</option>
            <option value="لون" \${data.type === 'لون' ? 'selected' : ''}>لون (Color)</option>
            <option value="سعة التخزين" \${data.type === 'سعة التخزين' ? 'selected' : ''}>سعة التخزين (Storage)</option>
            <option value="الذاكرة العشوائية" \${data.type === 'الذاكرة العشوائية' ? 'selected' : ''}>الذاكرة العشوائية (RAM)</option>
            <option value="آخر" \${data.type !== 'مقاس' && data.type !== 'لون' && data.type !== 'سعة التخزين' && data.type !== 'الذاكرة العشوائية' ? 'selected' : ''}>آخر (Other)</option>
          </select>
        </div>
        <div>
          <label class="block text-[11px] text-mute mb-1 font-semibold">القيمة (مثال: XL / أحمر)</label>
          <input type="text" value="\${data.value}" placeholder="القيمة" class="v-value w-full px-3 py-2 border border-std rounded-lg text-xs bg-page text-main focus:outline-none">
        </div>
        <div>
          <label class="block text-[11px] text-mute mb-1 font-semibold">فارق السعر (+/-)</label>
          <input type="number" value="\${data.price_modifier}" placeholder="0.00" step="0.01" class="v-price-modifier w-full px-3 py-2 border border-std rounded-lg text-xs bg-page text-main focus:outline-none text-center" dir="ltr">
        </div>
        <div>
          <label class="block text-[11px] text-mute mb-1 font-semibold">المخزون</label>
          <input type="number" value="\${data.stock}" placeholder="0" class="v-stock w-full px-3 py-2 border border-std rounded-lg text-xs bg-page text-main focus:outline-none text-center" dir="ltr">
        </div>
        <div class="flex items-center gap-2">
          <div class="flex-1">
            <label class="block text-[11px] text-mute mb-1 font-semibold">رمز SKU (اختياري)</label>
            <input type="text" value="\${data.sku || ''}" placeholder="SKU" class="v-sku w-full px-3 py-2 border border-std rounded-lg text-xs bg-page text-main focus:outline-none text-center" dir="ltr">
          </div>
          <button type="button" onclick="this.parentElement.parentElement.remove()" class="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors flex-shrink-0 mb-0.5">
            <i class="fas fa-trash-alt text-sm"></i>
          </button>
        </div>\`;
      container.appendChild(div);
    }
    // Load initial variants
    if (initialVariants && initialVariants.length > 0) {
      initialVariants.forEach(v => addVariantRow(v));
    }

    async function uploadProductImages(input) {
      if (!input.files || input.files.length === 0) return;
      
      const files = Array.from(input.files);
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        
        // Show temp loading state
        const tempId = 'temp-' + Date.now() + Math.random().toString(36).substr(2, 5);
        const div = document.createElement('div');
        div.id = tempId;
        div.className = 'flex items-center gap-3 p-2.5 bg-gray-50 dark:bg-slate-800 border border-std rounded-xl';
        div.innerHTML = \`
          <div class="w-12 h-12 bg-gray-100 dark:bg-slate-700 rounded-lg flex items-center justify-center text-primary-600 flex-shrink-0">
            <i class="fas fa-spinner fa-spin"></i>
          </div>
          <div class="flex-1">
            <p class="text-xs text-mute">جاري رفع: \${file.name}...</p>
            <div class="w-full bg-gray-200 dark:bg-slate-700 h-1.5 rounded-full mt-1 overflow-hidden">
              <div class="bg-primary-600 h-1.5 rounded-full animate-pulse" style="width: 70%"></div>
            </div>
          </div>
        \`;
        document.getElementById('imageContainer').appendChild(div);
        
        try {
          const res = await axios.post('/api/dashboard/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
          
          if (res.data && res.data.url) {
            // Replace loading state with uploaded item
            div.className = 'flex items-center gap-3 p-2.5 bg-gray-50 dark:bg-slate-800 border border-std rounded-xl';
            div.innerHTML = \`
              <img src="\${res.data.url}" class="w-12 h-12 object-cover rounded-lg flex-shrink-0" onerror="this.src='https://via.placeholder.com/48'">
              <input type="text" value="\${res.data.url}" dir="ltr" class="flex-1 px-3 py-1.5 border border-std rounded-lg text-sm bg-page text-main image-input">
              <button type="button" onclick="this.parentElement.remove()" class="text-red-400 hover:text-red-600 p-1 flex-shrink-0"><i class="fas fa-times"></i></button>
            \`;
            showToast('تم رفع ' + file.name + ' بنجاح', 'success');
          } else {
            div.remove();
            showToast('خطأ أثناء رفع الملف', 'error');
          }
        } catch (err) {
          div.remove();
          showToast(err.response?.data?.message || 'خطأ أثناء رفع الملف', 'error');
        }
      }
      input.value = ''; // Reset input
    }

    function addImageField() {
      const div = document.createElement('div');
      div.className = 'flex items-center gap-3 p-2.5 bg-gray-50 dark:bg-slate-800 border border-std rounded-xl';
      div.innerHTML = \`
        <div class="w-12 h-12 bg-gray-100 dark:bg-slate-700 rounded-lg flex items-center justify-center text-mute flex-shrink-0">
          <i class="fas fa-image"></i>
        </div>
        <input type="text" dir="ltr" placeholder="https://example.com/image.jpg"
          class="flex-1 px-3 py-1.5 border border-std rounded-lg text-sm bg-page text-main image-input">
        <button type="button" onclick="this.parentElement.remove()" class="text-red-400 hover:text-red-600 p-1 flex-shrink-0">
          <i class="fas fa-times"></i>
        </button>
      \`;
      document.getElementById('imageContainer').appendChild(div);
    }

    document.getElementById('productForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const images = Array.from(document.querySelectorAll('.image-input'))
        .map(i => i.value.trim()).filter(Boolean);
      const data = {
        name: document.getElementById('pName').value,
        category_id: document.getElementById('pCategory').value || null,
        description: document.getElementById('pDesc').value,
        short_description: document.getElementById('pShortDesc').value,
        price: parseFloat(document.getElementById('pPrice').value),
        sale_price: document.getElementById('pSalePrice').value ? parseFloat(document.getElementById('pSalePrice').value) : null,
        currency: document.getElementById('pCurrency').value || 'YER',
        stock: parseInt(document.getElementById('pStock').value) || 0,
        sku: document.getElementById('pSku').value || null,
        featured: document.getElementById('pFeatured').checked ? 1 : 0,
        status: document.getElementById('pActive').checked ? 'active' : 'inactive',
        images
      };
      try {
        let productId = null;
        if (${isEdit}) {
          productId = ${product?.id || 0};
          await axios.put('/api/dashboard/products/' + productId, data);
        } else {
          const res = await axios.post('/api/dashboard/products', data);
          productId = res.data.id;
        }

        // Collect and save variants
        const variantRows = Array.from(document.querySelectorAll('.variant-row'));
        const variants = variantRows.map(row => ({
          type: row.querySelector('.v-type').value,
          value: row.querySelector('.v-value').value.trim(),
          price_modifier: parseFloat(row.querySelector('.v-price-modifier').value) || 0,
          stock: parseInt(row.querySelector('.v-stock').value) || 0,
          sku: row.querySelector('.v-sku').value.trim() || null
        })).filter(v => v.value);

        if (variants && variants.length > 0 && productId && productId !== 'undefined') {
          await axios.post('/api/dashboard/products/' + productId + '/variants', { variants });
        }

        showToast('تم حفظ المنتج والخيارات بنجاح', 'success');
        setTimeout(() => window.location.href = '/dashboard/products', 1000);
      } catch(err) { showToast(err.response?.data?.message || 'خطأ في الحفظ', 'error'); }
    });
  </script>
  `;
}
// ─── Advanced Analytics Page ──────────────────────────────────
dashboard.get('/analytics', async (c) => {
  const user = c.get('user')!;
  const store = await getStore(c.env.DB, user.id);
  if (!store) return c.redirect('/auth/register');

  const period = c.req.query('period') || '30'; // days

  // ── KPIs ────────────────────────────────────────────────────
  const [
    revenueTotal, revenuePeriod, revenuePrev,
    ordersTotal, ordersPeriod, ordersPrev,
    avgOrder, cancelledCount, viewsTotal
  ] = await Promise.all([
    c.env.DB.prepare("SELECT COALESCE(SUM(total), 0) as v FROM orders WHERE store_id = ? AND payment_status = 'paid'").bind(store.id).first() as Promise<any>,
    c.env.DB.prepare(`SELECT COALESCE(SUM(total), 0) as v FROM orders WHERE store_id = ? AND created_at >= datetime('now', '-${period} days')`).bind(store.id).first() as Promise<any>,
    c.env.DB.prepare(`SELECT COALESCE(SUM(total), 0) as v FROM orders WHERE store_id = ? AND created_at < datetime('now', '-${period} days') AND created_at >= datetime('now', '-${parseInt(period)*2} days')`).bind(store.id).first() as Promise<any>,
    c.env.DB.prepare("SELECT COUNT(*) as v FROM orders WHERE store_id = ?").bind(store.id).first() as Promise<any>,
    c.env.DB.prepare(`SELECT COUNT(*) as v FROM orders WHERE store_id = ? AND created_at >= datetime('now', '-${period} days')`).bind(store.id).first() as Promise<any>,
    c.env.DB.prepare(`SELECT COUNT(*) as v FROM orders WHERE store_id = ? AND created_at < datetime('now', '-${period} days') AND created_at >= datetime('now', '-${parseInt(period)*2} days')`).bind(store.id).first() as Promise<any>,
    c.env.DB.prepare("SELECT COALESCE(AVG(total), 0) as v FROM orders WHERE store_id = ?").bind(store.id).first() as Promise<any>,
    c.env.DB.prepare("SELECT COUNT(*) as v FROM orders WHERE store_id = ? AND status = 'cancelled'").bind(store.id).first() as Promise<any>,
    c.env.DB.prepare("SELECT COALESCE(SUM(views), 0) as v FROM products WHERE store_id = ?").bind(store.id).first() as Promise<any>,
  ]);

  const revGrowth = revenuePrev?.v > 0
    ? (((revenuePeriod?.v - revenuePrev?.v) / revenuePrev?.v) * 100).toFixed(1)
    : revenuePeriod?.v > 0 ? '100' : '0';
  const ordGrowth = ordersPrev?.v > 0
    ? (((ordersPeriod?.v - ordersPrev?.v) / ordersPrev?.v) * 100).toFixed(1)
    : ordersPeriod?.v > 0 ? '100' : '0';
  const convRate = viewsTotal?.v > 0 ? ((ordersTotal?.v / viewsTotal?.v) * 100).toFixed(2) : '0';

  // ── Chart Data ───────────────────────────────────────────────
  const [dailyData, monthlyData, statusData, topProductsData, topCitiesData, couponData] = await Promise.all([
    // Daily sales (last 30 days)
    c.env.DB.prepare(`
      SELECT strftime('%m/%d', created_at) as day,
             COUNT(*) as orders,
             COALESCE(SUM(total), 0) as revenue
      FROM orders WHERE store_id = ? AND created_at >= datetime('now', '-30 days')
      GROUP BY day ORDER BY created_at ASC
    `).bind(store.id).all(),
    // Monthly (last 12)
    c.env.DB.prepare(`
      SELECT strftime('%Y-%m', created_at) as month,
             COUNT(*) as orders,
             COALESCE(SUM(total), 0) as revenue
      FROM orders WHERE store_id = ?
      GROUP BY month ORDER BY month DESC LIMIT 12
    `).bind(store.id).all(),
    // Status distribution
    c.env.DB.prepare(`
      SELECT status, COUNT(*) as count FROM orders WHERE store_id = ? GROUP BY status
    `).bind(store.id).all(),
    // Top 10 products
    c.env.DB.prepare(`
      SELECT p.name, p.total_sold, p.price,
             COALESCE(SUM(oi.total), 0) as revenue
      FROM products p
      LEFT JOIN order_items oi ON oi.product_id = p.id AND oi.store_id = p.store_id
      WHERE p.store_id = ? AND p.total_sold > 0
      GROUP BY p.id ORDER BY p.total_sold DESC LIMIT 10
    `).bind(store.id).all(),
    // Top cities
    c.env.DB.prepare(`
      SELECT shipping_city as city, COUNT(*) as orders, COALESCE(SUM(total), 0) as revenue
      FROM orders WHERE store_id = ? AND shipping_city IS NOT NULL AND shipping_city != ''
      GROUP BY shipping_city ORDER BY orders DESC LIMIT 10
    `).bind(store.id).all(),
    // Coupon report
    c.env.DB.prepare(`
      SELECT c.code, c.type, c.value, c.used_count, c.max_uses,
             COALESCE(SUM(o.discount_amount), 0) as total_saved
      FROM coupons c
      LEFT JOIN orders o ON o.store_id = c.store_id AND o.discount_amount > 0
      WHERE c.store_id = ?
      GROUP BY c.id ORDER BY c.used_count DESC
    `).bind(store.id).all(),
  ]);

  const daily = (dailyData.results as any[]);
  const monthly = (monthlyData.results as any[]).reverse();
  const statuses = (statusData.results as any[]);

  const dailyLabels = JSON.stringify(daily.map(d => d.day));
  const dailyRevenue = JSON.stringify(daily.map(d => d.revenue));
  const dailyOrders = JSON.stringify(daily.map(d => d.orders));
  const monthlyLabels = JSON.stringify(monthly.map(d => d.month));
  const monthlyRevenue = JSON.stringify(monthly.map(d => d.revenue));
  const monthlyOrders = JSON.stringify(monthly.map(d => d.orders));

  const statusMap: any = { pending: 'قيد الانتظار', processing: 'قيد المعالجة', completed: 'مكتمل', cancelled: 'ملغي' };
  const statusColors = ['#F59E0B', '#3B82F6', '#10B981', '#EF4444'];
  const statusLabels = JSON.stringify(statuses.map(s => statusMap[s.status] || s.status));
  const statusValues = JSON.stringify(statuses.map(s => s.count));

  const topProducts = (topProductsData.results as any[]);
  const tpLabels = JSON.stringify(topProducts.map(p => p.name.slice(0, 20)));
  const tpSold = JSON.stringify(topProducts.map(p => p.total_sold));
  const tpRevenue = JSON.stringify(topProducts.map(p => p.revenue));

  const primary = store.primary_color || '#4F46E5';

  const growthBadge = (val: string) => {
    const num = parseFloat(val);
    if (num > 0) return `<span class="text-xs bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full"><i class="fas fa-arrow-up ml-0.5 text-[10px]"></i>${val}%</span>`;
    if (num < 0) return `<span class="text-xs bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded-full"><i class="fas fa-arrow-down ml-0.5 text-[10px]"></i>${Math.abs(num)}%</span>`;
    return `<span class="text-xs bg-gray-100 text-gray-500 font-bold px-2 py-0.5 rounded-full">0%</span>`;
  };

  return c.html(dashboardLayout('التقارير والتحليلات', `
  <!-- Header -->
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
    <div>
      <h2 class="text-xl font-black text-main">التقارير والتحليلات المتقدمة</h2>
      <p class="text-sub text-sm mt-1">تحليل شامل لأداء متجرك</p>
    </div>
    <!-- Period Filter -->
    <div class="flex gap-2 flex-wrap">
      ${['7','30','90','365'].map(p => `
        <a href="/dashboard/analytics?period=${p}"
          class="px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${period === p ? 'text-white border-transparent shadow-lg' : 'border-std bg-card text-sub hover:bg-gray-50 dark:hover:bg-slate-700'}"
          style="${period === p ? `background: ${primary}` : ''}">
          ${p === '7' ? 'أسبوع' : p === '30' ? 'شهر' : p === '90' ? '3 أشهر' : 'سنة'}
        </a>
      `).join('')}
    </div>
  </div>

  <!-- KPI Cards -->
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
    <div class="bg-card rounded-2xl border border-std p-5 shadow-sm relative overflow-hidden">
      <div class="absolute inset-0 opacity-5" style="background: linear-gradient(135deg, ${primary}, transparent)"></div>
      <div class="relative">
        <div class="flex items-center justify-between mb-2">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm" style="background: ${primary}">
            <i class="fas fa-chart-line"></i>
          </div>
          ${growthBadge(revGrowth)}
        </div>
        <p class="text-2xl font-black text-main mt-3">${formatCurrency(revenuePeriod?.v || 0, store.currency)}</p>
        <p class="text-sub text-xs mt-1">الإيرادات (الفترة المختارة)</p>
        <p class="text-mute text-xs mt-0.5">الإجمالي: ${formatCurrency(revenueTotal?.v || 0, store.currency)}</p>
      </div>
    </div>
    <div class="bg-card rounded-2xl border border-std p-5 shadow-sm relative overflow-hidden">
      <div class="absolute inset-0 opacity-5 bg-gradient-to-br from-blue-400 to-transparent"></div>
      <div class="relative">
        <div class="flex items-center justify-between mb-2">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm bg-blue-500">
            <i class="fas fa-shopping-bag"></i>
          </div>
          ${growthBadge(ordGrowth)}
        </div>
        <p class="text-2xl font-black text-main mt-3">${ordersPeriod?.v || 0}</p>
        <p class="text-sub text-xs mt-1">الطلبات (الفترة المختارة)</p>
        <p class="text-mute text-xs mt-0.5">الإجمالي: ${ordersTotal?.v || 0} طلب</p>
      </div>
    </div>
    <div class="bg-card rounded-2xl border border-std p-5 shadow-sm relative overflow-hidden">
      <div class="absolute inset-0 opacity-5 bg-gradient-to-br from-purple-400 to-transparent"></div>
      <div class="relative">
        <div class="flex items-center justify-between mb-2">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm bg-purple-500">
            <i class="fas fa-receipt"></i>
          </div>
        </div>
        <p class="text-2xl font-black text-main mt-3">${formatCurrency(avgOrder?.v || 0, store.currency)}</p>
        <p class="text-sub text-xs mt-1">متوسط قيمة الطلب</p>
        <p class="text-mute text-xs mt-0.5">Average Order Value</p>
      </div>
    </div>
    <div class="bg-card rounded-2xl border border-std p-5 shadow-sm relative overflow-hidden">
      <div class="absolute inset-0 opacity-5 bg-gradient-to-br from-green-400 to-transparent"></div>
      <div class="relative">
        <div class="flex items-center justify-between mb-2">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm bg-emerald-500">
            <i class="fas fa-mouse-pointer"></i>
          </div>
        </div>
        <p class="text-2xl font-black text-main mt-3">${convRate}%</p>
        <p class="text-sub text-xs mt-1">معدل التحويل</p>
        <p class="text-mute text-xs mt-0.5">${viewsTotal?.v || 0} مشاهدة → ${ordersTotal?.v || 0} طلب</p>
      </div>
    </div>
  </div>

  <!-- Charts Row 1 -->
  <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
    <!-- Daily Sales Bar Chart -->
    <div class="lg:col-span-2 bg-card rounded-2xl border border-std p-5 shadow-sm">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-bold text-main">المبيعات اليومية (آخر 30 يوم)</h3>
        <span class="text-xs text-mute bg-gray-100 dark:bg-slate-700 px-3 py-1 rounded-full">Bar Chart</span>
      </div>
      <canvas id="dailyChart" height="100"></canvas>
    </div>
    <!-- Status Doughnut -->
    <div class="bg-card rounded-2xl border border-std p-5 shadow-sm flex flex-col">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-bold text-main">توزيع الطلبات</h3>
      </div>
      <div class="flex-1 flex items-center justify-center">
        <div style="max-height: 200px; max-width: 200px; width:100%">
          <canvas id="statusChart"></canvas>
        </div>
      </div>
      <div class="mt-4 space-y-1.5">
        ${statuses.map((s, i) => `
          <div class="flex items-center justify-between text-xs">
            <div class="flex items-center gap-2">
              <div class="w-2.5 h-2.5 rounded-full" style="background: ${statusColors[i % 4]}"></div>
              <span class="text-sub">${statusMap[s.status] || s.status}</span>
            </div>
            <span class="font-bold text-main">${s.count}</span>
          </div>
        `).join('')}
      </div>
    </div>
  </div>

  <!-- Charts Row 2 -->
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
    <!-- Monthly Revenue -->
    <div class="bg-card rounded-2xl border border-std p-5 shadow-sm">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-bold text-main">الإيرادات الشهرية (آخر 12 شهر)</h3>
      </div>
      <canvas id="monthlyChart" height="120"></canvas>
    </div>
    <!-- Top Products Horizontal Bar -->
    <div class="bg-card rounded-2xl border border-std p-5 shadow-sm">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-bold text-main">أفضل المنتجات مبيعاً</h3>
      </div>
      <canvas id="topProductsChart" height="120"></canvas>
    </div>
  </div>

  <!-- Tables Row -->
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
    <!-- Top Cities -->
    <div class="bg-card rounded-2xl border border-std p-5 shadow-sm">
      <h3 class="font-bold text-main mb-4">أفضل المدن حسب الطلبات</h3>
      <div class="space-y-3">
        ${(topCitiesData.results as any[]).length === 0 
          ? '<p class="text-mute text-sm text-center py-6">لا توجد بيانات بعد</p>'
          : (topCitiesData.results as any[]).map((city, i) => `
          <div class="flex items-center gap-3">
            <span class="w-6 h-6 rounded-full bg-gray-100 dark:bg-slate-700 text-xs font-bold text-center leading-6 flex-shrink-0 text-sub">${i + 1}</span>
            <div class="flex-1">
              <div class="flex justify-between text-sm mb-1">
                <span class="font-medium text-main">${city.city || 'غير محدد'}</span>
                <span class="text-sub">${city.orders} طلب</span>
              </div>
              <div class="h-1.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div class="h-full rounded-full" style="width: ${Math.min(100, (city.orders / ((topCitiesData.results as any[])[0]?.orders || 1)) * 100)}%; background: ${primary}"></div>
              </div>
            </div>
            <span class="text-xs font-bold text-sub">${formatCurrency(city.revenue, store.currency)}</span>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Coupon Report -->
    <div class="bg-card rounded-2xl border border-std p-5 shadow-sm">
      <h3 class="font-bold text-main mb-4">تقرير الكوبونات</h3>
      ${(couponData.results as any[]).length === 0 
        ? '<p class="text-mute text-sm text-center py-6">لا توجد كوبونات بعد</p>'
        : `<div class="space-y-2.5">
          ${(couponData.results as any[]).map(cp => `
          <div class="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-slate-800/50">
            <div>
              <p class="font-bold text-main text-sm font-mono">${cp.code}</p>
              <p class="text-xs text-mute">${cp.type === 'percentage' ? cp.value + '%' : formatCurrency(cp.value, store.currency)} خصم</p>
            </div>
            <div class="text-center">
              <p class="text-sm font-bold text-main">${cp.used_count}${cp.max_uses ? '/' + cp.max_uses : ''}</p>
              <p class="text-xs text-mute">استخدام</p>
            </div>
            <div class="text-left">
              <p class="text-sm font-bold text-green-600">${formatCurrency(cp.total_saved || 0, store.currency)}</p>
              <p class="text-xs text-mute">إجمالي الخصم</p>
            </div>
          </div>
          `).join('')}
        </div>`
      }
    </div>
  </div>

  <!-- Products Performance Table -->
  <div class="bg-card rounded-2xl border border-std p-5 shadow-sm">
    <h3 class="font-bold text-main mb-4">أداء المنتجات التفصيلي</h3>
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-std text-mute text-xs">
            <th class="text-right pb-3 font-semibold">#</th>
            <th class="text-right pb-3 font-semibold">المنتج</th>
            <th class="text-center pb-3 font-semibold">المبيعات</th>
            <th class="text-center pb-3 font-semibold">الإيراد</th>
            <th class="text-center pb-3 font-semibold">الأداء</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-50 dark:divide-slate-800">
          ${topProducts.length === 0 
            ? '<tr><td colspan="5" class="text-center text-mute py-8 text-sm">لا توجد مبيعات بعد</td></tr>'
            : topProducts.map((p, i) => `
            <tr class="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
              <td class="py-3 pr-2 text-mute font-bold">${i + 1}</td>
              <td class="py-3">
                <p class="font-medium text-main">${p.name}</p>
                <p class="text-xs text-mute">${formatCurrency(p.price, store.currency)}</p>
              </td>
              <td class="py-3 text-center font-bold text-main">${p.total_sold}</td>
              <td class="py-3 text-center font-bold" style="color: ${primary}">${formatCurrency(p.revenue, store.currency)}</td>
              <td class="py-3 text-center">
                <div class="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-1.5 max-w-24 mx-auto">
                  <div class="h-1.5 rounded-full" style="width: ${Math.min(100, (p.total_sold / (topProducts[0]?.total_sold || 1)) * 100)}%; background: ${primary}"></div>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  </div>
  `, user, store, 'analytics', `
  <script>
    // Daily Bar Chart
    new Chart(document.getElementById('dailyChart'), {
      type: 'bar',
      data: {
        labels: ${dailyLabels},
        datasets: [
          {
            label: 'الإيرادات',
            data: ${dailyRevenue},
            backgroundColor: '${primary}33',
            borderColor: '${primary}',
            borderWidth: 2,
            borderRadius: 6,
          },
          {
            label: 'الطلبات',
            data: ${dailyOrders},
            backgroundColor: '#10B98133',
            borderColor: '#10B981',
            borderWidth: 2,
            borderRadius: 6,
            yAxisID: 'y1',
          }
        ]
      },
      options: {
        responsive: true,
        interaction: { mode: 'index' },
        plugins: { legend: { labels: { color: document.documentElement.className.includes('dark') ? '#94a3b8' : '#64748b' } } },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#94a3b8', maxTicksLimit: 10 } },
          y: { beginAtZero: true, ticks: { color: '#64748b' } },
          y1: { position: 'left', grid: { display: false }, ticks: { color: '#10B981' }, beginAtZero: true }
        }
      }
    });

    // Status Doughnut
    new Chart(document.getElementById('statusChart'), {
      type: 'doughnut',
      data: {
        labels: ${statusLabels},
        datasets: [{
          data: ${statusValues},
          backgroundColor: ${JSON.stringify(statusColors)},
          borderWidth: 0,
          hoverOffset: 6,
        }]
      },
      options: {
        responsive: true,
        cutout: '65%',
        plugins: { legend: { display: false } }
      }
    });

    // Monthly Line Chart
    new Chart(document.getElementById('monthlyChart'), {
      type: 'line',
      data: {
        labels: ${monthlyLabels},
        datasets: [{
          label: 'الإيرادات الشهرية',
          data: ${monthlyRevenue},
          borderColor: '${primary}',
          backgroundColor: '${primary}15',
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '${primary}',
          pointRadius: 4,
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#94a3b8' } },
          y: { beginAtZero: true, ticks: { color: '#64748b' } }
        }
      }
    });

    // Top Products Horizontal Bar
    new Chart(document.getElementById('topProductsChart'), {
      type: 'bar',
      data: {
        labels: ${tpLabels},
        datasets: [{
          label: 'عدد المبيعات',
          data: ${tpSold},
          backgroundColor: '${primary}',
          borderRadius: 4,
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#94a3b8' } },
          y: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 11 } } }
        }
      }
    });
  </script>
  `));
});

// ─── Flash Sales Management Page ──────────────────────────────
dashboard.get('/flash-sales', async (c) => {
  const user = c.get('user')!;
  const store = await getStore(c.env.DB, user.id);
  if (!store) return c.redirect('/auth/register');

  const flashSales = await c.env.DB.prepare(`
    SELECT fs.*, p.name as product_name, p.price as original_price,
           pi.url as product_image
    FROM flash_sales fs
    JOIN products p ON p.id = fs.product_id
    LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = 1
    WHERE fs.store_id = ?
    ORDER BY fs.created_at DESC
  `).bind(store.id).all();

  const products = await c.env.DB.prepare(
    "SELECT id, name, price FROM products WHERE store_id = ? AND status = 'active' ORDER BY name"
  ).bind(store.id).all();

  const sales = flashSales.results as any[];
  const now = new Date();

  const statusBadge = (sale: any) => {
    const start = new Date(sale.start_at);
    const end = new Date(sale.end_at);
    if (!sale.is_active) return `<span class="text-xs bg-gray-100 dark:bg-slate-700 text-gray-500 font-bold px-3 py-1 rounded-full">معطّل</span>`;
    if (now < start) return `<span class="text-xs bg-blue-100 text-blue-700 font-bold px-3 py-1 rounded-full"><i class="fas fa-clock ml-1"></i>قادم</span>`;
    if (now > end) return `<span class="text-xs bg-gray-100 text-gray-500 font-bold px-3 py-1 rounded-full">منتهي</span>`;
    return `<span class="text-xs bg-green-100 text-green-700 font-bold px-3 py-1 rounded-full pulse-dot">نشط الآن</span>`;
  };

  const primary = store.primary_color || '#4F46E5';

  return c.html(dashboardLayout('العروض السريعة', `
  <!-- Header -->
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
    <div>
      <h2 class="text-xl font-black text-main flex items-center gap-2">
        <span class="text-2xl">⚡</span> العروض السريعة (Flash Sales)
      </h2>
      <p class="text-sub text-sm mt-1">أنشئ عروضاً محدودة الوقت مع عداد عكسي على صفحة المنتج</p>
    </div>
    <button onclick="openCreateModal()"
      class="flex items-center gap-2 text-white font-semibold px-5 py-2.5 rounded-xl transition-all hover:opacity-90 shadow-lg"
      style="background: ${primary}">
      <i class="fas fa-plus"></i> عرض جديد
    </button>
  </div>

  <!-- Stats Row -->
  <div class="grid grid-cols-3 gap-4 mb-6">
    <div class="bg-card rounded-2xl border border-std p-4 text-center shadow-sm">
      <p class="text-2xl font-black text-green-600">${sales.filter(s => s.is_active && new Date(s.start_at) <= now && new Date(s.end_at) >= now).length}</p>
      <p class="text-xs text-sub mt-1">نشط الآن</p>
    </div>
    <div class="bg-card rounded-2xl border border-std p-4 text-center shadow-sm">
      <p class="text-2xl font-black" style="color:${primary}">${sales.filter(s => s.is_active && new Date(s.start_at) > now).length}</p>
      <p class="text-xs text-sub mt-1">قادم</p>
    </div>
    <div class="bg-card rounded-2xl border border-std p-4 text-center shadow-sm">
      <p class="text-2xl font-black text-gray-400">${sales.filter(s => new Date(s.end_at) < now).length}</p>
      <p class="text-xs text-sub mt-1">منتهي</p>
    </div>
  </div>

  <!-- Flash Sales Table -->
  <div class="bg-card rounded-2xl border border-std shadow-sm overflow-hidden">
    ${sales.length === 0 ? `
    <div class="text-center py-16">
      <div class="text-6xl mb-4">⚡</div>
      <h3 class="font-bold text-main text-lg mb-2">لا توجد عروض بعد</h3>
      <p class="text-mute text-sm mb-6">أنشئ أول عرض سريع لمنتجاتك وشاهد المبيعات ترتفع!</p>
      <button onclick="openCreateModal()"
        class="text-white font-semibold px-6 py-3 rounded-xl transition-all hover:opacity-90"
        style="background: ${primary}">
        <i class="fas fa-bolt ml-2"></i> إنشاء عرض الآن
      </button>
    </div>
    ` : `
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="border-b border-std bg-gray-50 dark:bg-slate-800/50">
          <tr class="text-mute text-xs font-semibold">
            <th class="text-right p-4">المنتج</th>
            <th class="text-center p-4">الخصم</th>
            <th class="text-center p-4">الفترة</th>
            <th class="text-center p-4">الكمية</th>
            <th class="text-center p-4">الحالة</th>
            <th class="text-center p-4">إجراءات</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-50 dark:divide-slate-800">
          ${sales.map(sale => {
            const discountLabel = sale.discount_type === 'percentage'
              ? `${sale.discount_value}% خصم`
              : `${formatCurrency(sale.discount_value, store.currency)} خصم`;
            const effectivePrice = sale.discount_type === 'percentage'
              ? sale.original_price * (1 - sale.discount_value / 100)
              : Math.max(0, sale.original_price - sale.discount_value);
            return `
            <tr class="hover:bg-gray-50 dark:hover:bg-slate-800/40 transition-colors">
              <td class="p-4">
                <div class="flex items-center gap-3">
                  <img src="${sale.product_image || 'https://via.placeholder.com/48'}" class="w-12 h-12 rounded-xl object-cover flex-shrink-0">
                  <div>
                    <p class="font-semibold text-main">${sale.product_name}</p>
                    <p class="text-xs text-mute">${sale.title}</p>
                  </div>
                </div>
              </td>
              <td class="p-4 text-center">
                <span class="font-bold text-red-500">${discountLabel}</span>
                <br>
                <span class="text-xs text-mute">${formatCurrency(sale.original_price, store.currency)} → <span class="text-green-600 font-semibold">${formatCurrency(effectivePrice, store.currency)}</span></span>
              </td>
              <td class="p-4 text-center text-xs">
                <p class="text-main">${new Date(sale.start_at).toLocaleDateString('ar')}</p>
                <i class="fas fa-arrow-down text-mute text-[10px] my-0.5"></i>
                <p class="text-main">${new Date(sale.end_at).toLocaleDateString('ar')}</p>
              </td>
              <td class="p-4 text-center text-xs">
                <p class="font-bold text-main">${sale.sold_quantity}${sale.max_quantity ? '/' + sale.max_quantity : ''}</p>
                <p class="text-mute">مباع</p>
              </td>
              <td class="p-4 text-center">${statusBadge(sale)}</td>
              <td class="p-4 text-center">
                <div class="flex items-center justify-center gap-2">
                  <button onclick="toggleSale(${sale.id}, ${sale.is_active})"
                    class="p-2 rounded-xl transition-all ${sale.is_active ? 'bg-yellow-100 text-yellow-600 hover:bg-yellow-200' : 'bg-green-100 text-green-600 hover:bg-green-200'}"
                    title="${sale.is_active ? 'تعطيل' : 'تفعيل'}">
                    <i class="fas fa-${sale.is_active ? 'pause' : 'play'} text-sm"></i>
                  </button>
                  <button onclick="deleteSale(${sale.id})"
                    class="p-2 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 transition-all" title="حذف">
                    <i class="fas fa-trash text-sm"></i>
                  </button>
                </div>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
    `}
  </div>

  <!-- Create Modal -->
  <div id="createModal" class="fixed inset-0 bg-black/60 hidden items-center justify-center z-50 p-4">
    <div class="bg-card rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
      <div class="p-5 border-b border-std flex items-center justify-between">
        <h3 class="font-bold text-main text-lg">⚡ إنشاء عرض سريع جديد</h3>
        <button onclick="closeModal()" class="text-mute hover:text-main"><i class="fas fa-times text-xl"></i></button>
      </div>
      <div class="p-6 space-y-4">
        <div>
          <label class="block text-sm font-medium text-sub mb-1.5">عنوان العرض *</label>
          <input type="text" id="fsTitle" placeholder="مثال: عرض العيد الوطني 🎉" class="w-full px-4 py-2.5 border border-std rounded-xl bg-card text-main focus:ring-2 focus:outline-none">
        </div>
        <div>
          <label class="block text-sm font-medium text-sub mb-1.5">المنتج *</label>
          <select id="fsProduct" class="w-full px-4 py-2.5 border border-std rounded-xl bg-card text-main focus:ring-2 focus:outline-none">
            <option value="">-- اختر منتج --</option>
            ${(products.results as any[]).map(p => `<option value="${p.id}" data-price="${p.price}">${p.name} (${formatCurrency(p.price, store.currency)})</option>`).join('')}
          </select>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-sub mb-1.5">نوع الخصم *</label>
            <select id="fsDiscountType" onchange="updatePreview()" class="w-full px-4 py-2.5 border border-std rounded-xl bg-card text-main focus:ring-2 focus:outline-none">
              <option value="percentage">نسبة مئوية (%)</option>
              <option value="fixed">مبلغ ثابت (${store.currency})</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-sub mb-1.5">قيمة الخصم *</label>
            <input type="number" id="fsDiscountValue" placeholder="مثال: 20" min="1" oninput="updatePreview()"
              class="w-full px-4 py-2.5 border border-std rounded-xl bg-card text-main focus:ring-2 focus:outline-none">
          </div>
        </div>
        <div id="pricePreview" class="hidden text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-xl text-sm text-green-700 font-semibold"></div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-sub mb-1.5">يبدأ في *</label>
            <input type="datetime-local" id="fsStartAt" class="w-full px-4 py-2.5 border border-std rounded-xl bg-card text-main focus:ring-2 focus:outline-none">
          </div>
          <div>
            <label class="block text-sm font-medium text-sub mb-1.5">ينتهي في *</label>
            <input type="datetime-local" id="fsEndAt" class="w-full px-4 py-2.5 border border-std rounded-xl bg-card text-main focus:ring-2 focus:outline-none">
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium text-sub mb-1.5">الحد الأقصى للكمية (اختياري)</label>
          <input type="number" id="fsMaxQty" placeholder="اتركه فارغاً لعدم التحديد" min="1"
            class="w-full px-4 py-2.5 border border-std rounded-xl bg-card text-main focus:ring-2 focus:outline-none">
        </div>

        <div class="flex gap-3 pt-2">
          <button onclick="closeModal()" class="flex-1 py-3 border border-std rounded-xl text-sub hover:bg-gray-50 dark:hover:bg-slate-700 transition-all font-medium">إلغاء</button>
          <button onclick="createSale()"
            class="flex-1 py-3 text-white font-semibold rounded-xl transition-all hover:opacity-90 shadow-lg"
            style="background: ${primary}">
            <i class="fas fa-bolt ml-1"></i> إنشاء العرض
          </button>
        </div>
      </div>
    </div>
  </div>
  `, user, store, 'flash-sales', `
  <script>
    function openCreateModal() {
      // Set default start to now, end to +2 hours
      const now = new Date();
      const end = new Date(now.getTime() + 2 * 60 * 60 * 1000);
      document.getElementById('fsStartAt').value = now.toISOString().slice(0, 16);
      document.getElementById('fsEndAt').value = end.toISOString().slice(0, 16);
      document.getElementById('createModal').classList.replace('hidden', 'flex');
    }
    function closeModal() {
      document.getElementById('createModal').classList.replace('flex', 'hidden');
    }
    function updatePreview() {
      const sel = document.getElementById('fsProduct');
      const price = parseFloat(sel.selectedOptions[0]?.dataset.price || '0');
      const type = document.getElementById('fsDiscountType').value;
      const val = parseFloat(document.getElementById('fsDiscountValue').value || '0');
      const preview = document.getElementById('pricePreview');
      if (!price || !val) { preview.classList.add('hidden'); return; }
      const newPrice = type === 'percentage' ? price * (1 - val/100) : Math.max(0, price - val);
      preview.classList.remove('hidden');
      preview.textContent = 'السعر الجديد: ' + newPrice.toLocaleString('ar-SA') + ' ${store.currency}';
    }
    document.getElementById('fsProduct')?.addEventListener('change', updatePreview);

    async function createSale() {
      const title = document.getElementById('fsTitle').value.trim();
      const product_id = parseInt(document.getElementById('fsProduct').value);
      const discount_type = document.getElementById('fsDiscountType').value;
      const discount_value = parseFloat(document.getElementById('fsDiscountValue').value);
      const start_at = document.getElementById('fsStartAt').value;
      const end_at = document.getElementById('fsEndAt').value;
      const max_qty = document.getElementById('fsMaxQty').value;

      if (!title || !product_id || !discount_value || !start_at || !end_at) {
        return showToast('يرجى تعبئة جميع الحقول المطلوبة', 'error');
      }
      if (new Date(end_at) <= new Date(start_at)) {
        return showToast('تاريخ الانتهاء يجب أن يكون بعد تاريخ البدء', 'error');
      }

      try {
        const res = await axios.post('/api/dashboard/flash-sales', {
          title, product_id, discount_type, discount_value,
          start_at: new Date(start_at).toISOString(),
          end_at: new Date(end_at).toISOString(),
          max_quantity: max_qty ? parseInt(max_qty) : null
        });
        showToast('تم إنشاء العرض بنجاح ⚡', 'success');
        setTimeout(() => location.reload(), 1000);
      } catch(err) {
        showToast(err.response?.data?.message || 'خطأ في إنشاء العرض', 'error');
      }
    }

    async function toggleSale(id, currentActive) {
      try {
        await axios.put('/api/dashboard/flash-sales/' + id, { is_active: currentActive ? 0 : 1 });
        showToast(currentActive ? 'تم تعطيل العرض' : 'تم تفعيل العرض', 'success');
        setTimeout(() => location.reload(), 800);
      } catch(err) {
        showToast('خطأ', 'error');
      }
    }

    async function deleteSale(id) {
      if (!confirm('هل تريد حذف هذا العرض؟')) return;
      try {
        await axios.delete('/api/dashboard/flash-sales/' + id);
        showToast('تم حذف العرض', 'success');
        setTimeout(() => location.reload(), 800);
      } catch(err) {
        showToast('خطأ', 'error');
      }
    }
  </script>
  `));
});

export default dashboard;
