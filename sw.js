/* sw.js — offline cache for the flashcard app.
 *
 * Strategy:
 *   - Precache the app shell on install so the app opens offline.
 *   - Network-first for deck JSON (so new articles appear when online),
 *     falling back to cache when offline.
 *   - Cache-first for static shell assets.
 * Bump CACHE version when you change shell files to force an update.
 */
var CACHE = 'flashcards-v4';
var SHELL = [
  './',
  './index.html',
  './css/style.css',
  './js/srs.js',
  './js/swipe.js',
  './js/app.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './decks/index.json'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(SHELL); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Network-first for everything (code AND data): when online, always get the
  // freshest version so app code and deck data never fall out of sync. Fall
  // back to cache when offline; navigations fall back to the cached app shell.
  e.respondWith(
    fetch(req).then(function (res) {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put(req, copy); });
      return res;
    }).catch(function () {
      return caches.match(req).then(function (hit) {
        if (hit) return hit;
        if (req.mode === 'navigate') return caches.match('./index.html');
        return Response.error();
      });
    })
  );
});
