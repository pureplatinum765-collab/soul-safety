const CACHE_NAME = 'soul-safety-v4';
const ASSETS = [
  '/',
  '/index.html',
  '/base.css',
  '/style.css',
  '/game.css',
  '/minigames.css',
  '/app.js',
  '/game.js',
  '/minigames.js',
  '/manifest.json',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

async function networkThenCache(request) {
  try {
    const fresh = await fetch(request);
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, fresh.clone());
    return fresh;
  } catch {
    return caches.match(request) || caches.match('/index.html');
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  // Keep API live when possible, with cache fallback only when offline.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/.netlify/')) {
    event.respondWith(fetch(request).catch(() => caches.match(request)));
    return;
  }

  // For navigations, prefer network to avoid stale shells hiding latest content.
  if (request.mode === 'navigate') {
    event.respondWith(networkThenCache(request));
    return;
  }

  // Static assets: cache first, then network.
  event.respondWith(
    caches.match(request).then((cached) => cached || networkThenCache(request))
  );
});
