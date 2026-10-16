/* =========================================================================
   Šachy – copy-extras.js
   Přidá tlačítka "Kopírovat PGN" a "Kopírovat FEN" vedle exportu.
   Autor: Better DeepSeek (AI) · Zadavatel: Jan Hošek · 2026
   SPDX-License-Identifier: GPL-3.0-or-later
   ========================================================================= */

(function () {
  'use strict';

  function copyToClipboard(text, successMsg) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        toast(successMsg || 'Zkopírováno do schránky.');
      }, function () {
        window.prompt('Zkopíruj ručně:', text);
      });
    } else {
      window.prompt('Zkopíruj ručně:', text);
    }
  }
  function toast(msg) {
    if (typeof showToast === 'function') { try { showToast(msg); return; } catch (e) {} }
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.hidden = true; }, 2400);
  }

  function buildPgnString() {
    if (!moveListSAN || moveListSAN.length === 0) return '';
    var NL = String.fromCharCode(10);
    var date = new Date();
    function p2(n) { return n < 10 ? '0' + n : '' + n; }
    var dateStr = date.getFullYear() + '.' + p2(date.getMonth() + 1) + '.' + p2(date.getDate());
    var white = playerColor === 'w' ? 'Hráč' : 'Počítač';
    var black = playerColor === 'b' ? 'Hráč' : 'Počítač';
    var result = '*';
    if (typeof gameOver !== 'undefined' && gameOver) {
      var moves = getAllLegalMoves(board, turn, state);
      if (moves.length === 0) {
        result = inCheck(board, turn, state) ? (turn === 'w' ? '0-1' : '1-0') : '1/2-1/2';
      } else result = '1/2-1/2';
    }
    var lines = [
      '[Event "Přátelská partie"]',
      '[Site "Šachy (Better DeepSeek)"]',
      '[Date "' + dateStr + '"]',
      '[White "' + white + '"]',
      '[Black "' + black + '"]',
      '[Result "' + result + '"]',
      ''
    ];
    var cur = '';
    for (var i = 0; i < moveListSAN.length; i++) {
      if (i % 2 === 0) cur += (i / 2 + 1) + '. ';
      cur += moveListSAN[i] + ' ';
      if (cur.length > 78) { lines.push(cur.trim()); cur = ''; }
    }
    if (cur.trim()) lines.push(cur.trim());
    lines.push(result);
    return lines.join(NL) + NL;
  }

  function injectButtons() {
    var exportBtn = document.getElementById('exportBtn');
    if (!exportBtn) return;
    var parent = exportBtn.parentNode;
    if (!parent || parent.querySelector('#copyPgnBtn')) return;

    var cpPgn = document.createElement('button');
    cpPgn.id = 'copyPgnBtn';
    cpPgn.className = 'btn btn-outline';
    cpPgn.textContent = 'Kopírovat PGN';
    cpPgn.addEventListener('click', function () {
      var s = buildPgnString();
      if (!s) { toast('Žádné tahy k exportu.'); return; }
      copyToClipboard(s, 'PGN zkopírováno.');
    });

    var cpFen = document.createElement('button');
    cpFen.id = 'copyFenBtn2';
    cpFen.className = 'btn btn-outline';
    cpFen.textContent = 'Kopírovat FEN';
    cpFen.addEventListener('click', function () {
      var fi = document.getElementById('fenInput');
      if (!fi) return;
      copyToClipboard(fi.value, 'FEN zkopírován.');
    });

    parent.appendChild(cpPgn);
    parent.appendChild(cpFen);
  }

  function init() {
    injectButtons();
    /* Kdyby se UI překreslilo, zkus znovu */
    setTimeout(injectButtons, 500);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 200); });
  } else {
    setTimeout(init, 200);
  }
})();
