// No-op service worker placeholder to satisfy browsers/extensions
// that probe /sw.js on this origin.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
