/* =========================================================================
   Správa místností a partií (stejná jako dřív, jen drobná úprava endGame,
   aby ukládal i přezdívky do historie).
   Autor: Better DeepSeek (AI) · Zadavatel: Jan Hošek · 2026
   SPDX-License-Identifier: GPL-3.0-or-later
   ========================================================================= */

const E = require('./engine-loader');
const db = require('./db');

const START_TIME_MS = 30 * 60 * 1000;
const INCREMENT_MS = 30 * 1000;
const RECONNECT_MS = 60 * 1000;

const rooms = new Map();
const socketToRoom = new Map();
const socketToRole = new Map();

function genId() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}
function newBoardState() {
  return { board: E.initialState(), state: E.freshState(), turn: 'w', uciHistory: [], halfmoveClock: 0, fullmoveNumber: 1 };
}

function createRoom(opts) {
  let id;
  do { id = genId(); } while (rooms.has(id));
  const now = Date.now();
  const room = {
    id, isPublic: !!opts.isPublic, hostUserId: opts.hostUserId,
    white: null, black: null, spectators: new Set(), chat: [],
    status: 'waiting', board: null, state: null, turn: 'w', uciHistory: [],
    halfmoveClock: 0, fullmoveNumber: 1,
    whiteTimeMs: START_TIME_MS, blackTimeMs: START_TIME_MS,
    lastTickAt: now, startedAt: now, endedAt: null, result: null, endReason: null,
    disconnectTimer: null, disconnectColor: null, createdAt: now
  };
  rooms.set(id, room);
  return room;
}

function startGame(room) {
  const bs = newBoardState();
  room.board = bs.board; room.state = bs.state; room.turn = 'w';
  room.uciHistory = []; room.halfmoveClock = 0; room.fullmoveNumber = 1;
  room.status = 'playing';
  room.whiteTimeMs = START_TIME_MS; room.blackTimeMs = START_TIME_MS;
  room.lastTickAt = Date.now(); room.startedAt = Date.now();
  room.endedAt = null; room.result = null; room.endReason = null;
  saveActive(room);
}
function saveActive(room) {
  db.saveActiveGame(room.id, {
    id: room.id, isPublic: room.isPublic, hostUserId: room.hostUserId,
    whiteUserId: room.white ? room.white.id : null,
    blackUserId: room.black ? room.black.id : null,
    status: room.status, uciHistory: room.uciHistory,
    whiteTimeMs: room.whiteTimeMs, blackTimeMs: room.blackTimeMs,
    startedAt: room.startedAt, chat: room.chat.slice(-100)
  });
}
function restoreRooms() {
  const active = db.loadActiveGames();
  for (const a of active) {
    const p = a.payload;
    if (p.status !== 'playing') continue;
    const room = {
      id: p.id, isPublic: !!p.isPublic, hostUserId: p.hostUserId,
      white: p.whiteUserId ? { id: p.whiteUserId, nickname: '—', rating: 1200, offline: true } : null,
      black: p.blackUserId ? { id: p.blackUserId, nickname: '—', rating: 1200, offline: true } : null,
      spectators: new Set(), chat: p.chat || [], status: 'playing',
      board: E.initialState(), state: E.freshState(), turn: 'w', uciHistory: [],
      halfmoveClock: 0, fullmoveNumber: 1,
      whiteTimeMs: p.whiteTimeMs, blackTimeMs: p.blackTimeMs,
      lastTickAt: Date.now(), startedAt: p.startedAt,
      endedAt: null, result: null, endReason: null,
      disconnectTimer: null, disconnectColor: null, createdAt: p.startedAt
    };
    for (const uci of (p.uciHistory || [])) {
      try {
        const from = E.uciToRC(uci.slice(0, 2));
        const to = E.uciToRC(uci.slice(2, 4));
        const promo = uci.length > 4 ? uci[4].toLowerCase() : null;
        const legal = E.getAllLegalMoves(room.board, room.turn, room.state);
        const move = legal.find(m =>
          m.from.r === from.r && m.from.c === from.c &&
          m.to.r === to.r && m.to.c === to.c &&
          (!m.promotion || m.promotion === promo));
        if (!move) break;
        E.applyMove(room.board, move, room.state);
        room.turn = E.other(room.turn);
        if (room.turn === 'w') room.fullmoveNumber++;
        room.uciHistory.push(uci);
      } catch (e) { break; }
    }
    rooms.set(room.id, room);
  }
  console.log('[rooms] Obnoveno', rooms.size, 'rozehraných místností.');
}

