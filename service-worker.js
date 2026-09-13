const CACHE_NAME = "ldcooklog-v1-19-1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-180.png",
  "./icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);

  // Only handle this app's own files. Cloud/API requests should go directly
  // to the network so an offline failure is reported normally to the app.
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    try {
      const response = await fetch(event.request);
      if (response && response.ok) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(event.request, response.clone());
      }
      return response;
    } catch (_) {
      const cached = await caches.match(event.request);
      if (cached) return cached;

      const isAppHtml = url.pathname.endsWith("/ldcooklog-mobile/") || url.pathname.endsWith("/ldcooklog-mobile/index.html");
      if (isAppHtml) {
        const fallback = await caches.match("./index.html");
        if (fallback) return fallback;
      }

      return Response.error();
    }
  })());
});
