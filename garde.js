/* =========================================================================
   Šachy – garde.js
   Hlášení "Garde!" – upozornění, když po tvém tahu zůstane soupeřova
   dáma (nebo věž) napadená a nekrytá. Etiketa, ne pravidlo šachu.
   Autor: Better DeepSeek (AI) · Zadavatel: Jan Hošek · 2026
   SPDX-License-Identifier: GPL-3.0-or-later

   Chování:
     - Hlásí se jen v režimech, kde proti tobě hraje člověk (hot-seat,
       multiplayer, dva hráči). Vůči AI ne – ta si to "všimne" sama.
     - Hlásí se jen v momentě, kdy hrozba vznikla (ne opakovaně).
     - Uprostřed šachovnice se objeví mizející text "GARDE – dáma!"
       (nebo "GARDE – věž!"), stejně jako ŠACH/MAT.
     - Volitelný tichý zvuk (pokud jsou zapnuté zvuky).
     - Checkbox "Hlásit garde" v panelu Vzhled (default zapnuto).
   ========================================================================= */

(function () {
  'use strict';

  var STORAGE_KEY = 'sachy-garde-enabled';
  var gardeEnabled = true;

  /* Co hlásit? V klasické etiketě dáma (a volitelně věž).
     Zde hlásíme dámu vždy, věž volitelně (checkbox v UI).
     Pěšce, střelce, jezdce – nehlásíme. */
  var reportRook = false;
  var ROOK_KEY = 'sachy-garde-rook';

  /* Naposledy hlášená hrozba (aby se neopakovala) */
  var lastAnnouncedKey = null;

  /* ---------- Načtení voleb ---------- */
  function loadPrefs() {
    try {
      var v = localStorage.getItem(STORAGE_KEY);
      if (v === '0') gardeEnabled = false;
      if (v === '1') gardeEnabled = true;
      var r = localStorage.getItem(ROOK_KEY);
      if (r === '1') reportRook = true;
    } catch (e) {}
  }
  function savePrefs() {
    try {
      localStorage.setItem(STORAGE_KEY, gardeEnabled ? '1' : '0');
      localStorage.setItem(ROOK_KEY, reportRook ? '1' : '0');
    } catch (e) {}
  }

  /* ---------- Pomocné ---------- */
  function pieceName(type) {
    return { q: 'dáma', r: 'věž', b: 'střelec', n: 'jezdec', p: 'pěšec' }[type] || 'figura';
  }
  function sideName(color) {
    return color === 'w' ? 'Bílý' : 'Černý';
  }

  /* Zjistí, jestli je figura na [r,c] napadená soupeřem.
     Používá globální isAttacked z engine.js. */
  function isThreatened(b, r, c, byColor) {
    try { return isAttacked(b, r, c, byColor); } catch (e) { return false; }
  }

  /* Je figura na [r,c] krytá vlastními figurami?
     (tzn. existuje vlastní figura, která by ji bránila, kdyby ji soupeř vzal)
     Zjednodušeně: hledáme, jestli na pole [r,c] míří nějaká vlastní figura
     – vyzkoušíme to tak, že si představíme, že tam stojí vlastní pěšec
     a zeptáme se, jestli ho někdo z našich chrání. */
  function isDefended(b, r, c, color) {
    // Pro jednoduchost: projdeme vlastní figury a zkusíme, jestli by mohly
    // bránit pole [r,c]. Když na cílové pole umístíme vlastní pěšec (dočasně),
    // a zjistíme, jestli ho vlastní figury napadají – to je "krytí".
    var orig = b[r][c];
    var probe = { type: 'p', color: color };
    b[r][c] = probe;
    var defended = false;
    try {
      // Procházíme jen vlastní figury
      outer:
      for (var rr = 0; rr < 8; rr++) {
        for (var cc = 0; cc < 8; cc++) {
          if (rr === r && cc === c) continue;
          var p = b[rr][cc];
          if (!p || p.color !== color) continue;
          // Zkusíme, jestli by figura mohla teoreticky bránit pole [r,c].
          // To poznáme tak, že na pole [r,c] dáme SOUPEŘOVU figurku a
          // zeptáme se, jestli naše figura pole napadá.
          // (isAttacked zjišťuje, jestli pole napadá daná barva.)
          if (wouldAttack(b, rr, cc, r, c, color)) {
            defended = true;
            break outer;
          }
        }
      }
    } catch (e) {}
    b[r][c] = orig;
    return defended;
  }

  /* Zjistí, jestli figura na [fr,fc] (barva color) může bránit pole [tr,tc].
     Trik: dáme na [tr,tc] soupeřovu figurku a zavoláme isAttacked na [tr,tc]
     ze strany color; pokud true, pak tam figura "dosáhne". */
  function wouldAttack(b, fr, fc, tr, tc, color) {
    var orig = b[tr][tc];
    var enemyColor = (color === 'w') ? 'b' : 'w';
    // Dáme na cílové pole imaginárního soupeřova pěšce
    b[tr][tc] = { type: 'p', color: enemyColor };
    var res = false;
    try {
      res = isAttacked(b, tr, tc, color);
    } catch (e) {}
    b[tr][tc] = orig;
    return res;
  }

  /* ---------- Hledání ohrožených dám a věží ---------- */
  /* Vrací seznam { r, c, type, color } – ohrožené figury barvy `color`. */
  function findThreatenedHighValue(b, color) {
    var found = [];
    for (var r = 0; r < 8; r++) {
      for (var c = 0; c < 8; c++) {
        var p = b[r][c];
        if (!p || p.color !== color) continue;
        if (p.type !== 'q' && p.type !== 'r') continue;
        if (!reportRook && p.type === 'r') continue;
        var enemy = (color === 'w') ? 'b' : 'w';
        if (!isThreatened(b, r, c, enemy)) continue;
        // Ohrožená + nekrytá = hrozba, kterou má smysl hlásit
        if (isDefended(b, r, c, color)) continue;
        found.push({ r: r, c: c, type: p.type, color: color });
      }
    }
    return found;
  }

  /* ---------- Rozhodnutí, zda a co hlásit ---------- */
  /* Voláno po tahu. Klíčeme na to, že hrozba vznikla po tahu HRÁČE,
     který právě táhl. Tzn. barva, která právě táhla, je `other(turn)`. */
  function checkAndAnnounce() {
    if (!gardeEnabled) return;
    if (typeof board === 'undefined' || typeof turn === 'undefined' || typeof state === 'undefined') return;

    // Přeskočit, když hraje AI proti člověku – tam garde nemá smysl
    // (AI si toho všimne sama a hlásit si to nemá kdo).
    var isHumanVsHuman = true;
    try {
      if (typeof aiEnabled !== 'undefined' && aiEnabled) isHumanVsHuman = false;
      if (typeof selfPlay !== 'undefined' && selfPlay) isHumanVsHuman = false;
    } catch (e) {}

    // V multiplayer režimu je člověk proti člověku – tam hlásíme.
    // V hot-seat je člověk proti člověku – tam hlásíme.
    // V singleplayeru proti AI – nehlásíme.
    // (Pokud klient ví o režimu multiplayer z client-net.js, necháme
    //  pravidlo "aiEnabled nebo selfPlay = nehlásit".)

    var moverColor = (turn === 'w') ? 'b' : 'w'; // kdo právě táhl

    // Zkontrolujeme, jestli po tahu zůstala ohrožená dáma/věž SOUPEŘE,
    // tedy barvy, která je právě na tahu (turn) – to je protivník toho,
    // kdo táhl.
    var threatened = findThreatenedHighValue(board, turn);
    if (threatened.length === 0) {
      lastAnnouncedKey = null;
      return;
    }

    // Klíč – abychom hlásili jen jednou pro danou kombinaci tahu/pozice
    var key = threatened.map(function (t) { return t.r + '' + t.c + t.type; }).join('|') +
              ':' + (typeof uciHistory !== 'undefined' ? uciHistory.length : 0);
    if (key === lastAnnouncedKey) return;
    lastAnnouncedKey = key;

    // Hlásíme jen v režimech "člověk proti člověku"
    if (!isHumanVsHuman) return;

    var t = threatened[0];
    var text = 'GARDE – ' + pieceName(t.type) + '!';
    showGardeNotice(text);
    playGardeSound();
  }

  /* ---------- Vykreslení upozornění ---------- */
  function showGardeNotice(text) {
    var frame = document.getElementById('boardFrame');
    if (!frame) return;
    if (getComputedStyle(frame).position === 'static') frame.style.position = 'relative';

    var el = document.getElementById('gardeNotice');
    if (!el) {
      el = document.createElement('div');
      el.id = 'gardeNotice';
      el.className = 'board-notice';
      frame.appendChild(el);
    }
    el.textContent = text;
    el.className = 'board-notice board-notice-garde';
    el.hidden = false;
    // Restart animace
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
    clearTimeout(showGardeNotice._t);
    showGardeNotice._t = setTimeout(function () { el.hidden = true; }, 2200);
  }

  /* ---------- Zvuk (tichý, jiný než šach) ---------- */
  function playGardeSound() {
    try {
      if (typeof soundsEnabled !== 'undefined' && !soundsEnabled) return;
      if (typeof getAudioCtx !== 'function') return;
      var ctx = getAudioCtx();
      if (!ctx) return;
      var now = ctx.currentTime;
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = 660;
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
      osc.start(now);
      osc.stop(now + 0.20);
      // druhý tón o chvíli později
      var osc2 = ctx.createOscillator();
      var gain2 = ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.value = 880;
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      gain2.gain.setValueAtTime(0.0001, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.05, now + 0.14);
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.34);
    } catch (e) {}
  }

  /* ---------- Hák do makeMove: po tahu zkontroluj hrozbu ---------- */
  if (typeof window.makeMove === 'function') {
    var _origMakeMove = window.makeMove;
    window.makeMove = function (move) {
      _origMakeMove.apply(this, arguments);
      // malá prodleva, aby proběhly ostatní háky (animace, status atd.)
      setTimeout(checkAndAnnounce, 60);
    };
  }
  // Pro jistotu i periodická kontrola (např. undo, import)
  setInterval(function () {
    // Nesmí se opakovat – chráněno přes lastAnnouncedKey
    checkAndAnnounce();
  }, 1200);

  /* ---------- UI: checkbox v panelu Vzhled ---------- */
  function injectUI() {
    var boxes = document.querySelectorAll('.panel .box');
    var target = null;
    for (var i = 0; i < boxes.length; i++) {
      var t = boxes[i].querySelector('.box-title');
      if (t && t.textContent.indexOf('Vzhled') >= 0) { target = boxes[i]; break; }
    }
    if (!target) return;
    if (target.querySelector('#gardeToggle')) return;

    var lbl = document.createElement('label');
    lbl.className = 'toggle';
    lbl.innerHTML = '<input type="checkbox" id="gardeToggle"><span>Hlásit „garde"</span>';
    target.appendChild(lbl);

    var lbl2 = document.createElement('label');
    lbl2.className = 'toggle';
    lbl2.innerHTML = '<input type="checkbox" id="gardeRookToggle"><span>Hlásit i věž</span>';
    lbl2.style.fontSize = '12.5px';
    lbl2.style.color = 'var(--muted)';
    target.appendChild(lbl2);

    var info = document.createElement('div');
    info.style.fontSize = '11.5px';
    info.style.color = 'var(--muted)';
    info.style.marginTop = '2px';
    info.style.lineHeight = '1.4';
    info.textContent = 'Upozornění na ohroženou dámu (etiketa). Hlásí se jen při hře člověka proti člověku, ne proti AI.';
    target.appendChild(info);

    var cb = lbl.querySelector('#gardeToggle');
    var cbR = lbl2.querySelector('#gardeRookToggle');
    cb.checked = gardeEnabled;
    cbR.checked = reportRook;

    cb.addEventListener('change', function (e) {
      gardeEnabled = e.target.checked;
      if (!gardeEnabled) lastAnnouncedKey = null;
      savePrefs();
    });
    cbR.addEventListener('change', function (e) {
      reportRook = e.target.checked;
      lastAnnouncedKey = null;
      savePrefs();
    });
  }

  /* ---------- Start ---------- */
  function init() {
    loadPrefs();
    injectUI();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 300); });
  } else {
    setTimeout(init, 300);
  }
})();
