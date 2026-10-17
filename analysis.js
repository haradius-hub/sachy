/* =========================================================================
Šachy – analysis.js (v2, Fáze B 6. část)
Analýza partie, report s grafem hodnocení, přesnost obou stran.

NOVÉ:

- Kategorie: book, best, good, inaccuracy, mistake, miss, blunder.
- Accuracy podle Lichess vzorce (winPercent + exp decay).

Autor: Better DeepSeek (AI) · Zadavatel: Jan Hošek · 2026
SPDX-License-Identifier: GPL-3.0-or-later
========================================================================= */

/* Lichess win% z centipawnů (white perspective). */
function winPercent(cp) {
return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}

/* Accuracy z win% delta (Lichess). */
function accuracyFromWinLoss(wpBefore, wpAfter) {
var delta = wpBefore - wpAfter;
if (delta < 0) delta = 0;
var acc = 103.1668 * Math.exp(-0.04354 * delta) - 3.1669;
return Math.max(0, Math.min(100, acc));
}

/* Book check – je prefix (history) začátek nějaké linie v OPENING_BOOK? */
function isBookLine(uciPrefix) {
if (typeof OPENING_BOOK === 'undefined') return false;
if (!uciPrefix || uciPrefix.length === 0) return false;
for (var i = 0; i < OPENING_BOOK.length; i++) {
var line = OPENING_BOOK[i];
if (line.length < uciPrefix.length) continue;
var match = true;
for (var j = 0; j < uciPrefix.length; j++) {
if (line[j] !== uciPrefix[j]) { match = false; break; }
}
if (match) return true;
}
return false;
}

/* Klasifikace tahu podle ztráty v cp + kontextu (book, miss). */
function classifyMove(loss, prevCp, newCp, mover, isBook) {
if (isBook) return { cat: 'book', annot: 0 };

var moverPrev = mover === 'w' ? prevCp : -prevCp;
var moverNew = mover === 'w' ? newCp : -newCp;

/* Miss: hrál jsi vyhranou pozici (>+2 pro tebe), teď už ne (<+1). */
if (moverPrev > 200 && moverNew < 100 && loss >= 300) {
return { cat: 'miss', annot: 2 };
}

if (loss < 20) return { cat: 'best', annot: 0 };
if (loss < 60) return { cat: 'good', annot: 0 };
if (loss < 150) return { cat: 'inaccuracy', annot: 1 };
if (loss < 300) return { cat: 'mistake', annot: 2 };
return { cat: 'blunder', annot: 3 };
}

/* Zpětná kompatibilita pro analysis-export.js. */
function classifyLoss(loss) {
if (loss < 20) return 'best';
if (loss < 60) return 'good';
if (loss < 150) return 'inaccuracy';
if (loss < 300) return 'mistake';
return 'blunder';
}
var LOSS_TO_ANNOT = { book: 0, best: 0, good: 0, inaccuracy: 1, mistake: 2, miss: 2, blunder: 3 };

/* ---------- Zahájení a fáze ---------- */

function detectOpening() {
var best = null;
for (var i = 0; i < OPENING_BOOK.length; i++) {
var line = OPENING_BOOK[i];
var matches = 0;
for (var j = 0; j < line.length && j < uciHistory.length; j++) {
if (line[j] === uciHistory[j]) matches++; else break;
}
if (matches > 0 && (!best || matches > best.matches)) {
best = { matches: matches, name: OPENING_NAMES[i] || ('Zahájení ' + (i + 1)) };
}
}
return best || { name: 'Neznámé zahájení', matches: 0 };
}

function classifyPhase(pos) {
var bd = pos.board;
var ply = pos.uciHistory.length;
var queens = 0, total = 0, minors = 0;
for (var r = 0; r < 8; r++) {
for (var c = 0; c < 8; c++) {
var p = bd[r][c];
if (!p || p.type === 'k') continue;
total++;
if (p.type === 'q') queens++;
if (p.type === 'n' || p.type === 'b') minors++;
}
}
if (queens === 0 && total <= 10) return 'endgame';
if (queens === 0 && minors <= 4 && total <= 12) return 'endgame';
if (ply <= 20) return 'opening';
return 'middlegame';
}

/* ---------- Analýza ---------- */

