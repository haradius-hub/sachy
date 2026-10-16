/* =========================================================================
   Šachy – Service Worker (PWA + Web Push)
   Autor: Better DeepSeek (AI) · Zadavatel: Jan Hošek · 2026
   SPDX-License-Identifier: GPL-3.0-or-later
   ========================================================================= */

var CACHE_NAME = 'sachy-v2';
var STATIC_ASSETS = [
  './', './index.html',
  './style.css', './style-extras.css', './style-net.css',
  './engine.js', './openings-extra.js', './game.js',
  './analysis.js', './analysis-export.js', './extras.js',
  './ui-extras.js', './puzzles.js', './puzzles-v2.js',
  './client-net.js', './polish-extras.js', './copy-extras.js',
  './pwa.js', './push-client.js', './manifest.json'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(STATIC_ASSETS).catch(function (err) {
        console.warn('[sw] Cache partial:', err);
      });
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) { if (k !== CACHE_NAME) return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  var url = new URL(req.url);
  if (url.pathname.indexOf('/api/') >= 0 || url.pathname.indexOf('/ws') >= 0) return;
  if (url.origin !== self.location.origin) return;
  e.respondWith(
    caches.match(req).then(function (cached) {
      if (cached) {
        fetch(req).then(function (res) {
          if (res && res.status === 200) caches.open(CACHE_NAME).then(function (c) { c.put(req, res.clone()); });
        }).catch(function () {});
        return cached;
      }
      return fetch(req).then(function (res) {
        if (res && res.status === 200 && req.method === 'GET') {
          var copy = res.clone();
          caches.open(CACHE_NAME).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () {
        if (req.headers.get('accept') && req.headers.get('accept').indexOf('text/html') >= 0) return caches.match('./index.html');
      });
    })
  );
});

/* ---------- Web Push ---------- */
self.addEventListener('push', function (e) {
  var data = {};
  try { data = e.data ? e.data.json() : {}; } catch (err) { data = { body: e.data ? e.data.text() : 'Soupeř táhl.' }; }
  var title = data.title || 'Šachy';
  var body = data.body || 'Soupeř táhl.';
  var url = data.url || './';
  var tag = data.tag || 'sachy';

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      /* Pokud je nějaký tab vidět, notifikaci neposílej (uživatel se dívá) */
      for (var i = 0; i < list.length; i++) {
        if (list[i].visibilityState === 'visible') {
          return;
        }
      }
      return self.registration.showNotification(title, {
        body: body,
        icon: 'icon-192.png',
        badge: 'icon-192.png',
        tag: tag,
        renotify: false,
        data: { url: url }
      });
    })
  );
});

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        var c = list[i];
        if (c.url.indexOf(self.location.origin) === 0) {
          if ('focus' in c) c.focus();
          if ('navigate' in c) c.navigate(url);
          return;
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
