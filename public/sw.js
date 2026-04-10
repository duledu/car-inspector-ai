'use strict';

// =============================================================================
// Service Worker — Car Inspector AI  v3
// Strategy:
//   • Static Next.js chunks  → cache-first (they have content hashes)
//   • Page navigations       → network-first, fall back to cache
//   • API routes             → network-only (never cache dynamic data)
//
// Update lifecycle:
//   • New SW installs but stays in "waiting" — does NOT auto-activate.
//   • App detects reg.waiting and shows an update prompt to the user.
//   • User clicks "Update now" → app posts { type: 'SKIP_WAITING' }.
//   • SW calls skipWaiting() → fires controllerchange on client → reload.
// =============================================================================

const CACHE_NAME = 'car-inspector-v3';

function isApiRequest(url) {
  return new URL(url).pathname.startsWith('/api/');
}

function isStaticAsset(url) {
  return new URL(url).pathname.startsWith('/_next/static/');
}

// ─── Install — do NOT skipWaiting automatically ───────────────────────────────
// The new SW will stay in "waiting" until the client grants permission.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(() => {
      // Cache is open and ready; stay in waiting state.
    })
  );
});

// ─── Message — allow client to trigger activation ─────────────────────────────
globalThis.addEventListener('message', (event) => {
  if (event.origin !== self.location.origin) return; // verify same origin
  if (event.data?.type === 'SKIP_WAITING') {
    globalThis.skipWaiting();
  }
});

// ─── Activate — purge old caches, claim clients ───────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

// ─── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle GET
  if (req.method !== 'GET') return;

  // API → always network, never cached
  if (isApiRequest(req.url)) return;

  // Static Next.js assets → cache-first (immutable, content-hashed)
  if (isStaticAsset(req.url)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      })
    );
    return;
  }

  // Everything else (pages, icons, fonts) → network-first
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          caches.open(CACHE_NAME).then((cache) => cache.put(req, res.clone()));
        }
        return res;
      })
      .catch(() => caches.match(req))
  );
});
