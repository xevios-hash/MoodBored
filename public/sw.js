// MoodBored Service Worker — caches the app shell for offline use.
// The app works offline once loaded — board data is in IndexedDB.

const CACHE_NAME = 'moodbored-v1'
const SHELL = ['/', '/index.html', '/logo.png', '/manifest.json']

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

self.addEventListener('fetch', (event) => {
  const { request } = event
  // Only cache GET requests for same-origin assets
  if (request.method !== 'GET') return
  if (!request.url.startsWith(self.location.origin)) return

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request).then((response) => {
        // Cache successful responses for app shell assets
        if (response.ok && (request.url.includes('/assets/') || SHELL.some(s => request.url.endsWith(s)))) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
        }
        return response
      }).catch(() => {
        // Offline fallback: return cached index.html for navigation
        if (request.mode === 'navigate') return caches.match('/')
      })
    })
  )
})