function analyzeGame() {
if (moveHistory.length < 2) { showToast('Žádné tahy k analýze.'); return; }
if (selfPlay) stopSelfPlay();
thinking = true;
if (statusEl) statusEl.textContent = 'Analyzuji partii… 0 %';
var positions = moveHistory.slice();
var evals = new Array(positions.length);
var idx = 0;
function step() {
var t0 = performance.now();
while (idx < positions.length && performance.now() - t0 < 60) {
var snap = positions[idx];
clearSearchTables();
searchAborted = false;
searchDeadline = performance.now() + 120;
var result = searchRoot(snap.board, snap.state, snap.turn, 3, true);
var whiteScore = snap.turn === 'w' ? result.score : -result.score;
if (Math.abs(whiteScore) > MATE_SCORE - 10000) whiteScore = whiteScore > 0 ? 100000 : -100000;
evals[idx] = whiteScore;
idx++;
}
var pct = Math.round(idx / positions.length * 100);
if (statusEl) statusEl.textContent = 'Analyzuji partii… ' + pct + ' %';
if (idx < positions.length) setTimeout(step, 0);
else finishAnalysis(positions, evals);
}
setTimeout(step, 0);
}

function finishAnalysis(positions, evals) {
var losses = [];
var lossCategories = [];
var annotations = [];

for (var i = 0; i < evals.length - 1; i++) {
var wb = evals[i], wa = evals[i + 1];
var mover = (i % 2 === 0) ? 'w' : 'b';
var loss = mover === 'w' ? Math.max(0, wb - wa) : Math.max(0, wa - wb);
losses.push(loss);

var prefix = (positions[i + 1].uciHistory || []).slice(0, i + 1);
var isBook = isBookLine(prefix);

var cls = classifyMove(loss, wb, wa, mover, isBook);
lossCategories.push(cls.cat);
annotations.push(cls.annot);
}

gameAnnotations = annotations;

function summarize(color) {
var total = 0, sumAcc = 0;
var counts = { book: 0, best: 0, good: 0, inaccuracy: 0, mistake: 0, miss: 0, blunder: 0 };
for (var m = 0; m < lossCategories.length; m++) {
var mc = (m % 2 === 0) ? 'w' : 'b';
if (mc !== color) continue;
total++;
counts[lossCategories[m]] = (counts[lossCategories[m]] || 0) + 1;

var prevCp = evals[m] || 0;
var newCp = evals[m + 1] || 0;
var moverPrev = color === 'w' ? prevCp : -prevCp;
var moverNew = color === 'w' ? newCp : -newCp;
sumAcc += accuracyFromWinLoss(winPercent(moverPrev), winPercent(moverNew));
}
return { total: total, accuracy: total > 0 ? sumAcc / total : 100, counts: counts };
}

var wSum = summarize('w'), bSum = summarize('b');
var opening = detectOpening();
var phaseCounts = { opening: 0, middlegame: 0, endgame: 0 };
for (var pi = 1; pi < positions.length; pi++) phaseCounts[classifyPhase(positions[pi])]++;

var resultText;
if (gameOver) {
var moves = getAllLegalMoves(board, turn, state);
if (moves.length === 0) {
resultText = inCheck(board, turn, state) ? (turn === 'w' ? 'Mat – vyhrál Černý' : 'Mat – vyhrál Bílý') : 'Pat – remíza';
} else if (halfmoveClock >= 100) resultText = 'Remíza (50 tahů)';
else if (isInsufficientMaterial()) resultText = 'Remíza (materiál)';
else if (isThreefoldRepetition()) resultText = 'Remíza (trojí opakování)';
else resultText = 'Remíza';
} else resultText = 'Nedohráno';

thinking = false;
updateStatus();
renderMoveList();
showReport({
losses: losses,
lossCategories: lossCategories,
evals: evals,
w: wSum, b: bSum,
opening: opening,
phases: phaseCounts,
result: resultText
});
}

/* ---------- Report rendering ---------- */

