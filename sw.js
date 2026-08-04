// ===== Service Worker — stratégie "Cache First" =====
const CACHE = 'atelier-v1';

// INSTALL : pré-cache les fichiers critiques pour l'offline
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(['./', './index.html']))
  );
  self.skipWaiting(); // prend le contrôle immédiatement
});

// ACTIVATE : purge les anciennes versions du cache
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// FETCH : intercepter chaque requête
self.addEventListener('fetch', e => {
  // Cache First : sert le cache, sinon va sur le réseau et met en cache
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).then(res => {
      // met en cache les nouvelles ressources (fonts, etc.) au fil de l'eau
      if (res && res.ok && e.request.url.startsWith(self.location.origin)) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
      }
      return res;
    }))
  );
});
