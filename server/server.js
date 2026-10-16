/* =========================================================================
   Šachy – Multiplayer server
   Autor: Better DeepSeek (AI) · Zadavatel: Jan Hošek · 2026
   SPDX-License-Identifier: GPL-3.0-or-later

   OPRAVY:
   - Po každém tahu se kontrolují remízová pravidla (50 tahů, trojí
     opakování, nedostatečný materiál).
   - room.halfmoveClock se správně inkrementuje (pěšec / braní = reset).
   - room.positionHashes pro trojí opakování.
   - sendFullState posílá i `state` (rošáda, en passant), aby klient
     mohl rekonstruovat legální tahy.
   ========================================================================= */

const path = require('path');
const http = require('http');
const express = require('express');
const { WebSocketServer } = require('ws');

const E = require('./engine-loader');
const db = require('./db');
const R = require('./rooms');
const push = require('./push');
const T = require('./tournaments');

const PORT = parseInt(process.env.PORT || '8081', 10);
const HOST = process.env.HOST || '0.0.0.0';

const app = express();
app.use(express.json({ limit: '32kb' }));
app.use(express.static(path.join(__dirname, '..')));

app.get('/health', (req, res) => res.json({ ok: true, rooms: R.rooms.size, tournaments: T.tournaments.size }));
app.get('/api/vapid-public-key', (req, res) => res.json({ publicKey: push.getPublicKey() }));
app.get('/api/leaderboard', (req, res) => res.json({ top: db.getTopPlayers(10) }));
app.get('/api/history', (req, res) => {
  const user = db.userByToken(req.query.token);
  if (!user) return res.status(401).json({ error: 'Neplatný token.' });
  const limit = Math.min(parseInt(req.query.limit || '30', 10) || 30, 100);
  res.json({ games: db.gamesByUser(user.id, limit) });
});
app.get('/api/game/:id/pgn', (req, res) => {
  const pgn = db.gamePgn(req.params.id);
  if (pgn === null) return res.status(404).send('Not found');
  res.set('Content-Type', 'application/x-chess-pgn');
  res.send(pgn);
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

function send(ws, msg) { if (ws.readyState === 1) { try { ws.send(JSON.stringify(msg)); } catch (e) {} } }
function broadcast(room, msg) {
  for (const c of [room.white, room.black]) if (c && c.ws) send(c.ws, msg);
  for (const s of room.spectators) send(s, msg);
}
function sendClock(room) { broadcast(room, { type: 'clock', ...R.clockSnapshot(room) }); }

async function notifyOpponent(room, moverColor) {
  const opp = moverColor === 'w' ? room.black : room.white;
  if (!opp || !opp.id) return;
  const subs = db.pushSubscriptionsByUser(opp.id);
  if (!subs || subs.length === 0) return;
  const payload = {
    title: 'Šachy — soupeř táhl',
    body: (moverColor === 'w' ? 'Bílý' : 'Černý') + ' táhl v místnosti ' + room.id + '.',
    tag: 'sachy-' + room.id,
    url: './#mp=' + room.id
  };
  for (const sub of subs) {
    const res = await push.sendPush(sub, payload);
    if (res && res.gone) db.removePushSubscription(sub.endpoint);
  }
}

setInterval(() => {
  for (const room of R.rooms.values()) {
    if (room.status !== 'playing') continue;
    const t = R.elapsedForColor(room);
    if (t.whiteExpired) {
      R.endGame(room, '0-1', 'timeout');
      broadcast(room, { type: 'game-over', result: '0-1', reason: 'timeout' });
      handleTournamentRoomEnd(room, '0-1');
    } else if (t.blackExpired) {
      R.endGame(room, '1-0', 'timeout');
      broadcast(room, { type: 'game-over', result: '1-0', reason: 'timeout' });
      handleTournamentRoomEnd(room, '1-0');
    } else {
      sendClock(room);
    }
  }
}, 1000);

function handleTournamentRoomEnd(room, result) {
  const t = T.getTournamentByRoom(room.id);
  if (!t) return;
  const m = t.matches.find(x => x.roomId === room.id);
  if (!m) return;

  if (result === '1/2-1/2') {
    const res = T.recordMatchResult(t, m.id, null, null, { isDraw: true });
    if (res.rematch) {
      broadcastTournament(t, {
        info: 'Remíza – partie se opakuje s prohozenými barvami (' + m.replayCount + '/' + T.MAX_REPLAYS + ').'
      });
    } else if (res.resolvedByElo) {
      broadcastTournament(t, {
        info: 'Po ' + T.MAX_REPLAYS + ' remízách rozhodlo ELO. Vítěz: ' + m.winnerNick
      });
    }
    return;
  }

  const winnerId = (result === '1-0') ? m.whiteId : m.blackId;
  const winnerNick = (result === '1-0') ? m.whiteNick : m.blackNick;
  if (!winnerId) return;
  const res = T.recordMatchResult(t, m.id, winnerId, winnerNick);
  if (res.ok) {
    let info = 'Vítěz zápasu: ' + winnerNick;
    if (m.replayCount && m.replayCount > 0) info += ' (po ' + m.replayCount + ' remízách)';
    broadcastTournament(t, { info: info });
  }
}

function broadcastTournament(t, extra) {
  const sent = new Set();
  for (const p of t.players) {
    for (const room of R.rooms.values()) {
      for (const c of [room.white, room.black]) {
        if (c && c.id === p.userId && c.ws && !sent.has(c.ws)) {
          send(c.ws, Object.assign({ type: 'tournament-state', tournament: publicTournamentState(t, p.userId) }, extra || {}));
          sent.add(c.ws);
        }
      }
    }
  }
  for (const ws of tournamentWatchers.get(t.id) || []) {
    if (!sent.has(ws)) send(ws, Object.assign({ type: 'tournament-state', tournament: publicTournamentState(t, ws.user ? ws.user.id : null) }, extra || {}));
  }
}

function publicTournamentState(t, viewerId) {
  return {
    id: t.id, name: t.name, hostId: t.hostId, size: t.size, status: t.status,
    players: t.players.map(p => ({ userId: p.userId, nickname: p.nickname, eliminated: p.eliminated })),
    bracket: t.bracket, currentRound: t.currentRound, winner: t.winner,
    myId: viewerId, maxReplays: T.MAX_REPLAYS
  };
}

const tournamentWatchers = new Map();

wss.on('connection', (ws) => {
  ws.user = null; ws.roomId = null; ws.role = null; ws.tournamentId = null;
  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch (e) { return send(ws, { type: 'error', message: 'Neplatný JSON.' }); }
    try { handle(ws, msg); }
    catch (err) { console.error('[ws]', err); send(ws, { type: 'error', message: 'Chyba serveru.' }); }
  });
  ws.on('close', () => {
    handleDisconnect(ws);
    if (ws.tournamentId) {
      const set = tournamentWatchers.get(ws.tournamentId);
      if (set) set.delete(ws);
    }
  });
});

