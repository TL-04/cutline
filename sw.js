// Cutline service worker: makes the app installable and usable offline.
// - The page itself is network-first, so a new version shows up on the next load when online.
// - Icons and the manifest are served from the cache first.
// - The speech-model library (jsDelivr) is cached the first time subtitles are generated; the model files
//   themselves are cached by that library in its own cache.
const VERSION = 'cutline-v1';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png',
  './icons/icon-maskable-512.png', './icons/apple-touch-icon.png', './icons/favicon-32.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('cutline-') && k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    if (req.mode === 'navigate' || url.pathname.endsWith('/index.html')) {
      e.respondWith(fetch(req).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put('./index.html', copy)); }
        return res;
      }).catch(() => caches.match('./index.html')));
    } else if (SHELL.some(p => url.pathname.endsWith(p.slice(1)) && p !== './')) {
      e.respondWith(caches.match(req).then(hit => hit || fetch(req)));
    }
    return;   // anything else (test files, media) goes straight to the network
  }
  if (url.hostname === 'cdn.jsdelivr.net') {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return res;
    })));
  }
});
