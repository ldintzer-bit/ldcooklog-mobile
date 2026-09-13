const CACHE_NAME = "ldcooklog-v1-20-0";
const FEATURE_SCRIPT = "./v1-20.js";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-180.png",
  "./icon-512.png",
  FEATURE_SCRIPT
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

function isAppHtml(url) {
  return url.pathname.endsWith("/ldcooklog-mobile/") || url.pathname.endsWith("/ldcooklog-mobile/index.html");
}

function injectV120(html) {
  if (html.includes('src="./v1-20.js"') || html.includes("src='./v1-20.js'")) return html;
  return html.replace("</body>", '<script src="./v1-20.js"></script>\n</body>');
}

async function transformedHtmlResponse(response) {
  const html = await response.text();
  const headers = new Headers(response.headers);
  headers.set("content-type", "text/html; charset=utf-8");
  headers.delete("content-length");
  return new Response(injectV120(html), {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);

  // Cloud/API requests are never intercepted. Offline failures are handled by app code.
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    try {
      const networkResponse = await fetch(event.request);
      if (!networkResponse) return Response.error();

      if (isAppHtml(url) && networkResponse.ok) {
        const transformed = await transformedHtmlResponse(networkResponse);
        const cache = await caches.open(CACHE_NAME);
        cache.put(event.request, transformed.clone());
        return transformed;
      }

      if (networkResponse.ok) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(event.request, networkResponse.clone());
      }
      return networkResponse;
    } catch (_) {
      const cached = await caches.match(event.request);
      if (cached) {
        if (isAppHtml(url)) return transformedHtmlResponse(cached);
        return cached;
      }

      if (isAppHtml(url)) {
        const fallback = await caches.match("./index.html");
        if (fallback) return transformedHtmlResponse(fallback);
      }

      return Response.error();
    }
  })());
});
