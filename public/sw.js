// MoodBored Service Worker — caches the app shell for offline use.
// The app works offline once loaded — board data is in IndexedDB.

// Cache version is auto-generated at build time to force updates
const CACHE_NAME = 'moodbored-' + (self.location.search.match(/v=([^&]+)/)?.[1] || 'dev')
const SHELL = ['/', '/index.html', '/manifest.json']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    ).then(() => self.clients.claim())
  )
})

function isShellPath(pathname) {
  return SHELL.includes(pathname)
}

// Content-hashed assets: cache-first is safe (the hash changes with content).
function cacheFirst(request) {
  return caches.match(request).then((cached) => {
    if (cached) return cached
    return fetch(request).then((response) => {
      if (response.ok) {
        const clone = response.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
      }
      return response
    })
  })
}

// App shell + navigations: NETWORK-FIRST so a rebuild is never masked by a
// stale cached index.html (which would reference deleted assets and blank
// the app). Cache is only the offline fallback.
function networkFirst(request) {
  return fetch(request).then((response) => {
    if (response.ok) {
      const clone = response.clone()
      caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
    }
    return response
  }).catch(() =>
    caches.match(request).then((cached) => cached || caches.match('/'))
  )
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  if (!request.url.startsWith(self.location.origin)) return

  const path = new URL(request.url).pathname

  if (path.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request))
    return
  }

  if (request.mode === 'navigate' || isShellPath(path)) {
    event.respondWith(networkFirst(request))
  }
  // Everything else (videos, favicons, …) goes straight to the network.
})
