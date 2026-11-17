const RELEASE = '__ORBIT_RELEASE__'
const FILES = [] /* __ORBIT_FILES__ */
const APP_BASE = new URL('./', self.location).pathname
const CACHE_PREFIX = `orbit-offline:${APP_BASE}:`
const CACHE_NAME = `${CACHE_PREFIX}${RELEASE}`
const APP_INDEX = `${APP_BASE}index.html`

async function installRelease() {
  const cache = await caches.open(CACHE_NAME)
  try {
    // Serialize writes so a failed download cannot race with cache deletion.
    for (const { path, digest } of FILES) {
      const url = `${APP_BASE}${path}`
      const response = await fetch(url, { cache: 'no-store' })
      if (!response.ok || response.redirected) throw new Error(`Offline download failed: ${path}`)
      const bytes = await response.clone().arrayBuffer()
      const hash = await crypto.subtle.digest('SHA-256', bytes)
      const actual = Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('')
      if (actual !== digest) throw new Error(`Offline download mismatch: ${path}`)
      await cache.put(url, response)
    }
  } catch (error) {
    await caches.delete(CACHE_NAME)
    throw error
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(installRelease())
  // Waiting updates activate after all existing app tabs close.
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME) await caches.delete(key)
    }
    // The old cache was shared across scopes; remove only this app's entries.
    if ((await caches.keys()).includes('orbit-shell-v1')) {
      const legacy = await caches.open('orbit-shell-v1')
      for (const request of await legacy.keys()) {
        const url = new URL(request.url)
        if (url.origin === self.location.origin && url.pathname.startsWith(APP_BASE)) await legacy.delete(request)
      }
      if ((await legacy.keys()).length === 0) await caches.delete('orbit-shell-v1')
    }
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(APP_BASE)) return
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME)
    const cached = await cache.match(request.mode === 'navigate' ? APP_INDEX : request, { ignoreSearch: true })
    return cached || fetch(request)
  })())
})
