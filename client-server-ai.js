/* =========================================================================
Šachy – client-server-ai.js
Volitelné: server-side AI. Aktivuje se, když je v URL `?serverAI=1`.
Přepíše window.triggerAI tak, aby poslal pozici serveru přes WebSocket
a počkal na výsledek. Fallback na lokální AI (worker-ai.js), pokud
server neodpoví.

Autor: Better DeepSeek (AI) · Zadavatel: Jan Hošek · 2026
SPDX-License-Identifier: GPL-3.0-or-later
========================================================================= */

(function () {
'use strict';

/* Aktivní jen s ?serverAI=1 */
var params = new URLSearchParams(location.search);
if (params.get('serverAI') !== '1') return;

var pending = new Map();
var nextId = 1;

/* Naslouchej zprávám ze serveru. */
window.addEventListener('sachy-mp-msg', function (e) {
var msg = e.detail;
if (!msg) return;
if (msg.type === 'ai-result' || msg.type === 'ai-error') {
var p = pending.get(msg.id);
if (!p) return;
pending.delete(msg.id);
if (msg.type === 'ai-error') p.reject(new Error(msg.error || 'AI error'));
else p.resolve(msg.move);
}
});

/* Připoj WS, kdyby ještě nebyl. */
function ensureConnected() {
if (typeof window.mpConnect === 'function') {
try { window.mpConnect(); } catch (e) {}
}
}
ensureConnected();

function askServer(board, state, turn, difficulty) {
return new Promise(function (resolve, reject) {
if (typeof window.mpSend !== 'function') {
return reject(new Error('mpSend není dostupný.'));
}
ensureConnected();
var id = nextId++;
var timer = setTimeout(function () {
pending.delete(id);
reject(new Error('Server AI timeout (15 s)'));
}, 15000);
pending.set(id, {
resolve: function (v) { clearTimeout(timer); resolve(v); },
reject: function (e) { clearTimeout(timer); reject(e); }
});
window.mpSend({
type: 'ai-compute',
id: id,
board: board,
state: state,
turn: turn,
difficulty: difficulty || 'medium'
});
});
}

/* Převeď UCI na legální tah v aktuální pozici. */
function uciToLegalMove(uci, board, turn, state) {
if (!uci) return null;
var from = uciToRC(uci.slice(0, 2));
var to = uciToRC(uci.slice(2, 4));
var promo = uci.length > 4 ? uci[4].toLowerCase() : null;
var legal = getAllLegalMoves(board, turn, state);
for (var i = 0; i < legal.length; i++) {
var m = legal[i];
if (m.from.r === from.r && m.from.c === from.c &&
m.to.r === to.r && m.to.c === to.c) {
if (m.promotion && promo && m.promotion !== promo) continue;
return m;
}
}
return null;
}

/* Zachovej původní triggerAI jako fallback (worker-ai.js). */
var fallbackTriggerAI = typeof window.triggerAI === 'function' ? window.triggerAI : null;

window.triggerAI = function () {
if (typeof selfPlay !== 'undefined' && selfPlay) return;
if (!aiEnabled || gameOver) return;
var aiColor = (typeof aiColor === 'function') ? aiColor() : (playerColor === 'w' ? 'b' : 'w');
if (turn !== aiColor) return;

thinking = true;
if (statusEl) statusEl.textContent = 'Server počítá…';
if (typeof render === 'function') render();

askServer(board, state, turn, difficulty).then(function (uciMove) {
thinking = false;
if (!uciMove) { updateStatus(); render(); return; }
var move = uciToLegalMove(uciMove, board, turn, state);
if (move) makeMove(move);
else { updateStatus(); render(); }
}).catch(function (err) {
console.warn('[server-ai] Chyba:', err && err.message);
thinking = false;
/* Fallback na lokální AI (worker-ai.js). */
if (fallbackTriggerAI) fallbackTriggerAI();
else { updateStatus(); render(); }
});
};

console.log('[server-ai] Server-side AI aktivní (?serverAI=1).');
})();