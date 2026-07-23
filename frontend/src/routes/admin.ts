// ============================================
// Platform Super Admin Routes — Premium v2
// ============================================
import { Hono } from 'hono';
import { Bindings, Variables } from '../types/index';
import { dashboardLayout } from '../utils/templates';
import { formatCurrency } from '../utils/helpers';

const admin = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ─── Admin Overview ───────────────────────────────────────────
admin.get('/', async (c) => {
  const user = c.get('user')!;

  const [storesTotal, storesActive, usersTotal, ordersTotal, revenueData, customersTotal, todayOrders, todayRevenue] = await Promise.all([
    c.env.DB.prepare('SELECT COUNT(*) as count FROM stores').first() as Promise<any>,
    c.env.DB.prepare("SELECT COUNT(*) as count FROM stores WHERE status = 'active'").first() as Promise<any>,
    c.env.DB.prepare("SELECT COUNT(*) as count FROM users WHERE role != 'admin'").first() as Promise<any>,
    c.env.DB.prepare('SELECT COUNT(*) as count FROM orders').first() as Promise<any>,
    c.env.DB.prepare("SELECT COALESCE(SUM(total), 0) as revenue FROM orders WHERE status != 'cancelled'").first() as Promise<any>,
    c.env.DB.prepare('SELECT COUNT(*) as count FROM customers').first() as Promise<any>,
    c.env.DB.prepare(`SELECT COUNT(*) as count FROM orders WHERE DATE(created_at::date) = CURRENT_DATE`).first() as Promise<any>,
    c.env.DB.prepare(`SELECT COALESCE(SUM(total), 0) as revenue FROM orders WHERE DATE(created_at::date) = CURRENT_DATE AND status != 'cancelled'`).first() as Promise<any>,
  ]);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  const last7Days = await c.env.DB.prepare(`
    SELECT DATE(created_at) as day, COUNT(*) as orders, COALESCE(SUM(total),0) as revenue
    FROM orders WHERE created_at >= ?
    GROUP BY DATE(created_at) ORDER BY day ASC
  `).bind(sevenDaysAgo.toISOString()).all();

  const recentStores = await c.env.DB.prepare(`
    SELECT s.*, u.name as owner_name, COALESCE(p.name, 'بدون باقة') as plan_name
    FROM stores s LEFT JOIN users u ON s.user_id = u.id LEFT JOIN plans p ON s.plan_id = p.id
    ORDER BY s.created_at DESC LIMIT 6
  `).all();

  const planStats = await c.env.DB.prepare(`
    SELECT p.name, p.slug, COUNT(s.id) as count
    FROM plans p LEFT JOIN stores s ON s.plan_id = p.id
    GROUP BY p.id ORDER BY p.price ASC
  `).all();

  const recentOrders = await c.env.DB.prepare(`
    SELECT o.*, COALESCE(s.name, 'متجر محذوف') as store_name
    FROM orders o LEFT JOIN stores s ON o.store_id = s.id
    ORDER BY o.created_at DESC LIMIT 8
  `).all();

  const chartDays = JSON.stringify((last7Days.results as any[]).map((d: any) => {
    const date = new Date(d.day);
    return date.toLocaleDateString('ar-SA', { weekday: 'short' });
  }));
  const chartOrders = JSON.stringify((last7Days.results as any[]).map((d: any) => d.orders));
  const chartRevenue = JSON.stringify((last7Days.results as any[]).map((d: any) => Math.round(d.revenue)));

  const planColors: Record<string, string> = { free: '#94a3b8', basic: '#3b82f6', pro: '#8b5cf6', business: '#f59e0b' };
  const planLabels = JSON.stringify((planStats.results as any[]).map((p: any) => p.name));
  const planCounts = JSON.stringify((planStats.results as any[]).map((p: any) => p.count));
  const planBgColors = JSON.stringify((planStats.results as any[]).map((p: any) => planColors[p.slug] || '#4F46E5'));

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700', processing: 'bg-blue-100 text-blue-700',
    shipped: 'bg-purple-100 text-purple-700', completed: 'bg-green-100 text-green-700', cancelled: 'bg-red-100 text-red-700',
  };
  const statusLabels: Record<string, string> = {
    pending: 'قيد الانتظار', processing: 'جاري التجهيز',
    shipped: 'تم الشحن', completed: 'مكتمل', cancelled: 'ملغي',
  };

  const kpiCards = [
    { label: 'المتاجر', value: String(storesTotal?.count || 0), sub: String(storesActive?.count || 0) + ' نشط', icon: 'store', light: 'bg-blue-50 text-blue-600' },
    { label: 'الإيرادات', value: formatCurrency(revenueData?.revenue || 0), sub: 'اليوم: ' + formatCurrency(todayRevenue?.revenue || 0), icon: 'chart-line', light: 'bg-green-50 text-green-600' },
    { label: 'الطلبات', value: String(ordersTotal?.count || 0), sub: 'اليوم: ' + String(todayOrders?.count || 0), icon: 'shopping-bag', light: 'bg-primary-50 text-primary-600' },
    { label: 'العملاء', value: String(customersTotal?.count || 0), sub: String(usersTotal?.count || 0) + ' تاجر', icon: 'users', light: 'bg-purple-50 text-purple-600' },
  ];

  const kpiHtml = kpiCards.map(card => `
    <div class="bg-card rounded-2xl p-5 shadow-sm border border-std card-hover">
      <div class="flex items-start justify-between">
        <div class="${card.light} w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0">
          <i class="fas fa-${card.icon} text-lg"></i>
        </div>
        <div class="text-left">
          <p class="text-2xl font-black text-main">${card.value}</p>
          <p class="text-xs text-mute mt-0.5">${card.sub}</p>
        </div>
      </div>
      <p class="text-sub text-xs font-medium mt-3">${card.label}</p>
    </div>`).join('');

  const planStatsHtml = (planStats.results as any[]).map((p: any) => `
    <div class="flex items-center justify-between text-sm">
      <div class="flex items-center gap-2">
        <span class="w-2.5 h-2.5 rounded-full" style="background:${planColors[p.slug] || '#4F46E5'}"></span>
        <span class="text-sub">${p.name}</span>
      </div>
      <span class="font-bold text-main">${p.count || 0}</span>
    </div>`).join('');

  const recentStoresHtml = (recentStores.results as any[]).map((store: any) => `
    <div class="flex items-center justify-between px-6 py-3.5 hover:bg-gray-50 dark:hover:bg-slate-800/40 transition-colors">
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center font-bold text-sm flex-shrink-0">${store.name[0]}</div>
        <div>
          <a href="/admin/stores/${store.id}" class="font-semibold text-main text-sm hover:text-primary-600">${store.name}</a>
          <p class="text-xs text-mute">${store.owner_name}</p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-xs px-2 py-0.5 rounded-full bg-primary-50 text-primary-600 font-medium">${store.plan_name}</span>
        <span class="text-xs px-2 py-0.5 rounded-full font-medium ${store.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">${store.status === 'active' ? 'نشط' : 'موقوف'}</span>
      </div>
    </div>`).join('');

  const recentOrdersHtml = (recentOrders.results as any[]).map((order: any) => `
    <div class="flex items-center justify-between px-6 py-3.5 hover:bg-gray-50 dark:hover:bg-slate-800/40 transition-colors">
      <div>
        <p class="font-semibold text-main text-sm">#${order.order_number}</p>
        <p class="text-xs text-mute">${order.store_name} · ${order.customer_name}</p>
      </div>
      <div class="flex items-center gap-2">
        <span class="font-bold text-sm text-main">${formatCurrency(order.total)}</span>
        <span class="text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[order.status] || 'bg-gray-100 text-gray-600'}">${statusLabels[order.status] || order.status}</span>
      </div>
    </div>`).join('');

  return c.html(dashboardLayout('لوحة إدارة المنصة', `
  <div class="space-y-6">
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">${kpiHtml}</div>
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="lg:col-span-2 bg-card rounded-2xl border border-std p-6 shadow-sm">
        <div class="flex items-center justify-between mb-5">
          <div>
            <h3 class="font-bold text-main">نشاط المنصة (آخر 7 أيام)</h3>
            <p class="text-xs text-mute mt-0.5">الطلبات والإيرادات اليومية</p>
          </div>
          <div class="flex gap-3 text-xs">
            <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-full bg-primary-500 inline-block"></span>طلبات</span>
            <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span>إيرادات</span>
          </div>
        </div>
        <canvas id="activityChart" height="120"></canvas>
      </div>
      <div class="bg-card rounded-2xl border border-std p-6 shadow-sm">
        <h3 class="font-bold text-main mb-4">توزيع الباقات</h3>
        <canvas id="plansChart" height="160"></canvas>
        <div class="mt-4 space-y-2">${planStatsHtml}</div>
      </div>
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div class="bg-card rounded-2xl border border-std shadow-sm overflow-hidden">
        <div class="flex items-center justify-between px-6 py-4 border-b border-std">
          <h3 class="font-bold text-main">آخر المتاجر</h3>
          <a href="/admin/stores" class="text-xs text-primary-600 font-semibold">عرض الكل</a>
        </div>
        <div class="divide-y divide-[var(--border)]">${recentStoresHtml}</div>
      </div>
      <div class="bg-card rounded-2xl border border-std shadow-sm overflow-hidden">
        <div class="flex items-center justify-between px-6 py-4 border-b border-std">
          <h3 class="font-bold text-main">آخر الطلبات</h3>
          <a href="/admin/orders" class="text-xs text-primary-600 font-semibold">عرض الكل</a>
        </div>
        <div class="divide-y divide-[var(--border)]">${recentOrdersHtml}</div>
      </div>
    </div>
  </div>
  `, user, undefined, 'overview', `
  <script>
    new Chart(document.getElementById('activityChart'), {
      type: 'line',
      data: {
        labels: ${chartDays},
        datasets: [
          { label: 'الطلبات', data: ${chartOrders}, borderColor: '#4F46E5', backgroundColor: 'rgba(79,70,229,0.08)', fill: true, tension: 0.4, borderWidth: 2.5, pointBackgroundColor: '#4F46E5', pointRadius: 4, yAxisID: 'y' },
          { label: 'الإيرادات', data: ${chartRevenue}, borderColor: '#10B981', backgroundColor: 'rgba(16,185,129,0.06)', fill: true, tension: 0.4, borderWidth: 2.5, pointBackgroundColor: '#10B981', pointRadius: 4, yAxisID: 'y1' }
        ]
      },
      options: {
        responsive: true,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { display: false } },
        scales: {
          y: { position: 'left', grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { family: 'Tajawal', size: 11 } } },
          y1: { position: 'right', grid: { drawOnChartArea: false }, ticks: { font: { family: 'Tajawal', size: 11 } } },
          x: { grid: { display: false }, ticks: { font: { family: 'Tajawal', size: 11 } } }
        }
      }
    });
    new Chart(document.getElementById('plansChart'), {
      type: 'doughnut',
      data: { labels: ${planLabels}, datasets: [{ data: ${planCounts}, backgroundColor: ${planBgColors}, borderWidth: 0, hoverOffset: 6 }] },
      options: { responsive: true, cutout: '68%', plugins: { legend: { display: false } } }
    });
  </script>
  `));
});

