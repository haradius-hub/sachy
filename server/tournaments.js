/* =========================================================================
   Turnajový režim (single elimination / pavouk)
   Autor: Better DeepSeek (AI) · Zadavatel: Jan Hošek · 2026
   SPDX-License-Identifier: GPL-3.0-or-later

   Pravidla:
     - 4, 8 nebo 16 hráčů (mocnina dvou)
     - Single elimination (jeden zápas, kdo prohraje, vypadává)
     - Remíza: partie se opakuje s PROHOZENÝMI barvami
       (tj. kdo měl bílé, teď hraje černé a naopak)
     - Po 5 remízách v řadě se rozhodne podle ELO (krajní řešení,
       aby turnaj mohl skončit)
   ========================================================================= */

const ALLOWED_SIZES = [4, 8, 16];
const MAX_REPLAYS = 5;

const tournaments = new Map();
const roomToTournament = new Map();

function genId() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

function createTournament({ hostId, hostNick, size, name }) {
  if (!ALLOWED_SIZES.includes(size)) throw new Error('Velikost musí být 4, 8 nebo 16.');
  let id;
  do { id = genId(); } while (tournaments.has(id));
  const t = {
    id,
    name: name || ('Turnaj ' + id),
    hostId,
    size,
    status: 'waiting',
    players: [{ userId: hostId, nickname: hostNick, eliminated: false }],
    bracket: null,
    matches: [],
    currentRound: 0,
    winner: null,
    createdAt: Date.now(),
    chat: []
  };
  tournaments.set(id, t);
  return t;
}

function getTournament(id) { return tournaments.get(id); }

function joinTournament(tid, userId, nickname) {
  const t = tournaments.get(tid);
  if (!t) return { error: 'Turnaj neexistuje.' };
  if (t.status !== 'waiting') return { error: 'Turnaj už začal.' };
  if (t.players.length >= t.size) return { error: 'Turnaj je plný.' };
  if (t.players.some(p => p.userId === userId)) return { error: 'Už jsi přihlášen.' };
  t.players.push({ userId, nickname, eliminated: false });
  return { ok: true, tournament: t };
}

function leaveTournament(tid, userId) {
  const t = tournaments.get(tid);
  if (!t) return { error: 'Turnaj neexistuje.' };
  if (t.status !== 'waiting') return { error: 'Turnaj už začal.' };
  const idx = t.players.findIndex(p => p.userId === userId);
  if (idx < 0) return { error: 'Nejsi přihlášen.' };
  t.players.splice(idx, 1);
  return { ok: true, tournament: t };
}

function startTournament(tid, userId) {
  const t = tournaments.get(tid);
  if (!t) return { error: 'Turnaj neexistuje.' };
  if (t.hostId !== userId) return { error: 'Jen hostitel může spustit turnaj.' };
  if (t.status !== 'waiting') return { error: 'Turnaj už byl spuštěn.' };
  if (t.players.length !== t.size) return { error: 'Turnaj není plný (' + t.players.length + '/' + t.size + ').' };

  const players = t.players.slice();
  for (let i = players.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [players[i], players[j]] = [players[j], players[i]];
  }

  const rounds = Math.log2(t.size);
  const bracket = [];
  for (let r = 0; r < rounds; r++) {
    const matchesInRound = t.size / Math.pow(2, r + 1);
    const round = [];
    for (let m = 0; m < matchesInRound; m++) {
      round.push({
        id: 'r' + r + 'm' + m,
        round: r,
        position: m,
        whiteId: null, whiteNick: null,
        blackId: null, blackNick: null,
        roomId: null,
        winnerId: null,
        winnerNick: null,
        status: 'pending',
        replayCount: 0,
        previousRooms: [] // historie odchraných pokusů (pro případnou analýzu)
      });
    }
    bracket.push(round);
  }

  const firstRound = bracket[0];
  for (let m = 0; m < firstRound.length; m++) {
    const w = players[m * 2];
    const b = players[m * 2 + 1];
    firstRound[m].whiteId = w.userId;
    firstRound[m].whiteNick = w.nickname;
    firstRound[m].blackId = b.userId;
    firstRound[m].blackNick = b.nickname;
    firstRound[m].status = 'ready';
  }

  t.bracket = bracket;
  t.matches = [];
  t.currentRound = 0;
  t.status = 'playing';
  for (const round of bracket) for (const m of round) t.matches.push(m);
  return { ok: true, tournament: t };
}

function getMatch(t, matchId) {
  return t.matches.find(m => m.id === matchId) || null;
}

