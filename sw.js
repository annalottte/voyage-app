// Voyage Service Worker
// Caches core assets for offline use and faster loads

const CACHE_NAME = 'voyage-v2';

// Assets to cache on install
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/ui.js',
  '/supabase-integration.js',
  '/ai-day-tips.js',
  '/nearby-explore.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  // External fonts (cache on first fetch)
];

// Install: precache core assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE_ASSETS).catch(err => {
        // Don't fail install if some assets aren't available yet
        console.warn('Precache partial failure:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate: clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: network-first for API calls, cache-first for static assets
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Skip anything that isn't http/https (e.g. chrome-extension://, data:, blob:)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Always go network-first for Supabase, Anthropic API, and weather APIs
  const isApiCall = url.hostname.includes('supabase.co')
    || url.hostname.includes('anthropic.com')
    || url.hostname.includes('open-meteo.com')
    || url.hostname.includes('geocoding-api')
    || url.pathname.startsWith('/api/');

  if (isApiCall) {
    // Network only — never cache API responses
    event.respondWith(fetch(event.request));
    return;
  }

  // For CDN assets (fonts, libraries) — cache first, then network
  const isCDN = url.hostname.includes('fonts.googleapis.com')
    || url.hostname.includes('fonts.gstatic.com')
    || url.hostname.includes('cdn.jsdelivr.net')
    || url.hostname.includes('unpkg.com');

  if (isCDN) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // For local assets — network first, fall back to cache
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