// ─── Admin: All Stores ────────────────────────────────────────
admin.get('/stores', async (c) => {
  const user = c.get('user')!;
  const status = c.req.query('status') || '';
  const search = c.req.query('q') || '';
  const planFilter = c.req.query('plan') || '';
  const page = parseInt(c.req.query('page') || '1');
  const perPage = 20;
  const offset = (page - 1) * perPage;

  let where = 'WHERE 1=1';
  const params: any[] = [];
  if (status) { where += ' AND s.status = ?'; params.push(status); }
  if (search) { where += ' AND (s.name LIKE ? OR s.slug LIKE ? OR u.name LIKE ? OR u.email LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`); }
  if (planFilter) { where += ' AND p.slug = ?'; params.push(planFilter); }

  const [stores, totalCount, plans, storesActive, storesSuspended] = await Promise.all([
    c.env.DB.prepare(`
      SELECT s.*, u.name as owner_name, u.email as owner_email, p.name as plan_name, p.slug as plan_slug,
        (SELECT COUNT(*) FROM orders WHERE store_id = s.id) as orders_count
      FROM stores s JOIN users u ON s.user_id = u.id JOIN plans p ON s.plan_id = p.id
      ${where} ORDER BY s.created_at DESC LIMIT ${perPage} OFFSET ${offset}
    `).bind(...params).all(),
    c.env.DB.prepare(`SELECT COUNT(*) as count FROM stores s JOIN users u ON s.user_id = u.id JOIN plans p ON s.plan_id = p.id ${where}`).bind(...params).first() as Promise<any>,
    c.env.DB.prepare('SELECT * FROM plans ORDER BY price ASC').all(),
    c.env.DB.prepare("SELECT COUNT(*) as count FROM stores WHERE status = 'active'").first() as Promise<any>,
    c.env.DB.prepare("SELECT COUNT(*) as count FROM stores WHERE status != 'active'").first() as Promise<any>,
  ]);

  const total = totalCount?.count || 0;
  const totalPages = Math.ceil(total / perPage);
  const planBadge: Record<string, string> = {
    free: 'bg-gray-100 text-gray-600', basic: 'bg-blue-100 text-blue-700',
    pro: 'bg-purple-100 text-purple-700', business: 'bg-amber-100 text-amber-700',
  };

  const plansOptions = (plans.results as any[]).map((p: any) =>
    `<option value="${p.slug}" ${planFilter === p.slug ? 'selected' : ''}>${p.name}</option>`).join('');

  const storeRows = (stores.results as any[]).length === 0
    ? '<tr><td colspan="8" class="px-5 py-12 text-center text-mute">لا توجد متاجر مطابقة</td></tr>'
    : (stores.results as any[]).map((store: any) => `
      <tr class="border-t border-std hover:bg-gray-50 dark:hover:bg-slate-800/30 transition-colors">
        <td class="px-5 py-4">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm text-white flex-shrink-0" style="background:${store.primary_color || '#4F46E5'}">${store.name[0]}</div>
            <div>
              <a href="/admin/stores/${store.id}" class="font-semibold text-main hover:text-primary-600 text-sm">${store.name}</a>
              <p class="text-xs text-mute">/store/${store.slug}</p>
            </div>
          </div>
        </td>
        <td class="px-5 py-4"><p class="text-sm text-main font-medium">${store.owner_name}</p><p class="text-xs text-mute">${store.owner_email}</p></td>
        <td class="px-5 py-4"><span class="px-2.5 py-1 rounded-full text-xs font-semibold ${planBadge[store.plan_slug] || 'bg-gray-100 text-gray-600'}">${store.plan_name}</span></td>
        <td class="px-5 py-4 text-center font-bold text-main text-sm">${store.orders_count}</td>
        <td class="px-5 py-4 font-bold text-main text-sm">${formatCurrency(store.total_sales || 0)}</td>
        <td class="px-5 py-4"><span class="px-2.5 py-1 rounded-full text-xs font-semibold ${store.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">${store.status === 'active' ? 'نشط' : 'موقوف'}</span></td>
        <td class="px-5 py-4 text-mute text-xs">${new Date(store.created_at).toLocaleDateString('ar-SA')}</td>
        <td class="px-5 py-4">
          <div class="flex items-center gap-2">
            <a href="/admin/stores/${store.id}" class="text-xs px-2.5 py-1 bg-primary-50 text-primary-600 rounded-lg hover:bg-primary-100 font-medium">تفاصيل</a>
            <button onclick="toggleStore(${store.id}, '${store.status}')"
              class="text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${store.status === 'active' ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}">
              ${store.status === 'active' ? 'إيقاف' : 'تفعيل'}
            </button>
          </div>
        </td>
      </tr>`).join('');

  const pagination = totalPages > 1 ? `
    <div class="flex items-center justify-between px-5 py-4 border-t border-std">
      <p class="text-xs text-mute">صفحة ${page} من ${totalPages}</p>
      <div class="flex gap-2">
        ${page > 1 ? '<a href="?page=' + (page-1) + '&q=' + search + '&status=' + status + '&plan=' + planFilter + '" class="px-3 py-1.5 border border-std rounded-lg text-xs hover:bg-gray-50 text-sub">السابق</a>' : ''}
        ${page < totalPages ? '<a href="?page=' + (page+1) + '&q=' + search + '&status=' + status + '&plan=' + planFilter + '" class="px-3 py-1.5 bg-primary-600 text-white rounded-lg text-xs hover:bg-primary-700">التالي</a>' : ''}
      </div>
    </div>` : '';

  return c.html(dashboardLayout('إدارة المتاجر', `
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
    <div>
      <h2 class="text-xl font-black text-main">إدارة المتاجر</h2>
      <p class="text-sm text-mute mt-0.5">${total} متجر · ${storesActive?.count || 0} نشط · ${storesSuspended?.count || 0} موقوف</p>
    </div>
  </div>
  <form method="GET" action="/admin/stores" class="flex flex-wrap gap-3 mb-5">
    <div class="relative flex-1 min-w-[200px]">
      <i class="fas fa-search absolute right-3 top-2.5 text-mute text-sm"></i>
      <input type="text" name="q" value="${search}" placeholder="ابحث بالاسم أو المالك أو البريد..."
        class="w-full pr-9 pl-4 py-2 border border-std rounded-xl text-sm bg-page text-main focus:ring-2 focus:ring-primary-300 outline-none">
    </div>
    <select name="status" class="px-3 py-2 border border-std rounded-xl text-sm bg-page text-main outline-none">
      <option value="">كل الحالات</option>
      <option value="active" ${status === 'active' ? 'selected' : ''}>نشط</option>
      <option value="suspended" ${status === 'suspended' ? 'selected' : ''}>موقوف</option>
    </select>
    <select name="plan" class="px-3 py-2 border border-std rounded-xl text-sm bg-page text-main outline-none">
      <option value="">كل الباقات</option>${plansOptions}
    </select>
    <button type="submit" class="px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700">
      <i class="fas fa-filter ml-1.5"></i>فلتر
    </button>
    ${(search || status || planFilter) ? '<a href="/admin/stores" class="px-4 py-2 bg-gray-100 dark:bg-slate-700 text-sub rounded-xl text-sm font-semibold hover:bg-gray-200 transition-colors">مسح</a>' : ''}
  </form>
  <div class="bg-card rounded-2xl border border-std shadow-sm overflow-hidden">
    <div class="overflow-x-auto">
      <table class="w-full">
        <thead class="bg-gray-50 dark:bg-slate-800/50">
          <tr>
            <th class="text-right px-5 py-3 text-xs font-semibold text-sub">المتجر</th>
            <th class="text-right px-5 py-3 text-xs font-semibold text-sub">المالك</th>
            <th class="text-right px-5 py-3 text-xs font-semibold text-sub">الباقة</th>
            <th class="text-right px-5 py-3 text-xs font-semibold text-sub">الطلبات</th>
            <th class="text-right px-5 py-3 text-xs font-semibold text-sub">المبيعات</th>
            <th class="text-right px-5 py-3 text-xs font-semibold text-sub">الحالة</th>
            <th class="text-right px-5 py-3 text-xs font-semibold text-sub">تاريخ الإنشاء</th>
            <th class="text-right px-5 py-3 text-xs font-semibold text-sub">إجراء</th>
          </tr>
        </thead>
        <tbody>${storeRows}</tbody>
      </table>
    </div>
    ${pagination}
  </div>
  `, user, undefined, 'stores', `
  <script>
    async function toggleStore(storeId, currentStatus) {
      const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
      if (!confirm(newStatus === 'suspended' ? 'هل تريد إيقاف هذا المتجر؟' : 'هل تريد تفعيل هذا المتجر؟')) return;
      try {
        await axios.put('/api/admin/stores/' + storeId + '/status', { status: newStatus });
        showToast(newStatus === 'suspended' ? 'تم إيقاف المتجر بنجاح' : 'تم تفعيل المتجر بنجاح', 'success');
        setTimeout(() => location.reload(), 600);
      } catch(err) {
        showToast(err.response?.data?.error || err.response?.data?.message || 'خطأ في تحديث حالة المتجر', 'error');
      }
    }
    window.toggleStore = toggleStore;
  </script>
  `));
});

// ─── Admin: Store Detail ──────────────────────────────────────
admin.get('/stores/:id', async (c) => {
  const user = c.get('user')!;
  const storeId = parseInt(c.req.param('id'));

  const [storeData, storeOrders, storeProducts, storeCustomers, plans] = await Promise.all([
    c.env.DB.prepare(`
      SELECT s.*, u.name as owner_name, u.email as owner_email, 
             COALESCE(p.name, 'مجاني') as plan_name, 
             COALESCE(p.slug, 'free') as plan_slug, 
             COALESCE(p.price, 0) as plan_price
      FROM stores s JOIN users u ON s.user_id = u.id LEFT JOIN plans p ON s.plan_id = p.id WHERE s.id = ?
    `).bind(storeId).first() as Promise<any>,
    c.env.DB.prepare('SELECT * FROM orders WHERE store_id = ? ORDER BY created_at DESC LIMIT 10').bind(storeId).all(),
    c.env.DB.prepare("SELECT COUNT(*) as count FROM products WHERE store_id = ? AND status = 'active'").bind(storeId).first() as Promise<any>,
    c.env.DB.prepare('SELECT COUNT(*) as count FROM customers WHERE store_id = ?').bind(storeId).first() as Promise<any>,
    c.env.DB.prepare('SELECT * FROM plans ORDER BY price ASC').all(),
  ]);

  if (!storeData) return c.html('<h1>المتجر غير موجود</h1>', 404);

  const ordersData = storeOrders.results as any[];
  const totalRevData = await c.env.DB.prepare("SELECT COALESCE(SUM(total),0) as r FROM orders WHERE store_id = ? AND status != 'cancelled'").bind(storeId).first() as any;
  const totalOrdData = await c.env.DB.prepare('SELECT COUNT(*) as c FROM orders WHERE store_id = ?').bind(storeId).first() as any;

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700', processing: 'bg-blue-100 text-blue-700',
    shipped: 'bg-purple-100 text-purple-700', completed: 'bg-green-100 text-green-700', cancelled: 'bg-red-100 text-red-700',
  };
  const statusLabels: Record<string, string> = {
    pending: 'قيد الانتظار', processing: 'جاري التجهيز',
    shipped: 'تم الشحن', completed: 'مكتمل', cancelled: 'ملغي',
  };

  const statsCards = [
    { label: 'إجمالي الطلبات', value: String(totalOrdData?.c || 0), icon: 'shopping-bag', color: 'text-primary-600 bg-primary-50' },
    { label: 'إجمالي الإيرادات', value: formatCurrency(totalRevData?.r || 0), icon: 'chart-line', color: 'text-green-600 bg-green-50' },
    { label: 'المنتجات النشطة', value: String(storeProducts?.count || 0), icon: 'box', color: 'text-blue-600 bg-blue-50' },
    { label: 'العملاء', value: String(storeCustomers?.count || 0), icon: 'users', color: 'text-purple-600 bg-purple-50' },
  ];
  const statsHtml = statsCards.map(card => `
    <div class="bg-card rounded-2xl p-5 border border-std shadow-sm">
      <div class="flex items-center gap-3">
        <div class="${card.color} w-10 h-10 rounded-xl flex items-center justify-center"><i class="fas fa-${card.icon} text-base"></i></div>
        <div><p class="text-xl font-black text-main">${card.value}</p><p class="text-xs text-mute">${card.label}</p></div>
      </div>
    </div>`).join('');

  const orderRows = ordersData.length === 0
    ? '<tr><td colspan="5" class="py-10 text-center text-mute text-sm">لا توجد طلبات بعد</td></tr>'
    : ordersData.map((order: any) => `
      <tr class="border-t border-std hover:bg-gray-50 dark:hover:bg-slate-800/30 transition-colors">
        <td class="px-5 py-3 font-bold text-primary-600 text-sm">#${order.order_number}</td>
        <td class="px-5 py-3 text-main text-sm">${order.customer_name}</td>
        <td class="px-5 py-3 font-bold text-main text-sm">${formatCurrency(order.total)}</td>
        <td class="px-5 py-3"><span class="px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusColors[order.status] || 'bg-gray-100 text-gray-600'}">${statusLabels[order.status] || order.status}</span></td>
        <td class="px-5 py-3 text-mute text-xs">${new Date(order.created_at).toLocaleDateString('ar-SA')}</td>
      </tr>`).join('');

  const plansListHtml = (plans.results as any[]).map((p: any) => `
    <button onclick="changePlan(${p.id})"
      class="w-full flex items-center justify-between p-4 border-2 rounded-xl transition-all hover:border-primary-400 text-right ${storeData.plan_name === p.name ? 'border-primary-500 bg-primary-50/50' : 'border-std'}">
      <div>
        <p class="font-bold text-main">${p.name} ${storeData.plan_name === p.name ? '<span class="text-xs text-primary-600">(الحالية)</span>' : ''}</p>
        <p class="text-xs text-mute">${p.max_products === -1 ? 'منتجات غير محدودة' : p.max_products + ' منتج'} · ${p.max_orders === -1 ? 'طلبات غير محدودة' : p.max_orders + ' طلب/شهر'}</p>
      </div>
      <span class="font-black text-primary-600">${p.price === 0 ? 'مجاني' : p.price + ' ر.س'}</span>
    </button>`).join('');

  return c.html(dashboardLayout(storeData.name + ' - تفاصيل', `
  <div class="mb-5">
    <a href="/admin/stores" class="inline-flex items-center gap-2 text-sub hover:text-primary-600 text-sm font-medium">
      <i class="fas fa-arrow-right"></i> العودة للمتاجر
    </a>
  </div>
  <div class="bg-card rounded-2xl border border-std p-6 shadow-sm mb-6">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div class="flex items-center gap-4">
        <div class="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-black" style="background:${storeData.primary_color || '#4F46E5'}">${storeData.name[0]}</div>
        <div>
          <div class="flex items-center gap-2 flex-wrap">
            <h1 class="text-xl font-black text-main">${storeData.name}</h1>
            <span class="px-2.5 py-0.5 rounded-full text-xs font-semibold ${storeData.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">${storeData.status === 'active' ? 'نشط' : 'موقوف'}</span>
          </div>
          <p class="text-mute text-sm mt-0.5">/store/${storeData.slug}</p>
          <p class="text-sub text-xs mt-1">${storeData.owner_name} · ${storeData.owner_email}</p>
        </div>
      </div>
      <div class="flex flex-wrap gap-2">
        <a href="/store/${storeData.slug}" target="_blank" class="px-4 py-2 bg-gray-100 dark:bg-slate-700 text-sub rounded-xl text-sm font-semibold hover:bg-gray-200 transition-colors">
          <i class="fas fa-external-link-alt ml-1"></i>زيارة المتجر
        </a>
        <button onclick="document.getElementById('changePlanModal').classList.remove('hidden')"
          class="px-4 py-2 bg-primary-50 text-primary-600 rounded-xl text-sm font-semibold hover:bg-primary-100 transition-colors">
          <i class="fas fa-exchange-alt ml-1"></i>تغيير الباقة
        </button>
        <button onclick="toggleStoreStatus(${storeData.id}, '${storeData.status}')"
          class="px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${storeData.status === 'active' ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}">
          ${storeData.status === 'active' ? 'إيقاف المتجر' : 'تفعيل المتجر'}
        </button>
      </div>
    </div>
  </div>
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">${statsHtml}</div>
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
    <div class="bg-card rounded-2xl border border-std p-6 shadow-sm">
      <h3 class="font-bold text-main mb-4"><i class="fas fa-crown text-amber-500 ml-2"></i>الباقة الحالية</h3>
      <div class="flex items-center justify-between p-4 bg-gradient-to-l from-primary-600 to-purple-600 rounded-xl text-white">
        <div>
          <p class="text-primary-200 text-sm">الباقة المشترك بها</p>
          <h4 class="text-2xl font-black mt-1">${storeData.plan_name}</h4>
          <p class="text-primary-200 text-sm mt-1">${storeData.plan_price === 0 ? 'مجاني' : storeData.plan_price + ' ريال / شهر'}</p>
        </div>
        <i class="fas fa-crown text-4xl text-yellow-300 opacity-80"></i>
      </div>
      ${storeData.subscription_ends_at ? '<p class="text-xs text-mute mt-3">ينتهي في: ' + new Date(storeData.subscription_ends_at).toLocaleDateString('ar-SA') + '</p>' : ''}
    </div>
    <div class="bg-card rounded-2xl border border-std p-6 shadow-sm">
      <h3 class="font-bold text-main mb-4"><i class="fas fa-info-circle text-blue-500 ml-2"></i>معلومات المتجر</h3>
      <div class="space-y-2.5 text-sm">
        ${storeData.phone ? '<div class="flex justify-between"><span class="text-mute">الهاتف</span><span class="text-main font-medium">' + storeData.phone + '</span></div>' : ''}
        ${storeData.email ? '<div class="flex justify-between"><span class="text-mute">البريد</span><span class="text-main font-medium">' + storeData.email + '</span></div>' : ''}
        ${storeData.city ? '<div class="flex justify-between"><span class="text-mute">المدينة</span><span class="text-main font-medium">' + storeData.city + '</span></div>' : ''}
        <div class="flex justify-between"><span class="text-mute">العملة</span><span class="text-main font-medium">${storeData.currency || 'SAR'}</span></div>
        <div class="flex justify-between"><span class="text-mute">تاريخ الإنشاء</span><span class="text-main font-medium">${new Date(storeData.created_at).toLocaleDateString('ar-SA')}</span></div>
      </div>
    </div>
  </div>
  <div class="bg-card rounded-2xl border border-std shadow-sm overflow-hidden mb-6">
    <div class="px-6 py-4 border-b border-std"><h3 class="font-bold text-main">آخر الطلبات</h3></div>
    <div class="overflow-x-auto">
      <table class="w-full">
        <thead class="bg-gray-50 dark:bg-slate-800/50">
          <tr>
            <th class="text-right px-5 py-3 text-xs font-semibold text-sub">رقم الطلب</th>
            <th class="text-right px-5 py-3 text-xs font-semibold text-sub">العميل</th>
            <th class="text-right px-5 py-3 text-xs font-semibold text-sub">الإجمالي</th>
            <th class="text-right px-5 py-3 text-xs font-semibold text-sub">الحالة</th>
            <th class="text-right px-5 py-3 text-xs font-semibold text-sub">التاريخ</th>
          </tr>
        </thead>
        <tbody>${orderRows}</tbody>
      </table>
    </div>
  </div>
  <div id="changePlanModal" class="modal-overlay hidden">
    <div class="modal-box p-6">
      <div class="flex items-center justify-between mb-5">
        <h3 class="font-bold text-main text-lg">تغيير باقة الاشتراك</h3>
        <button onclick="document.getElementById('changePlanModal').classList.add('hidden')" class="text-mute hover:text-main"><i class="fas fa-times text-xl"></i></button>
      </div>
      <p class="text-sub text-sm mb-4">اختر الباقة الجديدة للمتجر <strong class="text-main">${storeData.name}</strong>:</p>
      <div class="space-y-3">${plansListHtml}</div>
    </div>
  </div>
  `, user, undefined, 'stores', `
  <script>
    async function changePlan(planId) {
      if (!confirm('هل تريد تغيير الباقة؟')) return;
      try {
        const res = await axios.put('/api/admin/stores/${storeData.id}/plan', { plan_id: planId });
        showToast(res.data?.message || 'تم تغيير الباقة بنجاح', 'success');
        setTimeout(() => location.reload(), 600);
      } catch(err) {
        showToast(err.response?.data?.message || err.response?.data?.error || 'خطأ في تغيير الباقة', 'error');
      }
    }
    window.changePlan = changePlan;
    async function toggleStoreStatus(storeId, currentStatus) {
      const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
      if (!confirm(newStatus === 'suspended' ? 'هل تريد إيقاف هذا المتجر؟' : 'هل تريد تفعيل هذا المتجر؟')) return;
      try {
        await axios.put('/api/admin/stores/' + storeId + '/status', { status: newStatus });
        showToast(newStatus === 'suspended' ? 'تم إيقاف المتجر بنجاح' : 'تم تفعيل المتجر بنجاح', 'success');
        setTimeout(() => location.reload(), 600);
      } catch(err) {
        showToast(err.response?.data?.error || err.response?.data?.message || 'خطأ في تحديث حالة المتجر', 'error');
      }
    }
    window.toggleStoreStatus = toggleStoreStatus;
  </script>
  `));
});

