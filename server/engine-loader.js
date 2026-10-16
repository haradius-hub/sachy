/* =========================================================================
   Načte engine.js (ten, co používá klient) do Node.js.
   Používá new Function() místo require, protože engine.js používá
   globální `var` a není CommonJS modul.
   Autor: Better DeepSeek (AI) · Zadavatel: Jan Hošek · 2026

   OPRAVA: přidán export hashPosition (pro trojí opakování v serveru).
   ========================================================================= */

const fs = require('fs');
const path = require('path');

const enginePath = path.join(__dirname, '..', 'engine.js');
const code = fs.readFileSync(enginePath, 'utf8');

const wrapped =
  code +
  '\nreturn {' +
  ' initialState, freshState, cloneBoard, cloneState, inBounds, other,' +
  ' findKing, moveToUCI, uciToRC, sameMove, isAttacked, pieceMoves,' +
  ' applyMove, getAllLegalMoves, inCheck, moveToSAN, normalizeSAN,' +
  ' hashPosition,' +
  ' MATE_SCORE, INFINITY_SCORE, VALUES, FILES, GLYPH' +
  ' };';

let engine;
try {
  engine = new Function(wrapped)();
} catch (err) {
  console.error('[engine-loader] Nepodařilo se načíst ../engine.js:', err.message);
  process.exit(1);
}

module.exports = engine;
