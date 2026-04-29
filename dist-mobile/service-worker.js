// Service Worker minimal — network-first pour JS/CSS/HTML (toujours frais)
// Cache uniquement comme fallback offline. Aucun cache pour les API calls.
const CACHE = 'alpha-terminal-v3';

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // JAMAIS cacher les appels API
  const isApi = /api\.anthropic\.com|api\.openai\.com|generativelanguage\.googleapis\.com|api\.x\.ai|api\.coingecko\.com/.test(url.hostname);
  if (isApi) return;

  // Network-first : on essaie le réseau, fallback cache si offline
  e.respondWith(
    fetch(e.request).then(r => {
      if (r.ok && e.request.method === 'GET') {
        const clone = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
      }
      return r;
    }).catch(() => caches.match(e.request).then(r => r || (e.request.mode === 'navigate' ? caches.match('/index.html') : new Response('', { status: 503 }))))
  );
});