function publicRoomList() {
  const out = [];
  for (const room of rooms.values()) {
    if (!room.isPublic) continue;
    if (room.status !== 'waiting' && room.status !== 'playing') continue;
    out.push({ id: room.id, host: room.white ? room.white.nickname : '?', status: room.status, spectators: room.spectators.size });
  }
  return out;
}
function elapsedForColor(room) {
  const now = Date.now();
  const elapsed = now - room.lastTickAt;
  room.lastTickAt = now;
  if (room.status !== 'playing') return { whiteExpired: false, blackExpired: false };
  if (room.turn === 'w') { room.whiteTimeMs -= elapsed; return { whiteExpired: room.whiteTimeMs <= 0, blackExpired: false }; }
  room.blackTimeMs -= elapsed;
  return { whiteExpired: false, blackExpired: room.blackTimeMs <= 0 };
}
function clockSnapshot(room) {
  return { whiteTimeMs: Math.max(0, room.whiteTimeMs), blackTimeMs: Math.max(0, room.blackTimeMs), turn: room.turn, status: room.status };
}
function computeElo(ra, rb, scoreA) {
  const K = 32;
  const Ea = 1 / (1 + Math.pow(10, (rb - ra) / 400));
  return { a: Math.round(ra + K * (scoreA - Ea)), b: Math.round(rb + K * ((1 - scoreA) - (1 - Ea))) };
}

function endGame(room, result, reason) {
  if (room.status === 'ended') return;
  room.status = 'ended';
  room.endedAt = Date.now();
  room.result = result;
  room.endReason = reason;
  db.deleteActiveGame(room.id);

  if (room.white && room.black && !room.white.offline && !room.black.offline) {
    let scoreW = 0.5;
    if (result === '1-0') scoreW = 1;
    else if (result === '0-1') scoreW = 0;
    const elo = computeElo(room.white.rating, room.black.rating, scoreW);
    db.updateRating(room.white.id, elo.a, true);
    db.updateRating(room.black.id, elo.b, true);
    room.white.rating = elo.a;
    room.black.rating = elo.b;
  }

  let pgn = '';
  if (room.board) {
    try {
      let tmpBoard = E.initialState(); let tmpState = E.freshState(); let tmpTurn = 'w';
      const sans = [];
      for (const uci of room.uciHistory) {
        const from = E.uciToRC(uci.slice(0, 2));
        const to = E.uciToRC(uci.slice(2, 4));
        const promo = uci.length > 4 ? uci[4].toLowerCase() : null;
        const legal = E.getAllLegalMoves(tmpBoard, tmpTurn, tmpState);
        const move = legal.find(m =>
          m.from.r === from.r && m.from.c === from.c &&
          m.to.r === to.r && m.to.c === to.c &&
          (!m.promotion || m.promotion === promo));
        if (!move) break;
        sans.push(E.moveToSAN(tmpBoard, move, tmpState));
        E.applyMove(tmpBoard, move, tmpState);
        tmpTurn = E.other(tmpTurn);
      }
      let line = '';
      for (let i = 0; i < sans.length; i++) {
        if (i % 2 === 0) line += (i / 2 + 1) + '. ';
        line += sans[i] + ' ';
      }
      pgn = line.trim();
    } catch (e) {}
  }

  db.saveGame({
    id: room.id,
    whiteId: room.white ? room.white.id : null,
    blackId: room.black ? room.black.id : null,
    whiteNick: room.white ? room.white.nickname : null,
    blackNick: room.black ? room.black.nickname : null,
    pgn, result, reason,
    startedAt: room.startedAt
  });
}

function getRoom(id) { return rooms.get(id); }
function deleteRoom(id) {
  const room = rooms.get(id);
  if (!room) return;
  if (room.disconnectTimer) clearTimeout(room.disconnectTimer);
  rooms.delete(id);
}
function allRoomIds() { return Array.from(rooms.keys()); }

module.exports = {
  rooms, socketToRoom, socketToRole,
  createRoom, startGame, getRoom, deleteRoom, allRoomIds,
  publicRoomList, clockSnapshot, elapsedForColor,
  saveActive, endGame, restoreRooms,
  START_TIME_MS, INCREMENT_MS, RECONNECT_MS
};
