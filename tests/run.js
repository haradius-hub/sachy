/* =========================================================================
Šachy – tests/run.js
Jednoduchý spouštěč testů bez závislostí.
Autor: Better DeepSeek (AI) · Zadavatel: Jan Hošek · 2026
SPDX-License-Identifier: GPL-3.0-or-later
========================================================================= */

'use strict';

const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;

/* Test harness – injektovaný do test-*.js souborů jako globální `t`. */
function t(name, fn) {
try {
fn();
console.log('  \u2713 ' + name);
passed++;
} catch (err) {
console.error('  \u2717 ' + name);
console.error('     ' + (err && err.message ? err.message : err));
failed++;
}
}
global.t = t;

/* Najdi všechny test-*.js v této složce (bez run.js). */
const files = fs.readdirSync(__dirname)
.filter(f => /^test-.*.js$/.test(f))
.sort();

console.log('== Šachy testy ==');
console.log('Soubory: ' + files.length);
console.log('');

const t0 = Date.now();
for (const f of files) {
console.log('→ ' + f);
try {
require(path.join(__dirname, f));
} catch (err) {
console.error('  Selhalo načtení: ' + (err && err.message ? err.message : err));
failed++;
}
console.log('');
}
const elapsed = Date.now() - t0;

console.log('== Výsledek ==');
console.log('OK:     ' + passed);
console.log('Selhalo: ' + failed);
console.log('Čas:    ' + (elapsed / 1000).toFixed(2) + ' s');

process.exit(failed > 0 ? 1 : 0);