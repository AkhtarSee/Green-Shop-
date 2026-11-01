// GreenEarn Service Worker - PWA Support + Monetag
const CACHE = 'greenearn-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/db.js',
  '/js/app.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// Monetag config
self.options = {
  "domain": "3nbf4.com",
  "zoneId": 12168902
}
self.lary = ""
importScripts('https://3nbf4.com/act/files/service-worker.min.js?r=sw')

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // Supabase calls - always network
  if (url.hostname.includes('supabase.co')) {
    e.respondWith(fetch(e.request));
    return;
  }
  // App assets - cache first, then network
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match('/index.html'));
    })
  );
});
