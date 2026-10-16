/* =========================================================================
Šachy – server/ai-worker.js
Worker thread, který spouští engine search (aby hlavní vlákno
serveru nezamrzlo na pár sekund).

Protokol (parent ↔ worker):
rodič → worker: { id, board, state, turn, difficulty }
worker → rodič: { type: 'result', id, move: 'e2e4', score }
nebo { type: 'error', id, error }

Autor: Better DeepSeek (AI) · Zadavatel: Jan Hošek · 2026
SPDX-License-Identifier: GPL-3.0-or-later
========================================================================= */

'use strict';

const { parentPort } = require('worker_threads');
const path = require('path');
const E = require(path.join(__dirname, 'engine-loader.js'));

parentPort.on('message', function (msg) {
if (!msg || msg.type !== 'compute') return;
try {
const result = computeMove(msg);
parentPort.postMessage({
type: 'result',
id: msg.id,
move: result.move,
score: result.score
});
} catch (err) {
parentPort.postMessage({
type: 'error',
id: msg.id,
error: String(err && err.message ? err.message : err)
});
}
});

function computeMove(req) {
const difficulty = req.difficulty || 'medium';
const cfg = E.AI_CONFIG[difficulty] || E.AI_CONFIG.medium;
const board = req.board;
const state = req.state;
const turn = req.turn;

if (!board || !state || !turn) {
throw new Error('Chybí board/state/turn.');
}

const move = E.searchIterative(
board, state, turn,
cfg.maxDepth, cfg.timeMs, cfg.useQ
);

if (!move) return { move: null, score: 0 };
return { move: E.moveToUCI(move), score: 0 };
}