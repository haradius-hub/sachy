/* =========================================================================
   Šachy – notice.js
   Výrazné mizející upozornění na ŠACH, MAT a PAT.
   Zobrazí velký text uprostřed šachovnice.
   Autor: Better DeepSeek (AI) · Zadavatel: Jan Hošek · 2026
   SPDX-License-Identifier: GPL-3.0-or-later
   ========================================================================= */

(function () {
  'use strict';

  var currentNotice = null;

  function ensureNoticeEl() {
    if (currentNotice && currentNotice.parentNode) return currentNotice;
    var boardArea = document.querySelector('.board-area');
    if (!boardArea) return null;

    // Potřebujeme pozicovat relativně k šachovnici
    var frame = document.getElementById('boardFrame');
    if (frame && getComputedStyle(frame).position === 'static') {
      frame.style.position = 'relative';
    }

    currentNotice = document.createElement('div');
    currentNotice.id = 'boardNotice';
    currentNotice.className = 'board-notice';
    currentNotice.hidden = true;
    (frame || boardArea).appendChild(currentNotice);
    return currentNotice;
  }

  function showNotice(text, kind) {
    var el = ensureNoticeEl();
    if (!el) return;
    el.textContent = text;
    el.className = 'board-notice board-notice-' + (kind || 'info');
    el.hidden = false;
    // Restart animace
    el.style.animation = 'none';
    // Force reflow
    void el.offsetWidth;
    el.style.animation = '';
    clearTimeout(showNotice._t);
    var ms = kind === 'mate' ? 4200 : (kind === 'check' ? 1800 : 2400);
    showNotice._t = setTimeout(function () { el.hidden = true; }, ms);
  }

  /* ---------- Detekce události ---------- */
  var lastTurn = null;
  var lastGameOver = false;
  var lastCheckState = false;

  function check() {
    if (typeof board === 'undefined' || typeof turn === 'undefined') return;
    if (typeof state === 'undefined') return;

    var isGameOver = typeof gameOver !== 'undefined' && gameOver;
    var isCheck = false;
    try { isCheck = inCheck(board, turn, state); } catch (e) { return; }

    // Konec partie
    if (isGameOver && !lastGameOver) {
      var moves;
      try { moves = getAllLegalMoves(board, turn, state); } catch (e) { moves = []; }
      if (moves.length === 0) {
        if (isCheck) {
          // Mat – vítězí protihráč tahu, který je na tahu
          var winner = turn === 'w' ? 'Černý' : 'Bílý';
          showNotice('MAT!', 'mate');
          // Menší doplňující text ukážeme v statusu (ten už to dělá)
        } else {
          showNotice('PAT', 'draw');
        }
      }
    }

    // Nový šach (jen pokud ne mat)
    if (!isGameOver && isCheck && (!lastCheckState || lastTurn !== turn)) {
      // Nespustit znovu, pokud už je zobrazené "MAT!"
      if (!currentNotice || currentNotice.hidden || currentNotice.textContent !== 'MAT!') {
        showNotice('ŠACH!', 'check');
      }
    }

    lastTurn = turn;
    lastGameOver = isGameOver;
    lastCheckState = isCheck;
  }

  /* Periodická kontrola – jednoduché a spolehlivé */
  setInterval(check, 250);

  /* Hák na updateStatus, aby notifikace přišla hned po tahu */
  if (typeof window.updateStatus === 'function') {
    var _orig = window.updateStatus;
    window.updateStatus = function () {
      _orig.apply(this, arguments);
      try { check(); } catch (e) {}
    };
  }
})();
