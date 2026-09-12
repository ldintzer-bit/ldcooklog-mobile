const CACHE_NAME = "ldcooklog-v1-18-0";
const APP_SHELL = [
  "./",
  "./index.html",
  "./v1-18.js",
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

async function injectV118(response) {
  const text = await response.text();
  if (text.includes('v1-18.js')) return new Response(text, {status: response.status, statusText: response.statusText, headers: response.headers});
  const injected = text.replace('</body>', '<script src="./v1-18.js"></script>\n</body>');
  return new Response(injected, {status: response.status, statusText: response.statusText, headers: response.headers});
}

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  const isAppHtml = event.request.mode === "navigate" || url.pathname.endsWith("/index.html") || url.pathname.endsWith("/ldcooklog-mobile/");

  if (isAppHtml) {
    event.respondWith(
      fetch(event.request)
        .then(async response => {
          const modified = await injectV118(response.clone());
          const copy = modified.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          return modified;
        })
        .catch(async () => {
          const cached = await caches.match(event.request) || await caches.match("./index.html");
          return cached ? injectV118(cached.clone()) : cached;
        })
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
