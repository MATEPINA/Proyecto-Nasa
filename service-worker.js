/* =========================================================
   Ares-360 · Service Worker (Offline-First)
   - Precachea la app, los datos, /assets/ y las librerías CDN.
   - Archivos propios: red primero y caché como respaldo (los
     cambios del equipo se ven al momento y funciona en modo avión).
   - CDN: caché primero.
   Sube VERSION cada vez que cambies la lista de precache.
   ========================================================= */
const VERSION = 'ares360-v3';

const CORE = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './datos_ruta.json',
  './manifest.json',
  './assets/icon.svg',
  './assets/README.txt',
  // --- Assets reales del Cráter Gale (addAll falla si falta alguno: subir VERSION al cambiarlos)
  './assets/punto1.jpg',
  './assets/punto2.jpg',
  './assets/punto3.jpg',
  './assets/punto4.jpg',
  './assets/mapa_gale.jpg',
  './assets/mapa_gale_hipso.jpg',
];

const CDN = [
  'https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.css',
  'https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
];

// Respaldo: además de CORE, se precachea cualquier imagen real que datos_ruta.json
// declare (p. ej. si se añade un punto nuevo) sin romper la instalación si falta.
async function precacheAssetsOpcionales(cache) {
  try {
    const res = await fetch('./datos_ruta.json', { cache: 'no-store' });
    const data = await res.json();
    const a = data.mision.assets || {};
    const urls = [];
    if (a.usar_imagenes_reales) data.puntos.forEach(p => urls.push('./' + p.imagen));
    if (a.usar_mapa_real && a.mapa) urls.push('./' + a.mapa);
    if (a.usar_mapa_real && a.mapa_hipso) urls.push('./' + a.mapa_hipso);
    await Promise.all(urls.map(u => cache.add(u).catch(() => console.warn('[SW] No se pudo cachear', u))));
  } catch (e) { /* sin datos: se omite */ }
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await cache.addAll(CORE);
    await Promise.all(CDN.map(u => cache.add(new Request(u, { mode: 'cors' })).catch(() => console.warn('[SW] CDN no disponible', u))));
    await precacheAssetsOpcionales(cache);
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
    event.respondWith(redPrimero(req));
  } else {
    event.respondWith(cachePrimero(req));
  }
});

async function redPrimero(req) {
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

async function cachePrimero(req) {
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
