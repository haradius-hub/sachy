/* =========================================================================
   Šachy – game.js
   Stav hry, vykreslování, interakce (klik, drag & drop, proměna).
   Používá funkce z engine.js, poskytuje stav pro extras.js.

   Autor: Better DeepSeek (AI) · Zadavatel: Jan Hošek · 2026
   SPDX-License-Identifier: GPL-3.0-or-later
   ========================================================================= */

/* ---------- Stav ---------- */
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
var selfPlay = false, selfPlaySpeedMs = 500, selfPlayTimer = null;

/* ---------- DOM cache (naplní cacheDom()) ---------- */
var boardEl, statusEl, moveListEl, capWhiteEl, capBlackEl;
var filesTopEl, filesBottomEl, ranksLeftEl, ranksRightEl;
var evalFillEl, evalLabelEl, fenInputEl, toastEl;

function cacheDom() {
  boardEl = document.getElementById('board');
  statusEl = document.getElementById('status');
  moveListEl = document.getElementById('moveList');
  capWhiteEl = document.getElementById('capByWhite');
  capBlackEl = document.getElementById('capByBlack');
  filesTopEl = document.getElementById('filesTop');
  filesBottomEl = document.getElementById('filesBottom');
  ranksLeftEl = document.getElementById('ranksLeft');
  ranksRightEl = document.getElementById('ranksRight');
  evalFillEl = document.getElementById('evalFill');
  evalLabelEl = document.getElementById('evalLabel');
  fenInputEl = document.getElementById('fenInput');
  toastEl = document.getElementById('toast');
}

