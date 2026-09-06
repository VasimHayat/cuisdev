/**
 * Service worker, generated at build time so the cache name changes with every
 * deploy. Served from the site root so its scope covers every page.
 *
 * Strategy:
 *  - `/_astro/*` and fonts/icons are content-hashed and immutable → cache-first.
 *  - Navigations → network-first (so a new deploy is picked up immediately),
 *    falling back to the cached page, then to `/offline/`.
 *  - Everything else same-origin → stale-while-revalidate.
 *  - Cross-origin and non-GET requests are never touched.
 */
import type { APIRoute } from 'astro';

export const prerender = true;

/** Bumped on every build; old caches are deleted on activate. */
const BUILD_ID = new Date().toISOString().replace(/\D/g, '').slice(0, 14);

const source = `
const CACHE = 'cuisdev-${BUILD_ID}';
const OFFLINE_URL = '/offline/';
const PRECACHE = ['/', '/tools/', OFFLINE_URL, '/manifest.webmanifest', '/favicon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// The page that triggered installation was fetched before this worker took
// control, so it is not in the cache yet. It asks us to add it (see
// ServiceWorker.astro) so a first visit is enough to make a tool available offline.
self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || data.type !== 'cache-urls' || !Array.isArray(data.urls)) return;
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.all(
        data.urls.map((url) =>
          fetch(url, { credentials: 'same-origin' })
            .then((response) => (response.ok ? cache.put(url, response) : undefined))
            .catch(() => undefined),
        ),
      ),
    ),
  );
});

const isImmutable = (url) =>
  url.pathname.startsWith('/_astro/') ||
  url.pathname.startsWith('/icons/') ||
  url.pathname.startsWith('/og/');

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() =>
          caches
            .match(request)
            .then((cached) => cached || caches.match(OFFLINE_URL))
            .then((cached) => cached || Response.error()),
        ),
    );
    return;
  }

  if (isImmutable(url)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
            return response;
          }),
      ),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
`;

export const GET: APIRoute = () =>
  new Response(source.trimStart(), {
    headers: {
      'Content-Type': 'text/javascript; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Service-Worker-Allowed': '/',
    },
  });
