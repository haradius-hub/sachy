/* =========================================================================
Šachy – client-net.js  (FIXED: shadowing state → mpState)
Multiplayer klient + historie partií + Web Push integrace.
Autor: Better DeepSeek (AI) · Zadavatel: Jan Hošek · 2026
SPDX-License-Identifier: GPL-3.0-or-later

POZN.: Detekce base path je bez regexu (lastIndexOf), aby přežila
i horší ZIP extrakci na Windows (regex se zpětnými lomítky se občas
rozbije, když ZIP nástroj stripuje \ znaky).
========================================================================= */

(function () {
'use strict';

var mpState = {
user: null, token: null, roomId: null, role: null,
isPublic: false, status: 'idle', inRoom: false
};
var socket = null;
var suppressMoveSend = false;

/* Bez regexu – přežije i horší extrakci. */
function computeBasePath() {
var p = location.pathname;
var idx = p.lastIndexOf('/');
if (idx > 0) return p.substring(0, idx);
return '';
}
var basePath = computeBasePath();

var WS_URL = (function () {
var proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
return proto + '//' + location.host + basePath + '/ws';
})();

var API_BASE = basePath;

function connect() {
if (socket && socket.readyState <= 1) return;
socket = new WebSocket(WS_URL);
socket.onopen = function () {
setStatusLine('Připojeno k serveru.');
if (mpState.token && mpState.roomId) {
socket.send(JSON.stringify({ type: 'reconnect', token: mpState.token, roomId: mpState.roomId }));
}
};
socket.onmessage = function (e) {
var msg;
try { msg = JSON.parse(e.data); } catch (err) { return; }
try { window.dispatchEvent(new CustomEvent('sachy-mp-msg', { detail: msg })); } catch (err) {}
onServerMessage(msg);
};
socket.onclose = function () {
setStatusLine('Odpojeno. Zkusím se znovu připojit…');
setTimeout(connect, 3000);
};
socket.onerror = function () { setStatusLine('Chyba připojení.'); };
}
function sendMsg(obj) {
if (socket && socket.readyState === 1) socket.send(JSON.stringify(obj));
}
window.mpSend = sendMsg;
window.mpConnect = connect;
window.mpState = mpState;

var modal = null, statusLine = null, lobbyArea = null, roomArea = null;
var chatBox = null, chatInput = null;
var historyArea = null, leaderboardArea = null;
var activeTab = 'play';

function ensureUI() {
if (modal) return;
modal = document.createElement('div');
modal.className = 'modal-backdrop';
modal.id = 'mpModal';
modal.hidden = true;
modal.innerHTML = '' +
'<div class="modal mp-modal">' +
'  <div class="report-head">' +
'    <h2>Multiplayer</h2>' +
'    <button id="mpClose" class="report-close">✕</button>' +
'  </div>' +
'  <div class="mp-tabs" id="mpTabs">' +
'    <button class="mp-tab active" data-tab="play">Hrát</button>' +
'    <button class="mp-tab" data-tab="history">Historie</button>' +
'    <button class="mp-tab" data-tab="leaderboard">Žebříček</button>' +
'  </div>' +
'  <div id="mpStatus" class="mp-status">Nepřipojeno.</div>' +
'  <div id="mpLobby" class="mp-area"></div>' +
'  <div id="mpRoom" class="mp-area" hidden></div>' +
'  <div id="mpHistory" class="mp-area" hidden></div>' +
'  <div id="mpLeaderboard" class="mp-area" hidden></div>' +
'</div>';
document.body.appendChild(modal);

if (!document.getElementById('mpBtn')) {
var btn = document.createElement('button');
btn.id = 'mpBtn';
btn.className = 'btn btn-outline';
btn.textContent = 'Multiplayer';
var controls = document.querySelector('.panel > .controls');
if (controls) controls.appendChild(btn);
else document.querySelector('.panel').prepend(btn);
btn.addEventListener('click', openModal);
} else {
document.getElementById('mpBtn').addEventListener('click', openModal);
}
modal.querySelector('#mpClose').addEventListener('click', function () { modal.hidden = true; });
modal.addEventListener('click', function (e) { if (e.target === modal) modal.hidden = true; });

var tabs = modal.querySelectorAll('.mp-tab');
for (var i = 0; i < tabs.length; i++) {
(function (t) {
t.addEventListener('click', function () {
activeTab = t.dataset.tab;
for (var j = 0; j < tabs.length; j++) tabs[j].classList.toggle('active', tabs[j] === t);
showTab();
});
})(tabs[i]);
}
statusLine = modal.querySelector('#mpStatus');
lobbyArea = modal.querySelector('#mpLobby');
roomArea = modal.querySelector('#mpRoom');
historyArea = modal.querySelector('#mpHistory');
leaderboardArea = modal.querySelector('#mpLeaderboard');
renderLobby();
}

function showTab() {
if (!modal) return;
lobbyArea.hidden = activeTab !== 'play' || mpState.inRoom;
roomArea.hidden = !mpState.inRoom || activeTab !== 'play';
historyArea.hidden = activeTab !== 'history';
leaderboardArea.hidden = activeTab !== 'leaderboard';
if (activeTab === 'history') {
if (!mpState.user) historyArea.innerHTML = '<div class="mp-section"><p class="hint-mini">Nejdřív se přihlas v záložce Hrát.</p></div>';
else {
sendMsg({ type: 'history', limit: 30 });
historyArea.innerHTML = '<div class="mp-section"><p class="hint-mini">Načítám historii…</p></div>';
}
} else if (activeTab === 'leaderboard') loadLeaderboard();
}

function openModal() {
ensureUI();
modal.hidden = false;
connect();
if (mpState.user && !mpState.inRoom) sendMsg({ type: 'list-rooms' });
showTab();
try { window.dispatchEvent(new Event('sachy-mp-modal-open')); } catch (e) {}
}
function setStatusLine(text) { if (statusLine) statusLine.textContent = text; }

function renderLobby() {
if (!lobbyArea) return;
if (!mpState.user) {
lobbyArea.innerHTML = '' +
'<div class="mp-section">' +
'  <h3>Přihlášení</h3>' +
'  <p class="hint-mini">Přezdívka slouží i k ukládání ratingu. Pokud je poprvé volná, zaregistruje se.</p>' +
'  <label class="field"><span class="field-label">Přezdívka</span>' +
'  <input type="text" id="mpNick" maxlength="24"></label>' +
'  <label class="field"><span class="field-label">Heslo (nepovinné)</span>' +
'  <input type="password" id="mpPass" maxlength="64"></label>' +
'  <div class="controls"><button id="mpLogin" class="btn">Přihlásit</button></div>' +
'</div>';
lobbyArea.querySelector('#mpLogin').addEventListener('click', function () {
sendMsg({ type: 'login', nickname: lobbyArea.querySelector('#mpNick').value, password: lobbyArea.querySelector('#mpPass').value });
});
return;
}
lobbyArea.innerHTML = '' +
'<div class="mp-section">' +
'  <h3>Přihlášen jako <b>' + escapeHtml(mpState.user.nickname) + '</b> (' + mpState.user.rating + ')</h3>' +
'  <div class="controls">' +
'    <button id="mpCreatePrivate" class="btn">Soukromá hra</button>' +
'    <button id="mpCreatePublic" class="btn btn-outline">Veřejná hra</button>' +
'    <button id="mpRefresh" class="btn btn-outline">Obnovit</button>' +
'  </div>' +
'</div>' +
'<div class="mp-section">' +
'  <h3>Připojit se</h3>' +
'  <label class="field"><span class="field-label">Kód místnosti</span>' +
'  <input type="text" id="mpRoomCode" maxlength="6" style="text-transform:uppercase"></label>' +
'  <div class="controls">' +
'    <button id="mpJoin" class="btn">Připojit</button>' +
'    <button id="mpSpectate" class="btn btn-outline">Dívat se</button>' +
'  </div>' +
'</div>' +
'<div class="mp-section">' +
'  <h3>Veřejné místnosti</h3>' +
'  <div id="mpRoomList" class="mp-room-list">Načítám…</div>' +
'</div>';

var ca = lobbyArea.querySelector('#mpCreatePrivate');
if (ca) ca.addEventListener('click', function () { sendMsg({ type: 'create-room', isPublic: false }); });
var cb = lobbyArea.querySelector('#mpCreatePublic');
if (cb) cb.addEventListener('click', function () { sendMsg({ type: 'create-room', isPublic: true }); });
var rf = lobbyArea.querySelector('#mpRefresh');
if (rf) rf.addEventListener('click', function () { sendMsg({ type: 'list-rooms' }); });
var jo = lobbyArea.querySelector('#mpJoin');
if (jo) jo.addEventListener('click', function () {
var id = lobbyArea.querySelector('#mpRoomCode').value.toUpperCase();
if (id) sendMsg({ type: 'join-room', roomId: id });
});
var sp = lobbyArea.querySelector('#mpSpectate');
if (sp) sp.addEventListener('click', function () {
var id = lobbyArea.querySelector('#mpRoomCode').value.toUpperCase();
if (id) sendMsg({ type: 'spectate', roomId: id });
});
sendMsg({ type: 'list-rooms' });
try { window.dispatchEvent(new Event('sachy-mp-lobby-rendered')); } catch (e) {}
}

function renderRoomList(list) {
if (!lobbyArea) return;
var el = lobbyArea.querySelector('#mpRoomList');
if (!el) return;
if (!list || list.length === 0) { el.textContent = 'Žádné veřejné místnosti.'; return; }
el.innerHTML = '';
for (var i = 0; i < list.length; i++) {
(function (r) {
var row = document.createElement('div');
row.className = 'mp-room-row';
var info = document.createElement('span');
info.textContent = r.id + ' · ' + r.host + ' · ' + (r.status === 'waiting' ? 'čeká' : 'hraje se');
row.appendChild(info);
var b1 = document.createElement('button');
b1.className = 'btn btn-outline'; b1.textContent = 'Hrát';
b1.addEventListener('click', function () { sendMsg({ type: 'join-room', roomId: r.id }); });
row.appendChild(b1);
var b2 = document.createElement('button');
b2.className = 'btn btn-outline'; b2.textContent = 'Dívat se';
b2.addEventListener('click', function () { sendMsg({ type: 'spectate', roomId: r.id }); });
row.appendChild(b2);
el.appendChild(row);
})(list[i]);
}
}

function renderRoom() {
if (!roomArea) return;
roomArea.hidden = false;
lobbyArea.hidden = true;
var roleText = mpState.role === 'spectator' ? 'Divák' : (mpState.role === 'w' ? 'Bílý' : 'Černý');
var shareUrl = location.origin + location.pathname + '#mp=' + mpState.roomId;
var html = '' +
'<div class="mp-section">' +
'  <h3>Místnost <b>' + mpState.roomId + '</b> — hraješ za: ' + roleText + '</h3>' +
'  <p class="hint-mini">Odkaz: <code>' + escapeHtml(shareUrl) + '</code></p>' +
'  <div class="controls">' +
'    <button id="mpCopyLink" class="btn btn-outline">Kopírovat odkaz</button>' +
'    <button id="mpLeave" class="btn btn-outline">Opustit</button>' +
(mpState.role === 'w' || mpState.role === 'b' ?
'    <button id="mpResign" class="btn btn-outline">Vzdát</button>' +
'    <button id="mpDraw" class="btn btn-outline">Remíza</button>' : '') +
'  </div>' +
'</div>' +
'<div class="mp-section mp-clock">' +
'  <div class="mp-clock-row"><span>Bílý:</span><span id="mpWhiteClock">30:00</span></div>' +
'  <div class="mp-clock-row"><span>Černý:</span><span id="mpBlackClock">30:00</span></div>' +
'</div>' +
'<div class="mp-section">' +
'  <h3>Chat</h3>' +
'  <div id="mpChat" class="mp-chat"></div>' +
'  <div class="controls">' +
'    <input type="text" id="mpChatInput" maxlength="500" placeholder="Napiš…">' +
'    <button id="mpChatSend" class="btn">Odeslat</button>' +
'  </div>' +
'</div>';
roomArea.innerHTML = html;
roomArea.querySelector('#mpLeave').addEventListener('click', leaveRoom);
var copy = roomArea.querySelector('#mpCopyLink');
if (copy) copy.addEventListener('click', function () {
if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(shareUrl).then(function () { showToast('Odkaz zkopírován.'); });
else window.prompt('Odkaz:', shareUrl);
});
var rs = roomArea.querySelector('#mpResign');
if (rs) rs.addEventListener('click', function () { if (confirm('Vzdát?')) sendMsg({ type: 'resign' }); });
var dr = roomArea.querySelector('#mpDraw');
if (dr) dr.addEventListener('click', function () { sendMsg({ type: 'offer-draw' }); });
chatBox = roomArea.querySelector('#mpChat');
chatInput = roomArea.querySelector('#mpChatInput');
roomArea.querySelector('#mpChatSend').addEventListener('click', sendChat);
if (chatInput) chatInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') sendChat(); });
}

function renderHistory(games) {
if (!historyArea) return;
if (!games || games.length === 0) {
historyArea.innerHTML = '<div class="mp-section"><p class="hint-mini">Zatím žádné odehrané partie.</p></div>';
return;
}
var html = '<div class="mp-section"><h3>Posledních ' + games.length + ' partií</h3><div class="mp-history-list">';
for (var i = 0; i < games.length; i++) {
var g = games[i];
var res = '', cls = 'mp-hist-neutral';
if (g.result === '1-0') { res = '1-0'; cls = g.myColor === 'w' ? 'mp-hist-win' : 'mp-hist-loss'; }
else if (g.result === '0-1') { res = '0-1'; cls = g.myColor === 'b' ? 'mp-hist-win' : 'mp-hist-loss'; }
else if (g.result === '1/2-1/2') { res = '½-½'; cls = 'mp-hist-draw'; }
else res = g.result || '?';
var d = new Date(g.endedAt);
var dStr = d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()) + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes());
html += '<div class="mp-hist-row">' +
'  <span class="mp-hist-date">' + dStr + '</span>' +
'  <span class="mp-hist-players">' + escapeHtml(g.white) + ' vs ' + escapeHtml(g.black) + '</span>' +
'  <span class="mp-hist-result ' + cls + '">' + res + '</span>' +
'  <button class="btn btn-outline" data-id="' + g.id + '">PGN</button>' +
'</div>';
}
html += '</div></div>';
historyArea.innerHTML = html;
var btns = historyArea.querySelectorAll('button[data-id]');
for (var j = 0; j < btns.length; j++) {
(function (btn) {
btn.addEventListener('click', function () {
var id = btn.dataset.id;
fetch(API_BASE + '/api/game/' + id + '/pgn').then(function (r) {
if (!r.ok) throw new Error('PGN nenalezeno');
return r.text();
}).then(function (pgn) {
if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(pgn).then(function () { showToast('PGN zkopírováno.'); });
else window.prompt('PGN:', pgn);
}).catch(function (e) { showToast('Chyba: ' + e.message); });
});
})(btns[j]);
}
}
function p2(n) { return n < 10 ? '0' + n : '' + n; }