function handle(ws, msg) {
  switch (msg.type) {
    case 'login': return onLogin(ws, msg);
    case 'create-room': return onCreateRoom(ws, msg);
    case 'join-room': return onJoinRoom(ws, msg);
    case 'list-rooms': return onListRooms(ws);
    case 'spectate': return onSpectate(ws, msg);
    case 'move': return onMove(ws, msg);
    case 'chat': return onChat(ws, msg);
    case 'resign': return onResign(ws);
    case 'offer-draw': return onOfferDraw(ws);
    case 'accept-draw': return onAcceptDraw(ws);
    case 'decline-draw': return onDeclineDraw(ws);
    case 'reconnect': return onReconnect(ws, msg);
    case 'history': return onHistory(ws, msg);
    case 'push-subscribe': return onPushSubscribe(ws, msg);
    case 'push-unsubscribe': return onPushUnsubscribe(ws, msg);
    case 'create-tournament': return onCreateTournament(ws, msg);
    case 'join-tournament': return onJoinTournament(ws, msg);
    case 'leave-tournament': return onLeaveTournament(ws, msg);
    case 'start-tournament': return onStartTournament(ws, msg);
    case 'list-tournaments': return onListTournaments(ws);
    case 'watch-tournament': return onWatchTournament(ws, msg);
    case 'unwatch-tournament': return onUnwatchTournament(ws, msg);
    case 'start-tournament-match': return onStartTournamentMatch(ws, msg);
    default: return send(ws, { type: 'error', message: 'Neznámý typ: ' + msg.type });
  }
}

