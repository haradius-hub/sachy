/* =========================================================================
Šachy – garde.js  (FIXED: zjednodušený isDefended)
Hlášení "Garde!" – upozornění, když po tvém tahu zůstane soupeřova
dáma (nebo věž) napadená a nekrytá. Etiketa, ne pravidlo šachu.
Autor: Better DeepSeek (AI) · Zadavatel: Jan Hošek · 2026
SPDX-License-Identifier: GPL-3.0-or-later
========================================================================= */

(function () {
'use strict';

var STORAGE_KEY = 'sachy-garde-enabled';
var gardeEnabled = true;

var reportRook = false;
var ROOK_KEY = 'sachy-garde-rook';

var lastAnnouncedKey = null;

function loadPrefs() {
try {
var v = localStorage.getItem(STORAGE_KEY);
if (v === '0') gardeEnabled = false;
if (v === '1') gardeEnabled = true;
var r = localStorage.getItem(ROOK_KEY);
if (r === '1') reportRook = true;
} catch (e) {}
}
function savePrefs() {
try {
localStorage.setItem(STORAGE_KEY, gardeEnabled ? '1' : '0');
localStorage.setItem(ROOK_KEY, reportRook ? '1' : '0');
} catch (e) {}
}

function pieceName(type) {
return { q: 'dáma', r: 'věž', b: 'střelec', n: 'jezdec', p: 'pěšec' }[type] || 'figura';
}

function isDefended(b, r, c, color) {
try { return isAttacked(b, r, c, color); } catch (e) { return false; }
}
function isThreatened(b, r, c, byColor) {
try { return isAttacked(b, r, c, byColor); } catch (e) { return false; }
}

function findThreatenedHighValue(b, color) {
var found = [];
for (var r = 0; r < 8; r++) {
for (var c = 0; c < 8; c++) {
var p = b[r][c];
if (!p || p.color !== color) continue;
if (p.type !== 'q' && p.type !== 'r') continue;
if (!reportRook && p.type === 'r') continue;
var enemy = (color === 'w') ? 'b' : 'w';
if (!isThreatened(b, r, c, enemy)) continue;
if (isDefended(b, r, c, color)) continue;
found.push({ r: r, c: c, type: p.type, color: color });
}
}
return found;
}

function checkAndAnnounce() {
if (!gardeEnabled) return;
if (typeof board === 'undefined' || typeof turn === 'undefined' || typeof state === 'undefined') return;

var isHumanVsHuman = true;
try {
if (typeof aiEnabled !== 'undefined' && aiEnabled) isHumanVsHuman = false;
if (typeof selfPlay !== 'undefined' && selfPlay) isHumanVsHuman = false;
} catch (e) {}

var threatened = findThreatenedHighValue(board, turn);
if (threatened.length === 0) {
lastAnnouncedKey = null;
return;
}

var key = threatened.map(function (t) { return t.r + '' + t.c + t.type; }).join('|') +
':' + (typeof uciHistory !== 'undefined' ? uciHistory.length : 0);
if (key === lastAnnouncedKey) return;
lastAnnouncedKey = key;

if (!isHumanVsHuman) return;

var t = threatened[0];
var text = 'GARDE – ' + pieceName(t.type) + '!';
showGardeNotice(text);
playGardeSound();
}

function showGardeNotice(text) {
var frame = document.getElementById('boardFrame');
if (!frame) return;
if (getComputedStyle(frame).position === 'static') frame.style.position = 'relative';

var el = document.getElementById('gardeNotice');
if (!el) {
el = document.createElement('div');
el.id = 'gardeNotice';
el.className = 'board-notice';
frame.appendChild(el);
}
el.textContent = text;
el.className = 'board-notice board-notice-garde';
el.hidden = false;
el.style.animation = 'none';
void el.offsetWidth;
el.style.animation = '';
clearTimeout(showGardeNotice._t);
showGardeNotice._t = setTimeout(function () { el.hidden = true; }, 2200);
}

function playGardeSound() {
try {
if (typeof soundsEnabled !== 'undefined' && !soundsEnabled) return;
if (typeof getAudioCtx !== 'function') return;
var ctx = getAudioCtx();
if (!ctx) return;
var now = ctx.currentTime;
var osc = ctx.createOscillator();
var gain = ctx.createGain();
osc.type = 'triangle';
osc.frequency.value = 660;
osc.connect(gain);
gain.connect(ctx.destination);
gain.gain.setValueAtTime(0.06, now);
gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
osc.start(now);
osc.stop(now + 0.20);
var osc2 = ctx.createOscillator();
var gain2 = ctx.createGain();
osc2.type = 'triangle';
osc2.frequency.value = 880;
osc2.connect(gain2);
gain2.connect(ctx.destination);
gain2.gain.setValueAtTime(0.0001, now + 0.12);
gain2.gain.exponentialRampToValueAtTime(0.05, now + 0.14);
gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
osc2.start(now + 0.12);
osc2.stop(now + 0.34);
} catch (e) {}
}

if (typeof window.makeMove === 'function') {
var _origMakeMove = window.makeMove;
window.makeMove = function (move) {
_origMakeMove.apply(this, arguments);
setTimeout(checkAndAnnounce, 60);
};
}
setInterval(function () { checkAndAnnounce(); }, 1200);

function injectUI() {
var boxes = document.querySelectorAll('.panel .box');
var target = null;
for (var i = 0; i < boxes.length; i++) {
var t = boxes[i].querySelector('.box-title');
if (t && t.textContent.indexOf('Vzhled') >= 0) { target = boxes[i]; break; }
}
if (!target) return;
if (target.querySelector('#gardeToggle')) return;

var lbl = document.createElement('label');
lbl.className = 'toggle';
lbl.innerHTML = '<input type="checkbox" id="gardeToggle"><span>Hlásit „garde"</span>';
target.appendChild(lbl);

var lbl2 = document.createElement('label');
lbl2.className = 'toggle';
lbl2.innerHTML = '<input type="checkbox" id="gardeRookToggle"><span>Hlásit i věž</span>';
lbl2.style.fontSize = '12.5px';
lbl2.style.color = 'var(--muted)';
target.appendChild(lbl2);

var info = document.createElement('div');
info.style.fontSize = '11.5px';
info.style.color = 'var(--muted)';
info.style.marginTop = '2px';
info.style.lineHeight = '1.4';
info.textContent = 'Upozornění na ohroženou dámu (etiketa). Hlásí se jen při hře člověka proti člověku, ne proti AI.';
target.appendChild(info);

var cb = lbl.querySelector('#gardeToggle');
var cbR = lbl2.querySelector('#gardeRookToggle');
cb.checked = gardeEnabled;
cbR.checked = reportRook;

cb.addEventListener('change', function (e) {
gardeEnabled = e.target.checked;
if (!gardeEnabled) lastAnnouncedKey = null;
savePrefs();
});
cbR.addEventListener('change', function (e) {
reportRook = e.target.checked;
lastAnnouncedKey = null;
savePrefs();
});
}

function init() {
loadPrefs();
injectUI();
}
if (document.readyState === 'loading') {
document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 300); });
} else {
setTimeout(init, 300);
}
})();