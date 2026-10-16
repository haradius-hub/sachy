/* =========================================================================
   Šachy – lite-mode.js
   Režim pro slabé stroje (starý hardware, tablety, mobily).
   Vypne animace, tooltip, eval bar, ohrožené figury a sníží AI.
   Autor: Better DeepSeek (AI) · Zadavatel: Jan Hošek · 2026
   SPDX-License-Identifier: GPL-3.0-or-later
   ========================================================================= */

(function () {
  'use strict';

  var LITE_KEY = 'sachy-lite-mode';
  var liteOn = false;

  /* ---------- Zjištění stavu z URL nebo localStorage ---------- */
  function shouldBeOn() {
    try {
      var url = new URL(location.href);
      if (url.searchParams.get('lite') === '1') return true;
      if (url.searchParams.get('lite') === '0') return false;
    } catch (e) {}
    try {
      var v = localStorage.getItem(LITE_KEY);
      if (v === '1') return true;
      if (v === '0') return false;
    } catch (e) {}
    return false;
  }

  function saveLite(on) {
    try { localStorage.setItem(LITE_KEY, on ? '1' : '0'); } catch (e) {}
  }

  /* ---------- Aplikace lite režimu ---------- */
  function applyLite(on) {
    liteOn = on;
    document.body.classList.toggle('lite-mode', on);

    // Vypneme threathighlighting checkbox (a dispatch change, ať se to propíše)
    var th = document.getElementById('threatToggle');
    if (th && on && th.checked) {
      th.checked = false;
      th.dispatchEvent(new Event('change'));
    }

    // Vypneme zvuky (Web Audio na starých strojích zbytečná zátěž)
    var s = document.getElementById('soundToggle');
    if (s && on && s.checked) {
      s.checked = false;
      s.dispatchEvent(new Event('change'));
    }

    // Zmenšíme AI (hloubka, quiescence) — přes globální AI_CONFIG
    if (typeof window.AI_CONFIG === 'object' && window.AI_CONFIG) {
      var cfg = window.AI_CONFIG;
      if (on) {
        // Uložíme si původní hodnoty (jen jednou)
        if (!cfg._origForLite) {
          cfg._origForLite = JSON.parse(JSON.stringify(cfg));
        }
        cfg.easy   = { maxDepth: 1, timeMs: 60,   useQ: false, randomTop: 6 };
        cfg.club   = { maxDepth: 2, timeMs: 200,  useQ: false, randomTop: 1, blunderChance: 0.15 };
        cfg.medium = { maxDepth: 2, timeMs: 250,  useQ: false, randomTop: 2 };
        cfg.hard   = { maxDepth: 3, timeMs: 500,  useQ: false, randomTop: 1 };
        cfg.expert = { maxDepth: 3, timeMs: 800,  useQ: false, randomTop: 1 };
      } else if (cfg._origForLite) {
        // Obnovit originální hodnoty
        var orig = cfg._origForLite;
        cfg.easy = orig.easy;
        cfg.club = orig.club;
        cfg.medium = orig.medium;
        cfg.hard = orig.hard;
        cfg.expert = orig.expert;
        delete cfg._origForLite;
      }
    }

    // Skryjeme tooltip pokud zůstal otevřený
    var tip = document.getElementById('moveTooltip');
    if (tip && on) tip.hidden = true;

    // Aktualizujeme UI
    var cb = document.getElementById('liteModeToggle');
    if (cb) cb.checked = on;
    var info = document.getElementById('liteModeInfo');
    if (info) info.textContent = on
      ? 'Lehký režim: ZAP (méně animací, slabší AI)'
      : 'Lehký režim: vyp';

    if (typeof showToast === 'function') {
      // Show only when user toggled (not initial)
      // handled by caller
    }
  }

  /* Veřejná funkce pro perf-detect.js */
  window.sachySetLiteMode = function (on) {
    saveLite(on);
    applyLite(on);
  };
  window.sachyGetLiteMode = function () { return liteOn; };

  /* ---------- UI ---------- */
  function injectUI() {
    var boxes = document.querySelectorAll('.panel .box');
    var target = null;
    for (var i = 0; i < boxes.length; i++) {
      var t = boxes[i].querySelector('.box-title');
      if (t && t.textContent.indexOf('Vzhled') >= 0) { target = boxes[i]; break; }
    }
    if (!target) return;
    if (target.querySelector('#liteModeToggle')) return;

    var section = document.createElement('div');
    section.style.marginTop = '10px';
    section.style.paddingTop = '10px';
    section.style.borderTop = '1px solid var(--line)';

    var lbl = document.createElement('label');
    lbl.className = 'toggle';
    lbl.innerHTML = '<input type="checkbox" id="liteModeToggle"><span><b>Lehký režim</b> (starý HW)</span>';
    section.appendChild(lbl);

    var info = document.createElement('div');
    info.id = 'liteModeInfo';
    info.style.fontSize = '11.5px';
    info.style.color = 'var(--muted)';
    info.style.marginTop = '4px';
    info.style.lineHeight = '1.4';
    info.textContent = 'Vypne animace, tooltip, eval bar a sníží AI. Doporučeno pro slabší stroje.';
    section.appendChild(info);

    target.appendChild(section);

    var cb = section.querySelector('#liteModeToggle');
    cb.checked = liteOn;
    cb.addEventListener('change', function (e) {
      var on = e.target.checked;
      saveLite(on);
      applyLite(on);
      if (typeof showToast === 'function') {
        showToast(on ? 'Lehký režim zapnut.' : 'Lehký režim vypnut.');
      }
    });
  }

  /* ---------- Start ---------- */
  function init() {
    applyLite(shouldBeOn());
    injectUI();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 300); });
  } else {
    setTimeout(init, 300);
  }
})();
