# Šachy ♟

Šachová hra do prohlížeče — singleplayer (AI, self-play, hot-seat),
hádanky, analýza, multiplayer, turnaje.

- **Autor kódu:** Better DeepSeek (AI)
- **Zadavatel:** Jan Hošek
- **Rok:** 2026 · **Licence:** GPL-3.0-or-later

## Novinky (Fáze B, 6. část)

### Testy pravidel + perft

- Složka `tests/` (bez závislostí, spouští se `node tests/run.js`).
- Perft z výchozí pozice (20, 400, 8902, 197281) — zlatý standard
šachových engine.
- Unit testy: rošáda, en passant, proměna, mat, pat, SAN, Zobrist.

### Server-side AI

- Volitelné: `?serverAI=1` v URL → AI počítá server, klient jen zobrazuje.
- Vhodné pro slabé klienty (tablety, mobily).
- Fallback: pokud server neodpovídá do 15 s, klient přepne na lokální AI.
- Nové soubory: `server/ai-worker.js`, `server/ai-client.js`,
`client-server-ai.js`.

### Rate limiting

- Token bucket per IP: 60 tokenů, 10/s refill.
- AI compute stojí 20 tokenů, login 5, create-room 3, ostatní 1.
- Ochrana proti spamu (login, chat, create-room).

### Rozšířená analýza

- Kategorie: **book**, **best**, **good**, **inaccuracy**, **mistake**,
**miss**, **blunder**.
- Accuracy podle Lichess vzorce (winPercent + exp decay), ne hrubé
`100 - loss/10`.
- Přesnější detekce přehlédnuté výhry (miss).

### Drobné bugy

- `saveGame` ukládá i `positionCounts`, `halfmoveClock`, `fullmoveNumber`,
`gameAnnotations`. Po nahrání se správně počítá trojí opakování
a 50-tah.
- Tooltip s hodnocením tahu se nezobrazuje v lite režimu.

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
- Analýza partie (report, graf, PGN a DOCX export, rozšířená klasifikace)
- Taktické hádanky (generované, 3 obtížnosti)
- Lehký režim (pro starý hardware)
- Detekce výkonu (bezpečná – na slabém HW nespouští benchmark)
- Server-side AI (volitelné `?serverAI=1`)
- Rate limiting na serveru
- Mizející upozornění na ŠACH / MAT / PAT / GARDE
- Export PGN/FEN, kopírování do schránky
- Tři témata, AI ve Web Workeru

## Struktura (nové soubory ve Fázi B, 6. část)

```
tests/
├── run.js               – spouštěč testů
├── engine-loader.js     – načte ../server/engine-loader.js
├── perft.js             – perft rekurze
├── test-rules.js        – testy pravidel
└── test-perft.js        – testy perft

server/
├── ai-worker.js         – Worker thread s enginem
├── ai-client.js         – Promise wrapper
└── rate-limit.js        – token bucket per IP

client-server-ai.js      – klient pro ?serverAI=1
```

### Pořadí načítání skriptů

`engine.js` → `openings-extra.js` → `game.js` → `analysis.js` →
`analysis-export.js` → `extras.js` → `ui-extras.js` → `puzzles.js` →
`puzzles-v2.js` → `hotseat.js` → `lite-mode.js` → `notice.js` →
`garde.js` → `worker-ai.js` → `client-net.js` → `client-server-ai.js` →
`tournament-client.js` → `push-client.js` → `polish-extras.js` →
`copy-extras.js` → `pwa.js` → `perf-detect.js`

## Testy

```
node tests/run.js
```

Očekávaný výstup:

```
== Šachy testy ==
→ test-perft.js
  ✓ Perft (1) = 20
  ✓ Perft (2) = 400
  ✓ Perft (3) = 8902
  ✓ Perft (4) = 197281
→ test-rules.js
  ✓ Výchozí pozice: 20 legálních tahů
  ✓ ...
== Výsledek ==
OK:     20
Selhalo: 0
```

## Server-side AI

Volitelné. Zapne se přepínačem v URL:

```
https://<host>/chess/?serverAI=1
```

Klient pošle pozici přes WebSocket (`ai-compute`), server spočítá
ve worker thread (`server/ai-worker.js`) a pošle zpět (`ai-result`).
Timeout 15 s, potom klient spadne na lokální AI.

## Licence

GPL-3.0-or-later, bez jakékoli záruky. Viz `LICENSE`.