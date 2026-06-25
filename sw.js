// sw.js — WHISTLE Service Worker
// Maneja push notifications en background

const CACHE_NAME = 'whistle-v1';

// ── Instalación ───────────────────────────────────────────────────────────────
self.addEventListener('install', (e) => {
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(self.clients.claim());
});

// ── Push recibido ─────────────────────────────────────────────────────────────
self.addEventListener('push', (e) => {
    if (!e.data) return;

    let payload;
    try {
        payload = e.data.json();
    } catch {
        payload = { title: 'WHISTLE', body: e.data.text() };
    }

    const { title, body, icon, badge, url, tag } = payload;

    const options = {
        body:    body    ?? '',
        icon:    icon    ?? '/elfulbo/icon-192.png',
        badge:   badge   ?? '/elfulbo/icon-badge.png',
        tag:     tag     ?? 'whistle-gol',        // agrupa notifs del mismo partido
        renotify: true,                            // vibra aunque ya exista el tag
        data:    { url: url ?? 'https://solgoyhe-gif.github.io/elfulbo/#/h2h' },
        actions: [
            { action: 'ver', title: '⚽ Ver partido' },
            { action: 'cerrar', title: 'Cerrar' }
        ],
        vibrate: [200, 100, 200],
    };

    e.waitUntil(
        self.registration.showNotification(title, options)
    );
});

// ── Click en notificación ─────────────────────────────────────────────────────
self.addEventListener('notificationclick', (e) => {
    e.notification.close();

    if (e.action === 'cerrar') return;

    const targetUrl = e.notification.data?.url
        ?? 'https://solgoyhe-gif.github.io/elfulbo/#/h2h';

    e.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            // Si ya hay una pestaña abierta, enfocala y navegá
            for (const client of windowClients) {
                if (client.url.includes('solgoyhe-gif.github.io') && 'focus' in client) {
                    client.focus();
                    client.navigate(targetUrl);
                    return;
                }
            }
            // Si no hay pestaña, abrí una nueva
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});
