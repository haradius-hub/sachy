/* =========================================================================
   Šachy – herní logika
   Autor: Better DeepSeek (AI)
   Zadavatel / iniciátor projektu: Jan Hošek
   Rok: 2026
   SPDX-License-Identifier: GPL-3.0-or-later

   Nově navíc:
   - Self-play mód (AI vs AI) s nastavitelnou rychlostí
   - Vylepšená evaluace: mobilita (jezdci + střelci),
     bezpečnost krále (pěšcový štít, rošáda, centrum v midgame),
     outpost bonus pro jezdce kryté vlastním pěšcem
   ========================================================================= */

(function () {
  'use strict';

  window.addEventListener('error', function (e) {
    var el = document.getElementById('status');
    if (el) el.textContent = '⚠ Chyba: ' + (e.message || e.error);
    console.error('[Šachy]', e.error || e.message);
  });

  /* =====================================================================
     KONSTANTY
     ===================================================================== */
  var FILES = 'abcdefgh';
  var GLYPH = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
  var VALUES = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };
  var MATE_SCORE = 1000000;
  var INFINITY_SCORE = 100000000;

  var PST_PAWN = [
     0,  0,  0,  0,  0,  0,  0,  0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
     5,  5, 10, 25, 25, 10,  5,  5,
     0,  0,  0, 20, 20,  0,  0,  0,
     5, -5,-10,  0,  0,-10, -5,  5,
     5, 10, 10,-20,-20, 10, 10,  5,
     0,  0,  0,  0,  0,  0,  0,  0
  ];
  var PST_KNIGHT = [
    -50,-40,-30,-30,-30,-30,-40,-50,
    -40,-20,  0,  0,  0,  0,-20,-40,
    -30,  0, 10, 15, 15, 10,  0,-30,
    -30,  5, 15, 20, 20, 15,  5,-30,
    -30,  0, 15, 20, 20, 15,  0,-30,
    -30,  5, 10, 15, 15, 10,  5,-30,
    -40,-20,  0,  5,  5,  0,-20,-40,
    -50,-40,-30,-30,-30,-30,-40,-50
  ];
  var PST_BISHOP = [
    -20,-10,-10,-10,-10,-10,-10,-20,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -10,  0,  5, 10, 10,  5,  0,-10,
    -10,  5,  5, 10, 10,  5,  5,-10,
    -10,  0, 10, 10, 10, 10,  0,-10,
    -10, 10, 10, 10, 10, 10, 10,-10,
    -10,  5,  0,  0,  0,  0,  5,-10,
    -20,-10,-10,-10,-10,-10,-10,-20
  ];
  var PST_ROOK = [
      0,  0,  0,  0,  0,  0,  0,  0,
      5, 10, 10, 10, 10, 10, 10,  5,
     -5,  0,  0,  0,  0,  0,  0, -5,
     -5,  0,  0,  0,  0,  0,  0, -5,
     -5,  0,  0,  0,  0,  0,  0, -5,
     -5,  0,  0,  0,  0,  0,  0, -5,
     -5,  0,  0,  0,  0,  0,  0, -5,
      0,  0,  0,  5,  5,  0,  0,  0
  ];
  var PST_QUEEN = [
    -20,-10,-10, -5, -5,-10,-10,-20,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -10,  0,  5,  5,  5,  5,  0,-10,
     -5,  0,  5,  5,  5,  5,  0, -5,
      0,  0,  5,  5,  5,  5,  0, -5,
    -10,  5,  5,  5,  5,  5,  0,-10,
    -10,  0,  5,  0,  0,  0,  0,-10,
    -20,-10,-10, -5, -5,-10,-10,-20
  ];
  var PST_KING_MID = [
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -20,-30,-30,-40,-40,-30,-30,-20,
    -10,-20,-20,-20,-20,-20,-20,-10,
     20, 20,  0,  0,  0,  0, 20, 20,
     20, 30, 10,  0,  0, 10, 30, 20
  ];
  var PST_KING_END = [
    -50,-40,-30,-20,-20,-30,-40,-50,
    -30,-20,-10,  0,  0,-10,-20,-30,
    -30,-10, 20, 30, 30, 20,-10,-30,
    -30,-10, 30, 40, 40, 30,-10,-30,
    -30,-10, 30, 40, 40, 30,-10,-30,
    -30,-10, 20, 30, 30, 20,-10,-30,
    -30,-30,  0,  0,  0,  0,-30,-30,
    -50,-30,-30,-30,-30,-30,-30,-50
  ];

  var PASSED_PAWN_BONUS = [0, 10, 20, 35, 60, 100];

  var OPENING_BOOK = [
    ['e2e4','e7e5','g1f3','b8c6','f1b5','a7a6','b5a4','g8f6','e1g1','f8e7'],
    ['e2e4','e7e5','g1f3','b8c6','f1c4','f8c5','c2c3','g8f6','d2d4','e5d4'],
    ['e2e4','e7e5','g1f3','b8c6','d2d4','e5d4','f3d4','g8f6','b1c3','f8b4'],
    ['e2e4','c7c5','g1f3','d7d6','d2d4','c5d4','f3d4','g8f6','b1c3','a7a6'],
    ['e2e4','c7c5','g1f3','b8c6','d2d4','c5d4','f3d4','g8f6','b1c3','e7e5'],
    ['e2e4','e7e6','d2d4','d7d5','b1c3','g8f6','c1g5','f8e7','e4e5','f6d7'],
    ['e2e4','c7c6','d2d4','d7d5','b1c3','d5e4','c3e4','c8f5','e4g3','f5g6'],
    ['d2d4','d7d5','c2c4','e7e6','b1c3','g8f6','c1g5','f8e7','e2e3','e1g1'],
    ['d2d4','g8f6','c2c4','g7g6','b1c3','f8g7','e2e4','d7d6','g1f3','e1g1'],
    ['d2d4','g8f6','c2c4','e7e6','b1c3','f8b4','e2e3','e1g1','f1d3','d7d5'],
    ['g1f3','d7d5','c2c4','e7e6','d2d4','g8f6','b1c3','f8e7','c1g5','e1g1'],
    ['e2e4','e7e5','g1f3','g8f6','f3e5','d7d6','e5f3','f6e4','d2d4','d6d5'],
    ['e2e4','e7e5','f1c4','g8f6','d2d3','f8c5','g1f3','d7d6','c2c3','e1g1'],
    ['d2d4','d7d5','g1f3','g8f6','c2c4','e7e6','b1c3','f8e7','c1f4','e1g1'],
    ['d2d4','d7d5','c2c4','c7c6','g1f3','g8f6','b1c3','e7e6','c1g5','h7h6'],
    ['c2c4','e7e5','b1c3','g8f6','g1f3','b8c6','g2g3','d7d5','c4d5','f6d5'],
    ['g1f3','g8f6','g2g3','g7g6','f1g2','f8g7','e1g1','e8g8','d2d3','d7d6']
  ];

  /* Zobrist */
  var ZOBRIST = (function () {
    function rnd() { return (Math.random() * 0xFFFFFFFF) | 0; }
    var t = {};
    var pieces = ['wp','wn','wb','wr','wq','wk','bp','bn','bb','br','bq','bk'];
    for (var i = 0; i < pieces.length; i++) {
      t[pieces[i]] = [];
      for (var j = 0; j < 64; j++) t[pieces[i]].push(rnd());
    }
    t.side = rnd();
    t.castle = { wk: rnd(), wq: rnd(), bk: rnd(), bq: rnd() };
    t.ep = [];
    for (var k = 0; k < 64; k++) t.ep.push(rnd());
    return t;
  })();

  function hashPosition(b, st, color) {
    var h = 0;
    for (var r = 0; r < 8; r++)
      for (var c = 0; c < 8; c++) {
        var p = b[r][c];
        if (p) h ^= ZOBRIST[p.color + p.type][r * 8 + c];
      }
    if (st.castling.w.k) h ^= ZOBRIST.castle.wk;
    if (st.castling.w.q) h ^= ZOBRIST.castle.wq;
    if (st.castling.b.k) h ^= ZOBRIST.castle.bk;
    if (st.castling.b.q) h ^= ZOBRIST.castle.bq;
    if (st.enPassant) h ^= ZOBRIST.ep[st.enPassant.r * 8 + st.enPassant.c];
    if (color === 'b') h ^= ZOBRIST.side;
    return h;
  }

  /* TT + killer + history */
  var TT_FLAG = { EXACT: 0, LOWER: 1, UPPER: 2 };
  var TT = new Map();
  var TT_MAX = 200000;
  function ttStore(key, depth, score, flag, bestMove) {
    if (TT.size >= TT_MAX) TT.clear();
    TT.set(key, { depth: depth, score: score, flag: flag, bestMove: bestMove });
  }

  var MAX_PLY = 64;
  var killerMoves = [];
  for (var i = 0; i < MAX_PLY; i++) killerMoves.push([null, null]);
  var historyTable = [];
  for (var i = 0; i < 64; i++) historyTable.push(new Int32Array(64));

  function clearSearchTables() {
    TT.clear();
    for (var i = 0; i < MAX_PLY; i++) killerMoves[i] = [null, null];
    for (var j = 0; j < 64; j++) historyTable[j].fill(0);
  }
  function addKiller(ply, move) {
    if (ply >= MAX_PLY) return;
    var km = killerMoves[ply];
    if (km[0] && km[0].from.r === move.from.r && km[0].from.c === move.from.c &&
        km[0].to.r === move.to.r && km[0].to.c === move.to.c) return;
    km[1] = km[0];
    km[0] = { from: { r: move.from.r, c: move.from.c }, to: { r: move.to.r, c: move.to.c } };
  }

  /* =====================================================================
     STAV
     ===================================================================== */
  var board, turn, state, selected, legalTargets, lastMove, gameOver;
  var capByWhite, capByBlack, moveListSAN, uciHistory;
  var aiEnabled = false, thinking = false;
  var playerColor = 'w', flipped = false, difficulty = 'medium';
  var soundsEnabled = true, threatsEnabled = false, hintMove = null;
  var moveHistory = [], historyIndex = 0;
  var pendingAnimation = null;
  var pendingPromotion = null;
  var positionCounts = new Map();
  var halfmoveClock = 0;
  var fullmoveNumber = 1;
  var gameAnnotations = [];

  /* Self-play */
  var selfPlay = false;
  var selfPlaySpeedMs = 500;
  var selfPlayTimer = null;

  /* DOM */
  var boardEl = document.getElementById('board');
  var statusEl = document.getElementById('status');
  var moveListEl = document.getElementById('moveList');
  var capWhiteEl = document.getElementById('capByWhite');
  var capBlackEl = document.getElementById('capByBlack');
  var filesTopEl = document.getElementById('filesTop');
  var filesBottomEl = document.getElementById('filesBottom');
  var ranksLeftEl = document.getElementById('ranksLeft');
  var ranksRightEl = document.getElementById('ranksRight');
  var evalFillEl = document.getElementById('evalFill');
  var evalLabelEl = document.getElementById('evalLabel');
  var fenInputEl = document.getElementById('fenInput');

  /* =====================================================================
     POMOCNÉ
     ===================================================================== */
  function initialState() {
    var back = ['r','n','b','q','k','b','n','r'];
    var b = [];
    for (var r = 0; r < 8; r++) {
      var row = [];
      for (var c = 0; c < 8; c++) row.push(null);
      b.push(row);
    }
    for (var c = 0; c < 8; c++) {
      b[0][c] = { type: back[c], color: 'b' };
      b[1][c] = { type: 'p', color: 'b' };
      b[6][c] = { type: 'p', color: 'w' };
      b[7][c] = { type: back[c], color: 'w' };
    }
    return b;
  }
  function freshState() {
    return { enPassant: null, castling: { w: { k: true, q: true }, b: { k: true, q: true } } };
  }
  function cloneBoard(b) {
    var out = [];
    for (var r = 0; r < 8; r++) {
      var row = [];
      for (var c = 0; c < 8; c++) {
        var p = b[r][c];
        row.push(p ? { type: p.type, color: p.color } : null);
      }
      out.push(row);
    }
    return out;
  }
  function cloneState(s) {
    return {
      enPassant: s.enPassant ? { r: s.enPassant.r, c: s.enPassant.c } : null,
      castling: {
        w: { k: s.castling.w.k, q: s.castling.w.q },
        b: { k: s.castling.b.k, q: s.castling.b.q }
      }
    };
  }
  function inBounds(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }
  function other(color) { return color === 'w' ? 'b' : 'w'; }
  function findKing(b, color) {
    for (var r = 0; r < 8; r++)
      for (var c = 0; c < 8; c++) {
        var p = b[r][c];
        if (p && p.type === 'k' && p.color === color) return { r: r, c: c };
      }
    return null;
  }
  function moveToUCI(m) {
    return FILES[m.from.c] + (8 - m.from.r) + FILES[m.to.c] + (8 - m.to.r) + (m.promotion || '');
  }
  function uciToRC(sq) { return { r: 8 - parseInt(sq[1], 10), c: sq.charCodeAt(0) - 97 }; }
  function sameMove(a, b) {
    if (!a || !b) return false;
    return a.from.r === b.from.r && a.from.c === b.from.c &&
           a.to.r === b.to.r && a.to.c === b.to.c;
  }

  /* =====================================================================
     NAPADENÍ
     ===================================================================== */
  function isAttacked(b, r, c, byColor) {
    var pawnRow = byColor === 'w' ? r + 1 : r - 1;
    for (var dc = -1; dc <= 1; dc += 2) {
      var pc = c + dc;
      if (inBounds(pawnRow, pc)) {
        var p = b[pawnRow][pc];
        if (p && p.color === byColor && p.type === 'p') return true;
      }
    }
    var kd = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
    for (var i = 0; i < kd.length; i++) {
      var nr = r + kd[i][0], nc = c + kd[i][1];
      if (inBounds(nr, nc)) {
        var p = b[nr][nc];
        if (p && p.color === byColor && p.type === 'n') return true;
      }
    }
    var gd = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
    for (var i = 0; i < gd.length; i++) {
      var nr = r + gd[i][0], nc = c + gd[i][1];
      if (inBounds(nr, nc)) {
        var p = b[nr][nc];
        if (p && p.color === byColor && p.type === 'k') return true;
      }
    }
    var rd = [[-1,0],[1,0],[0,-1],[0,1]];
    for (var i = 0; i < rd.length; i++) {
      var nr = r + rd[i][0], nc = c + rd[i][1];
      while (inBounds(nr, nc)) {
        var p = b[nr][nc];
        if (p) {
          if (p.color === byColor && (p.type === 'r' || p.type === 'q')) return true;
          break;
        }
        nr += rd[i][0]; nc += rd[i][1];
      }
    }
    var bd = [[-1,-1],[-1,1],[1,-1],[1,1]];
    for (var i = 0; i < bd.length; i++) {
      var nr = r + bd[i][0], nc = c + bd[i][1];
      while (inBounds(nr, nc)) {
        var p = b[nr][nc];
        if (p) {
          if (p.color === byColor && (p.type === 'b' || p.type === 'q')) return true;
          break;
        }
        nr += bd[i][0]; nc += bd[i][1];
      }
    }
    return false;
  }

  /* =====================================================================
     POHYBY
     ===================================================================== */
  function pieceMoves(b, r, c, st) {
    var piece = b[r][c];
    if (!piece) return [];
    var color = piece.color;
    var enemy = other(color);
    var moves = [];

    function push(tr, tc) {
      if (!inBounds(tr, tc)) return;
      var target = b[tr][tc];
      if (!target || target.color === enemy) {
        moves.push({ from: { r: r, c: c }, to: { r: tr, c: tc } });
      }
    }

    if (piece.type === 'p') {
      var dir = color === 'w' ? -1 : 1;
      var startRow = color === 'w' ? 6 : 1;
      var lastRow = color === 'w' ? 0 : 7;
      if (inBounds(r + dir, c) && !b[r + dir][c]) {
        var m1 = { from: { r: r, c: c }, to: { r: r + dir, c: c } };
        if (r + dir === lastRow) m1.promotion = 'q';
        moves.push(m1);
        if (r === startRow && !b[r + 2 * dir][c]) {
          moves.push({ from: { r: r, c: c }, to: { r: r + 2 * dir, c: c } });
        }
      }
      for (var dc = -1; dc <= 1; dc += 2) {
        var tr = r + dir, tc = c + dc;
        if (!inBounds(tr, tc)) continue;
        var target = b[tr][tc];
        if (target && target.color === enemy) {
          var mm = { from: { r: r, c: c }, to: { r: tr, c: tc } };
          if (tr === lastRow) mm.promotion = 'q';
          moves.push(mm);
        } else if (st.enPassant && st.enPassant.r === tr && st.enPassant.c === tc) {
          moves.push({ from: { r: r, c: c }, to: { r: tr, c: tc }, enPassant: true });
        }
      }
      return moves;
    }
    if (piece.type === 'n') {
      var d = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
      for (var i = 0; i < d.length; i++) push(r + d[i][0], c + d[i][1]);
      return moves;
    }
    if (piece.type === 'b' || piece.type === 'r' || piece.type === 'q') {
      var dirs = [];
      if (piece.type === 'b' || piece.type === 'q') dirs.push([-1,-1],[-1,1],[1,-1],[1,1]);
      if (piece.type === 'r' || piece.type === 'q') dirs.push([-1,0],[1,0],[0,-1],[0,1]);
      for (var i = 0; i < dirs.length; i++) {
        var nr = r + dirs[i][0], nc = c + dirs[i][1];
        while (inBounds(nr, nc)) {
          var target = b[nr][nc];
          if (!target) {
            moves.push({ from: { r: r, c: c }, to: { r: nr, c: nc } });
          } else {
            if (target.color === enemy) moves.push({ from: { r: r, c: c }, to: { r: nr, c: nc } });
            break;
          }
          nr += dirs[i][0]; nc += dirs[i][1];
        }
      }
      return moves;
    }
    if (piece.type === 'k') {
      var d = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
      for (var i = 0; i < d.length; i++) push(r + d[i][0], c + d[i][1]);
      var homeRow = color === 'w' ? 7 : 0;
      var rights = st.castling[color];
      if (r === homeRow && c === 4) {
        if (rights.k && !b[homeRow][5] && !b[homeRow][6]) {
          var rook = b[homeRow][7];
          if (rook && rook.type === 'r' && rook.color === color &&
              !isAttacked(b, homeRow, 4, enemy) &&
              !isAttacked(b, homeRow, 5, enemy) &&
              !isAttacked(b, homeRow, 6, enemy)) {
            moves.push({ from: { r: r, c: c }, to: { r: homeRow, c: 6 }, castle: 'k' });
          }
        }
        if (rights.q && !b[homeRow][1] && !b[homeRow][2] && !b[homeRow][3]) {
          var rook2 = b[homeRow][0];
          if (rook2 && rook2.type === 'r' && rook2.color === color &&
              !isAttacked(b, homeRow, 4, enemy) &&
              !isAttacked(b, homeRow, 3, enemy) &&
              !isAttacked(b, homeRow, 2, enemy)) {
            moves.push({ from: { r: r, c: c }, to: { r: homeRow, c: 2 }, castle: 'q' });
          }
        }
      }
      return moves;
    }
    return moves;
  }

  function applyMove(b, move, st) {
    var piece = b[move.from.r][move.from.c];
    if (!piece) return;
    b[move.to.r][move.to.c] = piece;
    b[move.from.r][move.from.c] = null;
    if (move.enPassant) b[move.from.r][move.to.c] = null;
    if (move.castle) {
      var row = move.from.r;
      if (move.castle === 'k') { b[row][5] = b[row][7]; b[row][7] = null; }
      else { b[row][3] = b[row][0]; b[row][0] = null; }
    }
    if (move.promotion) b[move.to.r][move.to.c] = { type: move.promotion, color: piece.color };
    st.enPassant = null;
    if (piece.type === 'p' && Math.abs(move.to.r - move.from.r) === 2) {
      st.enPassant = { r: (move.from.r + move.to.r) / 2, c: move.from.c };
    }
    if (piece.type === 'k') {
      st.castling[piece.color].k = false;
      st.castling[piece.color].q = false;
    }
    if (piece.type === 'r') {
      var homeRow = piece.color === 'w' ? 7 : 0;
      if (move.from.r === homeRow) {
        if (move.from.c === 0) st.castling[piece.color].q = false;
        if (move.from.c === 7) st.castling[piece.color].k = false;
      }
    }
    var oppColor = other(piece.color);
    var oppHome = oppColor === 'w' ? 7 : 0;
    if (move.to.r === oppHome) {
      if (move.to.c === 0) st.castling[oppColor].q = false;
      if (move.to.c === 7) st.castling[oppColor].k = false;
    }
  }

  function getAllLegalMoves(b, color, st) {
    var pseudo = [];
    for (var r = 0; r < 8; r++) {
      for (var c = 0; c < 8; c++) {
        var p = b[r][c];
        if (p && p.color === color) {
          var ms = pieceMoves(b, r, c, st);
          for (var i = 0; i < ms.length; i++) pseudo.push(ms[i]);
        }
      }
    }
    var legal = [];
    for (var i = 0; i < pseudo.length; i++) {
      var m = pseudo[i];
      var b2 = cloneBoard(b), s2 = cloneState(st);
      applyMove(b2, m, s2);
      var k = findKing(b2, color);
      if (k && !isAttacked(b2, k.r, k.c, other(color))) legal.push(m);
    }
    return legal;
  }

  function inCheck(b, color, st) {
    var k = findKing(b, color);
    return k ? isAttacked(b, k.r, k.c, other(color)) : false;
  }

  /* =====================================================================
     FEN
     ===================================================================== */
  function boardToFEN() {
    var fen = '';
    for (var r = 0; r < 8; r++) {
      var empty = 0;
      for (var c = 0; c < 8; c++) {
        var p = board[r][c];
        if (!p) { empty++; continue; }
        if (empty) { fen += empty; empty = 0; }
        fen += p.color === 'w' ? p.type.toUpperCase() : p.type;
      }
      if (empty) fen += empty;
      if (r < 7) fen += '/';
    }
    fen += ' ' + turn;
    var cast = '';
    if (state.castling.w.k) cast += 'K';
    if (state.castling.w.q) cast += 'Q';
    if (state.castling.b.k) cast += 'k';
    if (state.castling.b.q) cast += 'q';
    fen += ' ' + (cast || '-');
    fen += ' ' + (state.enPassant ? FILES[state.enPassant.c] + (8 - state.enPassant.r) : '-');
    fen += ' ' + halfmoveClock + ' ' + fullmoveNumber;
    return fen;
  }
  function updateFEN() { if (fenInputEl) fenInputEl.value = boardToFEN(); }

  /* =====================================================================
     SAN
     ===================================================================== */
  function sanSuffix(b, move, st) {
    var b2 = cloneBoard(b), s2 = cloneState(st);
    applyMove(b2, move, s2);
    var landed = b2[move.to.r][move.to.c];
    if (!landed) return '';
    var moverColor = landed.color;
    var opp = other(moverColor);
    var k = findKing(b2, opp);
    if (!k || !isAttacked(b2, k.r, k.c, moverColor)) return '';
    var oppMoves = getAllLegalMoves(b2, opp, s2);
    return oppMoves.length === 0 ? '#' : '+';
  }

  function moveToSAN(b, move, st) {
    var piece = b[move.from.r][move.from.c];
    if (!piece) return '?';
    if (move.castle) return (move.castle === 'k' ? 'O-O' : 'O-O-O') + sanSuffix(b, move, st);
    var isCapture = !!b[move.to.r][move.to.c] || !!move.enPassant;
    var dest = FILES[move.to.c] + (8 - move.to.r);
    if (piece.type === 'p') {
      var s = '';
      if (isCapture) s += FILES[move.from.c] + 'x';
      s += dest;
      if (move.promotion) s += '=' + move.promotion.toUpperCase();
      return s + sanSuffix(b, move, st);
    }
    var legal = getAllLegalMoves(b, piece.color, st);
    var candidates = [];
    for (var i = 0; i < legal.length; i++) {
      var m = legal[i];
      if (m.from.r === move.from.r && m.from.c === move.from.c) continue;
      if (m.to.r !== move.to.r || m.to.c !== move.to.c) continue;
      var p = b[m.from.r][m.from.c];
      if (p && p.type === piece.type && p.color === piece.color) candidates.push(m);
    }
    var disamb = '';
    if (candidates.length > 0) {
      var sameFile = false, sameRank = false;
      for (var j = 0; j < candidates.length; j++) {
        if (candidates[j].from.c === move.from.c) sameFile = true;
        if (candidates[j].from.r === move.from.r) sameRank = true;
      }
      if (!sameFile) disamb = FILES[move.from.c];
      else if (!sameRank) disamb = String(8 - move.from.r);
      else disamb = FILES[move.from.c] + String(8 - move.from.r);
    }
    return piece.type.toUpperCase() + disamb + (isCapture ? 'x' : '') + dest + sanSuffix(b, move, st);
  }

  function normalizeSAN(s) { return s.replace(/[+#?!]+/g, '').replace(/0/g, 'O').replace(/=/g, ''); }
  function findMoveBySAN(token) {
    var norm = normalizeSAN(token);
    if (!norm) return null;
    var legal = getAllLegalMoves(board, turn, state);
    for (var i = 0; i < legal.length; i++) {
      var m = legal[i];
      if (normalizeSAN(moveToSAN(board, m, state)) === norm) return m;
    }
    return null;
  }

  /* =====================================================================
     REMÍZOVÁ PRAVIDLA
     ===================================================================== */
  function isInsufficientMaterial() {
    var pieces = [];
    for (var r = 0; r < 8; r++)
      for (var c = 0; c < 8; c++) {
        var p = board[r][c];
        if (p) pieces.push({ type: p.type, r: r, c: c });
      }
    if (pieces.length === 2) return true;
    if (pieces.length === 3) {
      for (var i = 0; i < pieces.length; i++) {
        if (pieces[i].type === 'n' || pieces[i].type === 'b') return true;
      }
    }
    if (pieces.length === 4) {
      var bishops = [];
      var others = 0;
      for (var i = 0; i < pieces.length; i++) {
        var p = pieces[i];
        if (p.type === 'b') bishops.push(p);
        else if (p.type !== 'k') others++;
      }
      if (bishops.length === 2 && others === 0) {
        if ((bishops[0].r + bishops[0].c) % 2 === (bishops[1].r + bishops[1].c) % 2) return true;
      }
    }
    return false;
  }
  function isThreefoldRepetition() {
    return (positionCounts.get(hashPosition(board, state, turn)) || 0) >= 3;
  }

  /* =====================================================================
     EVALUACE
     ===================================================================== */
  function isEndgamePosition(b) {
    var queens = 0, minors = 0;
    for (var r = 0; r < 8; r++)
      for (var c = 0; c < 8; c++) {
        var p = b[r][c];
        if (!p) continue;
        if (p.type === 'q') queens++;
        else if (p.type === 'n' || p.type === 'b') minors++;
      }
    return queens === 0 || (queens === 2 && minors <= 2);
  }

  function evaluatePawnStructure(b, endgame) {
    var wp = [], bp = [];
    for (var r = 0; r < 8; r++)
      for (var c = 0; c < 8; c++) {
        var p = b[r][c];
        if (p && p.type === 'p') {
          if (p.color === 'w') wp.push({ r: r, c: c });
          else bp.push({ r: r, c: c });
        }
      }
    var wC = [0,0,0,0,0,0,0,0], bC = [0,0,0,0,0,0,0,0];
    for (var i = 0; i < wp.length; i++) wC[wp[i].c]++;
    for (var i = 0; i < bp.length; i++) bC[bp[i].c]++;
    var score = 0;
    for (var c = 0; c < 8; c++) {
      if (wC[c] > 1) score -= 15 * (wC[c] - 1);
      if (bC[c] > 1) score += 15 * (bC[c] - 1);
      var wN = (c > 0 ? wC[c - 1] : 0) + (c < 7 ? wC[c + 1] : 0);
      var bN = (c > 0 ? bC[c - 1] : 0) + (c < 7 ? bC[c + 1] : 0);
      if (wC[c] > 0 && wN === 0) score -= 20;
      if (bC[c] > 0 && bN === 0) score += 20;
    }
    var wK = findKing(b, 'w'), bK = findKing(b, 'b');
    for (var i = 0; i < wp.length; i++) {
      var pawn = wp[i];
      var passed = true;
      for (var j = 0; j < bp.length; j++) {
        if (bp[j].r < pawn.r && Math.abs(bp[j].c - pawn.c) <= 1) { passed = false; break; }
      }
      if (!passed) continue;
      var adv = Math.max(0, Math.min(5, 6 - pawn.r));
      score += PASSED_PAWN_BONUS[adv];
      if (endgame && wK && bK) {
        var wd = Math.max(Math.abs(wK.r - pawn.r), Math.abs(wK.c - pawn.c));
        var bd = Math.max(Math.abs(bK.r - pawn.r), Math.abs(bK.c - pawn.c));
        score += (7 - wd) * 5 - (7 - bd) * 3;
      }
    }
    for (var i = 0; i < bp.length; i++) {
      var pawn = bp[i];
      var passed = true;
      for (var j = 0; j < wp.length; j++) {
        if (wp[j].r > pawn.r && Math.abs(wp[j].c - pawn.c) <= 1) { passed = false; break; }
      }
      if (!passed) continue;
      var adv = Math.max(0, Math.min(5, pawn.r - 1));
      score -= PASSED_PAWN_BONUS[adv];
      if (endgame && wK && bK) {
        var bd = Math.max(Math.abs(bK.r - pawn.r), Math.abs(bK.c - pawn.c));
        var wd = Math.max(Math.abs(wK.r - pawn.r), Math.abs(wK.c - pawn.c));
        score -= (7 - bd) * 5 - (7 - wd) * 3;
      }
    }
    return score;
  }

  /* Mobilita jezdce: kolik má pole k dispozici */
  function knightMobility(b, r, c, color) {
    var enemy = other(color);
    var count = 0;
    var dirs = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
    for (var i = 0; i < dirs.length; i++) {
      var nr = r + dirs[i][0], nc = c + dirs[i][1];
      if (!inBounds(nr, nc)) continue;
      var t = b[nr][nc];
      if (!t || t.color === enemy) count++;
    }
    return count;
  }

  /* Mobilita střelce */
  function bishopMobility(b, r, c, color) {
    var enemy = other(color);
    var count = 0;
    var dirs = [[-1,-1],[-1,1],[1,-1],[1,1]];
    for (var i = 0; i < dirs.length; i++) {
      var nr = r + dirs[i][0], nc = c + dirs[i][1];
      while (inBounds(nr, nc)) {
        var t = b[nr][nc];
        if (!t) count++;
        else { if (t.color === enemy) count++; break; }
        nr += dirs[i][0]; nc += dirs[i][1];
      }
    }
    return count;
  }

  /* Mobilita + bezpečnost krále + outposty */
  function evaluateMobilitySafety(b, endgame) {
    var score = 0;

    /* Mobilita (jen jezdci a střelci – nejrychlejší užitečný signál) */
    for (var r = 0; r < 8; r++) {
      for (var c = 0; c < 8; c++) {
        var p = b[r][c];
        if (!p) continue;
        if (p.type === 'n') {
          var m = knightMobility(b, r, c, p.color);
          score += (p.color === 'w' ? 1 : -1) * m * 4;
        } else if (p.type === 'b') {
          var mb = bishopMobility(b, r, c, p.color);
          score += (p.color === 'w' ? 1 : -1) * mb * 3;
        }
      }
    }

    /* Bezpečnost krále – jen v midgame */
    if (!endgame) {
      for (var idx = 0; idx < 2; idx++) {
        var color = idx === 0 ? 'w' : 'b';
        var sign = color === 'w' ? 1 : -1;
        var k = findKing(b, color);
        if (!k) continue;

        var safety = 0;

        /* Pěšcový štít před králem */
        var dr = color === 'w' ? -1 : 1;
        var shieldRow = k.r + dr;
        if (inBounds(shieldRow, k.c)) {
          var pp = b[shieldRow][k.c];
          if (pp && pp.type === 'p' && pp.color === color) safety += 10;
        }
        for (var dc = -1; dc <= 1; dc += 2) {
          if (inBounds(shieldRow, k.c + dc)) {
            var pp2 = b[shieldRow][k.c + dc];
            if (pp2 && pp2.type === 'p' && pp2.color === color) safety += 8;
          }
        }
        /* Krytý král na kraji (po rošádě) */
        if (k.c === 6 || k.c === 2) safety += 15;
        /* Král v centru v midgame = špatně */
        if (k.c >= 3 && k.c <= 4) safety -= 20;
        score += sign * safety;
      }
    }

    /* Outpost pro jezdce: na 4.–6. řadě (vlastní perspektiva),
       krytý vlastním pěšcem a neohrožený soupeřovým pěšcem */
    for (var r = 0; r < 8; r++) {
      for (var c = 0; c < 8; c++) {
        var p = b[r][c];
        if (!p || p.type !== 'n') continue;
        var sign2 = p.color === 'w' ? 1 : -1;
        var rank = p.color === 'w' ? (8 - r) : (r + 1); // 1 = doma, 8 = soupeřova řada
        if (rank < 4 || rank > 6) continue;

        var pawnRow = p.color === 'w' ? r + 1 : r - 1;
        var defended = false;
        for (var dc2 = -1; dc2 <= 1; dc2 += 2) {
          if (inBounds(pawnRow, c + dc2)) {
            var dp = b[pawnRow][c + dc2];
            if (dp && dp.type === 'p' && dp.color === p.color) { defended = true; break; }
          }
        }
        if (!defended) continue;

        var enemyColor = other(p.color);
        var enemyPawnRow = p.color === 'w' ? r - 1 : r + 1;
        var attackable = false;
        for (var dc3 = -1; dc3 <= 1; dc3 += 2) {
          if (inBounds(enemyPawnRow, c + dc3)) {
            var ep = b[enemyPawnRow][c + dc3];
            if (ep && ep.type === 'p' && ep.color === enemyColor) { attackable = true; break; }
          }
        }
        if (!attackable) score += sign2 * 20;
      }
    }

    return score;
  }

  function evaluateBoard(b) {
    var endgame = isEndgamePosition(b);
    var score = 0;
    for (var r = 0; r < 8; r++) {
      for (var c = 0; c < 8; c++) {
        var p = b[r][c];
        if (!p) continue;
        var sign = p.color === 'w' ? 1 : -1;
        var idx = p.color === 'w' ? r * 8 + c : (7 - r) * 8 + c;
        var val = VALUES[p.type];
        if (p.type === 'p') val += PST_PAWN[idx];
        else if (p.type === 'n') val += PST_KNIGHT[idx];
        else if (p.type === 'b') val += PST_BISHOP[idx];
        else if (p.type === 'r') val += PST_ROOK[idx];
        else if (p.type === 'q') val += PST_QUEEN[idx];
        else if (p.type === 'k') val += endgame ? PST_KING_END[idx] : PST_KING_MID[idx];
        score += sign * val;
      }
    }
    score += evaluatePawnStructure(b, endgame);
    score += evaluateMobilitySafety(b, endgame);
    return score;
  }

  /* =====================================================================
     MOVE ORDERING
     ===================================================================== */
  function moveOrderScore(b, m, ply, ttMove) {
    if (ttMove && sameMove(m, ttMove)) return 1000000;
    var s = 0;
    var target = b[m.to.r][m.to.c];
    if (target) {
      var attacker = b[m.from.r][m.from.c];
      s += 100000 + 10 * VALUES[target.type] - VALUES[attacker.type];
    }
    if (m.promotion) s += 90000 + VALUES[m.promotion];
    if (m.castle) s += 100;
    if (ply < MAX_PLY) {
      var km = killerMoves[ply];
      if (km[0] && sameMove(m, km[0])) s += 50000;
      else if (km[1] && sameMove(m, km[1])) s += 40000;
    }
    if (!target && !m.promotion) {
      s += historyTable[m.from.r * 8 + m.from.c][m.to.r * 8 + m.to.c];
    }
    return s;
  }
  function orderMoves(b, moves, ply, ttMove) {
    moves.sort(function (a, b2) {
      return moveOrderScore(b, b2, ply, ttMove) - moveOrderScore(b, a, ply, ttMove);
    });
  }

  /* =====================================================================
     QUIESCENCE
     ===================================================================== */
  function getNoisyMoves(b, st, color) {
    var result = [];
    for (var r = 0; r < 8; r++) {
      for (var c = 0; c < 8; c++) {
        var p = b[r][c];
        if (!p || p.color !== color) continue;
        var ms = pieceMoves(b, r, c, st);
        for (var i = 0; i < ms.length; i++) {
          var m = ms[i];
          var target = b[m.to.r][m.to.c];
          var isCap = !!target || m.enPassant;
          var isProm = !!m.promotion;
          if (!isCap && !isProm) continue;
          var b2 = cloneBoard(b), s2 = cloneState(st);
          applyMove(b2, m, s2);
          var k = findKing(b2, color);
          if (k && !isAttacked(b2, k.r, k.c, other(color))) result.push(m);
        }
      }
    }
    return result;
  }

  function quiescence(b, st, color, alpha, beta, ply) {
    var standPat = color === 'w' ? evaluateBoard(b) : -evaluateBoard(b);
    if (standPat >= beta) return beta;
    if (standPat > alpha) alpha = standPat;
    if (ply > 32) return standPat;
    var moves = getNoisyMoves(b, st, color);
    orderMoves(b, moves, ply, null);
    for (var i = 0; i < moves.length; i++) {
      var m = moves[i];
      var b2 = cloneBoard(b), s2 = cloneState(st);
      applyMove(b2, m, s2);
      var score = -quiescence(b2, s2, other(color), -beta, -alpha, ply + 1);
      if (score >= beta) return beta;
      if (score > alpha) alpha = score;
    }
    return alpha;
  }

  /* =====================================================================
     NEGAMAX
     ===================================================================== */
  var searchDeadline = 0;
  var searchAborted = false;

  function negamax(b, st, color, depth, alpha, beta, ply, useQ) {
    if (searchAborted) return 0;
    if (performance.now() > searchDeadline) { searchAborted = true; return 0; }
    if (depth <= 0) {
      if (useQ) return quiescence(b, st, color, alpha, beta, ply);
      return color === 'w' ? evaluateBoard(b) : -evaluateBoard(b);
    }
    var key = hashPosition(b, st, color);
    var entry = TT.get(key);
    var ttMove = entry ? entry.bestMove : null;
    if (entry && entry.depth >= depth) {
      if (entry.flag === TT_FLAG.EXACT) return entry.score;
      if (entry.flag === TT_FLAG.LOWER && entry.score >= beta) return entry.score;
      if (entry.flag === TT_FLAG.UPPER && entry.score <= alpha) return entry.score;
    }
    var check = inCheck(b, color, st);
    var moves = getAllLegalMoves(b, color, st);
    if (moves.length === 0) return check ? -(MATE_SCORE - ply) : 0;
    orderMoves(b, moves, ply, ttMove);
    var best = -INFINITY_SCORE;
    var bestMove = moves[0];
    var origAlpha = alpha;
    for (var i = 0; i < moves.length; i++) {
      var m = moves[i];
      var b2 = cloneBoard(b), s2 = cloneState(st);
      applyMove(b2, m, s2);
      var score;
      if (i === 0) {
        score = -negamax(b2, s2, other(color), depth - 1, -beta, -alpha, ply + 1, useQ);
      } else {
        score = -negamax(b2, s2, other(color), depth - 1, -alpha - 1, -alpha, ply + 1, useQ);
        if (score > alpha && score < beta) {
          score = -negamax(b2, s2, other(color), depth - 1, -beta, -alpha, ply + 1, useQ);
        }
      }
      if (searchAborted) return 0;
      if (score > best) { best = score; bestMove = m; }
      if (best > alpha) alpha = best;
      if (alpha >= beta) {
        var isCap = !!b[m.to.r][m.to.c] || m.enPassant || m.promotion;
        if (!isCap && ply < MAX_PLY) {
          addKiller(ply, m);
          historyTable[m.from.r * 8 + m.from.c][m.to.r * 8 + m.to.c] += depth * depth;
        }
        break;
      }
    }
    if (!searchAborted) {
      var flag = TT_FLAG.EXACT;
      if (best <= origAlpha) flag = TT_FLAG.UPPER;
      else if (best >= beta) flag = TT_FLAG.LOWER;
      ttStore(key, depth, best, flag, bestMove);
    }
    return best;
  }

  function searchRoot(b, st, color, depth, useQ) {
    var moves = getAllLegalMoves(b, color, st);
    if (moves.length === 0) return { move: null, score: 0 };
    var key = hashPosition(b, st, color);
    var entry = TT.get(key);
    var ttMove = entry ? entry.bestMove : null;
    orderMoves(b, moves, 0, ttMove);
    var best = -INFINITY_SCORE;
    var bestMove = moves[0];
    var alpha = -INFINITY_SCORE;
    for (var i = 0; i < moves.length; i++) {
      var m = moves[i];
      var b2 = cloneBoard(b), s2 = cloneState(st);
      applyMove(b2, m, s2);
      var score = -negamax(b2, s2, other(color), depth - 1, -INFINITY_SCORE, -alpha, 1, useQ);
      if (searchAborted) break;
      if (score > best) { best = score; bestMove = m; }
      if (score > alpha) alpha = score;
    }
    return { move: bestMove, score: best };
  }

  function searchIterative(b, st, color, maxDepth, timeMs, useQ) {
    clearSearchTables();
    searchAborted = false;
    searchDeadline = performance.now() + timeMs;
    var bestMove = null;
    for (var depth = 1; depth <= maxDepth; depth++) {
      var result = searchRoot(b, st, color, depth, useQ);
      if (result.move) bestMove = result.move;
      if (searchAborted) break;
      if (Math.abs(result.score) > MATE_SCORE - 1000) break;
      if (performance.now() > searchDeadline) break;
    }
    return bestMove;
  }

  /* =====================================================================
     OPENING BOOK
     ===================================================================== */
  function getBookMove() {
    var legal = getAllLegalMoves(board, turn, state);
    if (uciHistory.length === 0) {
      var firsts = [];
      for (var i = 0; i < OPENING_BOOK.length; i++) firsts.push(OPENING_BOOK[i][0]);
      var pick = firsts[Math.floor(Math.random() * firsts.length)];
      var from = uciToRC(pick.slice(0, 2));
      var to = uciToRC(pick.slice(2, 4));
      for (var j = 0; j < legal.length; j++) {
        var m = legal[j];
        if (m.from.r === from.r && m.from.c === from.c && m.to.r === to.r && m.to.c === to.c) return m;
      }
      return null;
    }
    var candidates = [];
    for (var k = 0; k < OPENING_BOOK.length; k++) {
      var line = OPENING_BOOK[k];
      if (line.length <= uciHistory.length) continue;
      var match = true;
      for (var l = 0; l < uciHistory.length; l++) {
        if (line[l] !== uciHistory[l]) { match = false; break; }
      }
      if (!match) continue;
      var bm = line[uciHistory.length];
      var bfrom = uciToRC(bm.slice(0, 2));
      var bto = uciToRC(bm.slice(2, 4));
      for (var m2 = 0; m2 < legal.length; m2++) {
        var mm = legal[m2];
        if (mm.from.r === bfrom.r && mm.from.c === bfrom.c && mm.to.r === bto.r && mm.to.c === bto.c) {
          candidates.push(mm); break;
        }
      }
    }
    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  /* =====================================================================
     AI
     ===================================================================== */
  var AI_CONFIG = {
    easy:   { maxDepth: 2, timeMs: 80,   useQ: false, randomTop: 6 },
    club:   { maxDepth: 5, timeMs: 800,  useQ: true,  randomTop: 1, blunderChance: 0.15 },
    medium: { maxDepth: 4, timeMs: 350,  useQ: true,  randomTop: 2 },
    hard:   { maxDepth: 6, timeMs: 1200, useQ: true,  randomTop: 1 },
    expert: { maxDepth: 8, timeMs: 3000, useQ: true,  randomTop: 1 }
  };

  function pickAIMove(color, overrideConfig) {
    var cfg = overrideConfig || AI_CONFIG[difficulty] || AI_CONFIG.medium;
    if (!overrideConfig && uciHistory.length <= 9) {
      var bm = getBookMove();
      if (bm) return bm;
    }
    var allLegal = getAllLegalMoves(board, color, state);
    if (allLegal.length === 0) return null;
    if (cfg.randomTop > 1 && cfg.maxDepth <= 2) {
      var scored = [];
      for (var i = 0; i < allLegal.length; i++) {
        var m = allLegal[i];
        var b2 = cloneBoard(board), s2 = cloneState(state);
        applyMove(b2, m, s2);
        var sc = -negamax(b2, s2, other(color), cfg.maxDepth - 1, -INFINITY_SCORE, INFINITY_SCORE, 1, cfg.useQ);
        scored.push({ move: m, score: sc });
      }
      scored.sort(function (a, b) { return b.score - a.score; });
      var n = Math.min(cfg.randomTop, scored.length);
      return scored[Math.floor(Math.random() * n)].move;
    }
    if (cfg.blunderChance && Math.random() < cfg.blunderChance) {
      var scored2 = [];
      for (var i = 0; i < allLegal.length; i++) {
        var m = allLegal[i];
        var b2 = cloneBoard(board), s2 = cloneState(state);
        applyMove(b2, m, s2);
        var sc = -negamax(b2, s2, other(color), Math.min(3, cfg.maxDepth) - 1, -INFINITY_SCORE, INFINITY_SCORE, 1, cfg.useQ);
        scored2.push({ move: m, score: sc });
      }
      scored2.sort(function (a, b) { return b.score - a.score; });
      var idx = 1 + Math.floor(Math.random() * Math.min(3, scored2.length - 1));
      return scored2[idx].move;
    }
    return searchIterative(board, state, color, cfg.maxDepth, cfg.timeMs, cfg.useQ);
  }

  function aiColor() { return other(playerColor); }

  function triggerAI() {
    if (selfPlay) return;
    if (!aiEnabled || gameOver || turn !== aiColor()) return;
    thinking = true;
    statusEl.textContent = 'Počítač přemýšlí…';
    render();
    var delay = difficulty === 'easy' ? 120 : difficulty === 'medium' ? 180 : 60;
    setTimeout(function () {
      var m = pickAIMove(turn);
      thinking = false;
      if (m) makeMove(m);
      else { updateStatus(); render(); }
    }, delay);
  }

  /* Self-play */
  function scheduleSelfPlayMove() {
    if (!selfPlay || gameOver) {
      selfPlay = false;
      document.getElementById('selfPlayToggle').checked = false;
      document.getElementById('selfPlaySpeedRow').style.display = 'none';
      updateStatus();
      render();
      return;
    }
    thinking = true;
    statusEl.textContent = 'AI vs AI – přemýšlí ' + (turn === 'w' ? 'Bílý' : 'Černý') + '…';
    render();
    selfPlayTimer = setTimeout(function () {
      if (!selfPlay) { thinking = false; return; }
      var m = pickAIMove(turn);
      thinking = false;
      if (m) {
        makeMove(m);
        // makeMove naplánuje další krok sám přes selfPlay check
      } else {
        selfPlay = false;
        document.getElementById('selfPlayToggle').checked = false;
        document.getElementById('selfPlaySpeedRow').style.display = 'none';
        updateStatus();
        render();
      }
    }, 60);
  }

  function startSelfPlay() {
    selfPlay = true;
    aiEnabled = false;
    document.getElementById('aiToggle').checked = false;
    document.getElementById('selfPlaySpeedRow').style.display = 'flex';
    // Malá prodleva mezi tahy, aby to bylo vizuálně příjemné
    var delayWrap = function () {
      if (!selfPlay || gameOver) return;
      scheduleSelfPlayMove();
    };
    setTimeout(delayWrap, 200);
  }

  function stopSelfPlay() {
    selfPlay = false;
    if (selfPlayTimer) clearTimeout(selfPlayTimer);
    selfPlayTimer = null;
    document.getElementById('selfPlaySpeedRow').style.display = 'none';
    updateStatus();
    render();
  }

  /* =====================================================================
     SNAPSHOT
     ===================================================================== */
  function getSnapshot() {
    return {
      board: cloneBoard(board),
      state: cloneState(state),
      turn: turn,
      capByWhite: capByWhite.slice(),
      capByBlack: capByBlack.slice(),
      moveListSAN: moveListSAN.slice(),
      uciHistory: uciHistory.slice(),
      lastMove: lastMove ? { from: { r: lastMove.from.r, c: lastMove.from.c }, to: { r: lastMove.to.r, c: lastMove.to.c } } : null,
      gameOver: gameOver,
      positionCounts: new Map(positionCounts),
      halfmoveClock: halfmoveClock,
      fullmoveNumber: fullmoveNumber
    };
  }
  function setSnapshot(s) {
    board = cloneBoard(s.board);
    state = cloneState(s.state);
    turn = s.turn;
    capByWhite = s.capByWhite.slice();
    capByBlack = s.capByBlack.slice();
    moveListSAN = s.moveListSAN.slice();
    uciHistory = s.uciHistory.slice();
    lastMove = s.lastMove ? { from: { r: s.lastMove.from.r, c: s.lastMove.from.c }, to: { r: s.lastMove.to.r, c: s.lastMove.to.c } } : null;
    gameOver = s.gameOver;
    positionCounts = new Map(s.positionCounts);
    halfmoveClock = s.halfmoveClock;
    fullmoveNumber = s.fullmoveNumber;
  }
  function pushHistory() {
    moveHistory = moveHistory.slice(0, historyIndex + 1);
    moveHistory.push(getSnapshot());
    historyIndex = moveHistory.length - 1;
  }

  /* =====================================================================
     VYKRESLOVÁNÍ
     ===================================================================== */
  function renderCoords() {
    filesTopEl.innerHTML = '';
    filesBottomEl.innerHTML = '';
    ranksLeftEl.innerHTML = '';
    ranksRightEl.innerHTML = '';
    for (var i = 0; i < 8; i++) {
      var fileIdx = flipped ? 7 - i : i;
      var rankIdx = flipped ? 7 - i : i;
      var ft = document.createElement('span'); ft.textContent = FILES[fileIdx]; filesTopEl.appendChild(ft);
      var fb = document.createElement('span'); fb.textContent = FILES[fileIdx]; filesBottomEl.appendChild(fb);
      var rl = document.createElement('span'); rl.textContent = String(8 - rankIdx); ranksLeftEl.appendChild(rl);
      var rr = document.createElement('span'); rr.textContent = String(8 - rankIdx); ranksRightEl.appendChild(rr);
    }
  }

  function getThreatenedSquares() {
    var result = {};
    if (!threatsEnabled || gameOver) return result;
    var enemy = other(turn);
    for (var r = 0; r < 8; r++)
      for (var c = 0; c < 8; c++) {
        var p = board[r][c];
        if (!p || p.color !== turn) continue;
        if (isAttacked(board, r, c, enemy)) result[r * 8 + c] = true;
      }
    return result;
  }

  function renderBoard() {
    boardEl.innerHTML = '';
    var checkActive = !gameOver && inCheck(board, turn, state);
    var kingPos = checkActive ? findKing(board, turn) : null;
    var threatened = getThreatenedSquares();
    var lastMoveIsOpponents = lastMove && moveHistory[historyIndex] && turn === moveHistory[historyIndex].turn;

    for (var vr = 0; vr < 8; vr++) {
      for (var vc = 0; vc < 8; vc++) {
        var r = flipped ? 7 - vr : vr;
        var c = flipped ? 7 - vc : vc;
        var sq = document.createElement('div');
        sq.className = 'square ' + ((r + c) % 2 === 0 ? 'light' : 'dark');
        sq.dataset.r = r;
        sq.dataset.c = c;

        if (selected && selected.r === r && selected.c === c) sq.classList.add('selected');
        if (lastMove && ((lastMove.from.r === r && lastMove.from.c === c) ||
                         (lastMove.to.r === r && lastMove.to.c === c))) {
          sq.classList.add('last');
          if (!lastMoveIsOpponents) sq.classList.add('own');
        }
        if (kingPos && kingPos.r === r && kingPos.c === c) sq.classList.add('in-check');
        if (threatened[r * 8 + c]) sq.classList.add('threatened');
        if (hintMove) {
          if (hintMove.from.r === r && hintMove.from.c === c) sq.classList.add('hint-from');
          if (hintMove.to.r === r && hintMove.to.c === c) sq.classList.add('hint-to');
        }
        var isTarget = false;
        for (var t = 0; t < legalTargets.length; t++) {
          if (legalTargets[t].to.r === r && legalTargets[t].to.c === c) { isTarget = true; break; }
        }
        if (isTarget) sq.classList.add(board[r][c] ? 'capture' : 'move');

        var p = board[r][c];
        if (p) {
          var span = document.createElement('span');
          span.className = 'piece ' + (p.color === 'w' ? 'white' : 'black');
          span.textContent = GLYPH[p.type];
          sq.appendChild(span);
        }
        (function (rr, cc) {
          sq.addEventListener('click', function () { onSquareClick(rr, cc); });
          setupDrag(sq, rr, cc);
        })(r, c);
        boardEl.appendChild(sq);
      }
    }
    if (pendingAnimation) {
      var sel = '.square[data-r="' + pendingAnimation.r + '"][data-c="' + pendingAnimation.c + '"]';
      var dest = boardEl.querySelector(sel);
      if (dest) {
        dest.classList.add('landing');
        if (pendingAnimation.capture) dest.classList.add('capture-flash');
      }
      pendingAnimation = null;
    }
  }

  function renderCaptured() {
    var w = '';
    for (var i = 0; i < capByWhite.length; i++) w += GLYPH[capByWhite[i]] + ' ';
    capWhiteEl.textContent = w;
    var b = '';
    for (var j = 0; j < capByBlack.length; j++) b += GLYPH[capByBlack[j]] + ' ';
    capBlackEl.textContent = b;
  }

  var ANNOT_TEXT = ['', '?!', '?', '??'];
  var ANNOT_CLASS = ['', 'annot-inaccuracy', 'annot-mistake', 'annot-blunder'];

  function renderMoveList() {
    moveListEl.innerHTML = '';
    var i = 0;
    while (i < moveListSAN.length) {
      var li = document.createElement('li');
      var num = document.createElement('span');
      num.className = 'num';
      num.textContent = (i / 2 + 1) + '.';
      li.appendChild(num);

      var w = document.createElement('span');
      w.className = 'w';
      w.textContent = moveListSAN[i] || '';
      if (historyIndex === i + 1) w.classList.add('active');
      if (gameAnnotations[i]) {
        var a = document.createElement('span');
        a.className = 'annot ' + ANNOT_CLASS[gameAnnotations[i]];
        a.textContent = ANNOT_TEXT[gameAnnotations[i]];
        w.appendChild(a);
      }
      (function (idx) { w.addEventListener('click', function () { gotoHistory(idx); }); })(i + 1);
      li.appendChild(w);

      if (moveListSAN[i + 1] !== undefined) {
        var b = document.createElement('span');
        b.className = 'b';
        b.textContent = moveListSAN[i + 1] || '';
        if (historyIndex === i + 2) b.classList.add('active');
        if (gameAnnotations[i + 1]) {
          var a2 = document.createElement('span');
          a2.className = 'annot ' + ANNOT_CLASS[gameAnnotations[i + 1]];
          a2.textContent = ANNOT_TEXT[gameAnnotations[i + 1]];
          b.appendChild(a2);
        }
        (function (idx) { b.addEventListener('click', function () { gotoHistory(idx); }); })(i + 2);
        li.appendChild(b);
      }
      moveListEl.appendChild(li);
      i += 2;
    }
    moveListEl.scrollTop = moveListEl.scrollHeight;
  }

  function updateEvalBarDisplay(scoreWhite) {
    var pct = 50 + Math.tanh(scoreWhite / 400) * 50;
    if (pct < 2) pct = 2;
    if (pct > 98) pct = 98;
    evalFillEl.style.width = pct + '%';
    var pawns = scoreWhite / 100;
    var label;
    if (Math.abs(scoreWhite) >= MATE_SCORE - 10000) {
      label = scoreWhite > 0 ? '#Bílý mat' : '#Černý mat';
    } else {
      label = (pawns > 0 ? '+' : '') + pawns.toFixed(2);
    }
    evalLabelEl.textContent = label;
  }

  function renderEvalBarFromSnapshot() {
    updateEvalBarDisplay(evaluateBoard(board));
  }

  function computeEvalBarAsync() {
    setTimeout(function () {
      try {
        clearSearchTables();
        searchAborted = false;
        searchDeadline = performance.now() + 120;
        var result = searchRoot(board, state, turn, 3, true);
        var scoreWhite = turn === 'w' ? result.score : -result.score;
        updateEvalBarDisplay(scoreWhite);
      } catch (err) {
        renderEvalBarFromSnapshot();
      }
    }, 0);
  }

  function render() {
    renderCoords();
    renderBoard();
    renderCaptured();
    renderMoveList();
    updateFEN();
    renderEvalBarFromSnapshot();
  }

  function updateStatus() {
    var moves = getAllLegalMoves(board, turn, state);
    var check = inCheck(board, turn, state);
    statusEl.classList.remove('check');
    statusEl.classList.remove('over');

    if (moves.length === 0) {
      gameOver = true;
      if (check) {
        var winner = turn === 'w' ? 'Černý' : 'Bílý';
        statusEl.textContent = 'Mat! Vyhrává ' + winner + '.';
      } else {
        statusEl.textContent = 'Pat – remíza.';
      }
      statusEl.classList.add('over');
      return;
    }
    if (halfmoveClock >= 100) {
      gameOver = true;
      statusEl.textContent = 'Remíza – pravidlo 50 tahů.';
      statusEl.classList.add('over');
      return;
    }
    if (isInsufficientMaterial()) {
      gameOver = true;
      statusEl.textContent = 'Remíza – nedostatečný materiál.';
      statusEl.classList.add('over');
      return;
    }
    if (isThreefoldRepetition()) {
      gameOver = true;
      statusEl.textContent = 'Remíza – trojí opakování pozice.';
      statusEl.classList.add('over');
      return;
    }

    var t = turn === 'w' ? 'Bílý' : 'Černý';
    var text = 'Na tahu: ' + t;
    if (selfPlay) text += ' (AI vs AI)';
    else if (aiEnabled && turn === aiColor()) text += ' (počítač)';
    if (check) text += ' – šach!';
    statusEl.textContent = text;
    if (check) statusEl.classList.add('check');
  }

  /* =====================================================================
     INTERAKCE
     ===================================================================== */
  function onSquareClick(r, c) {
    if (gameOver || thinking) return;
    if (selfPlay) return;
    if (historyIndex !== moveHistory.length - 1) {
      gotoHistory(moveHistory.length - 1);
      return;
    }
    if (aiEnabled && turn === aiColor()) return;
    hintMove = null;
    var target = null;
    for (var i = 0; i < legalTargets.length; i++) {
      if (legalTargets[i].to.r === r && legalTargets[i].to.c === c) { target = legalTargets[i]; break; }
    }
    if (selected && target) {
      if (target.promotion) { pendingPromotion = target; showPromotionPicker(target, turn); return; }
      makeMove(target);
      return;
    }
    var p = board[r][c];
    if (p && p.color === turn) {
      selected = { r: r, c: c };
      var all = getAllLegalMoves(board, turn, state);
      legalTargets = [];
      for (var j = 0; j < all.length; j++) {
        if (all[j].from.r === r && all[j].from.c === c) legalTargets.push(all[j]);
      }
      render();
      return;
    }
    selected = null;
    legalTargets = [];
    render();
  }

  function makeMove(move) {
    var mover = board[move.from.r][move.from.c];
    var capturedPiece = null;
    if (move.enPassant) capturedPiece = board[move.from.r][move.to.c];
    else capturedPiece = board[move.to.r][move.to.c];

    var san = moveToSAN(board, move, state);
    applyMove(board, move, state);

    if (capturedPiece) {
      if (mover.color === 'w') capByWhite.push(capturedPiece.type);
      else capByBlack.push(capturedPiece.type);
    }
    if (mover.type === 'p' || capturedPiece) halfmoveClock = 0; else halfmoveClock++;
    if (mover.color === 'b') fullmoveNumber++;

    moveListSAN.push(san);
    uciHistory.push(moveToUCI(move));
    lastMove = { from: { r: move.from.r, c: move.from.c }, to: { r: move.to.r, c: move.to.c } };
    turn = other(turn);
    selected = null;
    legalTargets = [];
    hintMove = null;
    pendingAnimation = { r: move.to.r, c: move.to.c, capture: !!capturedPiece || !!move.enPassant };

    positionCounts.set(hashPosition(board, state, turn), (positionCounts.get(hashPosition(board, state, turn)) || 0) + 1);

    var wasCastle = !!move.castle;
    updateStatus();

    var checkNow = !gameOver && inCheck(board, turn, state);
    if (gameOver && checkNow) playSound('mate');
    else if (checkNow) playSound('check');
    else if (capturedPiece) playSound('capture');
    else if (wasCastle) playSound('castle');
    else playSound('move');

    pushHistory();
    render();
    computeEvalBarAsync();

    if (selfPlay && !gameOver) {
      if (selfPlayTimer) clearTimeout(selfPlayTimer);
      selfPlayTimer = setTimeout(scheduleSelfPlayMove, selfPlaySpeedMs);
    } else if (!gameOver && aiEnabled && turn === aiColor()) {
      triggerAI();
    }
  }

  function gotoHistory(idx) {
    if (idx < 0) idx = 0;
    if (idx >= moveHistory.length) idx = moveHistory.length - 1;
    historyIndex = idx;
    setSnapshot(moveHistory[idx]);
    selected = null;
    legalTargets = [];
    hintMove = null;
    updateStatus();
    render();
    computeEvalBarAsync();
  }

  function undo() {
    if (thinking || historyIndex <= 0) return;
    if (selfPlay) { stopSelfPlay(); }
    var target = historyIndex - 1;
    if (aiEnabled && target > 0) {
      var prevSnap = moveHistory[target];
      if (prevSnap.turn === aiColor()) target -= 1;
    }
    gotoHistory(Math.max(0, target));
  }

  function newGame() {
    if (selfPlayTimer) clearTimeout(selfPlayTimer);
    selfPlayTimer = null;
    board = initialState();
    state = freshState();
    turn = 'w';
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
    flipped = (playerColor === 'b');
    halfmoveClock = 0;
    fullmoveNumber = 1;
    gameAnnotations = [];
    positionCounts = new Map();
    positionCounts.set(hashPosition(board, state, turn), 1);
    moveHistory = [getSnapshot()];
    historyIndex = 0;
    clearSearchTables();
    updateStatus();
    render();
    computeEvalBarAsync();
  }

  /* =====================================================================
     PROMOTION
     ===================================================================== */
  function showPromotionPicker(move, color) {
    var modal = document.getElementById('promoModal');
    var buttons = modal.querySelectorAll('.promo-btn');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].classList.remove('white-piece', 'black-piece');
      buttons[i].classList.add(color === 'w' ? 'white-piece' : 'black-piece');
    }
    modal.hidden = false;
  }
  document.getElementById('promoModal').addEventListener('click', function (e) {
    var btn = e.target.closest ? e.target.closest('.promo-btn') : null;
    if (!btn) return;
    var piece = btn.dataset.piece;
    document.getElementById('promoModal').hidden = true;
    if (pendingPromotion) {
      pendingPromotion.promotion = piece;
      var m = pendingPromotion;
      pendingPromotion = null;
      makeMove(m);
    }
  });

  /* =====================================================================
     DRAG & DROP
     ===================================================================== */
  var pointerDrag = null;

  function setupDrag(sq, r, c) {
    sq.addEventListener('pointerdown', function (e) {
      if (selfPlay) return;
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      if (gameOver || thinking) return;
      if (aiEnabled && turn === aiColor()) return;
      if (historyIndex !== moveHistory.length - 1) return;
      var p = board[r][c];
      if (!p || p.color !== turn) return;
      pointerDrag = {
        from: { r: r, c: c },
        startX: e.clientX, startY: e.clientY,
        moved: false, ghost: null, srcSquare: sq
      };
      document.addEventListener('pointermove', onGlobalPointerMove);
      document.addEventListener('pointerup', onGlobalPointerUp, { once: true });
    });
  }
  function onGlobalPointerMove(e) {
    if (!pointerDrag) return;
    var dx = e.clientX - pointerDrag.startX;
    var dy = e.clientY - pointerDrag.startY;
    if (!pointerDrag.moved && Math.sqrt(dx * dx + dy * dy) > 8) {
      pointerDrag.moved = true;
      var r = pointerDrag.from.r, c = pointerDrag.from.c;
      selected = { r: r, c: c };
      var all = getAllLegalMoves(board, turn, state);
      legalTargets = [];
      for (var i = 0; i < all.length; i++) {
        if (all[i].from.r === r && all[i].from.c === c) legalTargets.push(all[i]);
      }
      render();
      var pieceEl = boardEl.querySelector('.square[data-r="' + r + '"][data-c="' + c + '"] .piece');
      if (pieceEl) {
        var rect = pieceEl.getBoundingClientRect();
        var ghost = pieceEl.cloneNode(true);
        ghost.classList.add('drag-ghost');
        ghost.style.left = (e.clientX - rect.width / 2) + 'px';
        ghost.style.top = (e.clientY - rect.height / 2) + 'px';
        document.body.appendChild(ghost);
        pointerDrag.ghost = ghost;
        pointerDrag.srcSquare.style.opacity = '0.35';
      }
    }
    if (pointerDrag.moved && pointerDrag.ghost) {
      var sz = pointerDrag.ghost.getBoundingClientRect();
      pointerDrag.ghost.style.left = (e.clientX - sz.width / 2) + 'px';
      pointerDrag.ghost.style.top = (e.clientY - sz.height / 2) + 'px';
    }
  }
  function onGlobalPointerUp(e) {
    document.removeEventListener('pointermove', onGlobalPointerMove);
    if (!pointerDrag) return;
    var wasMoved = pointerDrag.moved;
    var from = pointerDrag.from;
    if (pointerDrag.ghost) pointerDrag.ghost.remove();
    if (pointerDrag.srcSquare) pointerDrag.srcSquare.style.opacity = '';
    if (wasMoved) {
      var el = document.elementFromPoint(e.clientX, e.clientY);
      var targetSq = el && el.closest ? el.closest('.square') : null;
      pointerDrag = null;
      if (targetSq) {
        var tr = +targetSq.dataset.r, tc = +targetSq.dataset.c;
        var target = null;
        for (var i = 0; i < legalTargets.length; i++) {
          if (legalTargets[i].to.r === tr && legalTargets[i].to.c === tc) { target = legalTargets[i]; break; }
        }
        if (target) {
          if (target.promotion) { pendingPromotion = target; showPromotionPicker(target, turn); }
          else makeMove(target);
          return;
        }
      }
      selected = null;
      legalTargets = [];
      render();
    } else {
      pointerDrag = null;
      onSquareClick(from.r, from.c);
    }
  }

  /* =====================================================================
     ULOŽENÍ / NAČTENÍ / PGN / SDÍLENÍ
     ===================================================================== */
  var STORAGE_KEY = 'sachy-saved-game';

  function saveGame() {
    try {
      var data = { playerColor: playerColor, difficulty: difficulty, aiEnabled: aiEnabled, moves: uciHistory };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      showToast('Partie uložena.');
    } catch (err) { showToast('Uložení se nezdařilo.'); }
  }
  function loadGame() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) { showToast('Žádná uložená partie.'); return; }
      var data = JSON.parse(raw);
      if (!data.moves || !Array.isArray(data.moves)) { showToast('Uložená partie je poškozená.'); return; }
      playerColor = data.playerColor || 'w';
      difficulty = data.difficulty || 'medium';
      aiEnabled = !!data.aiEnabled;
      document.getElementById('sideSelect').value = playerColor;
      document.getElementById('difficultySelect').value = difficulty;
      document.getElementById('aiToggle').checked = aiEnabled;
      replayMovesUCI(data.moves);
      showToast('Partie načtena.');
    } catch (err) { showToast('Načtení se nezdařilo.'); }
  }

  function resetStateForReplay() {
    board = initialState();
    state = freshState();
    turn = 'w';
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
    flipped = (playerColor === 'b');
    halfmoveClock = 0;
    fullmoveNumber = 1;
    gameAnnotations = [];
    positionCounts = new Map();
    positionCounts.set(hashPosition(board, state, turn), 1);
    moveHistory = [getSnapshot()];
    historyIndex = 0;
  }

  function applyMoveToGame(move) {
    var mover = board[move.from.r][move.from.c];
    var capturedPiece = null;
    if (move.enPassant) capturedPiece = board[move.from.r][move.to.c];
    else capturedPiece = board[move.to.r][move.to.c];
    var san = moveToSAN(board, move, state);
    applyMove(board, move, state);
    if (capturedPiece) {
      if (mover.color === 'w') capByWhite.push(capturedPiece.type);
      else capByBlack.push(capturedPiece.type);
    }
    if (mover.type === 'p' || capturedPiece) halfmoveClock = 0; else halfmoveClock++;
    if (mover.color === 'b') fullmoveNumber++;
    moveListSAN.push(san);
    uciHistory.push(moveToUCI(move));
    lastMove = { from: { r: move.from.r, c: move.from.c }, to: { r: move.to.r, c: move.to.c } };
    turn = other(turn);
    var h = hashPosition(board, state, turn);
    positionCounts.set(h, (positionCounts.get(h) || 0) + 1);
    moveHistory.push(getSnapshot());
    historyIndex = moveHistory.length - 1;
  }

  function replayMovesUCI(uciMoves) {
    resetStateForReplay();
    for (var i = 0; i < uciMoves.length; i++) {
      var uci = uciMoves[i];
      var from = uciToRC(uci.slice(0, 2));
      var to = uciToRC(uci.slice(2, 4));
      var promo = uci.length > 4 ? uci[4].toLowerCase() : null;
      var legal = getAllLegalMoves(board, turn, state);
      var move = null;
      for (var j = 0; j < legal.length; j++) {
        var m = legal[j];
        if (m.from.r === from.r && m.from.c === from.c && m.to.r === to.r && m.to.c === to.c) {
          if (m.promotion && promo && m.promotion !== promo) continue;
          move = m; break;
        }
      }
      if (!move) break;
      applyMoveToGame(move);
    }
    updateStatus();
    render();
    computeEvalBarAsync();
  }

  function replayMovesSAN(tokens) {
    resetStateForReplay();
    var applied = 0;
    for (var i = 0; i < tokens.length; i++) {
      var move = findMoveBySAN(tokens[i]);
      if (!move) break;
      applyMoveToGame(move);
      applied++;
    }
    updateStatus();
    render();
    computeEvalBarAsync();
    return applied;
  }

  function exportPGN() {
    if (uciHistory.length === 0) { showToast('Žádné tahy k exportu.'); return; }
    var date = new Date();
    var dateStr = date.getFullYear() + '.' + String(date.getMonth() + 1).padStart(2, '0') + '.' + String(date.getDate()).padStart(2, '0');
    var white = playerColor === 'w' ? 'Hráč' : 'Počítač';
    var black = playerColor === 'b' ? 'Hráč' : 'Počítač';
    var result = '*';
    if (gameOver) {
      if (inCheck(board, turn, state) && getAllLegalMoves(board, turn, state).length === 0) {
        result = turn === 'w' ? '0-1' : '1-0';
      } else result = '1/2-1/2';
    }
    var pgn = '[Event "Přátelská partie"]\n[Site "Šachy (Better DeepSeek)"]\n';
    pgn += '[Date "' + dateStr + '"]\n[Round "-"]\n';
    pgn += '[White "' + white + '"]\n[Black "' + black + '"]\n';
    pgn += '[Result "' + result + '"]\n\n';
    var line = '';
    for (var i = 0; i < moveListSAN.length; i++) {
      if (i % 2 === 0) line += (i / 2 + 1) + '. ';
      line += moveListSAN[i] + ' ';
      if (line.length > 78) { pgn += line.trim() + '\n'; line = ''; }
    }
    if (line.trim()) pgn += line.trim() + '\n';
    pgn += result + '\n';
    downloadFile(pgn, 'partie.pgn', 'application/x-chess-pgn');
  }

  function downloadFile(content, filename, mime) {
    var blob = new Blob([content], { type: mime });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function importPGNText(text) {
    var cleaned = text.replace(/[^a-h1-8\s]/gi, ' ').split(/\s+/);
    var uciMoves = [];
    for (var i = 0; i < cleaned.length; i++) {
      var t = cleaned[i].toLowerCase();
      if (/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(t)) uciMoves.push(t);
    }
    if (uciMoves.length < 2) {
      var sanTokens = parsePGNTokens(text);
      if (sanTokens.length === 0) { showToast('Nepodařilo se najít žádné tahy.'); return; }
      playerColor = document.getElementById('sideSelect').value;
      difficulty = document.getElementById('difficultySelect').value;
      aiEnabled = document.getElementById('aiToggle').checked;
      var n = replayMovesSAN(sanTokens);
      if (!gameOver && aiEnabled && turn === aiColor()) triggerAI();
      showToast('Importováno ' + n + ' tahů (SAN).');
      return;
    }
    playerColor = document.getElementById('sideSelect').value;
    difficulty = document.getElementById('difficultySelect').value;
    aiEnabled = document.getElementById('aiToggle').checked;
    replayMovesUCI(uciMoves);
    if (!gameOver && aiEnabled && turn === aiColor()) triggerAI();
    showToast('Importováno ' + uciMoves.length + ' tahů (UCI).');
  }

  function parsePGNTokens(text) {
    var s = text;
    s = s.replace(/\{[^}]*\}/g, ' ');
    s = s.replace(/;[^\n]*/g, ' ');
    s = s.replace(/\[[^\]]*\]/g, ' ');
    s = s.replace(/\$\d+/g, ' ');
    s = s.replace(/\b(1-0|0-1|1\/2-1\/2|\*)\b/g, ' ');
    s = s.replace(/\d+\.+/g, ' ');
    s = s.replace(/[?!]+/g, '');
    return s.split(/\s+/).filter(function (t) {
      return t && /^[a-hkqrbnpKQRBNP0-9oO=\-x]+$/.test(t);
    });
  }

  function shareGame() {
    try {
      var data = { m: uciHistory, p: playerColor, d: difficulty, a: aiEnabled ? 1 : 0 };
      var b64 = btoa(unescape(encodeURIComponent(JSON.stringify(data))));
      var url = location.origin + location.pathname + '#g=' + b64;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(
          function () { showToast('Odkaz zkopírován do schránky.'); },
          function () { window.prompt('Zkopíruj odkaz:', url); }
        );
      } else window.prompt('Zkopíruj odkaz:', url);
    } catch (err) { showToast('Sdílení se nezdařilo.'); }
  }

  function tryLoadFromURL() {
    var h = location.hash;
    if (!h || h.indexOf('#g=') !== 0) return false;
    try {
      var b64 = h.slice(3);
      var json = decodeURIComponent(escape(atob(b64)));
      var data = JSON.parse(json);
      if (!data.m || !Array.isArray(data.m)) return false;
      playerColor = data.p || 'w';
      difficulty = data.d || 'medium';
      aiEnabled = !!data.a;
      document.getElementById('sideSelect').value = playerColor;
      document.getElementById('difficultySelect').value = difficulty;
      document.getElementById('aiToggle').checked = aiEnabled;
      replayMovesUCI(data.m);
      history.replaceState(null, '', location.pathname + location.search);
      showToast('Partie načtena z odkazu.');
      return true;
    } catch (err) { return false; }
  }

  /* =====================================================================
     NÁPOVĚDA
     ===================================================================== */
  function requestHint() {
    if (gameOver || thinking || selfPlay) return;
    if (aiEnabled && turn === aiColor()) return;
    if (historyIndex !== moveHistory.length - 1) {
      showToast('Nejprve se vrať do aktuální pozice.');
      return;
    }
    thinking = true;
    statusEl.textContent = 'Přemýšlím o nápovědě…';
    setTimeout(function () {
      var cfg = AI_CONFIG.hard;
      var m = searchIterative(board, state, turn, cfg.maxDepth, cfg.timeMs, cfg.useQ);
      thinking = false;
      if (m) {
        hintMove = { from: { r: m.from.r, c: m.from.c }, to: { r: m.to.r, c: m.to.c } };
        showToast('Nápověda: ' + moveToSAN(board, m, state));
      } else showToast('Nápověda není k dispozici.');
      updateStatus();
      render();
    }, 30);
  }

  /* =====================================================================
     ANALÝZA
     ===================================================================== */
  function analyzeGame() {
    if (moveHistory.length < 2) { showToast('Žádné tahy k analýze.'); return; }
    thinking = true;
    statusEl.textContent = 'Analyzuji partii…';
    showToast('Analýza běží, chvilku strpení.');
    setTimeout(function () {
      var evals = [];
      for (var i = 1; i < moveHistory.length; i++) {
        var snap = moveHistory[i];
        clearSearchTables();
        searchAborted = false;
        searchDeadline = performance.now() + 120;
        var result = searchRoot(snap.board, snap.state, snap.turn, 3, true);
        var scoreWhite = snap.turn === 'w' ? result.score : -result.score;
        if (Math.abs(scoreWhite) > MATE_SCORE - 10000) scoreWhite = scoreWhite > 0 ? 100000 : -100000;
        evals.push(scoreWhite);
      }
      var annotations = [];
      for (var i = 0; i < evals.length; i++) {
        var isWhiteMove = (i % 2 === 0);
        var prev = i === 0 ? 0 : evals[i - 1];
        var delta = isWhiteMove ? (evals[i] - prev) : (prev - evals[i]);
        if (delta < -300) annotations.push(3);
        else if (delta < -150) annotations.push(2);
        else if (delta < -60) annotations.push(1);
        else annotations.push(0);
      }
      gameAnnotations = annotations;
      thinking = false;
      updateStatus();
      renderMoveList();
      var blunders = 0, mistakes = 0, inaccs = 0;
      for (var i = 0; i < annotations.length; i++) {
        if (annotations[i] === 3) blunders++;
        else if (annotations[i] === 2) mistakes++;
        else if (annotations[i] === 1) inaccs++;
      }
      showToast('Analýza: ' + blunders + '× ?? · ' + mistakes + '× ? · ' + inaccs + '× ?!', 4000);
    }, 30);
  }

  /* =====================================================================
     ZVUKY
     ===================================================================== */
  var audioCtx = null;
  function getAudioCtx() {
    try {
      if (!audioCtx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        audioCtx = new AC();
      }
      if (audioCtx.state === 'suspended') audioCtx.resume();
      return audioCtx;
    } catch (err) { return null; }
  }
  function playSound(kind) {
    if (!soundsEnabled) return;
    var ctx = getAudioCtx();
    if (!ctx) return;
    try {
      var now = ctx.currentTime;
      function beep(freq, dur, type, vol, off) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = type || 'sine';
        osc.frequency.value = freq;
        osc.connect(gain);
        gain.connect(ctx.destination);
        var t = now + (off || 0);
        gain.gain.setValueAtTime(vol || 0.08, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.start(t);
        osc.stop(t + dur + 0.02);
      }
      if (kind === 'move') beep(520, 0.08, 'sine', 0.06);
      else if (kind === 'capture') { beep(260, 0.14, 'triangle', 0.12); beep(180, 0.16, 'sawtooth', 0.05, 0.02); }
      else if (kind === 'castle') { beep(520, 0.09, 'sine', 0.07, 0); beep(700, 0.09, 'sine', 0.07, 0.07); }
      else if (kind === 'check') { beep(880, 0.09, 'sine', 0.10, 0); beep(1200, 0.12, 'sine', 0.10, 0.08); }
      else if (kind === 'mate') { beep(660, 0.12, 'sine', 0.10, 0); beep(880, 0.12, 'sine', 0.10, 0.10); beep(1100, 0.20, 'sine', 0.12, 0.20); }
    } catch (err) {}
  }

  /* =====================================================================
     TOAST
     ===================================================================== */
  var toastTimer = null;
  var toastEl = document.getElementById('toast');
  function showToast(msg, ms) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.hidden = true; }, ms || 2400);
  }

  /* =====================================================================
     OVLÁDACÍ PRVKY
     ===================================================================== */
  document.getElementById('newGame').addEventListener('click', function () {
    newGame();
    if (selfPlay) {
      // Restart self-play
      setTimeout(function () { if (selfPlay) scheduleSelfPlayMove(); }, 200);
    } else if (!gameOver && aiEnabled && turn === aiColor()) triggerAI();
  });
  document.getElementById('undo').addEventListener('click', undo);
  document.getElementById('hintBtn').addEventListener('click', requestHint);
  document.getElementById('analyzeBtn').addEventListener('click', analyzeGame);
  document.getElementById('saveBtn').addEventListener('click', saveGame);
  document.getElementById('loadBtn').addEventListener('click', loadGame);
  document.getElementById('exportBtn').addEventListener('click', exportPGN);
  document.getElementById('importBtn').addEventListener('click', function () {
    document.getElementById('importText').value = '';
    document.getElementById('importModal').hidden = false;
    document.getElementById('importText').focus();
  });
  document.getElementById('importCancel').addEventListener('click', function () {
    document.getElementById('importModal').hidden = true;
  });
  document.getElementById('importConfirm').addEventListener('click', function () {
    var text = document.getElementById('importText').value;
    document.getElementById('importModal').hidden = true;
    importPGNText(text);
  });
  document.getElementById('shareBtn').addEventListener('click', shareGame);

  document.getElementById('copyFenBtn').addEventListener('click', function () {
    var v = fenInputEl.value;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(v).then(
        function () { showToast('FEN zkopírován.'); },
        function () { window.prompt('FEN:', v); }
      );
    } else window.prompt('FEN:', v);
  });

  document.getElementById('rotateBtn').addEventListener('click', function () {
    flipped = !flipped;
    render();
  });

  document.getElementById('aiToggle').addEventListener('change', function (e) {
    aiEnabled = e.target.checked;
    if (aiEnabled && selfPlay) {
      selfPlay = false;
      document.getElementById('selfPlayToggle').checked = false;
      document.getElementById('selfPlaySpeedRow').style.display = 'none';
      if (selfPlayTimer) clearTimeout(selfPlayTimer);
    }
    newGame();
    if (!gameOver && aiEnabled && turn === aiColor()) triggerAI();
  });

  document.getElementById('selfPlayToggle').addEventListener('change', function (e) {
    if (e.target.checked) {
      if (selfPlayTimer) clearTimeout(selfPlayTimer);
      startSelfPlay();
    } else {
      stopSelfPlay();
    }
  });

  document.getElementById('selfPlaySpeedSelect').addEventListener('change', function (e) {
    selfPlaySpeedMs = parseInt(e.target.value, 10) || 500;
  });

  document.getElementById('sideSelect').addEventListener('change', function (e) {
    playerColor = e.target.value;
    newGame();
    if (!gameOver && aiEnabled && turn === aiColor()) triggerAI();
  });

  document.getElementById('difficultySelect').addEventListener('change', function (e) {
    difficulty = e.target.value;
  });

  document.getElementById('soundToggle').addEventListener('change', function (e) {
    soundsEnabled = e.target.checked;
    try { localStorage.setItem('chess-sound', soundsEnabled ? '1' : '0'); } catch (err) {}
  });

  document.getElementById('threatToggle').addEventListener('change', function (e) {
    threatsEnabled = e.target.checked;
    try { localStorage.setItem('chess-threats', threatsEnabled ? '1' : '0'); } catch (err) {}
    render();
  });

  document.getElementById('themeSelect').addEventListener('change', function (e) {
    document.body.dataset.theme = e.target.value;
    try { localStorage.setItem('chess-theme', e.target.value); } catch (err) {}
  });

  document.addEventListener('keydown', function (e) {
    var tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.ctrlKey && (e.key === 's' || e.key === 'S')) {
      e.preventDefault();
      saveGame();
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'n' || e.key === 'N') {
      newGame();
      if (selfPlay) setTimeout(function () { if (selfPlay) scheduleSelfPlayMove(); }, 200);
      else if (!gameOver && aiEnabled && turn === aiColor()) triggerAI();
    } else if (e.key === 'z' || e.key === 'Z') {
      undo();
    } else if (e.key === 'h' || e.key === 'H') {
      requestHint();
    }
  });

  /* Obnova preferencí */
  (function restorePrefs() {
    try {
      var t = localStorage.getItem('chess-theme');
      if (t) { document.body.dataset.theme = t; document.getElementById('themeSelect').value = t; }
      var s = localStorage.getItem('chess-sound');
      if (s !== null) { soundsEnabled = s === '1'; document.getElementById('soundToggle').checked = soundsEnabled; }
      var th = localStorage.getItem('chess-threats');
      if (th !== null) { threatsEnabled = th === '1'; document.getElementById('threatToggle').checked = threatsEnabled; }
    } catch (err) {}
  })();

  /* Init */
  try {
    if (!tryLoadFromURL()) newGame();
    console.log('[Šachy] Inicializace OK');
  } catch (err) {
    if (statusEl) statusEl.textContent = '⚠ Init selhal: ' + err.message;
    console.error('[Šachy] Init chyba:', err);
  }

})();
