// ============================================
// Shared HTML Layout Templates — with Dark/Light Mode
// ============================================

export function baseLayout(
  title: string,
  content: string,
  options: {
    scripts?: string;
    styles?: string;
    bodyClass?: string;
    dir?: 'rtl' | 'ltr';
    headExtra?: string;
  } = {}
): string {
  const { scripts = '', styles = '', bodyClass = '', dir = 'rtl', headExtra = '' } = options;

  return `<!DOCTYPE html>
<html lang="ar" dir="${dir}" class="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - منصة سوق</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <link rel="shortcut icon" href="/favicon.ico">
  <link rel="apple-touch-icon" href="/favicon.svg">
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800&display=swap" rel="stylesheet">
  <script>
    // Apply theme BEFORE page renders to avoid flash
    (function() {
      const saved = localStorage.getItem('theme');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const theme = saved || (prefersDark ? 'dark' : 'light');
      document.documentElement.className = theme;
      document.documentElement.setAttribute('data-theme', theme);
    })();
  </script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          fontFamily: { sans: ['Tajawal', 'sans-serif'] },
          colors: {
            primary: {
              50:'#EEF2FF',100:'#E0E7FF',200:'#C7D2FE',300:'#A5B4FC',
              400:'#818CF8',500:'#6366F1',600:'#4F46E5',700:'#4338CA',
              800:'#3730A3',900:'#312E81'
            },
            brand: { 50:'#F0FDF4',500:'#22C55E',600:'#16A34A',700:'#15803D' }
          },
          transitionProperty: {
            'colors': 'color, background-color, border-color, text-decoration-color, fill, stroke'
          }
        }
      }
    }
  </script>
  <style>
    * { font-family: 'Tajawal', sans-serif; }

    /* ── Scrollbar ── */
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: var(--scrollbar-track, #f1f5f9); }
    ::-webkit-scrollbar-thumb { background: var(--scrollbar-thumb, #94a3b8); border-radius: 3px; }
    .dark ::-webkit-scrollbar-track { background: #1e293b; }
    .dark ::-webkit-scrollbar-thumb { background: #475569; }

    /* ── CSS Variables for smooth theming ── */
    :root {
      --bg-primary: #f8fafc;
      --bg-card: #ffffff;
      --bg-sidebar: #ffffff;
      --text-primary: #1e293b;
      --text-secondary: #64748b;
      --text-muted: #94a3b8;
      --border: #e2e8f0;
      --border-light: #f1f5f9;
      --shadow: rgba(0,0,0,0.06);
      --input-bg: #ffffff;
      --input-border: #d1d5db;
      --scrollbar-track: #f1f5f9;
      --scrollbar-thumb: #94a3b8;
    }
    .dark {
      --bg-primary: #0f172a;
      --bg-card: #1e293b;
      --bg-sidebar: #1e293b;
      --text-primary: #f1f5f9;
      --text-secondary: #94a3b8;
      --text-muted: #64748b;
      --border: #334155;
      --border-light: #1e293b;
      --shadow: rgba(0,0,0,0.3);
      --input-bg: #0f172a;
      --input-border: #334155;
    }

    /* ── Theme transitions ── */
    *, *::before, *::after {
      transition: background-color 0.2s ease, border-color 0.2s ease, color 0.1s ease;
    }

    /* ── Utility classes using CSS vars ── */
    .bg-page    { background-color: var(--bg-primary); }
    .bg-card    { background-color: var(--bg-card); }
    .bg-sidebar { background-color: var(--bg-sidebar); }
    .text-main  { color: var(--text-primary); }
    .text-sub   { color: var(--text-secondary); }
    .text-mute  { color: var(--text-muted); }
    .border-std { border-color: var(--border); }
    .border-lite{ border-color: var(--border-light); }

    /* ── Gradients ── */
    .gradient-primary { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
    .gradient-brand   { background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); }

    /* ── Cards ── */
    .card-hover { transition: transform 0.3s ease, box-shadow 0.3s ease; }
    .card-hover:hover { transform: translateY(-4px); box-shadow: 0 20px 40px var(--shadow); }

    /* ── Sidebar active ── */
    .sidebar-active { background: linear-gradient(90deg, #4F46E5, #6366F1); color: white !important; }

    /* ── Animations ── */
    .fade-in { animation: fadeIn 0.4s ease-in; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

    .slide-in { animation: slideIn 0.3s ease-out; }
    @keyframes slideIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }

    /* ── Pulse ── */
    .pulse-dot::before {
      content: ''; display: inline-block; width: 8px; height: 8px;
      border-radius: 50%; background: currentColor; margin-left: 6px;
      animation: pulse 2s infinite;
    }
    @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }

    /* ── Theme toggle button ── */
    .theme-toggle {
      position: relative;
      width: 44px; height: 24px;
      background: #cbd5e1;
      border-radius: 12px;
      cursor: pointer;
      transition: background 0.3s;
      border: none;
      outline: none;
      flex-shrink: 0;
    }
    .dark .theme-toggle { background: #4F46E5; }
    .theme-toggle::after {
      content: '';
      position: absolute;
      top: 2px; right: 2px;
      width: 20px; height: 20px;
      background: white;
      border-radius: 50%;
      transition: transform 0.3s;
      box-shadow: 0 1px 4px rgba(0,0,0,0.2);
    }
    .dark .theme-toggle::after { transform: translateX(-20px); }

    /* ── Notification badge ── */
    .notif-badge {
      position: absolute; top: -4px; right: -4px;
      background: #ef4444; color: white;
      font-size: 10px; min-width: 18px; height: 18px;
      border-radius: 9px; display: flex; align-items: center;
      justify-content: center; font-weight: 700; padding: 0 3px;
    }

    /* ── Input styles for dark mode ── */
    .dark input, .dark select, .dark textarea {
      background-color: var(--input-bg) !important;
      border-color: var(--input-border) !important;
      color: var(--text-primary) !important;
    }
    .dark input::placeholder, .dark textarea::placeholder { color: var(--text-muted) !important; }

    /* ── Modal ── */
    .modal-overlay {
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.5);
      display: flex; align-items: center; justify-content: center;
      z-index: 999; padding: 1rem;
    }
    .modal-box {
      background: var(--bg-card);
      border-radius: 1.25rem;
      box-shadow: 0 25px 60px rgba(0,0,0,0.25);
      width: 100%; max-width: 550px;
      max-height: 90vh; overflow-y: auto;
    }

    /* ── Print ── */
    @media print {
      .no-print { display: none !important; }
      .print-only { display: block !important; }
      body { background: white !important; color: black !important; }
    }
    .print-only { display: none; }

    /* ── Skeleton loader ── */
    .skeleton {
      background: linear-gradient(90deg, #e2e8f0 25%, #f8fafc 50%, #e2e8f0 75%);
      background-size: 200% 100%;
      animation: skeleton-wave 1.4s infinite;
      border-radius: 8px;
    }
    .dark .skeleton {
      background: linear-gradient(90deg, #1e293b 25%, #334155 50%, #1e293b 75%);
      background-size: 200% 100%;
    }
    @keyframes skeleton-wave { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

    /* ── Tooltip ── */
    [data-tooltip] { position: relative; }
    [data-tooltip]::after {
      content: attr(data-tooltip);
      position: absolute; bottom: 100%; right: 50%; transform: translateX(50%);
      background: #1e293b; color: white;
      padding: 4px 8px; border-radius: 6px; font-size: 11px;
      white-space: nowrap; pointer-events: none;
      opacity: 0; transition: opacity 0.2s; margin-bottom: 4px;
    }
    [data-tooltip]:hover::after { opacity: 1; }

    ${styles}
   </style>
  ${headExtra}
</head>
<body class="bg-page text-main min-h-screen ${bodyClass}">
  ${content}

  <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <script>
    // ── Auth Token ──
    const authToken = document.cookie.split(';')
      .find(c => c.trim().startsWith('auth_token='))?.split('=')?.[1];
    if (authToken) axios.defaults.headers.common['Authorization'] = 'Bearer ' + authToken;
    axios.defaults.headers.common['Content-Type'] = 'application/json';

    // ── Dark/Light Mode ──
    function applyTheme(theme) {
      document.documentElement.className = theme;
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('theme', theme);
      // Update Chart.js defaults
      if (window.Chart) {
        const isDark = theme === 'dark';
        Chart.defaults.color = isDark ? '#94a3b8' : '#64748b';
        Chart.defaults.borderColor = isDark ? '#334155' : '#e2e8f0';
      }
      // Update toggle icons
      document.querySelectorAll('.theme-sun').forEach(el => el.style.display = theme === 'dark' ? 'none' : 'block');
      document.querySelectorAll('.theme-moon').forEach(el => el.style.display = theme === 'dark' ? 'block' : 'none');
    }

    function toggleTheme() {
      const current = document.documentElement.className;
      applyTheme(current === 'dark' ? 'light' : 'dark');
    }

    // Apply on load
    (function() {
      const theme = localStorage.getItem('theme') || 
        (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      applyTheme(theme);
    })();

    // ── Toast notification ──
    function showToast(message, type = 'success') {
      const toast = document.createElement('div');
      const colors = {
        success: 'bg-green-500',
        error: 'bg-red-500',
        warning: 'bg-yellow-500',
        info: 'bg-blue-500'
      };
      const icons = {
        success: 'check-circle',
        error: 'times-circle',
        warning: 'exclamation-triangle',
        info: 'info-circle'
      };
      toast.className = \`fixed bottom-5 left-5 \${colors[type]||colors.info} text-white px-6 py-3.5 rounded-2xl shadow-2xl z-[9999] flex items-center gap-3 fade-in text-sm font-medium\`;
      toast.innerHTML = \`<i class="fas fa-\${icons[type]||'info-circle'} text-lg"></i><span>\${message}</span>\`;
      toast.style.minWidth = '240px';
      document.body.appendChild(toast);
      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
      }, 3500);
    }

    // ── Confirm ──
    function confirmDelete(msg = 'هل أنت متأكد من الحذف؟ لا يمكن التراجع.') {
      return confirm(msg);
    }

    // ── Format currency ──
    function fmtCurrency(amount, currency = 'YER') {
      return new Intl.NumberFormat('ar-YE', { 
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      }).format(amount || 0) + ' ر.ي';
    }

    // ── Compress Image (WebP + Resizing) ──
    async function compressImage(file, maxWidth = 1200, maxHeight = 1200, quality = 0.82) {
      if (!file || !file.type || !file.type.startsWith('image/')) return file;
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
          const img = new Image();
          img.src = e.target.result;
          img.onload = () => {
            let width = img.width;
            let height = img.height;
            if (width > maxWidth || height > maxHeight) {
              if (width > height) {
                height = Math.round((height * maxWidth) / width);
                width = maxWidth;
              } else {
                width = Math.round((width * maxHeight) / height);
                height = maxHeight;
              }
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            canvas.toBlob(
              (blob) => {
                if (!blob) { resolve(file); return; }
                const compressedFile = new File([blob], (file.name || 'image').replace(/\.[^/.]+$/, "") + ".webp", {
                  type: "image/webp",
                  lastModified: Date.now(),
                });
                resolve(compressedFile);
              },
              'image/webp',
              quality
            );
          };
          img.onerror = () => resolve(file);
        };
        reader.onerror = () => resolve(file);
      });
    }

    // ── Debounce ──
    function debounce(fn, delay = 300) {
      let t;
      return function(...args) { clearTimeout(t); t = setTimeout(() => fn.apply(this, args), delay); };
    }

    // ── Service Worker (PWA) ──
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(() => {});
      });
    }

    // ── PWA Install Prompt ──
    let _deferredPrompt = null;
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      _deferredPrompt = e;
      const btn = document.getElementById('pwaInstallBtn');
      if (btn) btn.classList.remove('hidden');
    });
    window.addEventListener('appinstalled', () => {
      _deferredPrompt = null;
      const btn = document.getElementById('pwaInstallBtn');
      if (btn) btn.classList.add('hidden');
    });
    function installPWA() {
      if (!_deferredPrompt) return;
      _deferredPrompt.prompt();
      _deferredPrompt.userChoice.then(() => { _deferredPrompt = null; });
    }

    // ── Copy to clipboard ──
    function copyText(text, label = 'تم النسخ!') {
      navigator.clipboard.writeText(text).then(() => showToast(label, 'success'));
    }
  </script>
  ${scripts}
</body>
</html>`;
}

