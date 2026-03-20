const CACHE_NAME = 'flickgame-pwa-v1';
const PRECACHE_URLS = [
  './',
  './index.html',
  './play.html',
  './manifest.webmanifest',
  './favicon.png',
  './icons/app-icon-180.png',
  './icons/app-icon-192.png',
  './icons/app-icon-512.png',
  './FileSaver.js',
  './flickgame_base.js',
  './flickgame_vanilla.js',
  './colorNames.js',
  './help.html',
  './help.css',
  './helpimage.png',
  './undo2.svg',
  './clipboard_paste.svg',
  './new_file.svg',
  './bucket.svg',
  './play.svg',
  './clear.png',
  './palette.png',
  './list.svg',
  './eyedropper.png',
  './auth.html'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(PRECACHE_URLS);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (cacheNames) {
      return Promise.all(
        cacheNames.map(function (cacheName) {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  const request = event.request;
  if (request.method !== 'GET') {
    return;
  }

  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then(function (cachedResponse) {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request).then(function (networkResponse) {
        if (!networkResponse || networkResponse.status !== 200) {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then(function (cache) {
          cache.put(request, responseToCache);
        });

        return networkResponse;
      }).catch(function () {
        if (request.mode === 'navigate') {
          if (requestUrl.pathname.endsWith('/play.html') || requestUrl.pathname === '/play.html') {
            return caches.match('./play.html');
          }
          return caches.match('./index.html');
        }
        return cachedResponse;
      });
    })
  );
});
