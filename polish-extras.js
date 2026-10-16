/* =========================================================================
Šachy – polish-extras.js
Drobnosti: klávesové zkratky M/Esc, long-press drag & drop na mobilu,
jiné zvuky pro soupeřův tah.

OPRAVA: Odstraněna sekce "Notace s 'x' u braní" – byla mrtvá, protože
engine.js.moveToSAN() už generuje 'x' přímo.

Autor: Better DeepSeek (AI) · Zadavatel: Jan Hošek · 2026
SPDX-License-Identifier: GPL-3.0-or-later
========================================================================= */

(function () {
'use strict';

if (typeof window.playSound === 'function') {
var _origPlaySound = window.playSound;
window.playSound = function (kind) {
if (window.isRemoteMove) playRemoteSound(kind);
else _origPlaySound.call(this, kind);
};
}

function playRemoteSound(kind) {
if (typeof soundsEnabled === 'undefined' || !soundsEnabled) return;
if (typeof getAudioCtx !== 'function') return;
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
gain.gain.setValueAtTime(vol || 0.06, t);
gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
osc.start(t);
osc.stop(t + dur + 0.02);
}
if (kind === 'move') beep(340, 0.06, 'sine', 0.04);
else if (kind === 'capture') beep(200, 0.10, 'triangle', 0.08);
else if (kind === 'castle') { beep(340, 0.07, 'sine', 0.05, 0); beep(480, 0.07, 'sine', 0.05, 0.06); }
else if (kind === 'check') beep(700, 0.08, 'sine', 0.07);
else if (kind === 'mate') { beep(500, 0.10, 'sine', 0.07, 0); beep(700, 0.15, 'sine', 0.07, 0.10); }
} catch (err) {}
}

document.addEventListener('keydown', function (e) {
var tag = e.target.tagName;
if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
if (e.ctrlKey || e.metaKey || e.altKey) return;

if (e.key === 'm' || e.key === 'M') {
var btn = document.getElementById('mpBtn');
if (btn) { btn.click(); e.preventDefault(); }
} else if (e.key === 'Escape') {
var modals = document.querySelectorAll('.modal-backdrop:not([hidden])');
for (var i = 0; i < modals.length; i++) modals[i].hidden = true;
}
});

var LONG_PRESS_MS = 250;

window.setupDrag = function (sq, r, c) {
sq.addEventListener('pointerdown', function (e) {
if (typeof selfPlay !== 'undefined' && selfPlay) return;
if (e.button !== 0 && e.pointerType === 'mouse') return;
if (gameOver || thinking) return;
if (aiEnabled && turn === aiColor()) return;
if (historyIndex !== moveHistory.length - 1) return;
var p = board[r][c];
if (!p || p.color !== turn) return;

var isTouch = (e.pointerType !== 'mouse');
window.pointerDrag = {
from: { r: r, c: c },
startX: e.clientX, startY: e.clientY,
moved: false, ghost: null, srcSquare: sq,
isTouch: isTouch,
ready: !isTouch,
longPressTimer: null
};

if (isTouch) {
window.pointerDrag.longPressTimer = setTimeout(function () {
if (window.pointerDrag) window.pointerDrag.ready = true;
}, LONG_PRESS_MS);
}

document.addEventListener('pointermove', window.onGlobalPointerMovePolished);
document.addEventListener('pointerup', window.onGlobalPointerUpPolished, { once: true });
});
};

window.onGlobalPointerMovePolished = function (e) {
var pd = window.pointerDrag;
if (!pd) return;
if (pd.isTouch && !pd.ready) return;

var dx = e.clientX - pd.startX;
var dy = e.clientY - pd.startY;
if (!pd.moved && Math.sqrt(dx * dx + dy * dy) > 8) {
pd.moved = true;
selected = { r: pd.from.r, c: pd.from.c };
var all = getAllLegalMoves(board, turn, state);
legalTargets = [];
for (var i = 0; i < all.length; i++) {
if (all[i].from.r === pd.from.r && all[i].from.c === pd.from.c) legalTargets.push(all[i]);
}
render();
var bEl = document.getElementById('board');
var pieceEl = bEl ? bEl.querySelector('.square[data-r="' + pd.from.r + '"][data-c="' + pd.from.c + '"] .piece') : null;
if (pieceEl) {
var rect = pieceEl.getBoundingClientRect();
var ghost = pieceEl.cloneNode(true);
ghost.classList.add('drag-ghost');
ghost.style.left = (e.clientX - rect.width / 2) + 'px';
ghost.style.top = (e.clientY - rect.height / 2) + 'px';
document.body.appendChild(ghost);
pd.ghost = ghost;
pd.srcSquare.style.opacity = '0.35';
}
}
if (pd.moved && pd.ghost) {
var sz = pd.ghost.getBoundingClientRect();
pd.ghost.style.left = (e.clientX - sz.width / 2) + 'px';
pd.ghost.style.top = (e.clientY - sz.height / 2) + 'px';
}
};

window.onGlobalPointerUpPolished = function (e) {
document.removeEventListener('pointermove', window.onGlobalPointerMovePolished);
var pd = window.pointerDrag;
if (!pd) return;
if (pd.longPressTimer) clearTimeout(pd.longPressTimer);

var wasMoved = pd.moved;
var from = pd.from;

if (pd.ghost) pd.ghost.remove();
if (pd.srcSquare) pd.srcSquare.style.opacity = '';
window.pointerDrag = null;

if (wasMoved) {
var el = document.elementFromPoint(e.clientX, e.clientY);
var targetSq = el && el.closest ? el.closest('.square') : null;
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
onSquareClick(from.r, from.c);
}
};
})();