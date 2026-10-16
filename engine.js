/* =========================================================================
   Šachy – engine.js
   Čistý šachový engine: pravidla, generátor tahů, evaluace, AI.
   Žádný přístup k DOM. Vše v globálním scope (aby to viděly další soubory).

   Autor: Better DeepSeek (AI) · Zadavatel: Jan Hošek · 2026
   SPDX-License-Identifier: GPL-3.0-or-later
   ========================================================================= */

var FILES = 'abcdefgh';
var GLYPH = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
var VALUES = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };
var MATE_SCORE = 1000000;
var INFINITY_SCORE = 100000000;
var MAX_PLY = 64;

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
var OPENING_NAMES = [
  'Španělská hra','Italská hra','Skotská hra','Sicilská (Taimanov)',
  'Sicilská (klasická)','Francouzská obrana','Caro-Kann',
  'Dámský gambit odmítnutý','Královská indická','Nimzo-indická',
  'Rétiho hra','Ruská hra','Italská (pomalá)','QGD (klasický)',
  'Slovanská obrana','Anglická hra','Královská indická (bílý)'
];

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

var TT_FLAG = { EXACT: 0, LOWER: 1, UPPER: 2 };
var TT = new Map();
var TT_MAX = 200000;
function ttStore(key, depth, score, flag, bestMove) {
  if (TT.size >= TT_MAX) TT.clear();
  TT.set(key, { depth: depth, score: score, flag: flag, bestMove: bestMove });
}

var killerMoves = [];
for (var _km = 0; _km < MAX_PLY; _km++) killerMoves.push([null, null]);
var historyTable = [];
for (var _ht = 0; _ht < 64; _ht++) historyTable.push(new Int32Array(64));

function clearSearchTables() {
  TT.clear();
  for (var i = 0; i < MAX_PLY; i++) killerMoves[i] = [null, null];
  for (var j = 0; j < 64; j++) historyTable[j].fill(0);
}
function addKiller(ply, move) {
  if (ply >= MAX_PLY) return;
  var k = killerMoves[ply];
  if (k[0] && k[0].from.r === move.from.r && k[0].from.c === move.from.c &&
      k[0].to.r === move.to.r && k[0].to.c === move.to.c) return;
  k[1] = k[0];
  k[0] = { from: { r: move.from.r, c: move.from.c }, to: { r: move.to.r, c: move.to.c } };
}

function initialState() {
  var back = ['r','n','b','q','k','b','n','r'];
  var b = [];
  for (var r = 0; r < 8; r++) {
    var row = [];
    for (var c = 0; c < 8; c++) row.push(null);
    b.push(row);
  }
  for (var i = 0; i < 8; i++) {
    b[0][i] = { type: back[i], color: 'b' };
    b[1][i] = { type: 'p', color: 'b' };
    b[6][i] = { type: 'p', color: 'w' };
    b[7][i] = { type: back[i], color: 'w' };
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
function evaluateMobilitySafety(b, endgame) {
  var score = 0;
  for (var r = 0; r < 8; r++) {
    for (var c = 0; c < 8; c++) {
      var p = b[r][c];
      if (!p) continue;
      if (p.type === 'n') score += (p.color === 'w' ? 1 : -1) * knightMobility(b, r, c, p.color) * 4;
      else if (p.type === 'b') score += (p.color === 'w' ? 1 : -1) * bishopMobility(b, r, c, p.color) * 3;
    }
  }
  if (!endgame) {
    for (var idx = 0; idx < 2; idx++) {
      var color = idx === 0 ? 'w' : 'b';
      var sign = color === 'w' ? 1 : -1;
      var k = findKing(b, color);
      if (!k) continue;
      var safety = 0;
      var dr = color === 'w' ? -1 : 1;
      var sr = k.r + dr;
      if (inBounds(sr, k.c)) {
        var pp = b[sr][k.c];
        if (pp && pp.type === 'p' && pp.color === color) safety += 10;
      }
      for (var dc = -1; dc <= 1; dc += 2) {
        if (inBounds(sr, k.c + dc)) {
          var pp2 = b[sr][k.c + dc];
          if (pp2 && pp2.type === 'p' && pp2.color === color) safety += 8;
        }
      }
      if (k.c === 6 || k.c === 2) safety += 15;
      if (k.c >= 3 && k.c <= 4) safety -= 20;
      score += sign * safety;
    }
  }
  for (var r2 = 0; r2 < 8; r2++) {
    for (var c2 = 0; c2 < 8; c2++) {
      var p2 = b[r2][c2];
      if (!p2 || p2.type !== 'n') continue;
      var sign2 = p2.color === 'w' ? 1 : -1;
      var rank = p2.color === 'w' ? (8 - r2) : (r2 + 1);
      if (rank < 4 || rank > 6) continue;
      var pawnRow = p2.color === 'w' ? r2 + 1 : r2 - 1;
      var defended = false;
      for (var dc2 = -1; dc2 <= 1; dc2 += 2) {
        if (inBounds(pawnRow, c2 + dc2)) {
          var dp = b[pawnRow][c2 + dc2];
          if (dp && dp.type === 'p' && dp.color === p2.color) { defended = true; break; }
        }
      }
      if (!defended) continue;
      var enemyColor = other(p2.color);
      var enemyPawnRow = p2.color === 'w' ? r2 - 1 : r2 + 1;
      var attackable = false;
      for (var dc3 = -1; dc3 <= 1; dc3 += 2) {
        if (inBounds(enemyPawnRow, c2 + dc3)) {
          var ep = b[enemyPawnRow][c2 + dc3];
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

var AI_CONFIG = {
  easy:   { maxDepth: 2, timeMs: 80,   useQ: false, randomTop: 6 },
  club:   { maxDepth: 5, timeMs: 800,  useQ: true,  randomTop: 1, blunderChance: 0.15 },
  medium: { maxDepth: 4, timeMs: 350,  useQ: true,  randomTop: 2 },
  hard:   { maxDepth: 6, timeMs: 1200, useQ: true,  randomTop: 1 },
  expert: { maxDepth: 8, timeMs: 3000, useQ: true,  randomTop: 1 }
};

/* Používá globální stav z game.js (board, turn, state, uciHistory, difficulty) */
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
    for (var i2 = 0; i2 < allLegal.length; i2++) {
      var m2 = allLegal[i2];
      var b22 = cloneBoard(board), s22 = cloneState(state);
      applyMove(b22, m2, s22);
      var sc2 = -negamax(b22, s22, other(color), Math.min(3, cfg.maxDepth) - 1, -INFINITY_SCORE, INFINITY_SCORE, 1, cfg.useQ);
      scored2.push({ move: m2, score: sc2 });
    }
    scored2.sort(function (a, b) { return b.score - a.score; });
    var idx = 1 + Math.floor(Math.random() * Math.min(3, scored2.length - 1));
    return scored2[idx].move;
  }
  return searchIterative(board, state, color, cfg.maxDepth, cfg.timeMs, cfg.useQ);
}