/*
  Zaznamená výsledek zápasu.
  Při remíze vrátí { rematch:true, match } a připraví zápas na opakování
  s prohozenými barvami. Po MAX_REPLAYS remízách se rozhodne podle ELO.
  Při vítězství postoupí vítěz.
*/
function recordMatchResult(t, matchId, winnerId, winnerNick, opts) {
  const m = getMatch(t, matchId);
  if (!m) return { error: 'Zápas nenalezen.' };
  if (m.status === 'done') return { error: 'Zápas už má výsledek.' };

  // Remíza s prohozením barev
  if (opts && opts.isDraw) {
    m.replayCount = (m.replayCount || 0) + 1;
    if (m.roomId) m.previousRooms.push(m.roomId);

    // Po MAX_REPLAYS remíz se rozhodne podle ELO
    if (m.replayCount >= MAX_REPLAYS) {
      return resolveByElo(t, m);
    }

    // Prohoď barvy a připrav rematch
    const tmpId = m.whiteId;
    const tmpNick = m.whiteNick;
    m.whiteId = m.blackId;
    m.whiteNick = m.blackNick;
    m.blackId = tmpId;
    m.blackNick = tmpNick;
    m.roomId = null;
    m.status = 'ready';
    return { ok: true, tournament: t, rematch: true, match: m };
  }

  // Rozhodující výsledek
  m.winnerId = winnerId;
  m.winnerNick = winnerNick;
  m.status = 'done';
  if (m.roomId) m.previousRooms.push(m.roomId);

  const loserId = (m.whiteId === winnerId) ? m.blackId : m.whiteId;
  const loser = t.players.find(p => p.userId === loserId);
  if (loser) loser.eliminated = true;

  const nextRound = m.round + 1;
  if (nextRound < t.bracket.length) {
    const nextMatchPos = Math.floor(m.position / 2);
    const nextMatch = t.bracket[nextRound][nextMatchPos];
    const isWhite = (m.position % 2 === 0);
    if (isWhite) { nextMatch.whiteId = winnerId; nextMatch.whiteNick = winnerNick; }
    else { nextMatch.blackId = winnerId; nextMatch.blackNick = winnerNick; }
    if (nextMatch.whiteId && nextMatch.blackId) nextMatch.status = 'ready';
  } else {
    t.status = 'finished';
    t.winner = { userId: winnerId, nickname: winnerNick };
  }
  return { ok: true, tournament: t };
}

/* Krajní řešení – po mnoha remízách rozhodne ELO hráčů. */
function resolveByElo(t, m) {
  const white = t.players.find(p => p.userId === m.whiteId);
  const black = t.players.find(p => p.userId === m.blackId);
  // Fallback: pokud nemáme ELO, rozhodne aktuální hráč s bílými
  let winnerId, winnerNick;
  if (white && black) {
    // Použijeme rating z dat (může být 1200 default)
    const wRating = white.rating || 1200;
    const bRating = black.rating || 1200;
    if (wRating >= bRating) { winnerId = m.whiteId; winnerNick = m.whiteNick; }
    else { winnerId = m.blackId; winnerNick = m.blackNick; }
  } else {
    winnerId = m.whiteId; winnerNick = m.whiteNick;
  }
  m.winnerId = winnerId;
  m.winnerNick = winnerNick;
  m.status = 'done';
  m.resolvedByElo = true;

  const loserId = (m.whiteId === winnerId) ? m.blackId : m.whiteId;
  const loser = t.players.find(p => p.userId === loserId);
  if (loser) loser.eliminated = true;

  const nextRound = m.round + 1;
  if (nextRound < t.bracket.length) {
    const nextMatchPos = Math.floor(m.position / 2);
    const nextMatch = t.bracket[nextRound][nextMatchPos];
    const isWhite = (m.position % 2 === 0);
    if (isWhite) { nextMatch.whiteId = winnerId; nextMatch.whiteNick = winnerNick; }
    else { nextMatch.blackId = winnerId; nextMatch.blackNick = winnerNick; }
    if (nextMatch.whiteId && nextMatch.blackId) nextMatch.status = 'ready';
  } else {
    t.status = 'finished';
    t.winner = { userId: winnerId, nickname: winnerNick };
  }
  return { ok: true, tournament: t, resolvedByElo: true, match: m };
}

function assignRoomToMatch(t, matchId, roomId) {
  const m = getMatch(t, matchId);
  if (!m) return;
  m.roomId = roomId;
  m.status = 'playing';
  roomToTournament.set(roomId, t.id);
}

function getTournamentByRoom(roomId) {
  const tid = roomToTournament.get(roomId);
  if (!tid) return null;
  return tournaments.get(tid) || null;
}

function removeRoomMapping(roomId) { roomToTournament.delete(roomId); }

function findNextReadyMatch(t) {
  for (let r = 0; r < t.bracket.length; r++) {
    for (const m of t.bracket[r]) if (m.status === 'ready') return m;
  }
  return null;
}

function publicTournamentList() {
  const out = [];
  for (const t of tournaments.values()) {
    if (t.status === 'waiting') {
      out.push({
        id: t.id,
        name: t.name,
        host: t.players.length > 0 ? t.players[0].nickname : '?',
        size: t.size,
        players: t.players.length
      });
    }
  }
  return out;
}

function cleanupFinishedTournaments() {
  const now = Date.now();
  for (const [id, t] of tournaments.entries()) {
    if (t.status === 'finished' && now - t.createdAt > 24 * 3600 * 1000) {
      tournaments.delete(id);
    }
  }
}
setInterval(cleanupFinishedTournaments, 60 * 60 * 1000);

module.exports = {
  tournaments,
  createTournament, getTournament, joinTournament, leaveTournament, startTournament,
  recordMatchResult, assignRoomToMatch, getTournamentByRoom, removeRoomMapping,
  findNextReadyMatch, publicTournamentList,
  MAX_REPLAYS
};
