/* =========================================================================
   Šachy – puzzles-v2.js
   Generované matové hádanky (3 obtížnosti) + trvalý panel s úkolem
   + ukládání rozehrané hádanky do localStorage.
   Autor: Better DeepSeek (AI) · Zadavatel: Jan Hošek · 2026
   SPDX-License-Identifier: GPL-3.0-or-later
   ========================================================================= */

(function () {
  'use strict';

  var PUZZLE_STORAGE_KEY = 'sachy-active-puzzle';

  var currentPuzzle = null;   // { board, state, N, material, difficulty, startFen }
  var playerMovesCount = 0;
  var savedDifficulty = null;
  var savedPlayerColor = null;
  var savedAiEnabled = null;
  var panelEl = null;

  /* =====================================================================
     1) GENERÁTOR HÁDANEK
     ===================================================================== */
  function puzzleEmptyBoard() {
    var b = [];
    for (var r = 0; r < 8; r++) {
      var row = [];
      for (var c = 0; c < 8; c++) row.push(null);
      b.push(row);
    }
    return b;
  }
  function puzzleRandomSquare() {
    return { r: Math.floor(Math.random() * 8), c: Math.floor(Math.random() * 8) };
  }
  function puzzleRandomFreeSquare(b) {
    for (var att = 0; att < 60; att++) {
      var s = puzzleRandomSquare();
      if (!b[s.r][s.c]) return s;
    }
    return null;
  }
  function puzzleMateInN(b, st, color, n) {
    if (n <= 0) return false;
    var moves = getAllLegalMoves(b, color, st);
    if (moves.length === 0) return false;
    var opp = other(color);
    for (var i = 0; i < moves.length; i++) {
      var b2 = cloneBoard(b), s2 = cloneState(st);
      applyMove(b2, moves[i], s2);
      var oppMoves = getAllLegalMoves(b2, opp, s2);
      if (oppMoves.length === 0) {
        if (inCheck(b2, opp, s2)) return true;
        continue;
      }
      if (n >= 2) {
        var allLose = true;
        for (var j = 0; j < oppMoves.length; j++) {
          var b3 = cloneBoard(b2), s3 = cloneState(s2);
          applyMove(b3, oppMoves[j], s3);
          if (!puzzleMateInN(b3, s3, color, n - 1)) { allLose = false; break; }
        }
        if (allLose) return true;
      }
    }
    return false;
  }
  function puzzleForcedMateFromOppTurn(b, st, color, n) {
    if (n <= 0) return false;
    var opp = other(color);
    var oppMoves = getAllLegalMoves(b, opp, st);
    if (oppMoves.length === 0) return inCheck(b, opp, st);
    for (var i = 0; i < oppMoves.length; i++) {
      var b2 = cloneBoard(b), s2 = cloneState(st);
      applyMove(b2, oppMoves[i], s2);
      if (!puzzleMateInN(b2, s2, color, n)) return false;
    }
    return true;
  }

  var PUZZLE_MATERIALS = {
    easy: [
      { name: 'Dáma', pieces: [{ type: 'q', color: 'w' }] },
      { name: 'Věž', pieces: [{ type: 'r', color: 'w' }] },
      { name: 'Dvě věže', pieces: [{ type: 'r', color: 'w' }, { type: 'r', color: 'w' }] }
    ],
    medium: [
      { name: 'Dáma', pieces: [{ type: 'q', color: 'w' }] },
      { name: 'Věž', pieces: [{ type: 'r', color: 'w' }] },
      { name: 'Dáma + Věž', pieces: [{ type: 'q', color: 'w' }, { type: 'r', color: 'w' }] },
      { name: 'Dvě věže', pieces: [{ type: 'r', color: 'w' }, { type: 'r', color: 'w' }] }
    ],
    hard: [
      { name: 'Dáma + Věž', pieces: [{ type: 'q', color: 'w' }, { type: 'r', color: 'w' }] },
      { name: 'Dvě věže', pieces: [{ type: 'r', color: 'w' }, { type: 'r', color: 'w' }] },
      { name: 'Dáma + Dáma', pieces: [{ type: 'q', color: 'w' }, { type: 'q', color: 'w' }] },
      { name: 'Dáma + Věž + Věž', pieces: [{ type: 'q', color: 'w' }, { type: 'r', color: 'w' }, { type: 'r', color: 'w' }] }
    ]
  };

  function generatePuzzle(difficulty) {
    var N = difficulty === 'easy' ? 1 : (difficulty === 'medium' ? 2 : 3);
    var mats = PUZZLE_MATERIALS[difficulty] || PUZZLE_MATERIALS.easy;
    var t0 = performance.now();
    var timeLimit = N === 3 ? 5500 : (N === 2 ? 2500 : 800);

    for (var attempt = 0; attempt < 4000; attempt++) {
      if (performance.now() - t0 > timeLimit) break;
      var mat = mats[Math.floor(Math.random() * mats.length)];
      var b = puzzleEmptyBoard();
      var wk, bk;
      if (N === 1) {
        wk = puzzleRandomSquare();
        var edges = [];
        for (var r = 0; r < 8; r++) { edges.push({ r: r, c: 0 }); edges.push({ r: r, c: 7 }); }
        for (var c2 = 1; c2 < 7; c2++) { edges.push({ r: 0, c: c2 }); edges.push({ r: 7, c: c2 }); }
        bk = edges[Math.floor(Math.random() * edges.length)];
      } else {
        wk = puzzleRandomSquare();
        bk = puzzleRandomSquare();
      }
      if (wk.r === bk.r && wk.c === bk.c) continue;
      if (Math.abs(wk.r - bk.r) <= 1 && Math.abs(wk.c - bk.c) <= 1) continue;
      b[wk.r][wk.c] = { type: 'k', color: 'w' };
      b[bk.r][bk.c] = { type: 'k', color: 'b' };
      var ok = true;
      for (var pi = 0; pi < mat.pieces.length; pi++) {
        var s = puzzleRandomFreeSquare(b);
        if (!s) { ok = false; break; }
        b[s.r][s.c] = { type: mat.pieces[pi].type, color: mat.pieces[pi].color };
      }
      if (!ok) continue;
      var st = freshState();
      if (isAttacked(b, wk.r, wk.c, 'b')) continue;
      if (isAttacked(b, bk.r, bk.c, 'w')) continue;
      if (!puzzleMateInN(b, st, 'w', N)) continue;
      if (N > 1 && puzzleMateInN(b, st, 'w', N - 1)) continue;
      return { board: b, state: st, N: N, material: mat.name, difficulty: difficulty };
    }
    return null;
  }

  /* =====================================================================
     2) TRVALÝ PANEL S ÚKOLEM
     ===================================================================== */
  function ensurePanel() {
    if (panelEl && panelEl.parentNode) return panelEl;
    var boardArea = document.querySelector('.board-area');
    if (!boardArea) return null;

    panelEl = document.createElement('div');
    panelEl.id = 'puzzleTaskPanel';
    panelEl.className = 'puzzle-task';
    panelEl.hidden = true;
    boardArea.appendChild(panelEl);
    return panelEl;
  }

  function renderPanel() {
    var p = ensurePanel();
    if (!p) return;
    if (!currentPuzzle) { p.hidden = true; p.innerHTML = ''; return; }
    p.hidden = false;

    var remaining = currentPuzzle.N - playerMovesCount;
    var turnText = (turn === 'w') ? 'Tvůj tah' : 'Soupeř přemýšlí…';

    p.innerHTML = '' +
      '<div class="puzzle-task-main">' +
      '  <span class="puzzle-task-badge">Hádanka</span>' +
      '  <span class="puzzle-task-title">Mat <b>' + currentPuzzle.N + '</b>. tahem</span>' +
      '  <span class="puzzle-task-mat">' + currentPuzzle.material + '</span>' +
      '</div>' +
      '<div class="puzzle-task-status">' +
      '  Zbývá: <b>' + Math.max(0, remaining) + '</b> ' + plural(remaining, 'tah', 'tahy', 'tahů') +
      ' · <span class="puzzle-task-turn">' + turnText + '</span>' +
      '</div>' +
      '<div class="puzzle-task-actions">' +
      '  <button id="puzzleRestart" class="btn btn-outline">Od začátku</button>' +
      '  <button id="puzzleGiveUp" class="btn btn-outline">Vzdát</button>' +
      '</div>';

    var r = p.querySelector('#puzzleRestart');
    if (r) r.addEventListener('click', restartPuzzle);
    var g = p.querySelector('#puzzleGiveUp');
    if (g) g.addEventListener('click', giveUpPuzzle);
  }

  function plural(n, one, few, many) {
    if (n === 1) return one;
    if (n >= 2 && n <= 4) return few;
    return many;
  }

  function updatePanel() { renderPanel(); }

  /* =====================================================================
     3) UKLÁDÁNÍ DO localStorage
     ===================================================================== */
  function savePuzzleToStorage() {
    if (!currentPuzzle) return;
    try {
      var data = {
        board: currentPuzzle.board,
        state: currentPuzzle.state,
        N: currentPuzzle.N,
        material: currentPuzzle.material,
        difficulty: currentPuzzle.difficulty,
        startBoard: currentPuzzle.startBoard,
        startState: currentPuzzle.startState,
        uciHistory: uciHistory,
        playerMovesCount: playerMovesCount
      };
      localStorage.setItem(PUZZLE_STORAGE_KEY, JSON.stringify(data));
    } catch (e) { /* ignore */ }
  }

  function clearPuzzleStorage() {
    try { localStorage.removeItem(PUZZLE_STORAGE_KEY); } catch (e) {}
  }

  function loadPuzzleFromStorage() {
    try {
      var raw = localStorage.getItem(PUZZLE_STORAGE_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || !data.board || !data.N) return null;
      return data;
    } catch (e) { return null; }
  }

  /* =====================================================================
     4) SPUŠTĚNÍ / UKONČENÍ HÁDANKY
     ===================================================================== */
  function loadGeneratedPuzzle(difficulty) {
    if (thinking) { showToast('Počkej, počítač přemýšlí.'); return; }
    if (typeof statusEl !== 'undefined' && statusEl) statusEl.textContent = 'Generuji hádanku…';
    showToast('Generuji hádanku…', 1500);

    if (savedDifficulty === null) {
      savedDifficulty = difficulty;
      savedPlayerColor = playerColor;
      savedAiEnabled = aiEnabled;
    }

    setTimeout(function () {
      var p = generatePuzzle(difficulty);
      if (!p) {
        showToast('Nepodařilo se vygenerovat hádanku. Zkus to znovu.', 3000);
        updateStatus();
        render();
        return;
      }
      p.startBoard = cloneBoard(p.board);
      p.startState = cloneState(p.state);
      applyPuzzleToGame(p);
      var m = document.getElementById('puzzleModal');
      if (m) m.hidden = true;
      showToast('Mat ' + p.N + '. tahem · ' + p.material, 3500);
    }, 60);
  }

  function applyPuzzleToGame(p) {
    board = cloneBoard(p.board);
    state = cloneState(p.state);
    turn = 'w';
    playerColor = 'w';
    aiEnabled = true;
    difficulty = 'hard';
    flipped = false;
    selected = null;
    legalTargets = [];
    lastMove = null;
    gameOver = false;
    capByWhite = [];
    capByBlack = [];
    moveListSAN = [];
    uciHistory = p.uciHistory ? p.uciHistory.slice() : [];
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
    clearSearchTables();

    currentPuzzle = p;
    playerMovesCount = p.playerMovesCount || 0;

    var side = document.getElementById('sideSelect'); if (side) side.value = 'w';
    var at = document.getElementById('aiToggle'); if (at) at.checked = true;
    var ds = document.getElementById('difficultySelect'); if (ds) ds.value = 'hard';

    updateStatus();
    render();
    renderPanel();
    if (typeof statusEl !== 'undefined' && statusEl) {
      statusEl.textContent = 'Hádanka (' + p.material + '): mat ' + p.N + '. tahem';
    }
    savePuzzleToStorage();
  }

  function restartPuzzle() {
    if (!currentPuzzle) return;
    if (!currentPuzzle.startBoard) return;
    var p = currentPuzzle;
    p.board = cloneBoard(p.startBoard);
    p.state = cloneState(p.startState);
    p.uciHistory = [];
    applyPuzzleToGame(p);
    showToast('Hádanka od začátku.', 2000);
  }

  function giveUpPuzzle() {
    if (!currentPuzzle) return;
    if (!confirm('Opravdu vzdát hádanku?')) return;
    exitPuzzle();
    newGame();
    updateStatus();
    render();
    showToast('Hádanka vzdána.', 2000);
  }

  function exitPuzzle() {
    currentPuzzle = null;
    playerMovesCount = 0;
    clearPuzzleStorage();
    if (savedDifficulty !== null) {
      difficulty = savedDifficulty;
      playerColor = savedPlayerColor;
      aiEnabled = savedAiEnabled;
      savedDifficulty = null;
      savedPlayerColor = null;
      savedAiEnabled = null;
      var ds = document.getElementById('difficultySelect'); if (ds) ds.value = difficulty;
      var ss = document.getElementById('sideSelect'); if (ss) ss.value = playerColor;
      var at = document.getElementById('aiToggle'); if (at) at.checked = aiEnabled;
    }
    if (panelEl) { panelEl.hidden = true; panelEl.innerHTML = ''; }
  }

  /* =====================================================================
     5) HÁK DO makeMove — sledování postupu hráče
     ===================================================================== */
  if (typeof window.makeMove === 'function') {
    var _origMakeMove = window.makeMove;
    window.makeMove = function (move) {
      _origMakeMove.apply(this, arguments);
      if (!currentPuzzle) return;

      /* Po tahu hráče je na tahu soupeř (turn === 'b') */
      if (turn !== 'b') return;

      setTimeout(function () {
        if (!currentPuzzle) return;

        var oppMoves = getAllLegalMoves(board, 'b', state);
        if (oppMoves.length === 0) {
          if (inCheck(board, 'b', state)) {
            showToast('🎉 Vyřešeno v ' + (playerMovesCount + 1) + ' tazích! (' + currentPuzzle.material + ')', 5000);
            exitPuzzle();
            updateStatus();
            render();
            return;
          } else {
            showToast('Pat – zkus znovu.', 2500);
            setTimeout(function () { restartPuzzle(); }, 1000);
            return;
          }
        }

        playerMovesCount++;
        updatePanel();
        savePuzzleToStorage();

        if (playerMovesCount > currentPuzzle.N) {
          showToast('Překročen limit ' + currentPuzzle.N + ' tahu. Zkus znovu.', 3000);
          setTimeout(function () { restartPuzzle(); }, 1200);
          return;
        }

        var remaining = currentPuzzle.N - playerMovesCount;
        if (remaining > 0) {
          var stillWinning = puzzleForcedMateFromOppTurn(board, state, 'w', remaining);
          if (!stillWinning) {
            showToast('Tah zkazil výhru. Zkus znovu.', 2500);
            setTimeout(function () { restartPuzzle(); }, 1200);
            return;
          }
        }
      }, 320);
    };
  }

  /* =====================================================================
     6) UI — tři tlačítka + obnova uložené hádanky
     ===================================================================== */
  function buildPuzzleButtons() {
    var list = document.getElementById('puzzleList');
    if (!list) return;
    list.innerHTML = '';

    /* Tlačítko "Pokračovat", pokud je uložená hádanka */
    var savedP = loadPuzzleFromStorage();
    if (savedP) {
      var resume = document.createElement('button');
      resume.className = 'puzzle-item puzzle-item-resume';
      var rb = document.createElement('b');
      rb.textContent = '▶ Pokračovat';
      resume.appendChild(rb);
      var rh = document.createElement('span');
      rh.className = 'puzzle-hint';
      rh.textContent = 'Rozpracovaná: mat ' + savedP.N + '. tahem · ' + savedP.material;
      resume.appendChild(rh);
      resume.addEventListener('click', function () {
        applyPuzzleToGame(savedP);
        var m = document.getElementById('puzzleModal');
        if (m) m.hidden = true;
        showToast('Pokračuješ v hádance.', 2000);
      });
      list.appendChild(resume);

      var sep = document.createElement('div');
      sep.style.margin = '12px 0 8px';
      sep.style.borderTop = '1px solid var(--line)';
      list.appendChild(sep);
    }

    var desc = document.createElement('p');
    desc.style.fontSize = '13px';
    desc.style.color = 'var(--muted)';
    desc.style.margin = '0 0 12px';
    desc.style.lineHeight = '1.5';
    desc.textContent = 'Vygeneruje se nová hádanka. Cílem je dát mat v uvedeném počtu tahů i při nejlepší obraně soupeře.';
    list.appendChild(desc);

    var diffs = [
      { id: 'easy',   label: 'Lehká',   desc: 'Mat 1. tahem (K+D / K+V vs K)' },
      { id: 'medium', label: 'Střední', desc: 'Mat 2. tahem (K+D / K+V vs K)' },
      { id: 'hard',   label: 'Těžká',   desc: 'Mat 3. tahem (D+V / 2V / 2D)' }
    ];
    for (var i = 0; i < diffs.length; i++) {
      (function (d) {
        var btn = document.createElement('button');
        btn.className = 'puzzle-item';
        var b = document.createElement('b');
        b.textContent = d.label;
        btn.appendChild(b);
        var h = document.createElement('span');
        h.className = 'puzzle-hint';
        h.textContent = d.desc;
        btn.appendChild(h);
        btn.addEventListener('click', function () { loadGeneratedPuzzle(d.id); });
        list.appendChild(btn);
      })(diffs[i]);
    }
  }

  function hookPuzzleBtn() {
    var oldBtn = document.getElementById('puzzleBtn');
    if (!oldBtn) return;
    var newBtn = oldBtn.cloneNode(true);
    oldBtn.parentNode.replaceChild(newBtn, oldBtn);
    newBtn.addEventListener('click', function () {
      var m = document.getElementById('puzzleModal');
      if (m) {
        buildPuzzleButtons();
        m.hidden = false;
      }
    });
  }

  /* Hák do newGame, aby ukončil hádanku při nové hře */
  if (typeof window.newGame === 'function') {
    var _origNewGame = window.newGame;
    window.newGame = function () {
      _origNewGame.apply(this, arguments);
      if (currentPuzzle) {
        currentPuzzle = null;
        playerMovesCount = 0;
        clearPuzzleStorage();
        if (panelEl) { panelEl.hidden = true; panelEl.innerHTML = ''; }
      }
    };
  }

  /* Init */
  function init() {
    ensurePanel();
    hookPuzzleBtn();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 150); });
  } else {
    setTimeout(init, 150);
  }
})();
