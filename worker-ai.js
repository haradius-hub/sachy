/* =========================================================================
   Šachy – worker-ai.js
   Spustí AI ve Web Workeru místo na hlavním vlákně.
   Hákuje se do triggerAI() a nahrazuje jeho chování, když Worker podporován.
   Autor: Better DeepSeek (AI) · Zadavatel: Jan Hošek · 2026
   SPDX-License-Identifier: GPL-3.0-or-later
   ========================================================================= */

(function () {
  'use strict';

  var worker = null;
  var pending = {};
  var nextId = 1;
  var workerBroken = false;

  function getWorker() {
    if (workerBroken) return null;
    if (worker && worker.readyState !== 'terminated') return worker;
    try {
      worker = new Worker('engine-worker.js');
      worker.onmessage = onWorkerMessage;
      worker.onerror = function (e) {
        console.warn('[worker-ai] Chyba workeru:', e);
        workerBroken = true;
        worker = null;
        // Vyřešíme čekající promise chybou, aby se UI nezaseklo
        for (var id in pending) {
          try { pending[id].reject(new Error('Worker failed')); } catch (er) {}
        }
        pending = {};
      };
      return worker;
    } catch (e) {
      console.warn('[worker-ai] Worker nelze spustit:', e);
      workerBroken = true;
      return null;
    }
  }

  function onWorkerMessage(e) {
    var msg = e.data || {};
    if (!msg.id) return;
    var p = pending[msg.id];
    if (!p) return;
    delete pending[msg.id];
    if (msg.type === 'move') p.resolve(msg.move);
    else if (msg.type === 'error') p.reject(new Error(msg.message));
    else p.resolve(null);
  }

  function serializeMove(m) {
    if (!m) return null;
    return {
      from: { r: m.from.r, c: m.from.c },
      to: { r: m.to.r, c: m.to.c },
      promotion: m.promotion || null,
      castle: m.castle || null,
      enPassant: !!m.enPassant
    };
  }

  function findMoveInWorker(cfg) {
    var w = getWorker();
    if (!w) return Promise.reject(new Error('Worker nedostupný.'));

    var id = nextId++;
    var req = {
      type: 'find-move',
      id: id,
      board: cloneBoard(board),
      state: cloneState(state),
      turn: turn,
      cfg: cfg,
      uciHistory: uciHistory.slice()
    };

    return new Promise(function (resolve, reject) {
      pending[id] = { resolve: resolve, reject: reject };
      try { w.postMessage(req); }
      catch (e) { delete pending[id]; reject(e); }
    });
  }

  /* ---------- Nahradíme globální triggerAI ---------- */
  var origTriggerAI = typeof window.triggerAI === 'function' ? window.triggerAI : null;

  window.triggerAI = function () {
    if (typeof selfPlay !== 'undefined' && selfPlay) return;
    if (!aiEnabled || gameOver) return;
    var aiColor = typeof aiColorFn === 'function' ? aiColorFn() : (playerColor === 'w' ? 'b' : 'w');
    if (turn !== aiColor) return;

    thinking = true;
    var statusEl = document.getElementById('status');
    if (statusEl) statusEl.textContent = 'Počítač přemýšlí…';
    if (typeof render === 'function') render();

    var cfg = (typeof AI_CONFIG !== 'undefined' && AI_CONFIG[difficulty]) || { maxDepth: 4, timeMs: 400, useQ: true, randomTop: 2 };

    findMoveInWorker(cfg).then(function (move) {
      thinking = false;
      if (move) {
        // Převod na plný tah v aktuální pozici
        var legal = getAllLegalMoves(board, turn, state);
        var real = null;
        for (var i = 0; i < legal.length; i++) {
          var m = legal[i];
          if (m.from.r === move.from.r && m.from.c === move.from.c &&
              m.to.r === move.to.r && m.to.c === move.to.c) {
            real = m;
            break;
          }
        }
        if (real) makeMove(real);
        else { updateStatus(); render(); }
      } else {
        updateStatus();
        render();
      }
    }).catch(function (err) {
      // Fallback – synchronní AI na hlavním vlákně
      console.warn('[worker-ai] Fallback na synchronní AI:', err.message);
      thinking = false;
      if (origTriggerAI) origTriggerAI();
      else { updateStatus(); render(); }
    });
  };

  // Pomocná funkce pro zjištění AI barvy (pokud globální neexistuje)
  function aiColorFn() {
    if (typeof aiColor === 'function') return aiColor();
    return playerColor === 'w' ? 'b' : 'w';
  }

  /* Pro self-play bychom mohli podobně nahradit scheduleSelfPlayMove,
     ale necháváme původní chování (self-play na pomalém stroji moc smysl nemá). */
})();
