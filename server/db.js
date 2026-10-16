/* =========================================================================
   SQLite – uživatelé, sessions, partie, historie, push subscription.
   Autor: Better DeepSeek (AI) · Zadavatel: Jan Hošek · 2026
   SPDX-License-Identifier: GPL-3.0-or-later
   ========================================================================= */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'sachy.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nickname TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    rating INTEGER NOT NULL DEFAULT 1200,
    games_played INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS games (
    id TEXT PRIMARY KEY,
    white_id INTEGER,
    black_id INTEGER,
    white_nick TEXT,
    black_nick TEXT,
    pgn TEXT,
    result TEXT,
    reason TEXT,
    started_at INTEGER,
    ended_at INTEGER
  );
  CREATE TABLE IF NOT EXISTS active_games (
    id TEXT PRIMARY KEY,
    payload TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS push_subscriptions (
    endpoint TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    subscription TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_games_white ON games(white_id);
  CREATE INDEX IF NOT EXISTS idx_games_black ON games(black_id);
  CREATE INDEX IF NOT EXISTS idx_games_ended ON games(ended_at);
  CREATE INDEX IF NOT EXISTS idx_push_user ON push_subscriptions(user_id);
`);

function hashPassword(password, salt) { return crypto.scryptSync(password, salt, 64).toString('hex'); }

function registerOrLogin(nickname, password) {
  nickname = String(nickname || '').trim();
  if (nickname.length < 2 || nickname.length > 24) return { error: 'Přezdívka musí být 2–24 znaků.' };
  if (password && password.length < 3) return { error: 'Heslo musí být aspoň 3 znaky.' };
  const existing = db.prepare('SELECT * FROM users WHERE nickname = ?').get(nickname);
  if (existing) {
    if (!password) return { error: 'Přezdívka je obsazená, zadej heslo.' };
    if (hashPassword(password, existing.salt) !== existing.password_hash) return { error: 'Špatné heslo.' };
    return issueToken(existing);
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const pass = password || crypto.randomBytes(12).toString('hex');
  const password_hash = hashPassword(pass, salt);
  const info = db.prepare('INSERT INTO users (nickname, password_hash, salt, created_at) VALUES (?, ?, ?, ?)')
    .run(nickname, password_hash, salt, Date.now());
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  return issueToken(user);
}
function issueToken(user) {
  const token = crypto.randomBytes(24).toString('hex');
  db.prepare('INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)').run(token, user.id, Date.now());
  return { user: publicUser(user), token };
}
function publicUser(row) { return { id: row.id, nickname: row.nickname, rating: row.rating, games_played: row.games_played }; }
function userByToken(token) {
  if (!token) return null;
  const row = db.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?').get(token);
  return row ? publicUser(row) : null;
}
function updateRating(id, rating, addGame) {
  if (addGame) db.prepare('UPDATE users SET rating = ?, games_played = games_played + 1 WHERE id = ?').run(rating, id);
  else db.prepare('UPDATE users SET rating = ? WHERE id = ?').run(rating, id);
}
function saveGame(g) {
  db.prepare('INSERT OR REPLACE INTO games (id, white_id, black_id, white_nick, black_nick, pgn, result, reason, started_at, ended_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(g.id, g.whiteId || null, g.blackId || null, g.whiteNick || null, g.blackNick || null,
      g.pgn || '', g.result || '*', g.reason || '', g.startedAt || Date.now(), Date.now());
}
function saveActiveGame(id, payload) {
  db.prepare('INSERT OR REPLACE INTO active_games (id, payload, updated_at) VALUES (?, ?, ?)').run(id, JSON.stringify(payload), Date.now());
}
function deleteActiveGame(id) { db.prepare('DELETE FROM active_games WHERE id = ?').run(id); }
function loadActiveGames() {
  const rows = db.prepare('SELECT id, payload FROM active_games').all();
  return rows.map(r => { try { return { id: r.id, payload: JSON.parse(r.payload) }; } catch (e) { return null; } }).filter(Boolean);
}
function getTopPlayers(limit) {
  return db.prepare('SELECT nickname, rating, games_played FROM users ORDER BY rating DESC LIMIT ?').all(limit || 10);
}
function gamesByUser(userId, limit) {
  if (!userId) return [];
  const rows = db.prepare(`
    SELECT id, white_id, black_id, white_nick, black_nick, result, reason, started_at, ended_at
    FROM games WHERE white_id = ? OR black_id = ?
    ORDER BY ended_at DESC LIMIT ?`).all(userId, userId, limit || 30);
  return rows.map(r => ({
    id: r.id,
    white: r.white_nick || (r.white_id ? '(hráč #' + r.white_id + ')' : '?'),
    black: r.black_nick || (r.black_id ? '(hráč #' + r.black_id + ')' : '?'),
    result: r.result, reason: r.reason, startedAt: r.started_at, endedAt: r.ended_at,
    myColor: r.white_id === userId ? 'w' : 'b'
  }));
}
function gamePgn(gameId) {
  const row = db.prepare('SELECT pgn FROM games WHERE id = ?').get(gameId);
  return row ? row.pgn : null;
}

/* ---------- Push subscriptions ---------- */
function savePushSubscription(userId, subscription) {
  if (!userId || !subscription || !subscription.endpoint) return;
  db.prepare('INSERT OR REPLACE INTO push_subscriptions (endpoint, user_id, subscription, created_at) VALUES (?, ?, ?, ?)')
    .run(subscription.endpoint, userId, JSON.stringify(subscription), Date.now());
}
function removePushSubscription(endpoint) {
  if (!endpoint) return;
  db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(endpoint);
}
function pushSubscriptionsByUser(userId) {
  if (!userId) return [];
  const rows = db.prepare('SELECT subscription FROM push_subscriptions WHERE user_id = ?').all(userId);
  return rows.map(r => { try { return JSON.parse(r.subscription); } catch (e) { return null; } }).filter(Boolean);
}

module.exports = {
  registerOrLogin, userByToken, updateRating, saveGame,
  saveActiveGame, deleteActiveGame, loadActiveGames, getTopPlayers,
  gamesByUser, gamePgn,
  savePushSubscription, removePushSubscription, pushSubscriptionsByUser
};
