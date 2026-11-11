const CACHE = 'cadran-web-v5';
const SHELL = [
  './', './index.html', './newtab.html', './manifest.webmanifest',
  './css/base.css', './css/tiles.css', './css/ui.css',
  './js/web-compat.js', './js/app.js', './js/pager.js', './js/i18n.js',
  './js/search.js', './js/widgets.js', './js/bookmarks.js', './js/panel.js',
  './js/store.js', './js/grid.js', './js/picker.js', './js/db.js',
  './js/wallpaper.js', './js/actions.js', './js/ui.js', './js/util.js',
  './js/boot.js', './js/icons.js', './js/analog-clock.js',
  './icons/icon-128.png', './icons/icon-32.png'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('cadran-web-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (request.mode === 'navigate' || /\.html?$/.test(url.pathname)) {
    event.respondWith(fetch(request).then(response => {
      if (response.ok) caches.open(CACHE).then(cache => cache.put(request, response.clone()));
      return response;
    }).catch(() => caches.match(request).then(cached => cached || caches.match('./newtab.html'))));
    return;
  }
  const isCode = /\.(?:js|css)(?:$|\?)/i.test(url.pathname + url.search);
  if (isCode) {
    event.respondWith(fetch(request).then(response => {
      if (response.ok) caches.open(CACHE).then(cache => cache.put(request, response.clone()));
      return response;
    }).catch(() => caches.match(request)));
    return;
  }
  event.respondWith(caches.match(request).then(cached => {
    if (cached) return cached;
    return fetch(request).then(response => {
      if (response.ok) caches.open(CACHE).then(cache => cache.put(request, response.clone()));
      return response;
    });
  }));
});
