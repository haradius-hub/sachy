/* =========================================================================
Šachy – client-net.js  (FIXED: shadowing state → mpState)
Multiplayer klient + historie partií + Web Push integrace.
Autor: Better DeepSeek (AI) · Zadavatel: Jan Hošek · 2026
SPDX-License-Identifier: GPL-3.0-or-later
========================================================================= */

(function () {
'use strict';

var mpState = {
user: null, token: null, roomId: null, role: null,
isPublic: false, status: 'idle', inRoom: false
};
var socket = null;
var suppressMoveSend = false;

var WS_URL = (function () {
var proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
var base = location.pathname.replace(//[^/]*$/, '');
if (!base) base = '/';
if (base.charAt(base.length - 1) === '/') base = base.slice(0, -1);
return proto + '//' + location.host + base + '/ws';
})();

var API_BASE = (function () {
var base = location.pathname.replace(//[^/]*$/, '');
if (!base) base = '';
return base;
})();

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
else if (g.result