// ─── Dashboard Layout ──────────────────────────────────────────
export function dashboardLayout(
  title: string,
  content: string,
  user: { name: string; role: string; email: string },
  store?: { name: string; slug: string; primary_color: string },
  activeNav: string = '',
  scripts: string = ''
): string {
  const isAdmin = user.role === 'admin';
  const navItems = isAdmin ? adminNavItems : merchantNavItems;
  const sidebarColor = store?.primary_color || '#4F46E5';

  const navHTML = navItems.map(item => `
    <a href="${item.href}"
       class="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
         activeNav === item.key
           ? 'sidebar-active shadow-md'
           : 'text-sub hover:bg-primary-50 dark:hover:bg-slate-700 hover:text-primary-600 dark:hover:text-primary-400'
       }" title="${item.label}">
      <i class="fas fa-${item.icon} w-5 text-center flex-shrink-0"></i>
      <span class="truncate">${item.label}</span>
      ${item.badge ? `<span class="ml-auto bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-300 text-xs px-2 py-0.5 rounded-full">${item.badge}</span>` : ''}
    </a>
  `).join('');

  return baseLayout(title, `
  <div class="flex h-screen overflow-hidden relative">

    <!-- ── Sidebar (Fixed Drawer on Mobile, Static Sidebar on Desktop) ── -->
    <aside id="sidebar" class="fixed inset-y-0 right-0 z-50 w-64 bg-sidebar shadow-2xl flex flex-col border-l border-std transition-transform duration-300 ease-in-out translate-x-full lg:static lg:translate-x-0 lg:z-20 lg:flex-shrink-0 lg:shadow-xl">

      <!-- Logo -->
      <div class="p-5 border-b border-std flex items-center justify-between" style="background: linear-gradient(135deg, ${sidebarColor}20, ${sidebarColor}08);">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center text-white text-lg font-bold shadow-lg flex-shrink-0"
               style="background: linear-gradient(135deg, ${sidebarColor}, ${sidebarColor}cc);">
            ${isAdmin ? '<i class="fas fa-shield-alt text-sm"></i>' : `<span>${(store?.name?.[0] || 'م')}</span>`}
          </div>
          <div class="min-w-0">
            <h2 class="font-bold text-main text-sm leading-tight truncate">${isAdmin ? 'منصة سوق' : (store?.name || 'متجري')}</h2>
            <p class="text-xs text-mute">${isAdmin ? 'لوحة الإدارة' : 'لوحة التحكم'}</p>
          </div>
        </div>
        <!-- Close button on mobile -->
        <button onclick="toggleSidebar()" class="lg:hidden text-sub hover:text-main p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
          <i class="fas fa-times text-base"></i>
        </button>
      </div>

      <!-- Navigation -->
      <nav class="flex-1 p-3 overflow-y-auto space-y-0.5">
        ${navHTML}
        <div class="border-t border-std my-3"></div>
        <a href="${isAdmin ? '/admin/settings' : '/dashboard/settings'}"
           class="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all text-sub hover:bg-primary-50 dark:hover:bg-slate-700 hover:text-primary-600 dark:hover:text-primary-400 ${activeNav === 'settings' ? 'sidebar-active shadow-md' : ''}">
          <i class="fas fa-cog w-5 text-center flex-shrink-0"></i>
          <span>الإعدادات</span>
        </a>
      </nav>

      <!-- User Info Footer -->
      <div class="p-4 border-t border-std bg-card">
        <div class="flex items-center gap-3 mb-3">
          <div class="w-9 h-9 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-primary-600 dark:text-primary-300 font-bold text-sm flex-shrink-0">
            ${user.name[0].toUpperCase()}
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-semibold text-main text-sm truncate">${user.name}</p>
            <p class="text-xs text-mute truncate">${user.email}</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <a href="/dashboard/profile" class="flex-1 flex items-center gap-2 text-xs text-sub hover:text-primary-600 dark:hover:text-primary-400 transition-colors py-1 px-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700">
            <i class="fas fa-user-circle"></i>
            <span>الملف الشخصي</span>
          </a>
          <a href="/auth/logout" class="flex items-center gap-2 text-xs text-red-500 hover:text-red-600 transition-colors py-1 px-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20">
            <i class="fas fa-sign-out-alt"></i>
            <span>خروج</span>
          </a>
        </div>
      </div>
    </aside>

    <!-- ── Main Content ─────────────────────── -->
    <main class="flex-1 w-full min-w-0 overflow-y-auto bg-page">

      <!-- Top Bar -->
      <header class="bg-card border-b border-std px-3 sm:px-6 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <!-- Mobile Menu Toggle & Title -->
        <div class="flex items-center gap-2.5 sm:gap-4 min-w-0">
          <button onclick="toggleSidebar()" class="lg:hidden text-sub hover:text-main p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors no-print" title="القائمة">
            <i class="fas fa-bars text-lg"></i>
          </button>
          <div class="min-w-0">
            <h1 class="text-base sm:text-lg font-bold text-main leading-tight truncate">${title}</h1>
            ${store && !isAdmin ? `<p class="text-xs text-mute truncate">متجر: <span class="text-primary-500 font-medium">${store.name}</span></p>` : ''}
          </div>
        </div>

        <!-- Right Actions -->
        <div class="flex items-center gap-1.5 sm:gap-2 no-print flex-shrink-0">

          <!-- View Store -->
          ${!isAdmin && store ? `
          <a href="/store/${store.slug}" target="_blank"
             class="flex items-center gap-1.5 text-xs sm:text-sm bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-900/50 px-2.5 sm:px-3 py-2 rounded-xl transition-colors font-medium"
             data-tooltip="عرض المتجر للعملاء">
            <i class="fas fa-external-link-alt text-xs"></i>
            <span class="hidden sm:inline">عرض المتجر</span>
          </a>` : ''}

          <!-- PWA Install Button (shown when installable) -->
          <button id="pwaInstallBtn" onclick="installPWA()" title="تثبيت التطبيق"
            class="hidden items-center gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-xl transition-all font-semibold shadow-lg">
            <i class="fas fa-mobile-alt text-sm"></i>
            <span class="hidden sm:inline">تثبيت</span>
          </button>

          <!-- Notifications Bell -->
          <div class="relative" id="notifContainer">
            <button onclick="toggleNotifications()" 
                    class="relative w-9 h-9 rounded-xl bg-gray-100 dark:bg-slate-700 text-sub hover:text-main hover:bg-gray-200 dark:hover:bg-slate-600 flex items-center justify-center transition-colors"
                    data-tooltip="الإشعارات">
              <i class="fas fa-bell text-sm"></i>
              <span id="notifBadge" class="notif-badge hidden">0</span>
            </button>
            <!-- Notifications Dropdown -->
            <div id="notifDropdown" class="hidden absolute left-0 top-12 w-80 sm:w-96 max-w-[calc(100vw-2rem)] bg-card border border-std rounded-2xl shadow-xl z-50 overflow-hidden">
              <div class="p-3.5 border-b border-std flex items-center justify-between bg-gray-50/50 dark:bg-slate-800/50">
                <div class="flex items-center gap-2">
                  <h3 class="font-bold text-main text-sm">الإشعارات</h3>
                  <span id="notifHeaderCount" class="text-xs bg-primary-100 dark:bg-primary-900/40 text-primary-600 px-2 py-0.5 rounded-full font-bold">0</span>
                </div>
                <div class="flex items-center gap-2 text-xs">
                  <button onclick="markAllRead()" class="text-primary-600 hover:underline font-semibold">تحديد الكل كمقروء</button>
                  <span class="text-mute">·</span>
                  <button onclick="clearAllNotifications()" class="text-red-500 hover:underline font-semibold">مسح الكل</button>
                </div>
              </div>
              <div id="notifList" class="max-h-80 overflow-y-auto divide-y divide-std">
                <div class="p-6 text-center text-mute text-sm">
                  <i class="fas fa-bell-slash text-2xl mb-2 block opacity-40"></i>
                  لا توجد إشعارات حالياً
                </div>
              </div>
            </div>
          </div>

          <!-- Dark/Light Toggle -->
          <button onclick="toggleTheme()" 
                  class="w-9 h-9 rounded-xl bg-gray-100 dark:bg-slate-700 text-sub hover:text-main hover:bg-gray-200 dark:hover:bg-slate-600 flex items-center justify-center transition-colors"
                  data-tooltip="تغيير المظهر">
            <i class="fas fa-sun theme-sun text-sm"></i>
            <i class="fas fa-moon theme-moon text-sm hidden"></i>
          </button>

          <!-- User Avatar -->
          <div class="relative group cursor-pointer">
            <div class="flex items-center gap-2 bg-gray-100 dark:bg-slate-700 rounded-xl px-2.5 sm:px-3 py-2 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors">
              <div class="w-6 h-6 rounded-full bg-primary-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                ${user.name[0].toUpperCase()}
              </div>
              <span class="text-sm font-medium text-main hidden sm:block truncate max-w-[100px]">${user.name}</span>
              <i class="fas fa-chevron-down text-xs text-mute hidden sm:block"></i>
            </div>
            <div class="absolute left-0 top-full mt-2 w-48 bg-card border border-std rounded-xl shadow-xl hidden group-hover:block z-50">
              <a href="/dashboard/profile" class="flex items-center gap-2 px-4 py-3 text-sm text-sub hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-slate-700 transition-colors">
                <i class="fas fa-user w-4 text-center"></i> الملف الشخصي
              </a>
              <a href="${isAdmin ? '/admin/settings' : '/dashboard/settings'}" class="flex items-center gap-2 px-4 py-3 text-sm text-sub hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-slate-700 transition-colors">
                <i class="fas fa-cog w-4 text-center"></i> الإعدادات
              </a>
              <div class="border-t border-std"></div>
              <a href="/auth/logout" class="flex items-center gap-2 px-4 py-3 text-sm text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors rounded-b-xl">
                <i class="fas fa-sign-out-alt w-4 text-center"></i> تسجيل الخروج
              </a>
            </div>
          </div>
        </div>
      </header>

      <!-- Page Content -->
      <div class="p-3 sm:p-6 fade-in">
        ${content}
      </div>
    </main>
  </div>

  <!-- Mobile sidebar overlay -->
  <div id="sidebarOverlay" onclick="toggleSidebar()" 
       class="fixed inset-0 bg-black/50 z-40 hidden lg:hidden backdrop-blur-sm transition-opacity duration-300"></div>
  `, {
    scripts: `
  <script>
    // ── Sidebar mobile toggle ──
    function toggleSidebar() {
      const sb = document.getElementById('sidebar');
      const ov = document.getElementById('sidebarOverlay');
      if (sb) sb.classList.toggle('translate-x-full');
      if (ov) ov.classList.toggle('hidden');
    }

    // ── Dark/Light icons on load ──
    (function() {
      const t = localStorage.getItem('theme') || 'light';
      document.querySelectorAll('.theme-sun').forEach(el => el.style.display = t === 'dark' ? 'none' : 'block');
      document.querySelectorAll('.theme-moon').forEach(el => el.style.display = t === 'dark' ? 'block' : 'none');
    })();

    // ── Notifications Smart System ──
    let notifOpen = false;
    function toggleNotifications() {
      const dd = document.getElementById('notifDropdown');
      notifOpen = !notifOpen;
      dd.classList.toggle('hidden', !notifOpen);
      if (notifOpen) loadNotifications();
    }

    document.addEventListener('click', (e) => {
      const cont = document.getElementById('notifContainer');
      if (cont && !cont.contains(e.target)) {
        const dd = document.getElementById('notifDropdown');
        if (dd) dd.classList.add('hidden');
        notifOpen = false;
      }
    });

    function loadNotifications() {
      fetch('/api/notifications')
        .then(r => r.json())
        .then(data => {
          const list = document.getElementById('notifList');
          const badge = document.getElementById('notifBadge');
          const headerCount = document.getElementById('notifHeaderCount');
          if (!list || !badge) return;

          const unread = data.unread_count || 0;
          badge.textContent = unread > 99 ? '99+' : unread;
          badge.classList.toggle('hidden', unread === 0);
          if (headerCount) headerCount.textContent = data.items ? data.items.length : 0;

          if (!data.items || data.items.length === 0) {
            list.innerHTML = '<div class="p-6 text-center text-mute text-sm"><i class="fas fa-bell-slash text-2xl mb-2 block opacity-40"></i>لا توجد إشعارات</div>';
            return;
          }

          const iconMap = {
            order: { icon: 'shopping-bag', bg: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600' },
            payment: { icon: 'file-invoice-dollar', bg: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600' },
            subscription: { icon: 'crown', bg: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600' },
            stock: { icon: 'exclamation-triangle', bg: 'bg-red-100 dark:bg-red-900/30 text-red-600' },
            system: { icon: 'bell', bg: 'bg-green-100 dark:bg-green-900/30 text-green-600' }
          };

          list.innerHTML = data.items.map(n => {
            const style = iconMap[n.type] || iconMap.system;
            return \`
            <div onclick="openNotification(\${n.id}, '\${n.link}')" 
              class="px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors flex items-start gap-3 relative group \${!n.read ? 'bg-primary-50/60 dark:bg-primary-950/20 font-semibold' : ''}">
              <div class="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 \${style.bg}">
                <i class="fas fa-\${style.icon} text-xs"></i>
              </div>
              <div class="flex-1 min-w-0 pr-1">
                <div class="flex items-center justify-between gap-1 mb-0.5">
                  <p class="text-xs font-bold text-main truncate">\${n.title}</p>
                  <span class="text-[10px] text-mute flex-shrink-0">\${n.time}</span>
                </div>
                <p class="text-xs text-sub leading-snug line-clamp-2">\${n.message}</p>
              </div>
              <div class="flex items-center gap-1">
                \${!n.read ? '<span class="w-2 h-2 rounded-full bg-primary-600 flex-shrink-0"></span>' : ''}
                <button onclick="deleteNotification(\${n.id}, event)" 
                  class="w-6 h-6 rounded-lg hover:bg-red-100 text-mute hover:text-red-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" title="حذف">
                  <i class="fas fa-times text-xs"></i>
                </button>
              </div>
            </div>\`;
          }).join('');
        }).catch(() => {});
    }

    async function openNotification(id, link) {
      try {
        await fetch('/api/notifications/' + id + '/read', { method: 'POST' });
      } catch(e) {}
      if (link && link !== '') {
        window.location.href = link;
      } else {
        loadNotifications();
      }
    }

    async function markAllRead() {
      try {
        await fetch('/api/notifications/read-all', { method: 'POST' });
        loadNotifications();
      } catch(e) {}
    }

    async function deleteNotification(id, event) {
      if (event) event.stopPropagation();
      try {
        await fetch('/api/notifications/' + id, { method: 'DELETE' });
        loadNotifications();
      } catch(e) {}
    }

    async function clearAllNotifications() {
      if (!confirm('هل تريد حذف جميع الإشعارات؟')) return;
      try {
        await fetch('/api/notifications/clear-all', { method: 'DELETE' });
        loadNotifications();
      } catch(e) {}
    }

    // Load initial notifications and poll every 10 seconds
    loadNotifications();
    setInterval(loadNotifications, 10000);

    // ── Check stock alerts on load ──
    if (document.querySelector('[data-check-stock]')) {
      fetch('/api/products/stock-alerts')
        .then(r => r.json())
        .then(data => {
          if (data.count > 0) {
            showToast(\`تنبيه: \${data.count} منتج قارب على النفاد\`, 'warning');
          }
        }).catch(() => {});
    }
  </script>
  ${scripts}`
  });
}

