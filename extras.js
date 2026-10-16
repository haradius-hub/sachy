/* =========================================================================
   Šachy – extras.js
   Úložiště, PGN, sdílení, zvuky, UI události, inicializace.
   Autor: Better DeepSeek (AI) · Zadavatel: Jan Hošek · 2026
   SPDX-License-Identifier: GPL-3.0-or-later

   POZN.: záměrně nepoužívám žádný zpětný lomítko-escape v řetězcích.
   Nový řádek = NL (String.fromCharCode(10)). PGN se skládá přes join.
   ========================================================================= */

var NL = String.fromCharCode(10);

/* ---------- Zvuky ---------- */
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

/* ---------- Toast ---------- */
var toastTimer = null;
function showToast(msg, ms) {
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { toastEl.hidden = true; }, ms || 2400);
}

/* ---------- Uložit / nahrát ---------- */
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
    var ss = document.getElementById('sideSelect'); if (ss) ss.value = playerColor;
    var ds = document.getElementById('difficultySelect'); if (ds) ds.value = difficulty;
    var at = document.getElementById('aiToggle'); if (at) at.checked = aiEnabled;
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

/* ---------- PGN export (žádné \n v řetězcích) ---------- */
function exportPGN() {
  if (uciHistory.length === 0) { showToast('Žádné tahy k exportu.'); return; }
  var date = new Date();
  var dateStr = date.getFullYear() + '.' +
    String(date.getMonth() + 1).padStart(2, '0') + '.' +
    String(date.getDate()).padStart(2, '0');
  var white = playerColor === 'w' ? 'Hráč' : 'Počítač';
  var black = playerColor === 'b' ? 'Hráč' : 'Počítač';
  var result = '*';
  if (gameOver) {
    if (inCheck(board, turn, state) && getAllLegalMoves(board, turn, state).length === 0) {
      result = turn === 'w' ? '0-1' : '1-0';
    } else result = '1/2-1/2';
  }
  var lines = [
    '[Event "Přátelská partie"]',
    '[Site "Šachy (Better DeepSeek)"]',
    '[Date "' + dateStr + '"]',
    '[Round "-"]',
    '[White "' + white + '"]',
    '[Black "' + black + '"]',
    '[Result "' + result + '"]',
    ''
  ];
  var curr = '';
  for (var i = 0; i < moveListSAN.length; i++) {
    if (i % 2 === 0) curr += (i / 2 + 1) + '. ';
    curr += moveListSAN[i] + ' ';
    if (curr.length > 78) { lines.push(curr.trim()); curr = ''; }
  }
  if (curr.trim()) lines.push(curr.trim());
  lines.push(result);
  var pgn = lines.join(NL) + NL;
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

/* ---------- PGN import ---------- */
function importPGNText(text) {
  var i, t;
  var uciMoves = [];
  var parts = text.split(' ');
  for (i = 0; i < parts.length; i++) {
    t = parts[i].toLowerCase();
    if (t.length === 4 || t.length === 5) {
      if (isAllUCIChars(t)) uciMoves.push(t);
    }
  }
  var ss = document.getElementById('sideSelect');
  var ds = document.getElementById('difficultySelect');
  var at = document.getElementById('aiToggle');
  playerColor = ss ? ss.value : 'w';
  difficulty = ds ? ds.value : 'medium';
  aiEnabled = at ? at.checked : false;
  if (uciMoves.length < 2) {
    var sanTokens = parsePGNTokens(text);
    if (sanTokens.length === 0) { showToast('Nepodařilo se najít žádné tahy.'); return; }
    var n = replayMovesSAN(sanTokens);
    if (!gameOver && aiEnabled && turn === aiColor()) triggerAI();
    showToast('Importováno ' + n + ' tahů (SAN).');
    return;
  }
  replayMovesUCI(uciMoves);
  if (!gameOver && aiEnabled && turn === aiColor()) triggerAI();
  showToast('Importováno ' + uciMoves.length + ' tahů (UCI).');
}

function isAllUCIChars(t) {
  if (t.length < 4 || t.length > 5) return false;
  var c0 = t.charCodeAt(0), c1 = t.charCodeAt(1);
  var c2 = t.charCodeAt(2), c3 = t.charCodeAt(3);
  if (c0 < 97 || c0 > 104) return false;
  if (c1 < 49 || c1 > 56) return false;
  if (c2 < 97 || c2 > 104) return false;
  if (c3 < 49 || c3 > 56) return false;
  if (t.length === 5) {
    var c4 = t.charAt(4);
    if (c4 !== 'q' && c4 !== 'r' && c4 !== 'b' && c4 !== 'n') return false;
  }
  return true;
}

function parsePGNTokens(text) {
  var parts = [];
  var curr = '';
  for (var i = 0; i < text.length; i++) {
    var code = text.charCodeAt(i);
    if (code === 32 || code === 9 || code === 10 || code === 13) {
      if (curr) { parts.push(curr); curr = ''; }
    } else if (code === 91 || code === 93 || code === 123 || code === 125) {
      if (curr) { parts.push(curr); curr = ''; }
    } else {
      curr += text.charAt(i);
    }
  }
  if (curr) parts.push(curr);
  var out = [];
  for (var j = 0; j < parts.length; j++) {
    if (isPGNMoveToken(parts[j])) out.push(parts[j]);
  }
  return out;
}

function isPGNMoveToken(tok) {
  if (!tok || tok.length === 0 || tok.length > 8) return false;
  if (tok === '1-0' || tok === '0-1' || tok === '1/2-1/2' || tok === '*') return false;
  var c0 = tok.charAt(0);
  var letters = 'abcdefghKQRBN';
  var digits = '12345678';
  var extras = '=#+-x';
  if (c0 === 'O' || c0 === '0') {
    return tok === 'O-O' || tok === 'O-O-O' || tok === '0-0' || tok === '0-0-0';
  }
  if (letters.indexOf(c0) < 0) return false;
  for (var k = 1; k < tok.length; k++) {
    var ch = tok.charAt(k);
    if (letters.indexOf(ch) >= 0) continue;
    if (digits.indexOf(ch) >= 0) continue;
    if (extras.indexOf(ch) >= 0) continue;
    return false;
  }
  return true;
}

/* ---------- Sdílení ---------- */
function shareGame() {
  try {
    var data = { m: uciHistory, p: playerColor, d: difficulty, a: aiEnabled ? 1 : 0 };
    var b64 = btoa(unescape(encodeURIComponent(JSON.stringify(data))));
    var url = location.origin + location.pathname + '#g=' + b64;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(
        function () { showToast('Odkaz zkopírován.'); },
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
    var ss = document.getElementById('sideSelect'); if (ss) ss.value = playerColor;
    var ds = document.getElementById('difficultySelect'); if (ds) ds.value = difficulty;
    var at = document.getElementById('aiToggle'); if (at) at.checked = aiEnabled;
    replayMovesUCI(data.m);
    history.replaceState(null, '', location.pathname + location.search);
    showToast('Partie načtena z odkazu.');
    return true;
  } catch (err) { return false; }
}

/* ---------- Nápověda ---------- */
function requestHint() {
  if (gameOver || thinking || selfPlay) return;
  if (aiEnabled && turn === aiColor()) return;
  if (historyIndex !== moveHistory.length - 1) { showToast('Nejprve se vrať do aktuální pozice.'); return; }
  thinking = true;
  if (statusEl) statusEl.textContent = 'Přemýšlím o nápovědě…';
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

/* ---------- Listenery ---------- */
function on(id, event, handler) {
  var el = document.getElementById(id);
  if (el) el.addEventListener(event, handler);
}

function setupEventListeners() {
  on('newGame', 'click', function () {
    newGame();
    if (selfPlay) setTimeout(function () { if (selfPlay) scheduleSelfPlayMove(); }, 200);
    else if (!gameOver && aiEnabled && turn === aiColor()) triggerAI();
  });
  on('undo', 'click', undo);
  on('hintBtn', 'click', requestHint);
  on('analyzeBtn', 'click', function () { if (typeof analyzeGame === 'function') analyzeGame(); });
  on('saveBtn', 'click', saveGame);
  on('loadBtn', 'click', loadGame);
  on('exportBtn', 'click', exportPGN);
  on('importBtn', 'click', function () {
    var t = document.getElementById('importText'); if (t) t.value = '';
    var m = document.getElementById('importModal'); if (m) m.hidden = false;
    if (t) t.focus();
  });
  on('importCancel', 'click', function () {
    var m = document.getElementById('importModal'); if (m) m.hidden = true;
  });
  on('importConfirm', 'click', function () {
    var t = document.getElementById('importText');
    var text = t ? t.value : '';
    var m = document.getElementById('importModal'); if (m) m.hidden = true;
    importPGNText(text);
  });
  on('shareBtn', 'click', shareGame);
  on('copyFenBtn', 'click', function () {
    var v = fenInputEl ? fenInputEl.value : '';
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(v).then(
        function () { showToast('FEN zkopírován.'); },
        function () { window.prompt('FEN:', v); }
      );
    } else window.prompt('FEN:', v);
  });
  on('rotateBtn', 'click', function () { flipped = !flipped; render(); });
  on('aiToggle', 'change', function (e) {
    aiEnabled = e.target.checked;
    if (aiEnabled && selfPlay) {
      selfPlay = false;
      var sp = document.getElementById('selfPlayToggle'); if (sp) sp.checked = false;
      var sr = document.getElementById('selfPlaySpeedRow'); if (sr) sr.style.display = 'none';
      if (selfPlayTimer) clearTimeout(selfPlayTimer);
    }
    newGame();
    if (!gameOver && aiEnabled && turn === aiColor()) triggerAI();
  });
  on('selfPlayToggle', 'change', function (e) {
    if (e.target.checked) { if (selfPlayTimer) clearTimeout(selfPlayTimer); startSelfPlay(); }
    else stopSelfPlay();
  });
  on('selfPlaySpeedSelect', 'change', function (e) {
    selfPlaySpeedMs = parseInt(e.target.value, 10) || 500;
  });
  on('sideSelect', 'change', function (e) {
    playerColor = e.target.value;
    newGame();
    if (!gameOver && aiEnabled && turn === aiColor()) triggerAI();
  });
  on('difficultySelect', 'change', function (e) { difficulty = e.target.value; });
  on('soundToggle', 'change', function (e) {
    soundsEnabled = e.target.checked;
    try { localStorage.setItem('chess-sound', soundsEnabled ? '1' : '0'); } catch (err) {}
  });
  on('threatToggle', 'change', function (e) {
    threatsEnabled = e.target.checked;
    try { localStorage.setItem('chess-threats', threatsEnabled ? '1' : '0'); } catch (err) {}
    render();
  });
  on('themeSelect', 'change', function (e) {
    document.body.dataset.theme = e.target.value;
    try { localStorage.setItem('chess-theme', e.target.value); } catch (err) {}
  });
  on('reportClose', 'click', function () { var m = document.getElementById('reportModal'); if (m) m.hidden = true; });
  on('reportCloseBtn', 'click', function () { var m = document.getElementById('reportModal'); if (m) m.hidden = true; });

  document.addEventListener('keydown', function (e) {
    var tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.ctrlKey && (e.key === 's' || e.key === 'S')) { e.preventDefault(); saveGame(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'n' || e.key === 'N') {
      newGame();
      if (selfPlay) setTimeout(function () { if (selfPlay) scheduleSelfPlayMove(); }, 200);
      else if (!gameOver && aiEnabled && turn === aiColor()) triggerAI();
    } else if (e.key === 'z' || e.key === 'Z') undo();
    else if (e.key === 'h' || e.key === 'H') requestHint();
    else if (e.key === 'a' || e.key === 'A') { if (typeof analyzeGame === 'function') analyzeGame(); }
  });
}

function restorePrefs() {
  try {
    var t = localStorage.getItem('chess-theme');
    if (t) {
      document.body.dataset.theme = t;
      var ts = document.getElementById('themeSelect'); if (ts) ts.value = t;
    }
    var s = localStorage.getItem('chess-sound');
    if (s !== null) {
      soundsEnabled = s === '1';
      var sot = document.getElementById('soundToggle'); if (sot) sot.checked = soundsEnabled;
    }
    var th = localStorage.getItem('chess-threats');
    if (th !== null) {
      threatsEnabled = th === '1';
      var tt = document.getElementById('threatToggle'); if (tt) tt.checked = threatsEnabled;
    }
  } catch (err) {}
}

/* ---------- Inicializace ---------- */
function initGame() {
  cacheDom();
  setupPromoModal();
  setupEventListeners();
  restorePrefs();
  try {
    if (!tryLoadFromURL()) newGame();
    if (window.console && console.log) console.log('[Šachy] Init OK');
  } catch (err) {
    if (statusEl) statusEl.textContent = '⚠ Init: ' + (err.message || err);
    if (window.console && console.error) console.error('[Šachy]', err);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initGame);
} else {
  initGame();
}