function loadLeaderboard() {
if (!leaderboardArea) return;
leaderboardArea.innerHTML = '<div class="mp-section"><p class="hint-mini">Načítám…</p></div>';
fetch(API_BASE + '/api/leaderboard').then(function (r) { return r.json(); }).then(function (data) {
var list = data.top || [];
if (list.length === 0) { leaderboardArea.innerHTML = '<div class="mp-section"><p class="hint-mini">Zatím žádní hráči.</p></div>'; return; }
var html = '<div class="mp-section"><h3>Top hráči</h3><div class="mp-leaderboard">';
for (var i = 0; i < list.length; i++) {
html += '<div class="mp-lb-row">' +
'  <span class="mp-lb-rank">#' + (i + 1) + '</span>' +
'  <span class="mp-lb-name">' + escapeHtml(list[i].nickname) + '</span>' +
'  <span class="mp-lb-rating">' + list[i].rating + '</span>' +
'  <span class="mp-lb-games">(' + list[i].games_played + ' her)</span>' +
'</div>';
}
html += '</div></div>';
leaderboardArea.innerHTML = html;
}).catch(function () {
leaderboardArea.innerHTML = '<div class="mp-section"><p class="hint-mini">Nepodařilo se načíst žebříček.</p></div>';
});
}

function sendChat() {
if (!chatInput) return;
var text = chatInput.value.trim();
if (!text) return;
sendMsg({ type: 'chat', text });
chatInput.value = '';
}
function appendChat(entry) {
if (!chatBox) return;
var line = document.createElement('div');
line.className = 'mp-chat-line';
var b = document.createElement('b');
b.textContent = entry.from + ':';
line.appendChild(b);
line.appendChild(document.createTextNode(' ' + entry.text));
chatBox.appendChild(line);
chatBox.scrollTop = chatBox.scrollHeight;
}
function setClocks(clock) {
var w = document.getElementById('mpWhiteClock'), b = document.getElementById('mpBlackClock');
if (w) w.textContent = fmtTime(clock.whiteTimeMs);
if (b) b.textContent = fmtTime(clock.blackTimeMs);
}
function fmtTime(ms) {
if (ms < 0) ms = 0;
var s = Math.floor(ms / 1000), m = Math.floor(s / 60), ss = s % 60;
return m + ':' + (ss < 10 ? '0' : '') + ss;
}
function leaveRoom() {
mpState.inRoom = false; mpState.roomId = null; mpState.role = null;
roomArea.hidden = true; lobbyArea.hidden = false;
showTab();
try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
}

