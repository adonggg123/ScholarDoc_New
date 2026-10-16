// Service Worker for ScholarDoc Desktop Background Notifications
const CACHE_NAME = 'scholardoc-notifications-v1';

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

// Handle incoming push event if Web Push Protocol is triggered
self.addEventListener('push', (event) => {
    if (!event.data) return;
    try {
        const payload = event.data.json();
        const title = payload.title || 'ScholarDoc Notification';
        const options = {
            body: payload.message || payload.body || '',
            icon: payload.icon || '/assets/app_logo3.png',
            badge: payload.badge || '/assets/app_logo3.png',
            tag: payload.tag || ('scholardoc_' + Date.now()),
            data: payload.data || {},
            renotify: true,
            requireInteraction: false
        };
        event.waitUntil(self.registration.showNotification(title, options));
    } catch (_) {
        const text = event.data.text();
        event.waitUntil(
            self.registration.showNotification('ScholarDoc Alert', {
                body: text,
                icon: '/assets/app_logo3.png'
            })
        );
    }
});

// Handle notification click on native desktop pop-up
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const targetUrl = event.notification.data?.url || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if ('focus' in client) {
                    client.focus();
                    if (event.notification.data?.notificationId) {
                        client.postMessage({
                            type: 'NOTIFICATION_CLICKED',
                            notificationId: event.notification.data.notificationId,
                            title: event.notification.title
                        });
                    }
                    return;
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});