// ─── Admin: All Users ─────────────────────────────────────────
admin.get('/users', async (c) => {
  const user = c.get('user')!;
  const search = c.req.query('q') || '';
  const statusFilter = c.req.query('status') || '';
  const tab = c.req.query('tab') || 'merchants';

  let listHtml = '';
  let totalCount = 0;
  let activeCount = 0;

  if (tab === 'merchants') {
    let where = "WHERE u.role != 'admin'";
    const params: any[] = [];
    if (search) { where += ' AND (u.name LIKE ? OR u.email LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    if (statusFilter === 'active') { where += ' AND u.is_active = 1'; }
    else if (statusFilter === 'inactive') { where += ' AND u.is_active = 0'; }

    const users = await c.env.DB.prepare(`
      SELECT u.*,
        (SELECT COUNT(*) FROM stores WHERE user_id = u.id) as stores_count,
        (SELECT COUNT(*) FROM orders o JOIN stores s ON o.store_id = s.id WHERE s.user_id = u.id) as total_orders
      FROM users u ${where} ORDER BY u.created_at DESC
    `).bind(...params).all();

    totalCount = (users.results as any[]).length;
    activeCount = (users.results as any[]).filter((u: any) => u.is_active).length;

    listHtml = (users.results as any[]).length === 0
      ? '<tr><td colspan="8" class="py-12 text-center text-mute">لا توجد نتائج</td></tr>'
      : (users.results as any[]).map((u: any) => `
        <tr class="border-t border-std hover:bg-gray-50 dark:hover:bg-slate-800/30 transition-colors">
          <td class="px-5 py-4">
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">${u.name[0]}</div>
              <div><p class="font-semibold text-main text-sm">${u.name}</p><p class="text-mute text-xs">${u.email}</p></div>
            </div>
          </td>
          <td class="px-5 py-4"><span class="px-2.5 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold">تاجر</span></td>
          <td class="px-5 py-4 text-center font-bold text-main text-sm">${u.stores_count}</td>
          <td class="px-5 py-4 text-center font-bold text-main text-sm">${u.total_orders}</td>
          <td class="px-5 py-4"><span class="px-2.5 py-0.5 rounded-full text-xs font-semibold ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">${u.is_active ? 'نشط' : 'موقوف'}</span></td>
          <td class="px-5 py-4 text-mute text-xs">${new Date(u.created_at).toLocaleDateString('ar-SA')}</td>
          <td class="px-5 py-4">
            <button onclick="resetPassword('merchant', ${u.id})"
              class="text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors bg-orange-50 text-orange-600 hover:bg-orange-100">
              إعادة تعيين كلمة المرور
            </button>
          </td>
          <td class="px-5 py-4">
            <button onclick="toggleUser(${u.id}, ${u.is_active ? 1 : 0})"
              class="text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors ${u.is_active ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}">
              ${u.is_active ? 'إيقاف' : 'تفعيل'}
            </button>
          </td>
        </tr>`).join('');
  } else {
    // Customers Tab
    let where = "WHERE 1=1";
    const params: any[] = [];
    if (search) { where += ' AND (name LIKE ? OR email LIKE ? OR phone LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }

    const customers = await c.env.DB.prepare(`
      SELECT * FROM customers ${where} ORDER BY created_at DESC
    `).bind(...params).all();

    totalCount = (customers.results as any[]).length;
    activeCount = totalCount; // Assuming all customers are active for now

    listHtml = (customers.results as any[]).length === 0
      ? '<tr><td colspan="7" class="py-12 text-center text-mute">لا توجد نتائج</td></tr>'
      : (customers.results as any[]).map((c: any) => `
        <tr class="border-t border-std hover:bg-gray-50 dark:hover:bg-slate-800/30 transition-colors">
          <td class="px-5 py-4">
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-full bg-gradient-to-br from-green-400 to-green-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">${c.name[0]}</div>
              <div><p class="font-semibold text-main text-sm">${c.name}</p><p class="text-mute text-xs">${c.email || c.phone || 'غير متوفر'}</p></div>
            </div>
          </td>
          <td class="px-5 py-4"><span class="px-2.5 py-0.5 bg-purple-50 text-purple-700 rounded-full text-xs font-semibold">عميل</span></td>
          <td class="px-5 py-4 text-center font-bold text-main text-sm">-</td>
          <td class="px-5 py-4 text-center font-bold text-main text-sm">${c.total_orders}</td>
          <td class="px-5 py-4"><span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">نشط</span></td>
          <td class="px-5 py-4 text-mute text-xs">${new Date(c.created_at).toLocaleDateString('ar-SA')}</td>
          <td class="px-5 py-4">
            <button onclick="resetPassword('customer', ${c.id})"
              class="text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors bg-orange-50 text-orange-600 hover:bg-orange-100">
              إعادة تعيين كلمة المرور
            </button>
          </td>
          <td class="px-5 py-4"></td>
        </tr>`).join('');
  }

  return c.html(dashboardLayout('مستخدمو الموقع', `
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
    <div>
      <h2 class="text-xl font-black text-main">مستخدمو الموقع</h2>
      <p class="text-sm text-mute mt-0.5">${totalCount} مستخدم · ${activeCount} نشط</p>
    </div>
  </div>
  
  <div class="flex gap-1.5 mb-5 bg-card p-1.5 rounded-xl border border-std overflow-x-auto">
    <a href="/admin/users?tab=merchants"
      class="px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${tab === 'merchants' ? 'bg-primary-600 text-white' : 'text-sub hover:bg-gray-100 dark:hover:bg-slate-700'}">
      أصحاب المتاجر
    </a>
    <a href="/admin/users?tab=customers"
      class="px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${tab === 'customers' ? 'bg-primary-600 text-white' : 'text-sub hover:bg-gray-100 dark:hover:bg-slate-700'}">
      العملاء
    </a>
  </div>

  <form method="GET" action="/admin/users" class="flex flex-wrap gap-3 mb-5">
    <input type="hidden" name="tab" value="${tab}">
    <div class="relative flex-1 min-w-[200px]">
      <i class="fas fa-search absolute right-3 top-2.5 text-mute text-sm"></i>
      <input type="text" name="q" value="${search}" placeholder="ابحث بالاسم أو البريد..."
        class="w-full pr-9 pl-4 py-2 border border-std rounded-xl text-sm bg-page text-main focus:ring-2 focus:ring-primary-300 outline-none">
    </div>
    ${tab === 'merchants' ? `
    <select name="status" class="px-3 py-2 border border-std rounded-xl text-sm bg-page text-main outline-none">
      <option value="">كل الحالات</option>
      <option value="active" ${statusFilter === 'active' ? 'selected' : ''}>نشط</option>
      <option value="inactive" ${statusFilter === 'inactive' ? 'selected' : ''}>موقوف</option>
    </select>
    ` : ''}
    <button type="submit" class="px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700">فلتر</button>
    ${(search || statusFilter) ? '<a href="/admin/users?tab=' + tab + '" class="px-4 py-2 bg-gray-100 dark:bg-slate-700 text-sub rounded-xl text-sm font-semibold hover:bg-gray-200 transition-colors">مسح</a>' : ''}
  </form>
  <div class="bg-card rounded-2xl border border-std shadow-sm overflow-hidden">
    <div class="overflow-x-auto">
      <table class="w-full">
        <thead class="bg-gray-50 dark:bg-slate-800/50">
          <tr>
            <th class="text-right px-5 py-3 text-xs font-semibold text-sub">المستخدم</th>
            <th class="text-right px-5 py-3 text-xs font-semibold text-sub">النوع</th>
            <th class="text-right px-5 py-3 text-xs font-semibold text-sub">المتاجر</th>
            <th class="text-right px-5 py-3 text-xs font-semibold text-sub">الطلبات</th>
            <th class="text-right px-5 py-3 text-xs font-semibold text-sub">الحالة</th>
            <th class="text-right px-5 py-3 text-xs font-semibold text-sub">تاريخ التسجيل</th>
            <th class="text-right px-5 py-3 text-xs font-semibold text-sub">إجراءات</th>
            <th class="text-right px-5 py-3 text-xs font-semibold text-sub">تفعيل/إيقاف</th>
          </tr>
        </thead>
        <tbody>${listHtml}</tbody>
      </table>
    </div>
  </div>
  `, user, undefined, 'users', `
  <script>
    async function toggleUser(userId, currentIsActive) {
      const nextActive = currentIsActive ? 0 : 1;
      const msg = nextActive === 1 ? 'هل تريد تفعيل حساب هذا المستخدم؟' : 'هل تريد إيقاف حساب هذا المستخدم؟';
      if (!confirm(msg)) return;
      try {
        const res = await axios.put('/api/admin/users/' + userId + '/status', { is_active: nextActive });
        showToast(res.data?.message || (nextActive === 1 ? 'تم تفعيل المستخدم بنجاح' : 'تم إيقاف المستخدم بنجاح'), 'success');
        setTimeout(() => location.reload(), 600);
      } catch(err) {
        showToast(err.response?.data?.message || err.response?.data?.error || 'خطأ في تحديث حالة المستخدم', 'error');
      }
    }
    window.toggleUser = toggleUser;

    async function resetPassword(type, id) {
      if (!confirm('هل أنت متأكد من إعادة تعيين كلمة المرور إلى 1234567891؟ سيُطلب من المستخدم تغييرها عند تسجيل الدخول القادم.')) return;
      try {
        const endpoint = type === 'customer' 
          ? '/admin/customers/' + id + '/reset-password'
          : '/admin/users/' + id + '/reset-password';
        
        await axios.post(endpoint);
        showToast('تم إعادة تعيين كلمة المرور بنجاح', 'success');
      } catch(err) { 
        showToast('حدث خطأ أثناء إعادة التعيين', 'error');
        console.error(err);
      }
    }
    window.resetPassword = resetPassword;
  </script>
  `));
});

// ─── Admin: All Orders ────────────────────────────────────────
admin.get('/orders', async (c) => {
  const user = c.get('user')!;
  const search = c.req.query('q') || '';
  const statusFilter = c.req.query('status') || '';
  const page = parseInt(c.req.query('page') || '1');
  const perPage = 20;
  const offset = (page - 1) * perPage;

  let where = 'WHERE 1=1';
  const params: any[] = [];
  if (search) { where += ' AND (o.order_number LIKE ? OR o.customer_name LIKE ? OR s.name LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
  if (statusFilter) { where += ' AND o.status = ?'; params.push(statusFilter); }

  const [orders, totalCount, summaryData] = await Promise.all([
    c.env.DB.prepare(`SELECT o.*, s.name as store_name, s.id as store_id FROM orders o JOIN stores s ON o.store_id = s.id ${where} ORDER BY o.created_at DESC LIMIT ${perPage} OFFSET ${offset}`).bind(...params).all(),
    c.env.DB.prepare(`SELECT COUNT(*) as count FROM orders o JOIN stores s ON o.store_id = s.id ${where}`).bind(...params).first() as Promise<any>,
    c.env.DB.prepare("SELECT COUNT(*) as total, COALESCE(SUM(total),0) as revenue FROM orders").first() as Promise<any>,
  ]);

  const total = totalCount?.count || 0;
  const totalPages = Math.ceil(total / perPage);
  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700', processing: 'bg-blue-100 text-blue-700',
    shipped: 'bg-purple-100 text-purple-700', completed: 'bg-green-100 text-green-700', cancelled: 'bg-red-100 text-red-700',
  };
  const statusLabels: Record<string, string> = {
    pending: 'قيد الانتظار', processing: 'جاري التجهيز',
    shipped: 'تم الشحن', completed: 'مكتمل', cancelled: 'ملغي',
  };
  const allStatuses = ['pending', 'processing', 'shipped', 'completed', 'cancelled'];

  const statusTabs = allStatuses.map(s => `
    <a href="/admin/orders?status=${s}${search ? '&q=' + search : ''}"
      class="px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${statusFilter === s ? 'bg-primary-600 text-white' : 'text-sub hover:bg-gray-100 dark:hover:bg-slate-700'}">
      ${statusLabels[s]}</a>`).join('');

  const orderRows = (orders.results as any[]).length === 0
    ? '<tr><td colspan="6" class="py-12 text-center text-mute">لا توجد طلبات</td></tr>'
    : (orders.results as any[]).map((order: any) => `
      <tr class="border-t border-std hover:bg-gray-50 dark:hover:bg-slate-800/30 transition-colors">
        <td class="px-5 py-3 font-bold text-primary-600 text-sm">#${order.order_number}</td>
        <td class="px-5 py-3"><a href="/admin/stores/${order.store_id}" class="text-main text-sm font-medium hover:text-primary-600">${order.store_name}</a></td>
        <td class="px-5 py-3 text-main text-sm">${order.customer_name}</td>
        <td class="px-5 py-3 font-bold text-main text-sm">${formatCurrency(order.total)}</td>
        <td class="px-5 py-3"><span class="px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusColors[order.status] || 'bg-gray-100 text-gray-600'}">${statusLabels[order.status] || order.status}</span></td>
        <td class="px-5 py-3 text-mute text-xs">${new Date(order.created_at).toLocaleDateString('ar-SA')}</td>
      </tr>`).join('');

  const pagination = totalPages > 1 ? `
    <div class="flex items-center justify-between px-5 py-4 border-t border-std">
      <p class="text-xs text-mute">صفحة ${page} من ${totalPages} — ${total} نتيجة</p>
      <div class="flex gap-2">
        ${page > 1 ? '<a href="?page=' + (page-1) + '&status=' + statusFilter + '&q=' + search + '" class="px-3 py-1.5 border border-std rounded-lg text-xs hover:bg-gray-50 text-sub">السابق</a>' : ''}
        ${page < totalPages ? '<a href="?page=' + (page+1) + '&status=' + statusFilter + '&q=' + search + '" class="px-3 py-1.5 bg-primary-600 text-white rounded-lg text-xs hover:bg-primary-700">التالي</a>' : ''}
      </div>
    </div>` : '';

  return c.html(dashboardLayout('كل الطلبات', `
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
    <div>
      <h2 class="text-xl font-black text-main">كل طلبات المنصة</h2>
      <p class="text-sm text-mute mt-0.5">${summaryData?.total || 0} طلب · ${formatCurrency(summaryData?.revenue || 0)} إيرادات</p>
    </div>
  </div>
  <div class="flex gap-1.5 mb-4 bg-card p-1.5 rounded-xl border border-std overflow-x-auto">
    <a href="/admin/orders${search ? '?q=' + search : ''}"
      class="px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${!statusFilter ? 'bg-primary-600 text-white' : 'text-sub hover:bg-gray-100 dark:hover:bg-slate-700'}">الكل</a>
    ${statusTabs}
  </div>
  <form method="GET" action="/admin/orders" class="flex gap-3 mb-5">
    ${statusFilter ? '<input type="hidden" name="status" value="' + statusFilter + '">' : ''}
    <div class="relative flex-1">
      <i class="fas fa-search absolute right-3 top-2.5 text-mute text-sm"></i>
      <input type="text" name="q" value="${search}" placeholder="ابحث برقم الطلب أو اسم العميل أو المتجر..."
        class="w-full pr-9 pl-4 py-2 border border-std rounded-xl text-sm bg-page text-main focus:ring-2 focus:ring-primary-300 outline-none">
    </div>
    <button type="submit" class="px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700">بحث</button>
  </form>
  <div class="bg-card rounded-2xl border border-std shadow-sm overflow-hidden">
    <div class="overflow-x-auto">
      <table class="w-full">
        <thead class="bg-gray-50 dark:bg-slate-800/50">
          <tr>
            <th class="text-right px-5 py-3 text-xs font-semibold text-sub">رقم الطلب</th>
            <th class="text-right px-5 py-3 text-xs font-semibold text-sub">المتجر</th>
            <th class="text-right px-5 py-3 text-xs font-semibold text-sub">العميل</th>
            <th class="text-right px-5 py-3 text-xs font-semibold text-sub">الإجمالي</th>
            <th class="text-right px-5 py-3 text-xs font-semibold text-sub">الحالة</th>
            <th class="text-right px-5 py-3 text-xs font-semibold text-sub">التاريخ</th>
          </tr>
        </thead>
        <tbody>${orderRows}</tbody>
      </table>
    </div>
    ${pagination}
  </div>
  `, user, undefined, 'orders'));
});

// ─── Admin: Plans Management ──────────────────────────────────
admin.get('/plans', async (c) => {
  const user = c.get('user')!;
  const { ensurePlansSeeded } = await import('../middleware/tenant');
  await ensurePlansSeeded(c.env.DB);

  const plans = await c.env.DB.prepare(
    'SELECT p.*, (SELECT COUNT(*) FROM stores WHERE plan_id = p.id) as stores_count FROM plans p ORDER BY p.price'
  ).all();

  const planIcons: Record<string, string> = { free: 'gift', basic: 'star', pro: 'rocket', business: 'building' };
  const planGrads: Record<string, string> = {
    free: 'from-gray-400 to-gray-500', basic: 'from-blue-500 to-blue-600',
    pro: 'from-purple-500 to-violet-600', business: 'from-amber-500 to-orange-600',
  };

  const planCards = (plans.results as any[]).map((plan: any) => `
    <div class="bg-card rounded-2xl border-2 border-std p-6 card-hover shadow-sm flex flex-col justify-between">
      <div>
        <div class="flex items-center justify-between mb-4">
          <div class="w-12 h-12 bg-gradient-to-br ${planGrads[plan.slug] || 'from-primary-500 to-primary-600'} rounded-xl flex items-center justify-center shadow-md">
            <i class="fas fa-${planIcons[plan.slug] || 'star'} text-white text-lg"></i>
          </div>
          <span class="text-xs font-black text-main bg-gray-100 dark:bg-slate-700 px-3 py-1 rounded-full">${plan.stores_count} متجر</span>
        </div>
        <h3 class="font-black text-main text-lg">${plan.name}</h3>
        <p class="text-2xl font-black text-primary-600 mt-1 mb-4">
          ${plan.price === 0 ? '0 ريال / 5 أيام' : plan.price.toLocaleString('ar-SA') + ' <span class="text-xs font-normal text-mute">ريال / شهر</span>'}
        </p>
        <div class="space-y-2 text-xs text-sub mb-5 border-t border-std pt-3">
          <div class="flex justify-between py-1 border-b border-std"><span>المتاجر</span><span class="font-bold text-main">${plan.max_stores === -1 ? 'غير محدود' : plan.max_stores}</span></div>
          <div class="flex justify-between py-1 border-b border-std"><span>المنتجات</span><span class="font-bold text-main">${plan.max_products === -1 ? 'غير محدود' : plan.max_products}</span></div>
          <div class="flex justify-between py-1 border-b border-std"><span>الطلبات الشهرية</span><span class="font-bold text-main">${plan.max_orders === -1 ? 'غير محدود' : plan.max_orders.toLocaleString('ar-SA')}</span></div>
          <div class="flex justify-between py-1"><span>الموظفون</span><span class="font-bold text-main">${plan.max_staff === -1 ? 'غير محدود' : plan.max_staff}</span></div>
        </div>
      </div>
      <button onclick="openEditPlan(${plan.id}, '${plan.name}', ${plan.price}, ${plan.max_products}, ${plan.max_orders}, ${plan.max_staff})"
        class="w-full py-2.5 bg-primary-50 text-primary-600 rounded-xl text-xs font-bold hover:bg-primary-100 transition-colors mt-2">
        <i class="fas fa-edit ml-1.5"></i>تعديل الباقة
      </button>
    </div>`).join('');

  return c.html(dashboardLayout('إدارة الباقات', `
  <div class="flex items-center justify-between mb-6">
    <div>
      <h2 class="text-xl font-black text-main">إدارة الباقات</h2>
      <p class="text-sm text-mute mt-0.5">تعديل حدود وأسعار باقات الاشتراك</p>
    </div>
  </div>
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">${planCards}</div>
  <div id="editPlanModal" class="modal-overlay hidden">
    <div class="modal-box p-6">
      <div class="flex items-center justify-between mb-5">
        <h3 class="font-bold text-main text-lg">تعديل باقة: <span id="editPlanName"></span></h3>
        <button onclick="document.getElementById('editPlanModal').classList.add('hidden')" class="text-mute hover:text-main"><i class="fas fa-times text-xl"></i></button>
      </div>
      <form id="editPlanForm" class="space-y-4">
        <input type="hidden" id="editPlanId">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-sub mb-1.5">السعر (ريال/شهر)</label>
            <input type="number" id="editPlanPrice" step="1" min="0" class="w-full px-4 py-2.5 border border-std rounded-xl text-sm bg-page text-main focus:ring-2 focus:ring-primary-300 outline-none" dir="ltr">
          </div>
          <div>
            <label class="block text-sm font-medium text-sub mb-1.5">عدد المنتجات (-1 = غير محدود)</label>
            <input type="number" id="editPlanMaxProducts" step="1" class="w-full px-4 py-2.5 border border-std rounded-xl text-sm bg-page text-main focus:ring-2 focus:ring-primary-300 outline-none" dir="ltr">
          </div>
          <div>
            <label class="block text-sm font-medium text-sub mb-1.5">الطلبات/شهر (-1 = غير محدود)</label>
            <input type="number" id="editPlanMaxOrders" step="1" class="w-full px-4 py-2.5 border border-std rounded-xl text-sm bg-page text-main focus:ring-2 focus:ring-primary-300 outline-none" dir="ltr">
          </div>
          <div>
            <label class="block text-sm font-medium text-sub mb-1.5">الموظفين (-1 = غير محدود)</label>
            <input type="number" id="editPlanMaxStaff" step="1" class="w-full px-4 py-2.5 border border-std rounded-xl text-sm bg-page text-main focus:ring-2 focus:ring-primary-300 outline-none" dir="ltr">
          </div>
        </div>
        <button type="submit" class="w-full bg-primary-600 text-white py-3 rounded-xl font-semibold hover:bg-primary-700 transition-colors">
          <i class="fas fa-save ml-2"></i>حفظ التغييرات
        </button>
      </form>
    </div>
  </div>
  `, user, undefined, 'plans', `
  <script>
    function openEditPlan(id, name, price, maxProducts, maxOrders, maxStaff) {
      document.getElementById('editPlanId').value = id;
      document.getElementById('editPlanName').textContent = name;
      document.getElementById('editPlanPrice').value = price;
      document.getElementById('editPlanMaxProducts').value = maxProducts;
      document.getElementById('editPlanMaxOrders').value = maxOrders;
      document.getElementById('editPlanMaxStaff').value = maxStaff;
      document.getElementById('editPlanModal').classList.remove('hidden');
    }
    document.getElementById('editPlanForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('editPlanId').value;
      try {
        await axios.put('/api/admin/plans/' + id, {
          price: parseFloat(document.getElementById('editPlanPrice').value),
          max_products: parseInt(document.getElementById('editPlanMaxProducts').value),
          max_orders: parseInt(document.getElementById('editPlanMaxOrders').value),
          max_staff: parseInt(document.getElementById('editPlanMaxStaff').value),
        });
        showToast('تم حفظ الباقة بنجاح', 'success');
        setTimeout(() => { document.getElementById('editPlanModal').classList.add('hidden'); location.reload(); }, 800);
      } catch(err) { showToast('خطأ في الحفظ', 'error'); }
    });
  </script>
  `));
});

// ─── Admin: Subscriptions ─────────────────────────────────────
admin.get('/subscriptions', async (c) => {
  const user = c.get('user')!;
  const filter = c.req.query('filter') || '';

  const { ensurePlansSeeded } = await import('../middleware/tenant');
  await ensurePlansSeeded(c.env.DB);

  const sevenDaysLater = new Date();
  sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
  const nowIso = new Date().toISOString();
  const sevenDaysLaterIso = sevenDaysLater.toISOString();

  let where = '';
  if (filter === 'pending') { where = "WHERE s.subscription_status = 'pending_activation'"; }
  else if (filter === 'expiring') { where = `WHERE s.subscription_ends_at IS NOT NULL AND s.subscription_ends_at <= '${sevenDaysLaterIso}' AND s.subscription_status = 'active'`; }
  else if (filter === 'expired') { where = `WHERE s.subscription_status = 'expired' OR (s.subscription_ends_at IS NOT NULL AND s.subscription_ends_at < '${nowIso}')`; }
  else if (filter === 'free') { where = 'WHERE p.price = 0'; }

  const stores = await c.env.DB.prepare(`
    SELECT s.*, u.name as owner_name, COALESCE(p.name,'بدون باقة') as plan_name, p.price as plan_price, p.slug as plan_slug
    FROM stores s LEFT JOIN users u ON s.user_id = u.id LEFT JOIN plans p ON s.plan_id = p.id
    ${where} ORDER BY s.subscription_ends_at ASC
  `).all();

  const [pendingCount, expiringSoon, paidCount, freeCount] = await Promise.all([
    c.env.DB.prepare("SELECT COUNT(*) as count FROM stores WHERE subscription_status = 'pending_activation'").first() as Promise<any>,
    c.env.DB.prepare(`SELECT COUNT(*) as count FROM stores WHERE subscription_ends_at IS NOT NULL AND subscription_ends_at <= '${sevenDaysLaterIso}' AND subscription_status = 'active'`).first() as Promise<any>,
    c.env.DB.prepare("SELECT COUNT(*) as count FROM stores s LEFT JOIN plans p ON s.plan_id = p.id WHERE p.price > 0").first() as Promise<any>,
    c.env.DB.prepare("SELECT COUNT(*) as count FROM stores s LEFT JOIN plans p ON s.plan_id = p.id WHERE p.price = 0").first() as Promise<any>,
  ]);

  const planBadge: Record<string, string> = { free: 'bg-gray-100 text-gray-600', basic: 'bg-blue-100 text-blue-700', pro: 'bg-purple-100 text-purple-700', business: 'bg-amber-100 text-amber-700' };
  const filterTabs = [
    { val: '', label: 'الكل' },
    { val: 'pending', label: 'بانتظار التفعيل (' + (pendingCount?.count || 0) + ')' },
    { val: 'expiring', label: 'تنتهي قريباً (' + (expiringSoon?.count || 0) + ')' },
    { val: 'expired', label: 'منتهية' },
    { val: 'free', label: 'مجانية' },
  ].map(f => `<a href="/admin/subscriptions${f.val ? '?filter=' + f.val : ''}"
      class="px-4 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${filter === f.val ? 'bg-primary-600 text-white' : 'text-sub hover:bg-gray-100 dark:hover:bg-slate-700'}">${f.label}</a>`).join('');

  const storeRows = (stores.results as any[]).length === 0
    ? '<tr><td colspan="6" class="py-12 text-center text-mute">لا توجد نتائج</td></tr>'
    : (stores.results as any[]).map((store: any) => {
        const endsAt = store.subscription_ends_at ? new Date(store.subscription_ends_at) : null;
        const isExpiringSoon = endsAt && (endsAt.getTime() - Date.now()) < 7 * 24 * 60 * 60 * 1000;
        const isPending = store.subscription_status === 'pending_activation';
        return `
      <tr class="border-t border-std hover:bg-gray-50 dark:hover:bg-slate-800/30 transition-colors ${isPending ? 'bg-amber-50/30' : isExpiringSoon ? 'bg-amber-50/20' : ''}">
        <td class="px-5 py-4"><a href="/admin/stores/${store.id}" class="font-semibold text-main hover:text-primary-600 text-sm">${store.name}</a><p class="text-xs text-mute">/store/${store.slug}</p></td>
        <td class="px-5 py-4 text-sub text-sm">${store.owner_name}</td>
        <td class="px-5 py-4"><span class="px-2.5 py-0.5 rounded-full text-xs font-semibold ${planBadge[store.plan_slug] || 'bg-gray-100 text-gray-600'}">${store.plan_name}</span></td>
        <td class="px-5 py-4">
          <span class="px-2.5 py-0.5 rounded-full text-xs font-semibold ${store.subscription_status === 'active' ? 'bg-green-100 text-green-700' : isPending ? 'bg-amber-100 text-amber-800 animate-pulse' : 'bg-red-100 text-red-700'}">
            ${store.subscription_status === 'active' ? 'نشط' : isPending ? 'بانتظار التفعيل' : 'منتهي'}
          </span>
        </td>
        <td class="px-5 py-4 text-sm ${isExpiringSoon ? 'text-amber-600 font-bold' : 'text-sub'}">${endsAt ? (isExpiringSoon ? '⚠ ' : '') + endsAt.toLocaleDateString('ar-SA') : '<span class="text-mute">—</span>'}</td>
        <td class="px-5 py-4 flex gap-2">
          <button onclick="activateSubscription(${store.id})"
            class="text-xs px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold transition-all shadow-sm flex items-center gap-1">
            <i class="fas fa-check-circle"></i>تفعيل الباقة
          </button>
          <button onclick="extendSubscription(${store.id})"
            class="text-xs px-3 py-1.5 bg-primary-50 text-primary-600 hover:bg-primary-100 rounded-lg font-semibold transition-colors">
            <i class="fas fa-calendar-plus ml-1"></i>تمديد شهر
          </button>
        </td>
      </tr>`;
      }).join('');

  return c.html(dashboardLayout('إدارة الاشتراكات', `
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
    <div>
      <h2 class="text-xl font-black text-main">إدارة الاشتراكات والتفعيل</h2>
      <p class="text-sm text-mute mt-0.5">${pendingCount?.count || 0} بانتظار التفعيل · ${paidCount?.count || 0} مدفوع · ${freeCount?.count || 0} مجاني</p>
    </div>
    ${(expiringSoon?.count || 0) > 0 ? '<div class="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 px-4 py-2 rounded-xl text-sm font-semibold"><i class="fas fa-exclamation-triangle"></i>' + expiringSoon?.count + ' اشتراك سينتهي قريباً</div>' : ''}
  </div>
  <div class="flex gap-1.5 mb-5 bg-card p-1.5 rounded-xl border border-std overflow-x-auto">${filterTabs}</div>
  <div class="bg-card rounded-2xl border border-std shadow-sm overflow-hidden">
    <div class="overflow-x-auto">
      <table class="w-full">
        <thead class="bg-gray-50 dark:bg-slate-800/50">
          <tr>
            <th class="text-right px-5 py-3 text-xs font-semibold text-sub">المتجر</th>
            <th class="text-right px-5 py-3 text-xs font-semibold text-sub">المالك</th>
            <th class="text-right px-5 py-3 text-xs font-semibold text-sub">الباقة</th>
            <th class="text-right px-5 py-3 text-xs font-semibold text-sub">حالة الاشتراك</th>
            <th class="text-right px-5 py-3 text-xs font-semibold text-sub">تاريخ الانتهاء</th>
            <th class="text-right px-5 py-3 text-xs font-semibold text-sub">إجراء</th>
          </tr>
        </thead>
        <tbody>${storeRows}</tbody>
      </table>
    </div>
  </div>
  `, user, undefined, 'subscriptions', `
  <script>
    async function activateSubscription(storeId) {
      if (!confirm('هل تريد تفعيل باقة الاشتراك لهذا المتجر وبدء سريان الصلاحية الآن؟')) return;
      try {
        const res = await axios.post('/api/admin/stores/' + storeId + '/activate-subscription', {});
        showToast(res.data?.message || 'تم تفعيل باقة المتجر بنجاح', 'success');
        setTimeout(() => location.reload(), 600);
      } catch(err) {
        showToast(err.response?.data?.message || err.response?.data?.error || 'خطأ في تفعيل الباقة', 'error');
      }
    }
    window.activateSubscription = activateSubscription;

    async function extendSubscription(storeId) {
      if (!confirm('هل تريد تمديد الاشتراك لمدة شهر إضافي؟')) return;
      try {
        const res = await axios.post('/api/admin/stores/' + storeId + '/extend', {});
        showToast(res.data?.message || 'تم تمديد الاشتراك بنجاح', 'success');
        setTimeout(() => location.reload(), 600);
      } catch(err) {
        showToast(err.response?.data?.message || err.response?.data?.error || 'خطأ في التمديد', 'error');
      }
    }
    window.extendSubscription = extendSubscription;
  </script>
  `));
});

// ─── Admin API Routes ─────────────────────────────────────────
admin.put('/stores/:id/status', async (c) => {
  try {
    const { status } = await c.req.json() as any;
    const storeId = parseInt(c.req.param('id'));
    const is_active = status === 'active' ? 1 : 0;
    await c.env.DB.prepare(
      "UPDATE stores SET status = ?, is_active = ?, updated_at = datetime('now') WHERE id = ?"
    ).bind(status, is_active, storeId).run();
    return c.json({ success: true, message: 'تم تحديث حالة المتجر بنجاح', status, is_active });
  } catch (err: any) {
    console.error('[ADMIN] PUT stores/:id/status error:', err?.message);
    return c.json({ success: false, error: err?.message }, 500);
  }
});

admin.put('/users/:id/status', async (c) => {
  try {
    const body = await c.req.json() as any;
    const is_active = body.is_active ? 1 : 0;
    const userId = parseInt(c.req.param('id'));

    await c.env.DB.prepare(
      "UPDATE users SET is_active = ?, updated_at = datetime('now') WHERE id = ?"
    ).bind(is_active, userId).run();

    // Also update any stores owned by this merchant
    const newStoreStatus = is_active === 1 ? 'active' : 'suspended';
    await c.env.DB.prepare(
      "UPDATE stores SET status = ?, is_active = ?, updated_at = datetime('now') WHERE user_id = ?"
    ).bind(newStoreStatus, is_active, userId).run();

    return c.json({ success: true, message: is_active === 1 ? 'تم تفعيل حساب المستخدم بنجاح' : 'تم إيقاف حساب المستخدم بنجاح', is_active });
  } catch (err: any) {
    console.error('[ADMIN] PUT users/:id/status error:', err?.message);
    return c.json({ success: false, error: err?.message }, 500);
  }
});

admin.post('/users/:id/reset-password', async (c) => {
  try {
    const userId = parseInt(c.req.param('id'));
    const tempPassword = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('1234567891')).then(b => Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join(''));
    await c.env.DB.prepare('UPDATE users SET password = ?, force_password_change = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .bind(tempPassword, userId).run();
    return c.json({ message: 'تم إعادة تعيين كلمة المرور بنجاح' });
  } catch (err: any) {
    console.error('[ADMIN] reset-password error:', err?.message);
    return c.json({ success: false, error: err?.message }, 500);
  }
});

admin.post('/customers/:id/reset-password', async (c) => {
  try {
    const customerId = parseInt(c.req.param('id'));
    const tempPassword = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('1234567891')).then(b => Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join(''));
    await c.env.DB.prepare('UPDATE customers SET password = ?, force_password_change = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .bind(tempPassword, customerId).run();
    return c.json({ message: 'تم إعادة تعيين كلمة المرور بنجاح' });
  } catch (err: any) {
    console.error('[ADMIN] reset-customer-password error:', err?.message);
    return c.json({ success: false, error: err?.message }, 500);
  }
});

admin.post('/stores/:id/activate-subscription', async (c) => {
  try {
    const storeId = parseInt(c.req.param('id'));
    
    const { ensurePlansSeeded } = await import('../middleware/tenant');
    await ensurePlansSeeded(c.env.DB);

    const store = await c.env.DB.prepare(`
      SELECT s.*, p.duration_days as plan_duration_days, p.slug as plan_slug, p.name as plan_name, p.price as plan_price 
      FROM stores s LEFT JOIN plans p ON s.plan_id = p.id WHERE s.id = ?
    `).bind(storeId).first() as any;
    if (!store) return c.json({ success: false, message: 'المتجر غير موجود' }, 404);

    let durationDays = store.plan_duration_days;
    if (!durationDays || durationDays <= 0) {
      durationDays = (store.plan_slug === 'free' || store.plan_price === 0) ? 365 : 30;
    }

    const startsAt = new Date();
    const endsAt = new Date();
    endsAt.setDate(endsAt.getDate() + durationDays);

    await c.env.DB.prepare(`
      UPDATE stores 
      SET subscription_status = 'active', status = 'active', is_active = 1, subscription_starts_at = ?, subscription_ends_at = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(startsAt.toISOString(), endsAt.toISOString(), storeId).run();

    const { NotificationService } = await import('../services/notification');
    await NotificationService.createNotification(c.env.DB, {
      user_type: 'merchant',
      user_id: store.user_id,
      store_id: store.id,
      title: 'تم تفعيل باقة المتجر بنجاح! 👑',
      message: `تم تفعيل باقة متجرك (${store.plan_name || 'الأساسية'}) لمدة ${durationDays} يوم بنجاح.`,
      link: '/dashboard/subscription',
      type: 'subscription'
    });

    return c.json({ success: true, message: `تم تفعيل باقة المتجر بنجاح لمدة ${durationDays} يوم`, ends_at: endsAt.toISOString() });
  } catch (err: any) {
    console.error('[ADMIN] activate subscription error:', err?.message);
    return c.json({ success: false, error: err?.message }, 500);
  }
});

admin.put('/stores/:id/plan', async (c) => {
  try {
    const { plan_id } = await c.req.json() as any;
    const storeId = parseInt(c.req.param('id'));
    const parsedPlanId = parseInt(plan_id);

    const plan = await c.env.DB.prepare(
      'SELECT * FROM plans WHERE id = ? OR slug = ?'
    ).bind(isNaN(parsedPlanId) ? -1 : parsedPlanId, String(plan_id)).first() as any;

    if (!plan) return c.json({ success: false, message: 'الباقة غير موجودة' }, 404);

    const days = plan.duration_days || (plan.slug === 'free' || plan.price === 0 ? 365 : 30);
    const startsAt = new Date();
    const endsAt = new Date();
    endsAt.setDate(endsAt.getDate() + days);

    await c.env.DB.prepare(`
      UPDATE stores 
      SET plan_id = ?, subscription_status = 'active', status = 'active', is_active = 1, subscription_starts_at = datetime('now'), subscription_ends_at = ?, updated_at = datetime('now') 
      WHERE id = ?
    `).bind(plan.id, endsAt.toISOString(), storeId).run();

    return c.json({ success: true, message: `تم تغيير الباقة إلى (${plan.name}) وتفعيلها بنجاح`, plan_name: plan.name });
  } catch (err: any) {
    console.error('[ADMIN] PUT stores/:id/plan error:', err?.message);
    return c.json({ success: false, error: err?.message }, 500);
  }
});

admin.put('/plans/:id', async (c) => {
  try {
    const planId = parseInt(c.req.param('id'));
    const { price, max_products, max_orders, max_staff } = await c.req.json() as any;
    await c.env.DB.prepare('UPDATE plans SET price = ?, max_products = ?, max_orders = ?, max_staff = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(price, max_products, max_orders, max_staff, planId).run();
    return c.json({ message: 'تم تحديث الباقة بنجاح' });
  } catch (err: any) {
    console.error('[ADMIN] PUT plans/:id error:', err?.message);
    return c.json({ success: false, error: err?.message }, 500);
  }
});

admin.post('/stores/:id/extend', async (c) => {
  try {
    const storeId = parseInt(c.req.param('id'));
    const store = await c.env.DB.prepare('SELECT subscription_ends_at FROM stores WHERE id = ?').bind(storeId).first() as any;
    if (!store) return c.json({ success: false, message: 'المتجر غير موجود' }, 404);

    const base = (store.subscription_ends_at && new Date(store.subscription_ends_at) > new Date())
      ? new Date(store.subscription_ends_at)
      : new Date();

    base.setMonth(base.getMonth() + 1);

    await c.env.DB.prepare(
      "UPDATE stores SET subscription_ends_at = ?, subscription_status = 'active', status = 'active', is_active = 1, updated_at = datetime('now') WHERE id = ?"
    ).bind(base.toISOString(), storeId).run();

    return c.json({ success: true, message: 'تم تمديد الاشتراك شهر إضافي بنجاح', ends_at: base.toISOString() });
  } catch (err: any) {
    console.error('[ADMIN] extend subscription error:', err?.message);
    return c.json({ success: false, error: err?.message }, 500);
  }
});

// ─── Admin Settings Page ──────────────────────────────────────
admin.get('/settings', async (c) => {
  const user = c.get('user')!;

  // Fetch current platform settings from database
  let settingsMap: Record<string, string> = {};
  try {
    const settingsRows = await c.env.DB.prepare('SELECT key, value FROM platform_settings').all() as any;
    if (settingsRows?.results) {
      for (const row of settingsRows.results) {
        settingsMap[row.key] = row.value;
      }
    }
  } catch (e) {}

  const platformName = settingsMap['platform_name'] || 'منصة سوق';
  const supportEmail = settingsMap['support_email'] || 'support@platform.com';
  const supportWhatsapp = settingsMap['support_whatsapp'] || '+967776461892';
  const defaultCurrency = settingsMap['default_currency'] || 'YER';
  const allowRegistrations = settingsMap['allow_registrations'] !== 'false' ? 'true' : 'false';
  const resendApiKey = settingsMap['resend_api_key'] || '';
  const senderEmail = settingsMap['sender_email'] || 'noreply@platform.com';
  
  return c.html(dashboardLayout('إعدادات المنصة', `
  <div class="max-w-4xl mx-auto space-y-6">
    <div>
      <h2 class="text-xl font-black text-main">إعدادات المنصة العامة</h2>
      <p class="text-sm text-mute mt-0.5">التحكم في إعدادات المنصة، التسجيل، وتهيئة النظام</p>
    </div>

    <div class="bg-card rounded-2xl border border-std shadow-sm overflow-hidden">
      <div class="p-6 border-b border-std">
        <h3 class="font-bold text-main text-base"><i class="fas fa-sliders-h ml-2 text-primary-500"></i>الإعدادات العامة</h3>
      </div>
      <form id="platformSettingsForm" class="p-6 space-y-4" onsubmit="saveSettings(event)">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-sub mb-1.5">اسم المنصة</label>
            <input type="text" id="platformName" value="${platformName}" required
              class="w-full px-4 py-2.5 border border-std rounded-xl text-sm bg-page text-main focus:ring-2 focus:ring-primary-300 outline-none">
          </div>
          <div>
            <label class="block text-sm font-medium text-sub mb-1.5">بريد الدعم الفني الرسمي</label>
            <input type="email" id="supportEmail" value="${supportEmail}" required
              class="w-full px-4 py-2.5 border border-std rounded-xl text-sm bg-page text-main focus:ring-2 focus:ring-primary-300 outline-none" dir="ltr">
          </div>
          <div>
            <label class="block text-sm font-medium text-sub mb-1.5">رقم واتساب الدعم الفني</label>
            <input type="text" id="supportWhatsapp" value="${supportWhatsapp}" required
              class="w-full px-4 py-2.5 border border-std rounded-xl text-sm bg-page text-main focus:ring-2 focus:ring-primary-300 outline-none" dir="ltr">
          </div>
          <div>
            <label class="block text-sm font-medium text-sub mb-1.5">العملة الافتراضية للمنصة</label>
            <select id="defaultCurrency" class="w-full px-4 py-2.5 border border-std rounded-xl text-sm bg-page text-main focus:ring-2 focus:ring-primary-300 outline-none">
              <option value="YER" ${defaultCurrency === 'YER' ? 'selected' : ''}>ريال يمني (YER)</option>
              <option value="SAR" ${defaultCurrency === 'SAR' ? 'selected' : ''}>ريال سعودي (SAR)</option>
              <option value="AED" ${defaultCurrency === 'AED' ? 'selected' : ''}>درهم إماراتي (AED)</option>
              <option value="USD" ${defaultCurrency === 'USD' ? 'selected' : ''}>دولار أمريكي (USD)</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-sub mb-1.5">حالة تسجيل التجار الجدد</label>
            <select id="allowRegistrations" class="w-full px-4 py-2.5 border border-std rounded-xl text-sm bg-page text-main focus:ring-2 focus:ring-primary-300 outline-none">
              <option value="true" ${allowRegistrations === 'true' ? 'selected' : ''}>مفتوح (يسمح للتجار بالاشتراك تلقائياً)</option>
              <option value="false" ${allowRegistrations === 'false' ? 'selected' : ''}>مغلق (تحت الصيانة / بدعوات فقط)</option>
            </select>
          </div>
        </div>

        <div class="border-t border-std pt-5 mt-5">
          <h4 class="font-bold text-main text-sm mb-3"><i class="fas fa-envelope-open-text ml-2 text-primary-500"></i>إعدادات خادم البريد (SMTP / Resend API)</h4>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-sub mb-1.5">مفتاح API الخاص بـ Resend</label>
              <input type="password" id="resendApiKey" value="${resendApiKey}" placeholder="re_************************" 
                class="w-full px-4 py-2.5 border border-std rounded-xl text-sm bg-page text-main focus:ring-2 focus:ring-primary-300 outline-none" dir="ltr">
            </div>
            <div>
              <label class="block text-sm font-medium text-sub mb-1.5">بريد الإرسال المعتمد (Sender Email)</label>
              <input type="text" id="senderEmail" value="${senderEmail}"
                class="w-full px-4 py-2.5 border border-std rounded-xl text-sm bg-page text-main focus:ring-2 focus:ring-primary-300 outline-none" dir="ltr">
            </div>
          </div>
        </div>

        <div class="border-t border-std pt-5 mt-5 flex justify-end">
          <button type="submit" id="saveSettingsBtn" class="px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl text-sm shadow-md transition-colors">
            <i class="fas fa-save ml-1.5"></i>حفظ الإعدادات
          </button>
        </div>
      </form>
    </div>
  </div>
  `, user, undefined, 'settings', `
  <script>
    async function saveSettings(e) {
      e.preventDefault();
      const submitBtn = document.getElementById('saveSettingsBtn');
      if (submitBtn) submitBtn.disabled = true;

      const payload = {
        platform_name: document.getElementById('platformName').value,
        support_email: document.getElementById('supportEmail').value,
        support_whatsapp: document.getElementById('supportWhatsapp').value,
        default_currency: document.getElementById('defaultCurrency').value,
        allow_registrations: document.getElementById('allowRegistrations').value,
        resend_api_key: document.getElementById('resendApiKey').value,
        sender_email: document.getElementById('senderEmail').value,
      };

      try {
        const res = await axios.put('/api/admin/settings', payload);
        showToast(res.data?.message || 'تم حفظ إعدادات المنصة بنجاح ⚡', 'success');
        setTimeout(() => location.reload(), 600);
      } catch (err) {
        showToast(err.response?.data?.message || err.response?.data?.error || 'خطأ في حفظ الإعدادات', 'error');
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    }
    window.saveSettings = saveSettings;
  </script>
  `));
});

admin.put('/settings', async (c) => {
  try {
    const body = await c.req.json() as Record<string, string>;
    for (const [key, value] of Object.entries(body)) {
      await c.env.DB.prepare(`
        INSERT INTO platform_settings (key, value, updated_at)
        VALUES (?, ?, datetime('now'))
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
      `).bind(key, String(value ?? '')).run();
    }
    return c.json({ success: true, message: 'تم حفظ إعدادات المنصة بنجاح ⚡' });
  } catch (err: any) {
    console.error('[ADMIN] PUT /settings error:', err?.message);
    return c.json({ success: false, error: err?.message }, 500);
  }
});

export default admin;