function onLogin(ws, msg) {
  const res = db.registerOrLogin(msg.nickname, msg.password);
  if (res.error) return send(ws, { type: 'login-error', message: res.error });
  ws.user = res.user;
  send(ws, { type: 'logged-in', user: res.user, token: res.token });
}
function onCreateRoom(ws, msg) {
  if (!ws.user) return send(ws, { type: 'error', message: 'Nejdřív se přihlas.' });
  if (ws.roomId) return send(ws, { type: 'error', message: 'Už jsi v místnosti.' });
  const room = R.createRoom({ isPublic: !!msg.isPublic, hostUserId: ws.user.id });
  const hostColor = msg.color === 'b' ? 'b' : 'w';
  if (hostColor === 'w') room.white = { ...ws.user, ws }; else room.black = { ...ws.user, ws };
  ws.roomId = room.id; ws.role = hostColor;
  send(ws, { type: 'room-created', roomId: room.id, color: hostColor, isPublic: room.isPublic });
}
function onJoinRoom(ws, msg) {
  if (!ws.user) return send(ws, { type: 'error', message: 'Nejdřív se přihlas.' });
  if (ws.roomId) return send(ws, { type: 'error', message: 'Už jsi v místnosti.' });
  const room = R.getRoom(msg.roomId);
  if (!room) return send(ws, { type: 'error', message: 'Místnost neexistuje.' });
  if (room.status === 'ended') return send(ws, { type: 'error', message: 'Partie skončila.' });
  let color = null;
  if (!room.white) color = 'w'; else if (!room.black) color = 'b';
  else { room.spectators.add(ws); ws.roomId = room.id; ws.role = 'spectator'; sendFullState(ws, room); return; }
  const player = { ...ws.user, ws };
  if (color === 'w') room.white = player; else room.black = player;
  ws.roomId = room.id; ws.role = color;
  if (room.white && room.black && room.status === 'waiting') {
    R.startGame(room);
    broadcast(room, { type: 'game-start', ...R.clockSnapshot(room) });
  }
  sendFullState(ws, room);
  broadcast(room, { type: 'players-updated', white: publicPlayer(room.white), black: publicPlayer(room.black) });
}
function publicPlayer(p) { return p ? { id: p.id, nickname: p.nickname, rating: p.rating } : null; }

/* OPRAVA: posílá i `state` (rošáda, en passant), aby klient měl kompletní stav. */
function sendFullState(ws, room) {
  send(ws, {
    type: 'state', roomId: room.id, isPublic: room.isPublic, status: room.status,
    board: room.board, state: room.state, turn: room.turn, uciHistory: room.uciHistory,
    halfmoveClock: room.halfmoveClock, fullmoveNumber: room.fullmoveNumber,
    white: publicPlayer(room.white), black: publicPlayer(room.black),
    spectators: room.spectators.size, chat: room.chat.slice(-50),
    clock: R.clockSnapshot(room), result: room.result, endReason: room.endReason, myRole: ws.role
  });
}
function onListRooms(ws) { send(ws, { type: 'room-list', rooms: R.publicRoomList() }); }
function onSpectate(ws, msg) {
  const room = R.getRoom(msg.roomId);
  if (!room) return send(ws, { type: 'error', message: 'Místnost neexistuje.' });
  room.spectators.add(ws); ws.roomId = room.id; ws.role = 'spectator';
  sendFullState(ws, room);
}

