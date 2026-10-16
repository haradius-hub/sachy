/* =========================================================================
Šachy – server/rate-limit.js
Token bucket limiter per IP.

- Kapacita: 60 tokenů.
- Doplnění: 10 tokenů/s.
- AI compute stojí 20 tokenů, login 5, create-room 3, ostatní 1.

Autor: Better DeepSeek (AI) · Zadavatel: Jan Hošek · 2026
SPDX-License-Identifier: GPL-3.0-or-later
========================================================================= */

'use strict';

const MAX_TOKENS = 60;
const REFILL_PER_SEC = 10;

const buckets = new Map();

function now() { return Date.now(); }

function getBucket(ip) {
let b = buckets.get(ip);
if (!b) {
b = { tokens: MAX_TOKENS, lastRefill: now() };
buckets.set(ip, b);
return b;
}
const elapsedSec = (now() - b.lastRefill) / 1000;
if (elapsedSec > 0) {
b.tokens = Math.min(MAX_TOKENS, b.tokens + elapsedSec * REFILL_PER_SEC);
b.lastRefill = now();
}
return b;
}

function allow(ip, cost) {
const c = cost || 1;
const b = getBucket(ip);
if (b.tokens >= c) {
b.tokens -= c;
return true;
}
return false;
}

/* Úklid neaktivních bucketů každou minutu (starší než 5 min). */
setInterval(function () {
const cutoff = now() - 5 * 60 * 1000;
for (const [ip, b] of buckets.entries()) {
if (b.lastRefill < cutoff) buckets.delete(ip);
}
}, 60 * 1000).unref();

module.exports = { allow };