const CACHE = 'ldcooklog-v2-poc-static-v2';
const ASSETS = ['./', './index.html', './app.js', './db.js', './backup.js', './migration.js', './manifest.webmanifest', './icon.svg'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('ldcooklog-v2-poc-static-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  // Static shell: cached first, network fallback. No API or credential interception.
  event.respondWith(caches.match(event.request).then(hit => hit || fetch(event.request)));
});
