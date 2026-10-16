/* =========================================================================
   Šachy – pwa.js
   Registrace service workeru a nabídka instalace na plochu.
   Autor: Better DeepSeek (AI) · Zadavatel: Jan Hošek · 2026
   SPDX-License-Identifier: GPL-3.0-or-later
   ========================================================================= */

(function () {
  'use strict';

  /* ---------- Registrace service workeru ---------- */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js', { scope: './' })
        .then(function (reg) {
          console.log('[PWA] Service worker registrovan:', reg.scope);
        })
        .catch(function (err) {
          console.warn('[PWA] Registrace SW selhala:', err);
        });
    });
  }

  /* ---------- Install prompt ---------- */
  var deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    showInstallButton();
  });

  window.addEventListener('appinstalled', function () {
    console.log('[PWA] Hra nainstalována.');
    hideInstallButton();
  });

  function showInstallButton() {
    if (document.getElementById('pwaInstallBtn')) return;
    var btn = document.createElement('button');
    btn.id = 'pwaInstallBtn';
    btn.className = 'btn btn-outline';
    btn.textContent = 'Nainstalovat hru';
    btn.style.marginTop = '8px';
    btn.addEventListener('click', function () {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function (result) {
        if (result.outcome === 'accepted') hideInstallButton();
        deferredPrompt = null;
      });
    });

    var target = document.querySelector('.board-controls');
    if (target) target.appendChild(btn);
  }

  function hideInstallButton() {
    var b = document.getElementById('pwaInstallBtn');
    if (b) b.remove();
  }

  /* ---------- Offline indikátor ---------- */
  function updateOnlineStatus() {
    var b = document.getElementById('pwaOffline');
    if (navigator.onLine) {
      if (b) b.remove();
    } else {
      if (b) return;
      var el = document.createElement('div');
      el.id = 'pwaOffline';
      el.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:#dc7c2a;color:#fff;padding:8px 14px;font-size:13px;font-weight:600;text-align:center;z-index:9999;';
      el.textContent = 'Jsi offline — hraješ ze cache.';
      document.body.appendChild(el);
    }
  }
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  updateOnlineStatus();
})();
