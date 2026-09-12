const CACHE_NAME = "ldcooklog-v1-19-0";
const APP_SHELL = [
  "./",
  "./index.html",
  "./v1-19.js",
  "./manifest.webmanifest",
  "./icon-180.png",
  "./icon-512.png"
];

function injectV119(html) {
  if (html.includes('src="./v1-19.js"') || html.includes("src='./v1-19.js'")) return html;
  return html.replace("</body>", '<script src="./v1-19.js"></script>\n</body>');
}

async function htmlResponse(response) {
  const text = await response.text();
  const headers = new Headers(response.headers);
  headers.set("Content-Type", "text/html; charset=utf-8");
  return new Response(injectV119(text), {status: response.status, statusText: response.statusText, headers});
}

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
  const isAppHtml = url.origin === self.location.origin && (url.pathname.endsWith("/ldcooklog-mobile/") || url.pathname.endsWith("/ldcooklog-mobile/index.html"));

  if (isAppHtml) {
    event.respondWith((async () => {
      try {
        const response = await fetch(event.request);
        const cache = await caches.open(CACHE_NAME);
        cache.put(event.request, response.clone());
        return htmlResponse(response);
      } catch (_) {
        const cached = await caches.match(event.request) || await caches.match("./index.html");
        if (cached) return htmlResponse(cached);
        throw _;
      }
    })());
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
