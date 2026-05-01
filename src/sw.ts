/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { NetworkFirst } from 'workbox-strategies'

declare const self: ServiceWorkerGlobalScope

// Take control immediately so stale chunks from the previous deployment don't
// keep serving after a new build is deployed.
self.addEventListener('install', () => { void self.skipWaiting() })
self.addEventListener('activate', (event) => { event.waitUntil(self.clients.claim()) })
self.addEventListener('message', (event) => {
  if ((event.data as { type?: string })?.type === 'SKIP_WAITING') void self.skipWaiting()
})

// Workbox precache manifest injected by VitePWA
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// Navigate to index.html for SPA routes
registerRoute(
  new NavigationRoute(
    new NetworkFirst({ cacheName: 'navigation', networkTimeoutSeconds: 3 }),
    { denylist: [/^\/api\//] },
  ),
)

// Cache Supabase API responses with NetworkFirst
registerRoute(
  ({ url }) => url.hostname.endsWith('.supabase.co'),
  new NetworkFirst({ cacheName: 'supabase-api', networkTimeoutSeconds: 10 }),
)

// ── Web Push ────────────────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  if (!event.data) return
  const data = event.data.json() as {
    title?: string
    body?: string
    icon?: string
    tag?: string
    url?: string
  }
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Chefsuite', {
      body: data.body ?? '',
      icon: data.icon ?? '/icon.svg',
      badge: '/icon.svg',
      tag: data.tag ?? 'chefsuite',
      data: { url: data.url ?? '/' },
      // vibrate is a non-standard extension; cast to satisfy strict types
      ...(({ vibrate: [100, 50, 100] }) as Record<string, unknown>),
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data as { url?: string })?.url ?? '/'
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) return (client as WindowClient).focus()
        }
        return self.clients.openWindow(url)
      }),
  )
})
