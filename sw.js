/* Offline support: the game's own files are served from cache and refreshed in the background,
   so it opens with no connection and picks up new versions the next time it is online. */
const VERSION = "touchline-4.0.0";
const FILES = ["./", "index.html", "app.css", "manifest.webmanifest", "icon.svg", "icon-192.png", "icon-512.png", "apple-touch-icon.png",
  "js/data.js", "js/world.js", "js/engine.js", "js/season.js", "js/market.js", "js/recruit.js", "js/story.js", "js/ui.js", "js/main.js"];
const FONTS = "touchline-fonts";

self.addEventListener("install", e => e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener("activate", e => e.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== FONTS).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", e => {
  const req = e.request; if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    e.respondWith(caches.open(VERSION).then(async cache => {
      const hit = await cache.match(req, { ignoreSearch: true });
      const fresh = fetch(req).then(res => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || fresh;
    }));
  } else if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    // Google Fonts are cached the first time they load; offline the page falls back to system fonts until then.
    e.respondWith(caches.open(FONTS).then(async cache => (await cache.match(req)) || fetch(req).then(res => { cache.put(req, res.clone()); return res; })));
  }
});
