/* =========================================================================
   Šachy – hotseat.js  (FIXED: shadowing state → hotseatState)
   Režim "dva hráči u jednoho PC" (hot-seat).
   Autor: Better DeepSeek (AI) · Zadavatel: Jan Hošek · 2026
   SPDX-License-Identifier: GPL-3.0-or-later
   ========================================================================= */

(function () {
  'use strict';

  /* OPRAVA: původně zde bylo `var state`, které shadowovalo globální šachový
     stav z game.js. Způsobovalo pád v getAllLegalMoves() v recordResult(),
     takže se skóre nikdy nepřičetlo. Nyní je to `hotseatState`. */
  var STORAGE_KEY = 'sachy-hotseat';
  var hotseatState = {
    enabled: false,
    whiteName: 'Hráč 1',
    blackName: 'Hráč 2',
    score: { white: 0, black: 0, draws: 0 }
  };

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      var data = JSON.parse(raw);
      if (typeof data.enabled === 'boolean') hotseatState.enabled = data.enabled;
      if (data.whiteName) hotseatState.whiteName = String(data.whiteName).slice(0, 20);
      if (data.blackName) hotseatState.blackName = String(data.blackName).slice(0, 20);
      if (data.score && typeof data.score === 'object') {
        hotseatState.score.white = parseInt(data.score.white, 10) || 0;
        hotseatState.score.black = parseInt(data.score.black, 10) || 0;
        hotseatState.score.draws = parseInt(data.score.draws, 10) || 0;
      }
    } catch (e) {}
  }
  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(hotseatState)); } catch (e) {}
  }

  function injectUI() {
    var box = document.querySelectorAll('.panel .box');
    var target = null;
    for (var i = 0; i < box.length; i++) {
      var t = box[i].querySelector('.box-title');
      if (t && t.textContent.indexOf('Nastavení hry') >= 0) { target = box[i]; break; }
    }
    if (!target) return;
    if (target.querySelector('#hotseatToggle')) return;

    var section = document.createElement('div');
    section.id = 'hotseatSection';
    section.style.marginTop = '10px';
    section.style.paddingTop = '10px';
    section.style.borderTop = '1px solid var(--line)';

    var toggle = document.createElement('label');
    toggle.className = 'toggle';
    toggle.innerHTML = '<input type="checkbox" id="hotseatToggle"><span>Hot-seat (dva hráči u PC)</span>';
    section.appendChild(toggle);

    var names = document.createElement('div');
    names.id = 'hotseatNames';
    names.style.display = 'none';
    names.style.marginTop = '8px';
    names.style.gap = '6px';
    names.style.flexDirection = 'column';

    var f1 = document.createElement('label');
    f1.className = 'field';
    f1.innerHTML = '<span class="field-label">Jméno bílého</span><input type="text" id="hotseatWhite" maxlength="20">';
    names.appendChild(f1);

    var f2 = document.createElement('label');
    f2.className = 'field';
    f2.innerHTML = '<span class="field-label">Jméno černého</span><input type="text" id="hotseatBlack" maxlength="20">';
    names.appendChild(f2);

    var scoreRow = document.createElement('div');
    scoreRow.id = 'hotseatScore';
    scoreRow.className = 'hotseat-score';
    scoreRow.style.marginTop = '8px';
    scoreRow.style.fontSize = '13px';
    scoreRow.style.fontVariantNumeric = 'tabular-nums';
    scoreRow.style.display = 'flex';
    scoreRow.style.justifyContent = 'space-between';
    scoreRow.style.gap = '6px';

    var resetBtn = document.createElement('button');
    resetBtn.id = 'hotseatResetScore';
    resetBtn.className = 'btn btn-outline';
    resetBtn.style.marginTop = '8px';
    resetBtn.style.padding = '4px 10px';
    resetBtn.style.fontSize = '11.5px';
    resetBtn.textContent = 'Vynulovat skóre';

    section.appendChild(names);
    section.appendChild(scoreRow);
    section.appendChild(resetBtn);
    target.appendChild(section);

    toggle.querySelector('#hotseatToggle').checked = hotseatState.enabled;
    toggle.querySelector('#hotseatToggle').addEventListener('change', function (e) {
      hotseatState.enabled = e.target.checked;
      if (hotseatState.enabled) {
        var ai = document.getElementById('aiToggle');
        if (ai && ai.checked) { ai.checked = false; }
        if (typeof aiEnabled !== 'undefined') aiEnabled = false;
      }
      updateNamesVisibility();
      saveState();
      if (typeof newGame === 'function') newGame();
      updateStatusNames();
    });

    var inpW = names.querySelector('#hotseatWhite');
    var inpB = names.querySelector('#hotseatBlack');
    inpW.value = hotseatState.whiteName;
    inpB.value = hotseatState.blackName;
    inpW.addEventListener('input', function () {
      hotseatState.whiteName = inpW.value.trim().slice(0, 20) || 'Hráč 1';
      saveState();
      updateStatusNames();
      updateScorePanel();
    });
    inpB.addEventListener('input', function () {
      hotseatState.blackName = inpB.value.trim().slice(0, 20) || 'Hráč 2';
      saveState();
      updateStatusNames();
      updateScorePanel();
    });

    resetBtn.addEventListener('click', function () {
      hotseatState.score = { white: 0, black: 0, draws: 0 };
      saveState();
      updateScorePanel();
    });

    updateNamesVisibility();
    updateScorePanel();
  }

  function updateNamesVisibility() {
    var n = document.getElementById('hotseatNames');
    if (n) n.style.display = hotseatState.enabled ? 'flex' : 'none';
  }

  function updateScorePanel() {
    var el = document.getElementById('hotseatScore');
    if (!el) return;
    var w = hotseatState.whiteName || 'Hráč 1';
    var b = hotseatState.blackName || 'Hráč 2';
    el.innerHTML = '' +
      '<span><b>' + esc(w) + '</b>: ' + hotseatState.score.white + '</span>' +
      '<span>Remízy: ' + hotseatState.score.draws + '</span>' +
      '<span><b>' + esc(b) + '</b>: ' + hotseatState.score.black + '</span>';
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }

  function updateStatusNames() {
    if (!hotseatState.enabled) return;
    var el = document.getElementById('status');
    if (!el) return;
    if (typeof turn === 'undefined') return;
    var name = turn === 'w' ? hotseatState.whiteName : hotseatState.blackName;
    var color = turn === 'w' ? 'Bílý' : 'Černý';
    var txt = 'Na tahu: ' + name + ' (' + color + ')';
    try {
      if (typeof inCheck === 'function' && typeof board !== 'undefined' && typeof state !== 'undefined') {
        if (inCheck(board, turn, state)) txt += ' – šach!';
      }
    } catch (e) {}
    el.textContent = txt;
    el.classList.toggle('check', /šach/.test(txt));
  }

  function hookStatus() {
    if (typeof window.updateStatus !== 'function') {
      setTimeout(hookStatus, 200);
      return;
    }
    var _orig = window.updateStatus;
    window.updateStatus = function () {
      _orig.apply(this, arguments);
      if (hotseatState.enabled) {
        try { updateStatusNames(); } catch (e) {}
      }
    };
  }

  var lastResultKey = '';

  function recordResult() {
    if (!hotseatState.enabled) return;
    if (typeof gameOver === 'undefined' || !gameOver) return;
    if (typeof board === 'undefined' || typeof turn === 'undefined' || typeof state === 'undefined') return;

    var key = (typeof uciHistory !== 'undefined' && uciHistory) ? uciHistory.join(',') : '';
    if (!key || key === lastResultKey) return;
    lastResultKey = key;

    var moves;
    try { moves = getAllLegalMoves(board, turn, state); } catch (e) { return; }
    if (moves.length > 0) return;

    var check = false;
    try { check = inCheck(board, turn, state); } catch (e) {}

    if (check) {
      if (turn === 'w') hotseatState.score.black += 1;
      else hotseatState.score.white += 1;
    } else {
      hotseatState.score.draws += 1;
    }
    saveState();
    updateScorePanel();

    var el = document.getElementById('status');
    if (el) {
      if (check) {
        var winner = turn === 'w' ? hotseatState.blackName : hotseatState.whiteName;
        el.textContent = 'Mat! Vyhrává ' + winner + '.';
      } else {
        el.textContent = 'Pat – remíza.';
      }
    }
  }

  setInterval(function () { recordResult(); }, 800);

  function init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { setTimeout(start, 150); });
    } else {
      setTimeout(start, 150);
    }
  }
  function start() {
    loadState();
    injectUI();
    hookStatus();
    if (hotseatState.enabled) updateStatusNames();
  }
  init();
})();