function onServerMessage(msg) {
switch (msg.type) {
case 'logged-in':
mpState.user = msg.user;
if (msg.token) { mpState.token = msg.token; try { localStorage.setItem('sachy-mp-token', msg.token); } catch (e) {} }
setStatusLine('Přihlášen jako ' + msg.user.nickname + '.');
renderLobby();
if (activeTab === 'history') sendMsg({ type: 'history', limit: 30 });
break;
case 'login-error': setStatusLine('Chyba: ' + msg.message); break;
case 'room-created':
mpState.roomId = msg.roomId; mpState.role = msg.color; mpState.inRoom = true;
setStatusLine('Místnost ' + msg.roomId + '. Pošli odkaz.');
renderRoom();
try { history.replaceState(null, '', location.pathname + '#mp=' + msg.roomId); } catch (e) {}
break;
case 'room-list': renderRoomList(msg.rooms); break;
case 'state': applyServerState(msg); if (!mpState.inRoom) { mpState.inRoom = true; renderRoom(); } break;
case 'move': applyRemoteMove(msg); break;
case 'clock': setClocks(msg); break;
case 'chat': appendChat(msg.entry); break;
case 'players-updated':
setStatusLine('Hráči: ' + (msg.white ? msg.white.nickname : '?') + ' vs ' + (msg.black ? msg.black.nickname : '?'));
break;
case 'game-start': setStatusLine('Hra začala.'); break;
case 'game-over': handleGameOver(msg); break;
case 'draw-offered':
if (confirm('Soupeř nabízí remízu. Přijmout?')) sendMsg({ type: 'accept-draw' });
else sendMsg({ type: 'decline-draw' });
break;
case 'draw-declined': showToast('Soupeř odmítl remízu.'); break;
case 'player-disconnected': setStatusLine('Soupeř odpojen. Čekám ' + Math.round(msg.timeoutMs / 1000) + ' s…'); break;
case 'player-reconnected': setStatusLine('Soupeř zpět.'); break;
case 'history': renderHistory(msg.games); break;
case 'push-subscribed': setStatusLine('Notifikace aktivní.'); break;
case 'push-unsubscribed': setStatusLine('Notifikace vypnuty.'); break;
case 'error': showToast('Chyba: ' + msg.message); setStatusLine('Chyba: ' + msg.message); break;
}
}

