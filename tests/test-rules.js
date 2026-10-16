/* =========================================================================
Šachy – tests/test-rules.js
Unit testy pravidel šachu.
Autor: Better DeepSeek (AI) · Zadavatel: Jan Hošek · 2026
SPDX-License-Identifier: GPL-3.0-or-later
========================================================================= */

'use strict';

const E = require('./engine-loader');

/* Pomocná funkce: převede UCI řetězec na legální tah v dané pozici. */
function uciToMove(board, state, color, uci) {
const from = E.uciToRC(uci.slice(0, 2));
const to = E.uciToRC(uci.slice(2, 4));
const promo = uci.length > 4 ? uci[4].toLowerCase() : null;
const legal = E.getAllLegalMoves(board, color, state);
for (let i = 0; i < legal.length; i++) {
const m = legal[i];
if (m.from.r === from.r && m.from.c === from.c &&
m.to.r === to.r && m.to.c === to.c) {
if (m.promotion && promo && m.promotion !== promo) continue;
return m;
}
}
return null;
}

/* Zahraje posloupnost UCI tahů. Vrací barvu, která je na tahu. */
function playMoves(board, state, color, uciList) {
for (let i = 0; i < uciList.length; i++) {
const m = uciToMove(board, state, color, uciList[i]);
if (!m) throw new Error('Nelegální setup tah: ' + uciList[i]);
E.applyMove(board, m, state);
color = E.other(color);
}
return color;
}

/* ---------- 1) Výchozí pozice ---------- */

t('Výchozí pozice: 20 legálních tahů', () => {
const b = E.initialState(), s = E.freshState();
const moves = E.getAllLegalMoves(b, 'w', s);
if (moves.length !== 20) throw new Error('expected 20, got ' + moves.length);
});

t('Výchozí pozice: černý má po 1.e4 také 20 tahů', () => {
const b = E.initialState(), s = E.freshState();
playMoves(b, s, 'w', ['e2e4']);
const moves = E.getAllLegalMoves(b, 'b', s);
if (moves.length !== 20) throw new Error('expected 20, got ' + moves.length);
});

/* ---------- 2) Rošáda ---------- */

