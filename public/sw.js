'use strict';

// =============================================================================
// Service Worker - Car Inspector AI
// Strategy:
//   - Auth routes: never intercepted, never cached
//   - API routes: network-only
//   - Static Next.js chunks: cache-first
//   - Normal same-origin page navigations/assets: network-first with cache fallback
//
// Important: OAuth redirects and session pages must pass straight through the
// browser. Caching or replaying any part of that flow can consume one-time
// cookies, serve stale auth pages, or trigger Response.clone() after the body
// stream has already been handed to the browser.
// =============================================================================

const CACHE_NAME = 'car-inspector-v7';

function toUrl(input) {
  return new URL(typeof input === 'string' ? input : input.url);
}

function isSameOriginUrl(url) {
  return url.origin === self.location.origin;
}

function isApiPath(pathname) {
  return pathname === '/api' || pathname.startsWith('/api/');
}

function isAuthPath(pathname) {
  return (
    pathname === '/auth' ||
    pathname.startsWith('/auth/') ||
    pathname === '/api/auth' ||
    pathname.startsWith('/api/auth/')
  );
}

function isGoogleAuthPath(pathname) {
  return (
    pathname === '/api/auth/google/init' ||
    pathname === '/api/auth/google/callback' ||
    pathname === '/api/auth/google/session' ||
    pathname === '/auth/google/complete'
  );
}

function isStaticAssetPath(pathname) {
  return pathname.startsWith('/_next/static/');
}

function isRedirectResponse(response) {
  return response.redirected || (response.status >= 300 && response.status < 400);
}

function isCacheableResponse(response) {
  return response.ok && response.type === 'basic' && !isRedirectResponse(response);
}

function isCacheableRequest(request) {
  const url = toUrl(request);

  if (request.method !== 'GET') return false;
  if (!isSameOriginUrl(url)) return false;
  if (isAuthPath(url.pathname) || isGoogleAuthPath(url.pathname)) return false;
  if (isApiPath(url.pathname)) return false;

  // OAuth and auth hand-offs commonly use query params. Do not cache any URL
  // carrying those markers even if the path is later changed.
  if (
    url.searchParams.has('code') ||
    url.searchParams.has('state') ||
    url.searchParams.has('oauth') ||
    url.searchParams.has('error')
  ) {
    return false;
  }

  return true;
}

function isCacheableNavigationRequest(request) {
  if (!isCacheableRequest(request)) return false;
  const url = toUrl(request);
  return request.mode === 'navigate' || request.destination === 'document' || url.pathname === '/';
}

function isCacheableRuntimeAssetRequest(request) {
  if (!isCacheableRequest(request)) return false;
  return ['font', 'image', 'manifest', 'script', 'style'].includes(request.destination);
}

async function putInCache(request, response) {
  if (!isCacheableRequest(request) || !isCacheableResponse(response)) return;

  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response);
}

// Updates wait until the app sends SKIP_WAITING from the visible update prompt.
globalThis.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME));
});

globalThis.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    globalThis.skipWaiting();
  }
});

globalThis.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
      .then(() => globalThis.clients.claim())
  );
});

globalThis.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = toUrl(request);

  // Let the browser own every unsafe, cross-origin, API, and auth request. This
  // intentionally avoids event.respondWith() for Google OAuth and email/password
  // auth so redirects, cookies, and session reads remain untouched by the SW.
  if (!isCacheableRequest(request)) return;

  if (isStaticAssetPath(url.pathname)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;

        const response = await fetch(request);
        if (isCacheableResponse(response)) {
          event.waitUntil(putInCache(request, response.clone()).catch(() => undefined));
        }
        return response;
      })
    );
    return;
  }

  // Keep normal app pages and same-origin runtime assets available offline.
  if (isCacheableNavigationRequest(request) || isCacheableRuntimeAssetRequest(request)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (isCacheableResponse(response)) {
            event.waitUntil(putInCache(request, response.clone()).catch(() => undefined));
          }
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached ?? Response.error()))
    );
  }
});
