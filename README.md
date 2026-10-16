# Šachy ♟

Šachová hra do prohlížeče — singleplayer (AI, self-play, hot-seat),
hádanky, analýza, multiplayer, turnaje.

- **Autor kódu:** Better DeepSeek (AI)
- **Zadavatel:** Jan Hošek
- **Rok:** 2026 · **Licence:** GPL-3.0-or-later

## Novinky (Fáze B, 5. část)

### Hlášení „Garde!"
Klasická šachová etiketa — když po tvém tahu zůstane soupeřova **dáma**
napadená a nekrytá, objeví se uprostřed šachovnice mizející text
**„GARDE – dáma!"** (modré pozadí) a zahraje tichý tón.

- Hlásí se **jen při hře člověka proti člověku** (hot-seat, multiplayer).
  Vůči AI se nehlásí – ta si to „všimne" sama.
- Hlásí se jen **v momentě, kdy hrozba vznikla**, ne opakovaně.
- Volitelně lze hlásit i **věž** (checkbox „Hlásit i věž").
- Vypínač v panelu Vzhled: **„Hlásit garde"**.

## Co hra umí (přehled)

### Režimy
- Singleplayer proti AI (5 obtížností)
- AI vs AI (self-play)
- Hot-seat (dva hráči u jednoho PC)
- Multiplayer (síť, WebSocket, ELO, chat, historie)
- Turnaje (pavouk 4/8/16)

### Funkce
- Kompletní pravidla (rošáda, en passant, proměna, mat, pat, remízy)
- PWA (instalace, offline režim), Web Push notifikace
- Analýza partie (report, graf, PGN a DOCX export)
- Taktické hádanky (generované, 3 obtížnosti)
- Lehký režim (pro starý hardware)
- Detekce výkonu (bezpečná – na slabém HW nespouští benchmark)
- **Mizející upozornění** na ŠACH / MAT / PAT / **GARDE**
- Export PGN/FEN, kopírování do schránky
- Tři témata, AI ve Web Workeru

## Struktura (nové soubory)

```

garde.js        – hlášení ohrožené dámy (etiketa)

```

### Pořadí načítání skriptů
`engine.js` → `openings-extra.js` → `game.js` → `analysis.js` →
`analysis-export.js` → `extras.js` → `ui-extras.js` → `puzzles.js` →
`puzzles-v2.js` → `hotseat.js` → `lite-mode.js` → `notice.js` →
`garde.js` → `worker-ai.js` → `client-net.js` →
`tournament-client.js` → `push-client.js` → `polish-extras.js` →
`copy-extras.js` → `pwa.js` → `perf-detect.js`

## Licence
GPL-3.0-or-later, bez jakékoli záruky. Viz `LICENSE`.