t('Krátká rošáda: bílý může po uvolnění cesty', () => {
const b = E.initialState(), s = E.freshState();
playMoves(b, s, 'w', ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8c5']);
const moves = E.getAllLegalMoves(b, 'w', s);
const castle = moves.find(m => m.castle === 'k');
if (!castle) throw new Error('krátká rošáda chybí');
});

t('Krátká rošáda: nelze přes šach', () => {
// Bílý král e1, černá věž na e8 → pole e1 je v šachu, rošáda není.
const b = E.initialState(), s = E.freshState();
// Vyčisti cesty a umísti černou věž na e8
playMoves(b, s, 'w', ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8c5']);
// Ručně přesuň černou věž z a8 na e8
b[0][4] = { type: 'r', color: 'b' };
b[0][0] = null;
const moves = E.getAllLegalMoves(b, 'w', s);
const castle = moves.find(m => m.castle === 'k');
if (castle) throw new Error('krátká rošáda nemá být možná (šach na e1)');
});

/* ---------- 3) En passant ---------- */

t('En passant: bílý pěšec může vzít en passant', () => {
const b = E.initialState(), s = E.freshState();
playMoves(b, s, 'w', ['e2e4', 'a7a6', 'e4e5', 'd7d5']);
const moves = E.getAllLegalMoves(b, 'w', s);
const ep = moves.find(m => m.enPassant);
if (!ep) throw new Error('en passant chybí');
if (ep.to.r !== 2 || ep.to.c !== 3) throw new Error('en passant na špatné pole');
});

t('En passant: po dvou tazích už není dostupný', () => {
const b = E.initialState(), s = E.freshState();
playMoves(b, s, 'w', ['e2e4', 'a7a6', 'e4e5', 'd7d5', 'g1f3', 'a6a5']);
const moves = E.getAllLegalMoves(b, 'w', s);
const ep = moves.find(m => m.enPassant);
if (ep) throw new Error('en passant nemá být po dvou tazích');
});

/* ---------- 4) Proměna ---------- */

t('Proměna: pěšec na 7. řadě má 4 proměny (D/V/S/J)', () => {
const b = E.initialState(), s = E.freshState();
// Vyčisti pole a umísti bílého pěšce na a7
playMoves(b, s, 'w', ['a2a4', 'h7h6', 'a4a5', 'h6h5', 'a5a6', 'h5h4', 'a6a7']);
const moves = E.getAllLegalMoves(b, 'w', s);
const promos = moves.filter(m => m.from.r === 1 && m.from.c === 0 && m.promotion);
if (promos.length !== 4) throw new Error('expected 4 promoce, got ' + promos.length);
const kinds = promos.map(m => m.promotion).sort().join('');
if (kinds !== 'bqnr') throw new Error('expected bqnr, got ' + kinds);
});

/* ---------- 5) Mat a pat ---------- */

t('Mat: bláznův mat (1.f3 e5 2.g4 Qh4#)', () => {
const b = E.initialState(), s = E.freshState();
playMoves(b, s, 'w', ['f2f3', 'e7e5', 'g2g4', 'd8h4']);
const moves = E.getAllLegalMoves(b, 'w', s);
if (moves.length !== 0) throw new Error('expected 0 tahů po matu');
if (!E.inCheck(b, 'w', s)) throw new Error('král má být v šachu');
});

t('Pat: černý král v rohu bez tahu, ale není v šachu', () => {
// Ručně postav pozici: bK h8, wQ g6, wK a1
const b = E.initialState(), s = E.freshState();
// Vyčisti
for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) b[r][c] = null;
b[7][7] = { type: 'k', color: 'b' };  // h8
b[2][6] = { type: 'q', color: 'w' };  // g6
b[7][0] = { type: 'k', color: 'w' };  // a1
const moves = E.getAllLegalMoves(b, 'b', s);
if (moves.length !== 0) throw new Error('expected 0 tahů, got ' + moves.length);
if (E.inCheck(b, 'b', s)) throw new Error('král nemá být v šachu – má být pat');
});

/* ---------- 6) SAN notace ---------- */

t('SAN: dvě dámy na stejné řadě → dezambiguace', () => {
// Jednodušší: dvě věže na a1 a h1, obě mohou na d1
const b = E.initialState(), s = E.freshState();
for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) b[r][c] = null;
b[7][4] = { type: 'k', color: 'w' };  // e1
b[0][4] = { type: 'k', color: 'b' };  // e8
b[7][0] = { type: 'r', color: 'w' };  // a1
b[7][7] = { type: 'r', color: 'w' };  // h1
const moves = E.getAllLegalMoves(b, 'w', s);
const d1 = moves.find(m => m.from.r === 7 && m.from.c === 0 && m.to.r === 7 && m.to.c === 3);
if (!d1) throw new Error('tah Rad1 nenalezen');
const san = E.moveToSAN(b, d1, s);
if (san.indexOf('R') !== 0) throw new Error('SAN má začínat R: ' + san);
if (san.indexOf('a') < 0) throw new Error('SAN má obsahovat dezambiguaci a: ' + san);
});

/* ---------- 7) Zobrist hash ---------- */

t('Zobrist: stejná pozice → stejný hash', () => {
const b = E.initialState(), s = E.freshState();
const h1 = E.hashPosition(b, s, 'w');
const b2 = E.initialState(), s2 = E.freshState();
const h2 = E.hashPosition(b2, s2, 'w');
if (h1 !== h2) throw new Error('hashe se liší: ' + h1 + ' vs ' + h2);
});

t('Zobrist: jiný tah → jiný hash', () => {
const b = E.initialState(), s = E.freshState();
const h1 = E.hashPosition(b, s, 'w');
playMoves(b, s, 'w', ['e2e4']);
const h2 = E.hashPosition(b, s, 'b');
if (h1 === h2) throw new Error('hashe mají být různé');
});

/* ---------- 8) Šach ---------- */

t('Šach: král je v šachu po tahu dámou', () => {
const b = E.initialState(), s = E.freshState();
playMoves(b, s, 'w', ['e2e4', 'e7e5', 'f1c4', 'b8c6', 'd1h5', 'g8f6', 'h5f7']);
// Po Qxf7 je černý král v šachu
if (!E.inCheck(b, 'b', s)) throw new Error('černý král má být v šachu po Qxf7');
});