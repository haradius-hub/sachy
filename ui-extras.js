/* =========================================================================
   Šachy – ui-extras.js
   1) Barevné šipky pro nápovědu (zelená), vykreslené přes SVG nad šachovnicí.
   2) Tooltip s hodnocením tahu při najetí myší na cílové pole.
   Načítá se po game.js. Hákuje se do globální funkce render().
   Autor: Better DeepSeek (AI) · Zadavatel: Jan Hošek · 2026
   SPDX-License-Identifier: GPL-3.0-or-later
   ========================================================================= */

(function () {
  'use strict';

  var SVG_NS = 'http://www.w3.org/2000/svg';

  /* ===== 1) Šipky ===== */
  function ensureArrowLayer() {
    var b = document.getElementById('board');
    if (!b) return null;
    var existing = document.getElementById('arrowLayer');
    if (existing) return existing;

    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('id', 'arrowLayer');
    svg.setAttribute('viewBox', '0 0 800 800');
    svg.setAttribute('preserveAspectRatio', 'none');

    var defs = document.createElementNS(SVG_NS, 'defs');
    var mk = document.createElementNS(SVG_NS, 'marker');
    mk.setAttribute('id', 'arrowHead');
    mk.setAttribute('viewBox', '0 0 10 10');
    mk.setAttribute('refX', '9');
    mk.setAttribute('refY', '5');
    mk.setAttribute('markerWidth', '5');
    mk.setAttribute('markerHeight', '5');
    mk.setAttribute('orient', 'auto');
    var mp = document.createElementNS(SVG_NS, 'path');
    mp.setAttribute('d', 'M0,0 L10,5 L0,10 z');
    mp.setAttribute('fill', '#4caf50');
    mk.appendChild(mp);
    defs.appendChild(mk);
    svg.appendChild(defs);

    if (getComputedStyle(b).position === 'static') b.style.position = 'relative';
    b.appendChild(svg);
    return svg;
  }

  function drawArrow(svg, from, to) {
    var fr = from.r, fc = from.c, tr = to.r, tc = to.c;
    if (typeof flipped !== 'undefined' && flipped) {
      fr = 7 - fr; fc = 7 - fc; tr = 7 - tr; tc = 7 - tc;
    }
    var x1 = (fc + 0.5) / 8 * 800;
    var y1 = (fr + 0.5) / 8 * 800;
    var x2 = (tc + 0.5) / 8 * 800;
    var y2 = (tr + 0.5) / 8 * 800;
    var line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('x1', x1);
    line.setAttribute('y1', y1);
    line.setAttribute('x2', x2);
    line.setAttribute('y2', y2);
    line.setAttribute('stroke', '#4caf50');
    line.setAttribute('stroke-width', '10');
    line.setAttribute('stroke-linecap', 'round');
    line.setAttribute('marker-end', 'url(#arrowHead)');
    line.setAttribute('opacity', '0.85');
    svg.appendChild(line);
  }

  function renderArrows() {
    var svg = document.getElementById('arrowLayer');
    if (!svg) return;
    var old = svg.querySelectorAll('line');
    for (var i = 0; i < old.length; i++) old[i].remove();
    if (typeof hintMove === 'undefined' || !hintMove) return;
    drawArrow(svg, hintMove.from, hintMove.to);
  }

  /* Hák do globální funkce render() */
  if (typeof render === 'function') {
    var _origRender = render;
    window.render = function () {
      _origRender.apply(this, arguments);
      ensureArrowLayer();
      renderArrows();
    };
  }

  /* ===== 2) Tooltip ===== */
  var tooltipEl = null, tooltipTimer = null;

  function getTooltip() {
    if (tooltipEl) return tooltipEl;
    tooltipEl = document.createElement('div');
    tooltipEl.id = 'moveTooltip';
    tooltipEl.className = 'move-tooltip';
    tooltipEl.hidden = true;
    document.body.appendChild(tooltipEl);
    return tooltipEl;
  }
  function showTip(el, text) {
    var t = getTooltip();
    t.textContent = text;
    var r = el.getBoundingClientRect();
    t.style.left = (r.right + 10) + 'px';
    t.style.top = (r.top + r.height / 2) + 'px';
    t.hidden = false;
  }
  function hideTip() {
    if (tooltipEl) tooltipEl.hidden = true;
    if (tooltipTimer) { clearTimeout(tooltipTimer); tooltipTimer = null; }
  }
  function computeMoveEval(move) {
    try {
      var b2 = cloneBoard(board), s2 = cloneState(state);
      applyMove(b2, move, s2);
      clearSearchTables();
      searchAborted = false;
      searchDeadline = performance.now() + 150;
      var res = searchRoot(b2, s2, other(turn), 3, true);
      return res.score;
    } catch (e) { return null; }
  }
  function attachHover() {
    var b = document.getElementById('board');
    if (!b) return;
    b.addEventListener('mouseover', function (e) {
      var sq = e.target && e.target.closest ? e.target.closest('.square') : null;
      if (!sq) return;
      if (typeof gameOver !== 'undefined' && (gameOver || thinking)) return;
      if (typeof legalTargets === 'undefined' || !selected) return;
      var r = +sq.dataset.r, c = +sq.dataset.c;
      var move = null;
      for (var i = 0; i < legalTargets.length; i++) {
        if (legalTargets[i].to.r === r && legalTargets[i].to.c === c) { move = legalTargets[i]; break; }
      }
      if (!move) return;
      var thisSq = sq;
      if (tooltipTimer) clearTimeout(tooltipTimer);
      tooltipTimer = setTimeout(function () {
        var ev = computeMoveEval(move);
        if (ev === null || !thisSq.isConnected) return;
        var txt;
        if (Math.abs(ev) > MATE_SCORE - 10000) txt = (ev > 0 ? 'Mat pro tebe!' : 'Soupeř matí');
        else txt = 'Hodnocení: ' + (ev >= 0 ? '+' : '') + (ev / 100).toFixed(2);
        showTip(thisSq, txt);
      }, 220);
    });
    b.addEventListener('mouseout', hideTip);
  }

  function init() {
    ensureArrowLayer();
    renderArrows();
    attachHover();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 80); });
  } else {
    setTimeout(init, 80);
  }
})();
