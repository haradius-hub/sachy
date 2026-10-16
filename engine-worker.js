/* =========================================================================
   Šachy – engine-worker.js
   AI engine ve Web Workeru (aby UI nezamrzelo na pomalém stroji).
   Worker přijímá JSON pozice a vrací nejlepší tah.
   Používá stejnou logiku jako engine.js (načítá ho přes importScripts).
   Autor: Better DeepSeek (AI) · Zadavatel: Jan Hošek · 2026
   SPDX-License-Identifier: GPL-3.0-or-later
   ========================================================================= */

/* Načteme engine.js (obsahuje pravidla, evaluaci, negamax atd.)
   POZOR: engine.js je psaný pro globální scope bez modulu; to je v pořádku. */
importScripts('engine.js');

/* Posluchač zpráv od hlavního vlákna. */
self.onmessage = function (e) {
  var msg = e.data || {};
  if (msg.type === 'find-move') {
    try {
      var result = findBestMove(msg);
      self.postMessage({ type: 'move', id: msg.id, move: result });
    } catch (err) {
      self.postMessage({ type: 'error', id: msg.id, message: String(err && err.message || err) });
    }
  } else if (msg.type === 'evaluate') {
    try {
      var score = evaluateBoard(msg.board);
      self.postMessage({ type: 'score', id: msg.id, score: score });
    } catch (err) {
      self.postMessage({ type: 'error', id: msg.id, message: String(err && err.message || err) });
    }
  }
};

/* -------------------------------------------------------------------------
   Najde nejlepší tah podle zadaného configu.
   Vstup: { board, state, turn, cfg, history }
   cfg: { maxDepth, timeMs, useQ, randomTop, blunderChance }
   ------------------------------------------------------------------------- */
function findBestMove(req) {
  var b = req.board;
  var st = req.state;
  var color = req.turn;
  var cfg = req.cfg;

  // Opening book by mohl být použit, pokud pošleme uciHistory a OPENING_BOOK.
  // Pro jednoduchost vynecháváme – server/klient stejně book použije při tahu.
  if (req.uciHistory && req.uciHistory.length <= 9) {
    var bookMove = getBookMoveFromWorker(b, st, color, req.uciHistory);
    if (bookMove) return bookMove;
  }

  var allLegal = getAllLegalMoves(b, color, st);
  if (allLegal.length === 0) return null;

  // Lehká obtížnost: náhodný výběr z top N
  if (cfg.randomTop > 1 && cfg.maxDepth <= 2) {
    var scored = [];
    for (var i = 0; i < allLegal.length; i++) {
      var m = allLegal[i];
      var b2 = cloneBoard(b), s2 = cloneState(st);
      applyMove(b2, m, s2);
      var sc = -negamaxWorker(b2, s2, other(color), cfg.maxDepth - 1, -INFINITY_SCORE, INFINITY_SCORE, 1, cfg.useQ);
      scored.push({ move: m, score: sc });
    }
    scored.sort(function (a, b2) { return b2.score - a.score; });
    var n = Math.min(cfg.randomTop, scored.length);
    return scored[Math.floor(Math.random() * n)].move;
  }

  // Klubový hráč: občas zahraje horší tah
  if (cfg.blunderChance && Math.random() < cfg.blunderChance) {
    var scored2 = [];
    for (var i2 = 0; i2 < allLegal.length; i2++) {
      var m2 = allLegal[i2];
      var b22 = cloneBoard(b), s22 = cloneState(st);
      applyMove(b22, m2, s22);
      var sc2 = -negamaxWorker(b22, s22, other(color), Math.min(3, cfg.maxDepth) - 1, -INFINITY_SCORE, INFINITY_SCORE, 1, cfg.useQ);
      scored2.push({ move: m2, score: sc2 });
    }
    scored2.sort(function (a, b2) { return b2.score - a.score; });
    var idx = 1 + Math.floor(Math.random() * Math.min(3, scored2.length - 1));
    return scored2[idx].move;
  }

  // Standardní vyhledávání
  return searchIterativeWorker(b, st, color, cfg.maxDepth, cfg.timeMs, cfg.useQ);
}

/* Iterativní prohledávání s časovým limitem. */
function searchIterativeWorker(b, st, color, maxDepth, timeMs, useQ) {
  clearSearchTables();
  searchAborted = false;
  searchDeadline = performance.now() + timeMs;
  var bestMove = null;
  for (var depth = 1; depth <= maxDepth; depth++) {
    var result = searchRootWorker(b, st, color, depth, useQ);
    if (result.move) bestMove = result.move;
    if (searchAborted) break;
    if (Math.abs(result.score) > MATE_SCORE - 1000) break;
    if (performance.now() > searchDeadline) break;
  }
  return bestMove;
}

function searchRootWorker(b, st, color, depth, useQ) {
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
    var score = -negamaxWorker(b2, s2, other(color), depth - 1, -INFINITY_SCORE, -alpha, 1, useQ);
    if (searchAborted) break;
    if (score > best) { best = score; bestMove = m; }
    if (score > alpha) alpha = score;
  }
  return { move: bestMove, score: best };
}

function negamaxWorker(b, st, color, depth, alpha, beta, ply, useQ) {
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
      score = -negamaxWorker(b2, s2, other(color), depth - 1, -beta, -alpha, ply + 1, useQ);
    } else {
      score = -negamaxWorker(b2, s2, other(color), depth - 1, -alpha - 1, -alpha, ply + 1, useQ);
      if (score > alpha && score < beta) {
        score = -negamaxWorker(b2, s2, other(color), depth - 1, -beta, -alpha, ply + 1, useQ);
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

/* Otevírací kniha – jednoduchá verze (jen tahy z OPENING_BOOK). */
function getBookMoveFromWorker(b, st, color, uciHistory) {
  if (typeof OPENING_BOOK === 'undefined') return null;
  var legal = getAllLegalMoves(b, color, st);
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
