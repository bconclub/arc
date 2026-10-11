// ARC service worker: makes the app installable and shows a friendly page when
// the phone is offline. It never caches ARC's pages or data (they are private
// and live), so everything you see online is always fresh.
const OFFLINE = "/offline.html";
const CACHE = "arc-shell-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll([OFFLINE, "/pwa-192.png"])));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  // Only page loads get the offline fallback; everything else goes straight to the network.
  if (event.request.mode !== "navigate") return;
  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE)));
});
