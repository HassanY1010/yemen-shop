// ============================================
// PWA Service Worker — Souq Merchant Dashboard
// Cache-first for static assets, network-first for API
// ============================================

const CACHE_VERSION = 'souq-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const API_CACHE = `${CACHE_VERSION}-api`;

const STATIC_ASSETS = [
  '/dashboard',
  '/dashboard/orders',
  '/dashboard/products',
  '/static/offline.html',
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800&display=swap',
];

// ── Install: cache static assets ──────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      // Don't fail if some assets can't be cached
      return Promise.allSettled(
        STATIC_ASSETS.map(url => cache.add(url).catch(() => {}))
      );
    }).then(() => self.skipWaiting())
  );
});

// ── Activate: clean old caches ────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter(k => k !== STATIC_CACHE && k !== API_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: smart caching strategy ─────────────────────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET, cross-origin auth, and POST requests
  if (event.request.method !== 'GET') return;
  if (url.pathname.startsWith('/auth/')) return;
  
  // Skip storefront dynamic pages and uploaded assets
  if (url.pathname.startsWith('/store/')) return;
  if (url.pathname.startsWith('/uploads/')) return;
  if (url.pathname === '/') return;

  // API routes — network first, fallback to cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(API_CACHE).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Dashboard pages — network first with cache fallback + offline page
  if (url.pathname.startsWith('/dashboard')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(event.request).then(cached =>
            cached || caches.match('/static/offline.html')
          )
        )
    );
    return;
  }

  // Static assets — cache first
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(STATIC_CACHE).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});

// ── Push Notifications ────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'طلب جديد!', {
      body: data.body || 'لديك طلب جديد في متجرك',
      icon: '/static/pwa/icon-192.png',
      badge: '/static/pwa/icon-192.png',
      dir: 'rtl',
      lang: 'ar',
      tag: data.tag || 'new-order',
      data: { url: data.url || '/dashboard/orders' },
      vibrate: [200, 100, 200],
      actions: [
        { action: 'view', title: 'عرض الطلب' },
        { action: 'dismiss', title: 'تجاهل' }
      ]
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;
  const url = event.notification.data?.url || '/dashboard/orders';
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes('/dashboard') && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