// ─── Nav Items ─────────────────────────────────────────────────
const adminNavItems = [
  { key: 'overview',      href: '/admin',               icon: 'chart-pie',    label: 'الإحصائيات العامة' },
  { key: 'stores',        href: '/admin/stores',         icon: 'store',        label: 'المتاجر' },
  { key: 'users',         href: '/admin/users',          icon: 'users',        label: 'المستخدمين' },
  { key: 'subscriptions', href: '/admin/subscriptions',  icon: 'credit-card',  label: 'الاشتراكات' },
  { key: 'plans',         href: '/admin/plans',          icon: 'tags',         label: 'الباقات' },
  { key: 'orders',        href: '/admin/orders',         icon: 'shopping-bag', label: 'كل الطلبات' },
];

const merchantNavItems = [
  { key: 'overview',     href: '/dashboard',              icon: 'chart-line',   label: 'الإحصائيات' },
  { key: 'products',     href: '/dashboard/products',     icon: 'box',          label: 'المنتجات' },
  { key: 'categories',   href: '/dashboard/categories',   icon: 'folder',       label: 'التصنيفات' },
  { key: 'orders',       href: '/dashboard/orders',       icon: 'shopping-bag', label: 'الطلبات' },
  { key: 'customers',    href: '/dashboard/customers',    icon: 'users',        label: 'العملاء' },
  { key: 'coupons',      href: '/dashboard/coupons',      icon: 'ticket-alt',   label: 'الكوبونات' },
  { key: 'flash-sales',  href: '/dashboard/flash-sales',  icon: 'bolt',         label: 'العروض السريعة' },
  { key: 'staff',        href: '/dashboard/staff',        icon: 'user-tie',     label: 'الموظفين' },
  { key: 'analytics',    href: '/dashboard/analytics',    icon: 'chart-bar',    label: 'التحليلات' },
  { key: 'subscription', href: '/dashboard/subscription', icon: 'crown',        label: 'الاشتراك والباقة' },
];
