/* =========================================================================
   Šachy – puzzles.js
   Taktické hádanky (mat 1. tahem). Obsahuje malý FEN parser.
   Načítá se po ui-extras.js. Hákuje se do makeMove() pro kontrolu řešení.
   Autor: Better DeepSeek (AI) · Zadavatel: Jan Hošek · 2026
   SPDX-License-Identifier: GPL-3.0-or-later
   ========================================================================= */

(function () {
  'use strict';

  var PUZZLES = [
    { name: 'Mat na zadní řadě',
      fen: '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1',
      hint: 'Věž na a8' },
    { name: 'Dáma na a8',
      fen: '7k/6pp/8/8/8/8/6PP/Q6K w - - 0 1',
      hint: 'Šach na 8. řadu' },
    { name: 'Opozice králů',
      fen: 'k7/8/K7/8/8/8/8/7R w - - 0 1',
      hint: 'Král hlídá útěk' },
    { name: 'Dáma na b7',
      fen: 'k7/8/K7/8/8/8/8/1Q6 w - - 0 1',
      hint: 'Dáma přímo vedle krále' },
    { name: 'Mat věží v rohu',
      fen: '6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1',
      hint: 'Věž na e8' }
  ];

  function parseFEN(fen) {
    var parts = fen.split(' ');
    var rows = parts[0].split('/');
    var b = [];
    for (var r = 0; r < 8; r++) {
      var row = [];
      var rank = rows[r];
      for (var i = 0; i < rank.length; i++) {
        var ch = rank[i];
        if (ch >= '1' && ch <= '8') {
          var n = ch.charCodeAt(0) - 48;
          for (var k = 0; k < n; k++) row.push(null);
        } else {
          var color = (ch === ch.toUpperCase()) ? 'w' : 'b';
          row.push({ type: ch.toLowerCase(), color: color });
        }
      }
      b.push(row);
    }
    var st = freshState();
    st.castling.w.k = parts[2].indexOf('K') >= 0;
    st.castling.w.q = parts[2].indexOf('Q') >= 0;
    st.castling.b.k = parts[2].indexOf('k') >= 0;
    st.castling.b.q = parts[2].indexOf('q') >= 0;
    st.enPassant = null;
    return { board: b, state: st, turn: (parts[1] === 'b' ? 'b' : 'w') };
  }

  var currentPuzzle = null;

  function loadPuzzle(idx) {
    if (idx < 0 || idx >= PUZZLES.length) return;
    var p = PUZZLES[idx];
    var parsed = parseFEN(p.fen);
    board = parsed.board;
    state = parsed.state;
    turn = parsed.turn;
    selected = null;
    legalTargets = [];
    lastMove = null;
    gameOver = false;
    capByWhite = [];
    capByBlack = [];
    moveListSAN = [];
    uciHistory = [];
    thinking = false;
    hintMove = null;
    pendingPromotion = null;
    halfmoveClock = 0;
    fullmoveNumber = 1;
    gameAnnotations = [];
    positionCounts = new Map();
    positionCounts.set(hashPosition(board, state, turn), 1);
    moveHistory = [getSnapshot()];
    historyIndex = 0;
    flipped = false;
    clearSearchTables();
    currentPuzzle = p;
    updateStatus();
    render();
    showToast('Hádanka: ' + p.name, 2500);
    var m = document.getElementById('puzzleModal');
    if (m) m.hidden = true;
  }

  /* Hák do makeMove: po tahu zkontroluj, zda je to mat */
  if (typeof makeMove === 'function') {
    var _origMakeMove = makeMove;
    window.makeMove = function (move) {
      var wasPuzzle = currentPuzzle;
      _origMakeMove.apply(this, arguments);
      if (!wasPuzzle) return;
      setTimeout(function () {
        var legal = getAllLegalMoves(board, turn, state);
        if (legal.length === 0 && inCheck(board, turn, state)) {
          showToast('🎉 Vyřešeno: ' + wasPuzzle.name, 3500);
          currentPuzzle = null;
        } else {
          showToast('Zkus to znovu.', 1500);
          currentPuzzle = wasPuzzle;
          gotoHistory(0);
        }
      }, 350);
    };
  }

  function buildPuzzleList() {
    var list = document.getElementById('puzzleList');
    if (!list) return;
    list.innerHTML = '';
    for (var i = 0; i < PUZZLES.length; i++) {
      (function (idx) {
        var p = PUZZLES[idx];
        var item = document.createElement('button');
        item.className = 'puzzle-item';
        var b = document.createElement('b');
        b.textContent = (idx + 1) + '.';
        item.appendChild(b);
        item.appendChild(document.createTextNode(' ' + p.name));
        var h = document.createElement('span');
        h.className = 'puzzle-hint';
        h.textContent = p.hint;
        item.appendChild(h);
        item.addEventListener('click', function () { loadPuzzle(idx); });
        list.appendChild(item);
      })(i);
    }
  }

  function setupUI() {
    var btn = document.getElementById('puzzleBtn');
    var modal = document.getElementById('puzzleModal');
    var c1 = document.getElementById('puzzleClose');
    var c2 = document.getElementById('puzzleCloseBtn');
    if (btn && modal) btn.addEventListener('click', function () {
      buildPuzzleList();
      modal.hidden = false;
    });
    if (c1 && modal) c1.addEventListener('click', function () { modal.hidden = true; });
    if (c2 && modal) c2.addEventListener('click', function () { modal.hidden = true; });
    if (modal) modal.addEventListener('click', function (e) {
      if (e.target === modal) modal.hidden = true;
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(setupUI, 60); });
  } else {
    setTimeout(setupUI, 60);
  }
})();
