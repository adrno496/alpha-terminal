// Service Worker v18 — network-first pour HTML/navigation (toujours frais),
// cache-first pour JS/CSS/JSON/images (offline + rapide). Aucun cache pour les API calls.
const CACHE = 'alpha-terminal-v18';

// Liste des assets pré-cachés au install pour fonctionner 100% offline.
// Inclut HTML pages SEO + JS modules core + datasets JSON.
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/styles.css',
  '/icons/logo.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  // Pré-cache les ressources critiques. .catch silencieux : si une URL est manquante,
  // on continue plutôt que de faire échouer toute l'installation.
  e.waitUntil(
    caches.open(CACHE).then(cache =>
      Promise.all(PRECACHE_URLS.map(url => cache.add(url).catch(err => console.warn('[SW] precache fail:', url, err))))
    )
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Détecte les URLs API LLM qui ne doivent JAMAIS être cachées.
function isApiCall(url) {
  return /api\.anthropic\.com|api\.openai\.com|generativelanguage\.googleapis\.com|api\.x\.ai|api\.coingecko\.com|api\.frankfurter\.dev|api\.cohere|api\.mistral|api\.cerebras|api\.together|api-inference\.huggingface|gateway\.ai\.cloudflare|integrate\.api\.nvidia|models\.github\.ai|openrouter\.ai|api\.perplexity|metals-api\.com|stlouisfed\.org|financialmodelingprep|finnhub\.io|polygon\.io|alphavantage|tiingo|twelvedata|youtube\.com\/api/.test(url.hostname);
}

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // 1. Jamais cacher les APIs (LLM, data providers)
  if (isApiCall(url)) return;
  // 2. Cross-origin (CDN fonts, jsPDF, etc.) : laisser passer sans cache
  if (url.origin !== location.origin) return;

  // 3a. NETWORK-FIRST pour HTML / navigation : toujours servir la version fraîche.
  //     Évite les bugs de "vieux index.html servi" après une mise à jour.
  const isHTML = /\.html$/i.test(url.pathname) || url.pathname === '/' || e.request.mode === 'navigate';
  if (isHTML && e.request.method === 'GET') {
    e.respondWith(
      fetch(e.request).then(r => {
        if (r.ok) {
          const clone = r.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return r;
      }).catch(() => caches.match(e.request).then(c => c || caches.match('/index.html') || new Response('Offline', { status: 503 })))
    );
    return;
  }

  // 3b. Stratégie cache-first pour les assets statiques (JS, CSS, JSON, images, fonts)
  //     → app marche 100% offline + chargement instantané.
  const isStaticAsset = /\.(js|mjs|css|json|png|jpg|jpeg|svg|webp|gif|ico|woff2?|ttf|eot)$/i.test(url.pathname);

  if (isStaticAsset && e.request.method === 'GET') {
    e.respondWith(
      caches.match(e.request).then(cached => {
        // Cache hit : retourne immédiat + fetch en background pour rafraîchir
        if (cached) {
          fetch(e.request).then(r => {
            if (r.ok) caches.open(CACHE).then(c => c.put(e.request, r));
          }).catch(() => {});
          return cached;
        }
        // Cache miss : fetch + cache pour la prochaine fois
        return fetch(e.request).then(r => {
          if (r.ok) {
            const clone = r.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return r;
        }).catch(() => {
          // Si offline et pas en cache : fallback à index.html pour les nav (SPA)
          if (e.request.mode === 'navigate') return caches.match('/index.html');
          return new Response('', { status: 503 });
        });
      })
    );
    return;
  }

  // 4. Pour le reste (POST, autres) : network-first avec fallback cache offline
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
