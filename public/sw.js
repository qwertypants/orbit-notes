const CACHE_NAME = 'orbit-shell-v1'
const APP_BASE = new URL('./', self.location).pathname
const APP_INDEX = `${APP_BASE}index.html`
const APP_SHELL = [APP_BASE, APP_INDEX, `${APP_BASE}manifest.webmanifest`, `${APP_BASE}icon.svg`]

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('orbit-') && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then((response) => {
      if (response.ok) {
        return caches.open(CACHE_NAME)
          .then((cache) => cache.put(APP_INDEX, response.clone()))
          .catch(() => {})
          .then(() => response)
      }
      return response
    }).catch(async () => (await caches.match(request)) || (await caches.match(APP_INDEX)))
    return
  }

  if (!['script', 'style', 'image', 'font', 'manifest'].includes(request.destination)) return
  event.respondWith(caches.match(request).then((cached) => {
    if (cached) return cached
    return fetch(request).then((response) => {
      if (response.ok) {
        return caches.open(CACHE_NAME)
          .then((cache) => cache.put(request, response.clone()))
          .catch(() => {})
          .then(() => response)
      }
      return response
    })
  }))
})
