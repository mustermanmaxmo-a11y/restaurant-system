const CACHE_NAME = 'restaurantos-v2'

const APP_SHELL = ['/admin', '/dashboard']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    const url = new URL(event.request.url)
    const fallback = url.pathname.startsWith('/dashboard') ? '/dashboard' : '/admin'
    event.respondWith(
      fetch(event.request).catch(() => caches.match(fallback))
    )
  }
})