function escHtml(s) {
var str = String(s);
var out = '';
for (var i = 0; i < str.length; i++) {
var c = str.charCodeAt(i);
if (c === 38) out += '&';
else if (c === 60) out += '<';
else if (c === 62) out += '>';
else if (c === 34) out += '"';
else if (c === 39) out += ''';
else out += str.charAt(i);
}
return out;
}

function chipEl(label, value) {
var el = document.createElement('span');
el.className = 'report-chip';
el.innerHTML = '<span>' + escHtml(label) + ':</span> <b>' + escHtml(value) + '</b>';
return el;
}

function renderPlayerCard(title, sum, color) {
var div = document.createElement('div');
div.className = 'report-player';
var titleEl = document.createElement('div');
titleEl.className = 'report-player-title';
titleEl.textContent = (color === 'w' ? '♔ ' : '♚ ') + title;
div.appendChild(titleEl);

var accEl = document.createElement('div');
var acc = sum.accuracy;
accEl.className = 'report-accuracy ' + (acc >= 85 ? 'high' : (acc >= 70 ? 'mid' : 'low'));
accEl.textContent = acc.toFixed(1) + '%';
div.appendChild(accEl);

var lbl = document.createElement('div');
lbl.style.fontSize = '12px';
lbl.style.color = 'var(--muted)';
lbl.style.marginBottom = '10px';
lbl.textContent = 'přesnost (' + sum.total + ' tahů)';
div.appendChild(lbl);

var stats = [];
if (sum.counts.book > 0) stats.push({ l: 'Kniha (book)', v: sum.counts.book });
stats.push({ l: 'Nejlepší / dobré', v: (sum.counts.best || 0) + (sum.counts.good || 0) });
stats.push({ l: 'Nepřesnosti (?!),', v: sum.counts.inaccuracy || 0 });
stats.push({ l: 'Chyby (?)', v: sum.counts.mistake || 0 });
if (sum.counts.miss > 0) stats.push({ l: 'Přehlédnutí (miss)', v: sum.counts.miss });
stats.push({ l: 'Hrubky (??)', v: sum.counts.blunder || 0 });

for (var i = 0; i < stats.length; i++) {
var row = document.createElement('div');
row.className = 'report-stat-row';
row.innerHTML = '<span class="label">' + escHtml(stats[i].l) + '</span><span class="value">' + stats[i].v + '</span>';
div.appendChild(row);
}
return div;
}

function buildEvalGraphSVG(evals) {
if (evals.length < 2) return '<p style="color:var(--muted);font-size:12px">Málo dat.</p>';
var W = 720, H = 200, pad = 20;
var innerW = W - 2 * pad, innerH = H - 2 * pad;
var maxCp = 500, n = evals.length - 1;
var points = [];
for (var i = 0; i < evals.length; i++) {
var v = evals[i];
if (v > maxCp) v = maxCp;
if (v < -maxCp) v = -maxCp;
var x = pad + (i / n) * innerW;
var y = pad + (1 - (v + maxCp) / (2 * maxCp)) * innerH;
points.push(x.toFixed(1) + ',' + y.toFixed(1));
}
var baseline = pad + innerH / 2;
var fp = points.slice();
fp.unshift(pad + ',' + baseline);
fp.push((pad + innerW).toFixed(1) + ',' + baseline);
var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">';
svg += '<line x1="' + pad + '" y1="' + baseline + '" x2="' + (pad + innerW) + '" y2="' + baseline + '" stroke="var(--graph-grid)" stroke-dasharray="3,3"/>';
svg += '<polygon points="' + fp.join(' ') + '" fill="rgba(77, 107, 254, 0.15)"/>';
svg += '<polyline points="' + points.join(' ') + '" fill="none" stroke="var(--accent)" stroke-width="2"/>';
svg += '<text x="4" y="' + (pad + 4) + '" font-size="10" fill="var(--muted)">+5</text>';
svg += '<text x="4" y="' + baseline + '" font-size="10" fill="var(--muted)">0</text>';
svg += '<text x="4" y="' + (pad + innerH) + '" font-size="10" fill="var(--muted)">-5</text>';
svg += '</svg>';
return svg;
}

function showReport(data) {
var content = document.getElementById('reportContent');
var modal = document.getElementById('reportModal');
if (!content || !modal) {
showToast('Přesnost B ' + data.w.accuracy.toFixed(1) + '% · Č ' + data.b.accuracy.toFixed(1) + '%', 4000);
return;
}
content.innerHTML = '';
var meta = document.createElement('div');
meta.className = 'report-meta';
meta.appendChild(chipEl('Zahájení', data.opening.name + (data.opening.matches ? ' (' + data.opening.matches + ' půltahů)' : '')));
meta.appendChild(chipEl('Výsledek', data.result));
meta.appendChild(chipEl('Půltahů', String(data.losses.length)));
meta.appendChild(chipEl('Fáze', 'Z ' + data.phases.opening + ' · S ' + data.phases.middlegame + ' · K ' + data.phases.endgame));
content.appendChild(meta);
var pl = document.createElement('div');
pl.className = 'report-players';
pl.appendChild(renderPlayerCard('Bílý', data.w, 'w'));
pl.appendChild(renderPlayerCard('Černý', data.b, 'b'));
content.appendChild(pl);
var sec = document.createElement('div');
sec.className = 'report-section';
var t = document.createElement('div');
t.className = 'report-section-title';
t.textContent = 'Průběh hodnocení';
sec.appendChild(t);
var gw = document.createElement('div');
gw.className = 'report-graph';
gw.innerHTML = buildEvalGraphSVG(data.evals);
sec.appendChild(gw);
content.appendChild(sec);
modal.hidden = false;
}