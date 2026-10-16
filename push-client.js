/* =========================================================================
   Šachy – push-client.js
   Registrace Web Push subscription.
   Přidá do multiplayer modalu tlačítko "Zapnout notifikace".
   Autor: Better DeepSeek (AI) · Zadavatel: Jan Hošek · 2026
   SPDX-License-Identifier: GPL-3.0-or-later
   ========================================================================= */

(function () {
  'use strict';

  var pushEnabled = false;
  var vapidPublicKey = null;

  function urlBase64ToUint8Array(base64String) {
    var padding = '='.repeat((4 - base64String.length % 4) % 4);
    var base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    var rawData = atob(base64);
    var outputArray = new Uint8Array(rawData.length);
    for (var i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
    return outputArray;
  }

  function isSupported() {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }

  async function fetchVapidKey() {
    if (vapidPublicKey) return vapidPublicKey;
    try {
      var res = await fetch('api/vapid-public-key');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var data = await res.json();
      vapidPublicKey = data.publicKey;
      return vapidPublicKey;
    } catch (e) {
      console.warn('[push] Nepodařilo se získat VAPID klíč:', e);
      return null;
    }
  }

  async function enablePush() {
    if (!isSupported()) {
      toast('Tvůj prohlížeč nepodporuje Web Push.');
      return;
    }
    var perm = await Notification.requestPermission();
    if (perm !== 'granted') {
      toast('Notifikace nebyly povoleny.');
      return;
    }
    var key = await fetchVapidKey();
    if (!key) { toast('Server neposkytl VAPID klíč.'); return; }

    var reg;
    try {
      reg = await navigator.serviceWorker.ready;
    } catch (e) {
      toast('Service worker není zaregistrovaný.');
      return;
    }
    var sub;
    try {
      sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(key)
        });
      }
    } catch (e) {
      toast('Nepodařilo se přihlásit k odběru: ' + (e.message || e));
      return;
    }
    pushEnabled = true;
    sendSubscription(sub);
    updateButton();
    toast('Notifikace zapnuty.');
  }

  async function disablePush() {
    try {
      var reg = await navigator.serviceWorker.ready;
      var sub = await reg.pushManager.getSubscription();
      if (sub) {
        sendUnsubscribe(sub.endpoint);
        await sub.unsubscribe();
      }
    } catch (e) {}
    pushEnabled = false;
    updateButton();
    toast('Notifikace vypnuty.');
  }

  function sendSubscription(sub) {
    if (typeof window.mpSend !== 'function') return;
    var json = sub.toJSON ? sub.toJSON() : {
      endpoint: sub.endpoint,
      keys: { p256dh: null, auth: null }
    };
    window.mpSend({ type: 'push-subscribe', subscription: json });
  }
  function sendUnsubscribe(endpoint) {
    if (typeof window.mpSend !== 'function') return;
    window.mpSend({ type: 'push-unsubscribe', endpoint: endpoint });
  }

  /* ---------- UI tlačítko v multiplayer modalu ---------- */
  var buttonEl = null;

  function updateButton() {
    if (!buttonEl) return;
    buttonEl.textContent = pushEnabled ? 'Vypnout notifikace' : 'Zapnout notifikace';
  }

  function injectButton() {
    var modal = document.getElementById('mpModal');
    if (!modal) return;
    var lobby = modal.querySelector('#mpLobby');
    if (!lobby) return;
    if (lobby.querySelector('#pushToggleBtn')) { buttonEl = lobby.querySelector('#pushToggleBtn'); updateButton(); return; }

    var sec = document.createElement('div');
    sec.className = 'mp-section';
    sec.innerHTML = '<h3>Notifikace</h3>' +
      '<p class="hint-mini" style="margin-bottom:10px">Když soupeř táhne a ty máš zavřený nebo skrytý tab, dostaneš systémovou notifikaci.</p>';
    var btn = document.createElement('button');
    btn.id = 'pushToggleBtn';
    btn.className = 'btn btn-outline';
    btn.textContent = 'Zapnout notifikace';
    btn.addEventListener('click', function () {
      if (pushEnabled) disablePush(); else enablePush();
    });
    sec.appendChild(btn);
    lobby.appendChild(sec);
    buttonEl = btn;

    if (!isSupported()) {
      btn.disabled = true;
      btn.textContent = 'Notifikace nejsou podporované';
    } else {
      navigator.serviceWorker.ready.then(function (reg) {
        return reg.pushManager.getSubscription();
      }).then(function (sub) {
        if (sub) { pushEnabled = true; updateButton(); }
      }).catch(function () {});
    }
  }

  /* Hák: sledujeme, kdy se multiplayer modal otevře (existuje #mpLobby) */
  var observer = new MutationObserver(function () {
    if (document.getElementById('mpLobby')) injectButton();
  });
  document.addEventListener('DOMContentLoaded', function () {
    observer.observe(document.body, { childList: true, subtree: true });
  });

  /* Handle pro serverové potvrzení */
  window.addEventListener('sachy-mp-msg', function (e) {
    var msg = e.detail;
    if (!msg) return;
    if (msg.type === 'push-subscribed' && msg.ok) {
      toast('Notifikace aktivní.');
    }
  });

  function toast(text) {
    if (typeof showToast === 'function') { try { showToast(text); return; } catch (e) {} }
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = text; el.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.hidden = true; }, 2400);
  }
})();
