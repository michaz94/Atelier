// sw.js — Service Worker pour Atelier
// Stratégie : app shell en cache (offline complet) + cache runtime pour le reste

const CACHE_VERSION = 'v1';
const APP_SHELL_CACHE = `atelier-shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `atelier-runtime-${CACHE_VERSION}`;

// Fichiers indispensables au fonctionnement hors-ligne de l'app.
// Adapte cette liste si tu ajoutes/renommes des fichiers locaux.
const APP_SHELL_FILES = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './hero.jpg'
];

// Limite du cache runtime (images/fonts externes) : on ne garde que les 60
// dernières entrées pour ne pas laisser le cache grossir sans fin.
const RUNTIME_MAX = 60;

// ---------- INSTALL : met en cache l'app shell ----------
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL_FILES))
      .then(() => self.skipWaiting())
  );
});

// ---------- ACTIVATE : nettoie les anciens caches ----------
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== APP_SHELL_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ---------- FETCH ----------
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // On ne gère que les requêtes GET
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isSameOrigin = url.origin === self.location.origin;

  // Navigation (chargement de page) : réseau d'abord, fallback cache -> index.html
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const resClone = res.clone();
          caches.open(APP_SHELL_CACHE).then((cache) => cache.put(req, resClone));
          return res;
        })
        .catch(() =>
          caches.match(req).then((cached) => cached || caches.match('./index.html'))
        )
    );
    return;
  }

  if (isSameOrigin) {
    // Ressources locales (CSS/JS/icônes) : cache d'abord, puis réseau
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          const resClone = res.clone();
          caches.open(APP_SHELL_CACHE).then((cache) => cache.put(req, resClone));
          return res;
        });
      })
    );
  } else {
    // Ressources externes (polices Google, images distantes) :
    // réseau d'abord, mise en cache runtime, fallback cache si hors-ligne
    event.respondWith(
      fetch(req)
        .then((res) => {
          const resClone = res.clone();
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(req, resClone);
            cache.keys().then((keys) => {
              while (keys.length > RUNTIME_MAX) {
                cache.delete(keys[0]);
                keys.shift();
              }
            });
          });
          return res;
        })
        .catch(() => caches.match(req))
    );
  }
});
