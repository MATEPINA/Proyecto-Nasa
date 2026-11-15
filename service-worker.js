/* =========================================================
   Ares-360 · Service Worker (Offline-First)
   - Precaches the app, the data, /assets/ and the CDN libraries.
   - Own files: network first with cache as fallback (team changes
     show up immediately and it still works in airplane mode).
   - CDN: cache first.
   Bump VERSION every time you change the precache list.
   ========================================================= */
const VERSION = 'ares360-v4';

const CORE = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './route_data.json',
  './manifest.json',
  './assets/icon.svg',
  './assets/README.txt',
  // --- Real Gale Crater assets (addAll fails if any is missing: bump VERSION when changing them)
  './assets/point1.jpg',
  './assets/point2.jpg',
  './assets/point3.jpg',
  './assets/point4.jpg',
  './assets/gale_map.jpg',
  './assets/gale_map_hypso.jpg',
];

const CDN = [
  'https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.css',
  'https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
];

// Fallback: besides CORE, precache any real image declared in route_data.json
// (e.g. if a new point is added) without breaking the install if it is missing.
async function precacheOptionalAssets(cache) {
  try {
    const res = await fetch('./route_data.json', { cache: 'no-store' });
    const data = await res.json();
    const a = data.mission.assets || {};
    const urls = [];
    if (a.use_real_images) data.points.forEach(p => urls.push('./' + p.image));
    if (a.use_real_map && a.map) urls.push('./' + a.map);
    if (a.use_real_map && a.map_hypso) urls.push('./' + a.map_hypso);
    await Promise.all(urls.map(u => cache.add(u).catch(() => console.warn('[SW] Could not cache', u))));
  } catch (e) { /* no data: skipped */ }
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await cache.addAll(CORE);
    await Promise.all(CDN.map(u => cache.add(new Request(u, { mode: 'cors' })).catch(() => console.warn('[SW] CDN unavailable', u))));
    await precacheOptionalAssets(cache);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(req));
  } else {
    event.respondWith(cacheFirst(req));
  }
});

async function networkFirst(req) {
  const cache = await caches.open(VERSION);
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (e) {
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    if (req.mode === 'navigate') return (await cache.match('./index.html')) || Response.error();
    return Response.error();
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(req, { ignoreVary: true });
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
    return res;
  } catch (e) {
    return Response.error();
  }
}