function applyServerState(s) {
mpState.roomId = s.roomId; mpState.role = s.myRole; mpState.isPublic = s.isPublic; mpState.status = s.status;
board = s.board;
turn = s.turn;
uciHistory = s.uciHistory || [];
state = s.state || { enPassant: null, castling: { w: { k: true, q: true }, b: { k: true, q: true } } };
gameOver = (s.status === 'ended');
selected = null; legalTargets = []; hintMove = null;
try { render(); } catch (e) { console.error(e); }
setClocks(s.clock);
var cb = document.getElementById('mpChat');
if (cb) cb.innerHTML = '';
if (s.chat) for (var i = 0; i < s.chat.length; i++) appendChat(s.chat[i]);
if (s.status === 'waiting') setStatusLine('Čekám na soupeře… Kód: ' + s.roomId);
else setStatusLine('Hraje se.');
if (s.result) handleGameOver({ result: s.result, reason: s.endReason });
}

function applyRemoteMove(msg) {
var from = uciToRC(msg.from);
var to = uciToRC(msg.to);
var promo = msg.promotion || null;
var legal = getAllLegalMoves(board, turn, state);
var move = null;
for (var i = 0; i < legal.length; i++) {
var m = legal[i];
if (m.from.r === from.r && m.from.c === from.c && m.to.r === to.r && m.to.c === to.c) {
if (m.promotion && promo && m.promotion !== promo) continue;
move = m; break;
}
}
if (!move) { setStatusLine('Chyba: server poslal neznámý tah.'); return; }
suppressMoveSend = true;
window.isRemoteMove = true;
try { makeMove(move); }
finally { suppressMoveSend = false; window.isRemoteMove = false; }
}

