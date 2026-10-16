/* =========================================================================
Šachy – tests/perft.js
Perft: rekurzivní počítání listů do hloubky N.
Standardní test šachových engine.
Autor: Better DeepSeek (AI) · Zadavatel: Jan Hošek · 2026
SPDX-License-Identifier: GPL-3.0-or-later
========================================================================= */

'use strict';

const E = require('./engine-loader');

/* Perft – vrací počet listů (nebo počet legálních tahů v hloubce 1). */
function perft(board, state, color, depth) {
if (depth === 0) return 1;
const moves = E.getAllLegalMoves(board, color, state);
if (depth === 1) return moves.length;
let count = 0;
for (let i = 0; i < moves.length; i++) {
const b2 = E.cloneBoard(board);
const s2 = E.cloneState(state);
E.applyMove(b2, moves[i], s2);
count += perft(b2, s2, E.other(color), depth - 1);
}
return count;
}

/* Známé hodnoty z výchozí pozice. */
const INITIAL_PERFT = {
1: 20,
2: 400,
3: 8902,
4: 197281
};

module.exports = { perft, INITIAL_PERFT };