/* ---------- Pomocné ---------- */
function aiColor() { return other(playerColor); }

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
    var bishops = [], others = 0;
    for (var j = 0; j < pieces.length; j++) {
      var pp = pieces[j];
      if (pp.type === 'b') bishops.push(pp);
      else if (pp.type !== 'k') others++;
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

/* ---------- Snapshoty pro undo / historii ---------- */
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

/* ---------- Vykreslování ---------- */
function renderCoords() {
  if (!filesTopEl) return;
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
  if (!boardEl) return;
  boardEl.innerHTML = '';
  if (!board) return;
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
  if (!capWhiteEl || !capBlackEl) return;
  var w = '', b = '';
  for (var i = 0; i < capByWhite.length; i++) w += GLYPH[capByWhite[i]] + ' ';
  for (var j = 0; j < capByBlack.length; j++) b += GLYPH[capByBlack[j]] + ' ';
  capWhiteEl.textContent = w;
  capBlackEl.textContent = b;
}

var ANNOT_TEXT = ['', '?!', '?', '??'];
var ANNOT_CLASS = ['', 'annot-inaccuracy', 'annot-mistake', 'annot-blunder'];

function renderMoveList() {
  if (!moveListEl) return;
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
  if (!evalFillEl || !evalLabelEl) return;
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
function renderEvalBarFromSnapshot() { updateEvalBarDisplay(evaluateBoard(board)); }
function computeEvalBarAsync() {
  setTimeout(function () {
    try {
      clearSearchTables();
      searchAborted = false;
      searchDeadline = performance.now() + 120;
      var result = searchRoot(board, state, turn, 3, true);
      var scoreWhite = turn === 'w' ? result.score : -result.score;
      updateEvalBarDisplay(scoreWhite);
    } catch (err) { renderEvalBarFromSnapshot(); }
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
  if (!statusEl) return;
  var moves = getAllLegalMoves(board, turn, state);
  var check = inCheck(board, turn, state);
  statusEl.classList.remove('check');
  statusEl.classList.remove('over');

  if (moves.length === 0) {
    gameOver = true;
    if (check) {
      var winner = turn === 'w' ? 'Černý' : 'Bílý';
      statusEl.textContent = 'Mat! Vyhrává ' + winner + '.';
    } else statusEl.textContent = 'Pat – remíza.';
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

/* ---------- Interakce ---------- */
function onSquareClick(r, c) {
  if (gameOver || thinking) return;
  if (selfPlay) return;
  if (historyIndex !== moveHistory.length - 1) { gotoHistory(moveHistory.length - 1); return; }
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
  if (selfPlay) stopSelfPlay();
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

/* ---------- AI trigger ---------- */
function triggerAI() {
  if (selfPlay) return;
  if (!aiEnabled || gameOver || turn !== aiColor()) return;
  thinking = true;
  if (statusEl) statusEl.textContent = 'Počítač přemýšlí…';
  render();
  var delay = difficulty === 'easy' ? 120 : difficulty === 'medium' ? 180 : 60;
  setTimeout(function () {
    var m = pickAIMove(turn);
    thinking = false;
    if (m) makeMove(m);
    else { updateStatus(); render(); }
  }, delay);
}

/* ---------- Self-play plánování ---------- */
function scheduleSelfPlayMove() {
  if (!selfPlay || gameOver) {
    selfPlay = false;
    var tg = document.getElementById('selfPlayToggle'); if (tg) tg.checked = false;
    var sr = document.getElementById('selfPlaySpeedRow'); if (sr) sr.style.display = 'none';
    updateStatus();
    render();
    return;
  }
  thinking = true;
  if (statusEl) statusEl.textContent = 'AI vs AI – přemýšlí ' + (turn === 'w' ? 'Bílý' : 'Černý') + '…';
  render();
  selfPlayTimer = setTimeout(function () {
    if (!selfPlay) { thinking = false; return; }
    var m = pickAIMove(turn);
    thinking = false;
    if (m) makeMove(m);
    else {
      selfPlay = false;
      var tg2 = document.getElementById('selfPlayToggle'); if (tg2) tg2.checked = false;
      var sr2 = document.getElementById('selfPlaySpeedRow'); if (sr2) sr2.style.display = 'none';
      updateStatus();
      render();
    }
  }, 60);
}
function startSelfPlay() {
  selfPlay = true;
  aiEnabled = false;
  var at = document.getElementById('aiToggle'); if (at) at.checked = false;
  var sr = document.getElementById('selfPlaySpeedRow'); if (sr) sr.style.display = 'flex';
  setTimeout(function () { if (selfPlay && !gameOver) scheduleSelfPlayMove(); }, 200);
}
function stopSelfPlay() {
  selfPlay = false;
  if (selfPlayTimer) clearTimeout(selfPlayTimer);
  selfPlayTimer = null;
  var sr = document.getElementById('selfPlaySpeedRow'); if (sr) sr.style.display = 'none';
  updateStatus();
  render();
}

/* ---------- Proměna ---------- */
function showPromotionPicker(move, color) {
  var modal = document.getElementById('promoModal');
  if (!modal) return;
  var buttons = modal.querySelectorAll('.promo-btn');
  for (var i = 0; i < buttons.length; i++) {
    buttons[i].classList.remove('white-piece', 'black-piece');
    buttons[i].classList.add(color === 'w' ? 'white-piece' : 'black-piece');
  }
  modal.hidden = false;
}
function setupPromoModal() {
  var modal = document.getElementById('promoModal');
  if (!modal) return;
  modal.addEventListener('click', function (e) {
    var btn = e.target.closest ? e.target.closest('.promo-btn') : null;
    if (!btn) return;
    var piece = btn.dataset.piece;
    modal.hidden = true;
    if (pendingPromotion) {
      pendingPromotion.promotion = piece;
      var m = pendingPromotion;
      pendingPromotion = null;
      makeMove(m);
    }
  });
}

/* ---------- Drag & drop ---------- */
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
    pointerDrag = { from: { r: r, c: c }, startX: e.clientX, startY: e.clientY, moved: false, ghost: null, srcSquare: sq };
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
    var pieceEl = boardEl ? boardEl.querySelector('.square[data-r="' + r + '"][data-c="' + c + '"] .piece') : null;
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