function handleGameOver(msg) {
gameOver = true;
var txt = msg.result === '1-0' ? 'Vyhrál Bílý.' : (msg.result === '0-1' ? 'Vyhrál Černý.' : 'Remíza.');
var reasons = {
'checkmate': 'mat', 'stalemate': 'pat', 'timeout': 'vypršel čas',
'resign': 'vzdání', 'agreement': 'dohoda', 'forfeit': 'soupeř odešel',
'fifty-move': '50 tahů', 'threefold': 'trojí opakování',
'material': 'nedostatečný materiál'
};
var rsn = reasons[msg.reason] || msg.reason || '';
setStatusLine('Konec: ' + txt + ' (' + rsn + ')');
if (typeof statusEl !== 'undefined' && statusEl) statusEl.textContent = 'Konec: ' + txt + ' (' + rsn + ')';
}

if (typeof makeMove === 'function') {
var _origMakeMove = makeMove;
window.makeMove = function (move) {
if (suppressMoveSend) return _origMakeMove.apply(this, arguments);
if (mpState.inRoom && (mpState.role === 'w' || mpState.role === 'b') && mpState.status === 'playing') {
sendMsg({ type: 'move', from: FILES[move.from.c] + (8 - move.from.r), to: FILES[move.to.c] + (8 - move.to.r), promotion: move.promotion || null });
return;
}
return _origMakeMove.apply(this, arguments);
};
}

function checkHash() {
var h = location.hash || '';
if (h.indexOf('#mp=') === 0) {
var id = h.slice(4).toUpperCase();
ensureUI();
connect();
setTimeout(function () { sendMsg({ type: 'join-room', roomId: id }); }, 800);
}
}

function escapeHtml(s) {
return String(s).replace(/[&<>"']/g, function (ch) {
return ({ '&': '&', '<': '<', '>': '>', '"': '"', "'": ''' })[ch];
});
}
function showToast(text, ms) {
if (typeof window.showToast === 'function') { try { window.showToast(text, ms); return; } catch (e) {} }
var el = document.getElementById('toast');
if (!el) return;
el.textContent = text; el.hidden = false;
clearTimeout(showToast._t);
showToast._t = setTimeout(function () { el.hidden = true; }, ms || 2400);
}

if (document.readyState === 'loading') {
document.addEventListener('DOMContentLoaded', function () { setTimeout(start, 100); });
} else setTimeout(start, 100);

function start() {
ensureUI();
try {
var t = localStorage.getItem('sachy-mp-token');
if (t) { mpState.token = t; connect(); }
} catch (e) {}
checkHash();
}
})();