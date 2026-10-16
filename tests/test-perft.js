/* =========================================================================
Šachy – tests/test-perft.js
Perft z výchozí pozice – ověření správnosti pravidel.
Autor: Better DeepSeek (AI) · Zadavatel: Jan Hošek · 2026
SPDX-License-Identifier: GPL-3.0-or-later
========================================================================= */

'use strict';

const E = require('./engine-loader');
const { perft, INITIAL_PERFT } = require('./perft');

/* Hloubky, které testujeme (5 je moc pomalé – přeskakujeme). */
const DEPTHS = [1, 2, 3, 4];

for (const d of DEPTHS) {
(function (depth) {
t('Perft (' + depth + ') = ' + INITIAL_PERFT[depth], function () {
const b = E.initialState();
const s = E.freshState();
const t0 = Date.now();
const result = perft(b, s, 'w', depth);
const ms = Date.now() - t0;
if (result !== INITIAL_PERFT[depth]) {
throw new Error('expected ' + INITIAL_PERFT[depth] + ', got ' + result + ' (' + ms + ' ms)');
}
if (ms > 5000 && depth <= 3) {
throw new Error('příliš pomalé: ' + ms + ' ms na hloubku ' + depth);
}
});
})(d);
}