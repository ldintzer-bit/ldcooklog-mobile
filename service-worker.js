const CACHE_NAME = "ldcooklog-v1-17-1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-180.png",
  "./icon-512.png",
  "./v1-17-1.js"
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

async function withV1171Hotfix(response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return response;
  const text = await response.text();
  if (text.includes("v1-17-1.js")) return new Response(text, response);
  const patched = text.replace("</body>", '<script src="./v1-17-1.js"></script>\n</body>');
  return new Response(patched, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  });
}

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  const isNavigation = event.request.mode === "navigate" || url.pathname.endsWith("/") || url.pathname.endsWith("/index.html");

  event.respondWith(
    fetch(event.request)
      .then(async response => {
        const finalResponse = isNavigation ? await withV1171Hotfix(response) : response;
        const copy = finalResponse.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return finalResponse;
      })
      .catch(() => caches.match(event.request).then(async response => {
        const fallback = response || await caches.match("./index.html");
        return fallback && isNavigation ? withV1171Hotfix(fallback) : fallback;
      }))
  );
});