/* OPRAVA: po tahu se kontrolují remízová pravidla + halfmoveClock + positionHashes. */
function onMove(ws, msg) {
  const room = R.getRoom(ws.roomId);
  if (!room) return send(ws, { type: 'error', message: 'Nejsi v místnosti.' });
  if (room.status !== 'playing') return send(ws, { type: 'error', message: 'Partie neběží.' });
  if (ws.role !== room.turn) return send(ws, { type: 'error', message: 'Nejsi na tahu.' });
  const from = E.uciToRC(msg.from);
  const to = E.uciToRC(msg.to);
  const promo = msg.promotion ? String(msg.promotion).toLowerCase() : null;
  const legal = E.getAllLegalMoves(room.board, room.turn, room.state);
  const move = legal.find(m =>
    m.from.r === from.r && m.from.c === from.c &&
    m.to.r === to.r && m.to.c === to.c &&
    (!m.promotion || m.promotion === promo));
  if (!move) return send(ws, { type: 'error', message: 'Nelegální tah.' });

  const moverColor = room.turn;
  const piece = room.board[move.from.r][move.from.c];
  const captured = move.enPassant ? { type: 'p' } : room.board[move.to.r][move.to.c];

  E.applyMove(room.board, move, room.state);
  const uci = E.moveToUCI(move);
  room.uciHistory.push(uci);

  /* halfmoveClock: reset při tahu pěšcem nebo při braní, jinak ++ */
  if (piece && piece.type === 'p' || captured) room.halfmoveClock = 0;
  else room.halfmoveClock++;

  if (room.turn === 'b') room.fullmoveNumber++;
  room.turn = E.other(room.turn);

  /* Trojí opakování */
  const h = E.hashPosition(room.board, room.state, room.turn);
  room.positionHashes.set(h, (room.positionHashes.get(h) || 0) + 1);

  if (moverColor === 'w') room.whiteTimeMs += R.INCREMENT_MS; else room.blackTimeMs += R.INCREMENT_MS;
  room.lastTickAt = Date.now();
  broadcast(room, { type: 'move', from: msg.from, to: msg.to, promotion: promo, uci });
  sendClock(room);
  notifyOpponent(room, moverColor).catch(function (err) { console.warn('[push]', err); });

  /* --- Kontrola konců --- */
  const legal2 = E.getAllLegalMoves(room.board, room.turn, room.state);
  if (legal2.length === 0) {
    const inChk = E.inCheck(room.board, room.turn, room.state);
    if (inChk) {
      const winner = room.turn === 'w' ? '0-1' : '1-0';
      R.endGame(room, winner, 'checkmate');
      broadcast(room, { type: 'game-over', result: winner, reason: 'checkmate' });
      handleTournamentRoomEnd(room, winner);
    } else {
      R.endGame(room, '1/2-1/2', 'stalemate');
      broadcast(room, { type: 'game-over', result: '1/2-1/2', reason: 'stalemate' });
      handleTournamentRoomEnd(room, '1/2-1/2');
    }
    return;
  }

  /* Remízová pravidla (50 tahů / trojí opakování / nedostatečný materiál) */
  const drawCheck = R.checkDrawRules(room);
  if (drawCheck) {
    R.endGame(room, '1/2-1/2', drawCheck.reason);
    broadcast(room, { type: 'game-over', result: '1/2-1/2', reason: drawCheck.reason });
    handleTournamentRoomEnd(room, '1/2-1/2');
    return;
  }

  R.saveActive(room);
}
function onChat(ws, msg) {
  const room = R.getRoom(ws.roomId);
  if (!room) return;
  const text = String(msg.text || '').slice(0, 500).trim();
  if (!text) return;
  const nick = ws.user ? ws.user.nickname : 'Divák';
  const entry = { t: Date.now(), from: nick, text };
  room.chat.push(entry);
  if (room.chat.length > 200) room.chat.shift();
  broadcast(room, { type: 'chat', entry });
}
function onResign(ws) {
  const room = R.getRoom(ws.roomId);
  if (!room || room.status !== 'playing') return;
  if (ws.role !== 'w' && ws.role !== 'b') return;
  const result = ws.role === 'w' ? '0-1' : '1-0';
  R.endGame(room, result, 'resign');
  broadcast(room, { type: 'game-over', result, reason: 'resign' });
  handleTournamentRoomEnd(room, result);
}
function onOfferDraw(ws) {
  const room = R.getRoom(ws.roomId);
  if (!room || room.status !== 'playing') return;
  const other = ws.role === 'w' ? room.black : room.white;
  if (other && other.ws) send(other.ws, { type: 'draw-offered' });
}
function onAcceptDraw(ws) {
  const room = R.getRoom(ws.roomId);
  if (!room || room.status !== 'playing') return;
  R.endGame(room, '1/2-1/2', 'agreement');
  broadcast(room, { type: 'game-over', result: '1/2-1/2', reason: 'agreement' });
  handleTournamentRoomEnd(room, '1/2-1/2');
}
function onDeclineDraw(ws) {
  const room = R.getRoom(ws.roomId);
  if (!room) return;
  const other = ws.role === 'w' ? room.black : room.white;
  if (other && other.ws) send(other.ws, { type: 'draw-declined' });
}
function onReconnect(ws, msg) {
  const user = db.userByToken(msg.token);
  if (!user) return send(ws, { type: 'error', message: 'Neplatný token.' });
  ws.user = user;
  send(ws, { type: 'logged-in', user });
  const room = R.getRoom(msg.roomId);
  if (!room) return send(ws, { type: 'error', message: 'Místnost už neexistuje.' });
  let role = null;
  if (room.white && room.white.id === user.id) role = 'w';
  else if (room.black && room.black.id === user.id) role = 'b';
  else { room.spectators.add(ws); ws.roomId = room.id; ws.role = 'spectator'; return sendFullState(ws, room); }
  if (role === 'w') room.white.ws = ws; else room.black.ws = ws;
  ws.roomId = room.id; ws.role = role;
  if (room.disconnectTimer && room.disconnectColor === role) {
    clearTimeout(room.disconnectTimer); room.disconnectTimer = null; room.disconnectColor = null;
  }
  sendFullState(ws, room);
  broadcast(room, { type: 'player-reconnected', color: role });
}
function onHistory(ws, msg) {
  if (!ws.user) return send(ws, { type: 'error', message: 'Nejdřív se přihlas.' });
  const limit = Math.min(parseInt(msg.limit || '30', 10) || 30, 100);
  send(ws, { type: 'history', games: db.gamesByUser(ws.user.id, limit) });
}
function onPushSubscribe(ws, msg) {
  if (!ws.user) return send(ws, { type: 'error', message: 'Nejdřív se přihlas.' });
  if (!msg.subscription || !msg.subscription.endpoint) return send(ws, { type: 'error', message: 'Chybí subscription.' });
  try { db.savePushSubscription(ws.user.id, msg.subscription); send(ws, { type: 'push-subscribed', ok: true }); }
  catch (err) { send(ws, { type: 'error', message: 'Nepodařilo se uložit subscription.' }); }
}
function onPushUnsubscribe(ws, msg) {
  if (!ws.user) return;
  if (msg.endpoint) db.removePushSubscription(msg.endpoint);
  send(ws, { type: 'push-unsubscribed', ok: true });
}

