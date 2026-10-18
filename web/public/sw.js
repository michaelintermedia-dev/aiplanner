// Gatazee's service worker: web push only (2026-10-18) - reminders with the tab closed.
// No fetch handler on purpose: nothing is cached, every load comes from the server.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: event.data ? event.data.text() : 'Gatazee' }
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Gatazee', {
      body: data.body || undefined,
      tag: data.tag, // the same reminder shown by an open tab is replaced, not doubled
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: data.url || '/feed' },
    }),
  )
})

// A tap opens the item: in a Gatazee tab that's already open, else a new one.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL(event.notification.data?.url || '/feed', self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((tabs) => {
      const tab = tabs.find((t) => new URL(t.url).origin === self.location.origin)
      if (tab) return tab.focus().then(() => tab.navigate(url))
      return self.clients.openWindow(url)
    }),
  )
})
