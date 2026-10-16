/* =========================================================================
Šachy – server/ai-client.js
Promise wrapper okolo ai-worker.js (Worker thread).
Udržuje jeden Worker a posílá mu požadavky přes zprávy.

Autor: Better DeepSeek (AI) · Zadavatel: Jan Hošek · 2026
SPDX-License-Identifier: GPL-3.0-or-later
========================================================================= */

'use strict';

const { Worker } = require('worker_threads');
const path = require('path');

let worker = null;
const pending = new Map();
let nextId = 1;

function getWorker() {
if (worker) return worker;
worker = new Worker(path.join(__dirname, 'ai-worker.js'));
worker.on('message', function (msg) {
const p = pending.get(msg.id);
if (!p) return;
pending.delete(msg.id);
if (msg.type === 'error') p.reject(new Error(msg.error));
else p.resolve({ move: msg.move, score: msg.score });
});
worker.on('error', function (err) {
for (const p of pending.values()) p.reject(err);
pending.clear();
worker = null;
});
worker.on('exit', function () {
worker = null;
});
return worker;
}

/* Vypočítá tah. Vrací Promise<{move, score}>. */
function computeMove(req, timeoutMs) {
const limit = timeoutMs || 15000;
return new Promise(function (resolve, reject) {
const id = nextId++;
const w = getWorker();
const timer = setTimeout(function () {
pending.delete(id);
reject(new Error('AI timeout (' + limit + ' ms)'));
}, limit);
pending.set(id, {
resolve: function (v) { clearTimeout(timer); resolve(v); },
reject: function (e) { clearTimeout(timer); reject(e); }
});
w.postMessage({
type: 'compute',
id: id,
board: req.board,
state: req.state,
turn: req.turn,
difficulty: req.difficulty || 'medium'
});
});
}

/* Zavře worker (volitelné). */
function shutdown() {
if (worker) {
try { worker.terminate(); } catch (e) {}
worker = null;
}
}

module.exports = { computeMove, shutdown };