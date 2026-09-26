/* WobbleTone FX — service worker */
// Bump this stamp on every code update to bust the cache for all users.
const CACHE_VERSION = "wobbletone-fx-20260924-27";
const CACHE = CACHE_VERSION;
const ASSETS = [
  "./", "./index.html", "./styles.css", "./app.js", "./manifest.json",
  "./icons/icon.svg", "./icons/icon-192.png", "./icons/icon-512.png",
  "./icons/icon-512-maskable.png", "./icons/favicon-32.png", "./icons/apple-touch-icon.png",
  "./engine/version.js", "./engine/spec.js", "./engine/registry.js", "./engine/rng.js",
  "./engine/color.js", "./engine/buffer.js", "./engine/render.js", "./engine/canvas.js",
  "./engine/incremental.js", "./engine/pool.js",
  "./engine/gl/index.js", "./engine/gl/context.js", "./engine/gl/programs.js",
  "./engine/gl/textures.js", "./engine/gl/readback.js", "./engine/gl/blends.js",
  "./engine/gl/fusion.js", "./engine/gl/renderer.js", "./engine/gl/infra.js",
  "./engine/gl/effects/blur.js", "./engine/gl/effects/overlay.js",
  "./engine/gl/uniforms.js",
  "./engine/effects/pointwise.js", "./engine/effects/tone.js", "./engine/effects/blur.js",
  "./engine/effects/overlay.js", "./engine/effects/grain.js", "./engine/effects/glitch.js",
  "./engine/effects/bloom.js", "./engine/effects/dropshadow.js", "./engine/effects/compound.js",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS))
      .then(() => caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const fetchPromise = fetch(e.request)
        .then((resp) => {
          if (resp && resp.status === 200 && resp.type === "basic") {
            const clone = resp.clone();
            caches.open(CACHE).then((c) => c.put(e.request, clone));
          }
          return resp;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
