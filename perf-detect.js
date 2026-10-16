/* =========================================================================
   Šachy – perf-detect.js (bezpečná verze)
   Autor: Better DeepSeek (AI) · Zadavatel: Jan Hošek · 2026
   SPDX-License-Identifier: GPL-3.0-or-later

   DŮLEŽITÉ: Na slabém stroji se benchmark AI VŮBEC nespouští — jen
   zkontrolujeme hardware. Na C2D (2010) benchmark blokuje hlavní vlákno
   prohlížeče a uživatel nemůže nic dělat.
   ========================================================================= */

(function () {
  'use strict';

  var PERF_KEY = 'sachy-perf-profile';
  var DIFF_KEY = 'sachy-user-difficulty';
  var profile = null;
  var lastMs = null;

  function loadProfile() {
    try {
      var raw = localStorage.getItem(PERF_KEY);
      if (!raw) return;
      var data = JSON.parse(raw);
      if (data && data.profile) { profile = data.profile; lastMs = data.ms; }
    } catch (e) {}
  }
  function saveProfile(p, ms) {
    try { localStorage.setItem(PERF_KEY, JSON.stringify({ profile: p, ms: ms, at: Date.now() })); } catch (e) {}
  }

  /* ---------------------------------------------------------------------
     Rychlá kontrola hardwaru PŘED jakýmkoli benchmarkem
     --------------------------------------------------------------------- */
  function quickHardwareCheck() {
    var cores = navigator.hardwareConcurrency || 0;
    var mem = navigator.deviceMemory || 0;

    // Bez informací o jádrech → opatrně
    if (cores === 0) return 'unknown';

    // 1–2 jádra = velmi slabý stroj, benchmark nespouštíme
    if (cores <= 2) return 'very-slow';

    // 4 GB RAM a méně → radši přeskočit benchmark
    if (mem > 0 && mem <= 4) return 'slow';

    return 'ok'; // může se měřit
  }

  /* ---------------------------------------------------------------------
     Benchmark — spouští se jen na 'ok' strojích
     --------------------------------------------------------------------- */
  function benchmark() {
    var savedBoard = board, savedState = state, savedTurn = turn, savedLastMove = lastMove;
    board = initialState();
    state = freshState();
    turn = 'w';
    lastMove = null;

    var t0 = performance.now();
    try {
      for (var d = 1; d <= 3; d++) {
        clearSearchTables();
        searchAborted = false;
        searchDeadline = performance.now() + 1500;
        searchRoot(board, state, 'w', d, true);
      }
    } catch (e) {}
    var elapsed = performance.now() - t0;

    board = savedBoard;
    state = savedState;
    turn = savedTurn;
    lastMove = savedLastMove;
    return elapsed;
  }

  function classify(ms) {
    if (ms < 150) return 'fast';
    if (ms < 600) return 'normal';
    if (ms < 1800) return 'slow';
    return 'very-slow';
  }
  function profileLabel(p) {
    return { 'fast': 'rychlý', 'normal': 'běžný', 'slow': 'pomalejší', 'very-slow': 'velmi pomalý' }[p] || p;
  }

  function applyProfile(p) {
    var diffSelect = document.getElementById('difficultySelect');
    if (!diffSelect) return;

    var userChoice = null;
    try { userChoice = localStorage.getItem(DIFF_KEY); } catch (e) {}

    if (!userChoice) {
      if (p === 'fast') diffSelect.value = 'hard';
      else if (p === 'normal') diffSelect.value = 'medium';
      else if (p === 'slow') diffSelect.value = 'easy';
      else if (p === 'very-slow') diffSelect.value = 'easy';
    }

    // Velmi pomalý stroj → automaticky zapni lite režim a vypni AI
    if (p === 'very-slow' || p === 'slow') {
      try {
        if (window.sachySetLiteMode) window.sachySetLiteMode(true);
      } catch (e) {}
    }

    var info = document.getElementById('perfInfo');
    if (info) {
      info.textContent = 'Výkon: ' + profileLabel(p) +
        (lastMs != null ? ' (' + Math.round(lastMs) + ' ms)' : '');
    }
  }

  function runBenchmark() {
    var el = document.getElementById('status');
    var prev = el ? el.textContent : null;
    if (el) el.textContent = 'Měřím výkon…';
    setTimeout(function () {
      var ms = benchmark();
      var p = classify(ms);
      profile = p; lastMs = ms;
      saveProfile(p, ms);
      applyProfile(p);
      if (el && el.textContent === 'Měřím výkon…') el.textContent = prev || 'Připraven.';
      try { console.log('[perf] Profil:', p, '(' + Math.round(ms) + ' ms)'); } catch (e) {}
    }, 80);
  }

  function injectButton() {
    var boxes = document.querySelectorAll('.panel .box');
    var target = null;
    for (var i = 0; i < boxes.length; i++) {
      var t = boxes[i].querySelector('.box-title');
      if (t && t.textContent.indexOf('Nastavení hry') >= 0) { target = boxes[i]; break; }
    }
    if (!target) return;
    if (target.querySelector('#perfTestBtn')) return;

    var section = document.createElement('div');
    section.style.marginTop = '10px';
    section.style.paddingTop = '10px';
    section.style.borderTop = '1px solid var(--line)';
    section.style.fontSize = '12.5px';
    section.style.color = 'var(--muted)';

    var info = document.createElement('div');
    info.id = 'perfInfo';
    info.style.marginBottom = '6px';
    info.textContent = profile
      ? ('Výkon: ' + profileLabel(profile) + (lastMs != null ? ' (' + Math.round(lastMs) + ' ms)' : ''))
      : 'Výkon: nezměřeno';

    var btn = document.createElement('button');
    btn.id = 'perfTestBtn';
    btn.className = 'btn btn-outline';
    btn.style.padding = '5px 10px';
    btn.style.fontSize = '12px';
    btn.textContent = 'Změřit výkon';
    btn.addEventListener('click', runBenchmark);

    section.appendChild(info);
    section.appendChild(btn);
    target.appendChild(section);
  }

  function hookDifficultySave() {
    var sel = document.getElementById('difficultySelect');
    if (!sel) return;
    sel.addEventListener('change', function () {
      try { localStorage.setItem(DIFF_KEY, sel.value); } catch (e) {}
    });
  }

  function init() {
    loadProfile();
    injectButton();
    hookDifficultySave();

    if (profile) { applyProfile(profile); return; }

    // Zjistíme hardware JEŠTĚ PŘED benchmarkem
    var hw = quickHardwareCheck();
    if (hw === 'very-slow' || hw === 'slow') {
      // Nespouštíme benchmark — rovnou označíme jako pomalý
      profile = hw;
      saveProfile(hw, null);
      applyProfile(hw);
      try { console.log('[perf] Hardware check: ' + hw + ' (benchmark přeskočen)'); } catch (e) {}
      return;
    }

    // Slabý/neznámý hardware → také nespouštět automaticky
    if (hw === 'unknown') {
      // Necháme uživatele, ať si klikne "Změřit výkon" sám
      try { console.log('[perf] Hardware neznámý, benchmark se nespouští.'); } catch (e) {}
      return;
    }

    // 'ok' — teprve teď bezpečně spustíme benchmark
    setTimeout(runBenchmark, 1200);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 250); });
  } else {
    setTimeout(init, 250);
  }
})();