function onCreateTournament(ws, msg) {
  if (!ws.user) return send(ws, { type: 'error', message: 'Nejdřív se přihlas.' });
  const size = parseInt(msg.size || '4', 10);
  try {
    const t = T.createTournament({ hostId: ws.user.id, hostNick: ws.user.nickname, size, name: msg.name });
    ws.tournamentId = t.id;
    registerWatcher(t.id, ws);
    send(ws, { type: 'tournament-created', tournament: publicTournamentState(t, ws.user.id) });
    broadcastTournament(t);
  } catch (e) { send(ws, { type: 'error', message: e.message }); }
}
function onJoinTournament(ws, msg) {
  if (!ws.user) return send(ws, { type: 'error', message: 'Nejdřív se přihlas.' });
  const res = T.joinTournament(msg.tournamentId, ws.user.id, ws.user.nickname);
  if (res.error) return send(ws, { type: 'error', message: res.error });
  ws.tournamentId = msg.tournamentId;
  registerWatcher(msg.tournamentId, ws);
  send(ws, { type: 'tournament-joined', tournament: publicTournamentState(res.tournament, ws.user.id) });
  broadcastTournament(res.tournament);
}
function onLeaveTournament(ws, msg) {
  if (!ws.user) return;
  const res = T.leaveTournament(msg.tournamentId, ws.user.id);
  if (res.error) return send(ws, { type: 'error', message: res.error });
  broadcastTournament(res.tournament);
}
function onStartTournament(ws, msg) {
  if (!ws.user) return;
  const res = T.startTournament(msg.tournamentId, ws.user.id);
  if (res.error) return send(ws, { type: 'error', message: res.error });
  broadcastTournament(res.tournament);
}
function onListTournaments(ws) {
  send(ws, { type: 'tournament-list', tournaments: T.publicTournamentList() });
}
function onWatchTournament(ws, msg) {
  const t = T.getTournament(msg.tournamentId);
  if (!t) return send(ws, { type: 'error', message: 'Turnaj neexistuje.' });
  ws.tournamentId = msg.tournamentId;
  registerWatcher(msg.tournamentId, ws);
  send(ws, { type: 'tournament-state', tournament: publicTournamentState(t, ws.user ? ws.user.id : null) });
}
function onUnwatchTournament(ws, msg) {
  const set = tournamentWatchers.get(msg.tournamentId);
  if (set) set.delete(ws);
  ws.tournamentId = null;
}
function onStartTournamentMatch(ws, msg) {
  if (!ws.user) return send(ws, { type: 'error', message: 'Nejdřív se přihlas.' });
  const t = T.getTournament(msg.tournamentId);
  if (!t) return send(ws, { type: 'error', message: 'Turnaj neexistuje.' });
  if (t.hostId !== ws.user.id) return send(ws, { type: 'error', message: 'Jen hostitel může spustit zápas.' });
  const m = t.matches.find(x => x.id === msg.matchId);
  if (!m) return send(ws, { type: 'error', message: 'Zápas nenalezen.' });
  if (m.status === 'done') return send(ws, { type: 'error', message: 'Zápas už skončil.' });
  if (!m.whiteId || !m.blackId) return send(ws, { type: 'error', message: 'Čeká se na vítěze předchozího zápasu.' });
  if (m.roomId) return send(ws, { type: 'error', message: 'Zápas už běží.' });

  const room = R.createRoom({ isPublic: true, host
