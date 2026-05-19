// Green Shop PWA Service Worker
// Version 1.0 — Giridih, Jharkhand

const CACHE_NAME = 'greenshop-v1';
const OFFLINE_URL = '/Green-Shop-/offline.html';

const ASSETS_TO_CACHE = [
  '/Green-Shop-/',
  '/Green-Shop-/index.html',
  '/Green-Shop-/manifest.json',
  '/Green-Shop-/offline.html',
];

// Install — cache important files
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Green Shop PWA...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.log('[SW] Cache addAll error (some files may not exist yet):', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Green Shop PWA...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch — serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match(OFFLINE_URL);
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return response;
      });
    })
  );
});

// Push Notifications
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Green Shop 🛒';
  const options = {
    body: data.body || 'Naya offer aaya hai! Check karo!',
    icon: '/Green-Shop-/icon-192.png',
    badge: '/Green-Shop-/icon-192.png',
    vibrate: [100, 50, 100],
    data: { url: data.url || '/Green-Shop-/' },
    actions: [
      { action: 'shop', title: '🛒 Shop Now' },
      { action: 'game', title: '🎮 Play Game' }
    ]
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification Click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data.url || '/Green-Shop-/';
  event.waitUntil(clients.openWindow(url));
});
