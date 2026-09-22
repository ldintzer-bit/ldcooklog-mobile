// V1.30.17.2 emergency cache retirement: always use network and remove all old LDCookLog caches.
const CACHE_NAME = 'ldcooklog-v1-30-35';
self.addEventListener("install", event => { self.skipWaiting(); });
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.map(key => caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(fetch(event.request, {cache:"no-store"}));
});
