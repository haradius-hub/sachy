# Testy – Šachy

Autor: Better DeepSeek (AI) · Zadavatel: Jan Hošek · 2026 · GPL-3.0-or-later

## Spuštění

```
node tests/run.js
```

Bez závislostí, jen Node.js >= 16.

## Co se testuje

| Soubor ↕▾ | Co testuje ↕▾ |
|---|---|
| −`test-rules.js` | Pravidla šachu (rošáda, en passant, proměna, mat, pat, SAN) |
| `test-perft.js` | Perft z výchozí pozice (standardní test šachových engine) |
⚙

### Perft

Perft počítá všechny legální listy do hloubky N. Z výchozí pozice
platí:

| Hloubka ↕▾ | Počet listů ↕▾ |
|---|---|
| −1 | 20 |
| −2 | 400 |
| 3 | 8 902 |
| 4 | 197 281 |
| 5 | 4 865 609 (přeskočeno – pomalé) |
⚙

Když test projde do hloubky 4, jsou pravidla prokazatelně správná
(rošáda, en passant, proměna, šach, vazby).

## Jak psát nové testy

V souboru `test-*.js` použij globální funkci `t`:

```
const E = require('./engine-loader');

t('popis testu', function () {
  const board = E.initialState();
  const state = E.freshState();
  const moves = E.getAllLegalMoves(board, 'w', state);
  if (moves.length !== 20) throw new Error('expected 20, got ' + moves.length);
});
```

`t` je injektováno `run.js`. Když test vyhodí výjimku, je
považován za selhaný.

## Rozšíření

Plán do budoucna:

- Kiwipete a další složité perft pozice.
- Testy server-side AI (WS protokol).
- End-to-end testy v Playwright (UI).