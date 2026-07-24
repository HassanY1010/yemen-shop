// ============================================
// PWA Service Worker — Yemen Shop Platform v3
// Full Offline Support & 100/100 PWA Compliance
// ============================================

const CACHE_VERSION = 'yemen-shop-v3';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;
const API_CACHE = `${CACHE_VERSION}-api`;

const PRECACHE_ASSETS = [
  '/',
  '/manifest.json',
  '/offline.html',
  '/pwa-icon.png',
  '/favicon.ico',
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800&display=swap',
  'https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return Promise.allSettled(
        PRECACHE_ASSETS.map(url =>
          fetch(url, { mode: 'no-cors' })
            .then(res => cache.put(url, res))
            .catch(err => console.warn('[PWA SW Pre-cache Warning]', url, err))
        )
      );
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter(k => k !== STATIC_CACHE && k !== DYNAMIC_CACHE && k !== API_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  let url;
  try {
    url = new URL(req.url);
  } catch (e) {
    return;
  }

  if (!url.protocol.startsWith('http')) return;
  if (req.method !== 'GET') return;

  const isHTMLRequest = req.mode === 'navigate' ||
                        req.headers.get('accept')?.includes('text/html') ||
                        url.pathname === '/' ||
                        url.pathname.startsWith('/dashboard') ||
                        url.pathname.startsWith('/admin') ||
                        url.pathname.startsWith('/store/');

  if (isHTMLRequest) {
    event.respondWith(
      fetch(req)
        .then(networkRes => {
          if (networkRes.status === 200) {
            const clone = networkRes.clone();
            caches.open(DYNAMIC_CACHE).then(cache => cache.put(req, clone));
          }
          return networkRes;
        })
        .catch(async () => {
          const cachedRes = await caches.match(req);
          if (cachedRes) return cachedRes;
          const offlinePage = await caches.match('/offline.html');
          return offlinePage || new Response('<h1>غير متصل بالإنترنت</h1><p>يرجى التحقق من اتصالك بالشبكة وإعادة المحاولة.</p>', {
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
          });
        })
    );
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(req)
        .then(networkRes => {
          if (networkRes.ok) {
            const clone = networkRes.clone();
            caches.open(API_CACHE).then(cache => cache.put(req, clone));
          }
          return networkRes;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(cachedRes => {
      if (cachedRes) return cachedRes;
      return fetch(req).then(networkRes => {
        if (networkRes.ok) {
          const clone = networkRes.clone();
          caches.open(STATIC_CACHE).then(cache => cache.put(req, clone));
        }
        return networkRes;
      }).catch(() => new Response('', { status: 404 }));
    })
  );
});

self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    event.waitUntil(
      self.registration.showNotification(data.title || 'منصة سوق اليمن', {
        body: data.body || 'لديك إشعار جديد في حسابك',
        icon: '/pwa-icon.png',
        badge: '/pwa-icon.png',
        dir: 'rtl',
        lang: 'ar',
        tag: data.tag || 'yemen-shop-notif',
        data: { url: data.url || '/dashboard' },
        vibrate: [200, 100, 200],
        actions: [
          { action: 'open', title: 'فتح التفاصيل' },
          { action: 'dismiss', title: 'إغلاق' }
        ]
      })
    );
  } catch (e) {}
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;
  const targetUrl = event.notification.data?.url || '/dashboard';
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});
