self.addEventListener('push', event => {
  const data = event.data?.json() ?? { title: 'Shnoozy', body: 'You have upcoming events.' };
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      tag: data.tag || 'shnoozy',
      data: { url: '/' },
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      return clients.openWindow(event.notification.data?.url ?? '/');
    })
  );
});
