const CACHE = 'shnoozy-v1';

// Activate immediately — don't wait for old SW to be released
self.addEventListener('install', () => self.skipWaiting());

// Take control of all clients, clean up old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Cache strategy
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Pass through all external requests (Supabase, etc.)
  if (url.origin !== location.origin) return;

  // HTML navigation: network-first, fallback to cache (ensures fresh app on update)
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).then(r => {
        caches.open(CACHE).then(c => c.put(e.request, r.clone()));
        return r;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // Hashed assets (/assets/...): cache-first — filenames change on each build
  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).then(r => {
        caches.open(CACHE).then(c => c.put(e.request, r.clone()));
        return r;
      }))
    );
    return;
  }

  // Everything else (icons, manifest, sw.js): network-first
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});

// ─── Push Notifications ───────────────────────────────────────────────────────

self.addEventListener('push', event => {
  const data = event.data?.json() ?? { title: 'Shnoozy', body: 'You have upcoming events.' };
  const url = data.tag === 'todo-assignment'
    ? self.registration.scope + '#todos'
    : self.registration.scope;
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      tag: data.tag || 'shnoozy',
      data: { url },
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = event.notification.data?.url ?? self.registration.scope;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      return clients.openWindow(targetUrl);
    })
  );
});
