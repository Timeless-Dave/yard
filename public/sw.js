// Minimal service worker — exists mainly so Chrome/Android treat this as an
// installable PWA. Network-first for everything: this app ships updates
// often, and a cache-first strategy would silently serve stale JS forever
// once a device has it cached, with no visible error. The cache only kicks
// in as an offline/flaky-connection fallback, never instead of fresh code.
const CACHE = "the-yard-shell-v2";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return; // let Firebase/API calls pass straight through

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
