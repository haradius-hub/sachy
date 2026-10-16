# Fáze B, 6. část – velký balíček vylepšení

Autor: Better DeepSeek (AI) · Zadavatel: Jan Hošek · 2026
Licence: GPL-3.0-or-later

Tato část přidává pět okruhů vylepšení v jednom balíčku, seřazených
podle hodnoty (co nejvíc pomůže kvalitě):

1. **Testy pravidel + perft** — jistota, že engine počítá správně.
2. **Server-side AI** — AI na serveru, klient jen zobrazuje.
3. **Rate limiting** — ochrana serveru proti spamu.
4. **Rozšířená analýza** — brilliant / miss / book klasifikace + přesnější accuracy.
5. **Drobné bugy** — saveGame, tooltip v lite režimu.

## 1. Testy pravidel + perft

Nový adresář `tests/`:

- `tests/run.js` — spouštěč (bez závislostí, stačí `node tests/run.js`).
- `tests/engine-loader.js` — načte `../server/engine-loader.js`.
- `tests/perft.js` — implementace perftu (standardní test šachových engine).
- `tests/test-rules.js` — unit testy (rošáda, en passant, proměna, mat, pat).
- `tests/test-perft.js` — perft z výchozí pozice (20, 400, 8902, 197281).

Perft je **zlatý standard** — když sedí do hloubky 4, jsou pravidla
prokazatelně správná.

## 2. Server-side AI

Nové soubory:

- `server/ai-worker.js` — Worker thread, který spouští engine search.
- `server/ai-client.js` — Promise wrapper okolo workeru.
- `client-server-ai.js` — klientský override `triggerAI`, když je
v URL `?serverAI=1`.

Klient se rozhodne: buď počítá sám (lokální worker), nebo pošle
pozici serveru a čeká na výsledek. Server odpovídá do 15 s, jinak
klient spadne zpět na lokální AI.

WebSocket zprávy:

- `ai-compute` → `{ id, board, state, turn, difficulty }`
- `ai-result` → `{ id, move: 'e2e4', score }`
- `ai-error` → `{ id, error }`

## 3. Rate limiting

Nový soubor `server/rate-limit.js` — token bucket (10 tokenů/s,
max 60). Různé operace mají různou cenu:

| Operace | Cena |
|---|---|
| move, chat | 1 |
| create-room | 3 |
| login | 5 |
| create-tournament | 5 |
| ai-compute | 20 |

Překročení → server pošle `error: 'Rate limit…'`. Buckety se
uklízejí po 5 minutách nečinnosti.

IP se čte z `X-Forwarded-For` (pokud za Caddy) nebo z
`req.socket.remoteAddress`.

## 4. Rozšířená analýza

`analysis.js` přepsán:

- Nové kategorie: **book**, **brilliant**, **best**, **good**,
**inaccuracy**, **mistake**, **miss**, **blunder**.
- **Accuracy** počítána podle Lichess vzorce
(`winPercent` a exponenciální pokles), ne hrubým `100 - loss/10`.

## 5. Drobné bugy

- **`extras.js:saveGame`** nyní ukládá i `positionCounts`,
`halfmoveClock`, `fullmoveNumber` a `gameAnnotations`. Po
nahrání se správně počítá trojí opakování a 50-tah.
- **`ui-extras.js` tooltip** se v lite režimu nezobrazuje.

## Jak aplikovat

1. Rozbal ZIP přes stávající `sachy/`.
2. `cd server && npm install` (kvůli worker_threads nic nového,
ale pro jistotu).
3. Restartuj Node server.
4. Testy: `node tests/run.js`.
5. V prohlížeči bumpni cache (nový SW: `sachy-v3`).

## Co testy odhalí (a co ne)

Testy pokrývají pravidla, ale **ne** UI, multiplayer ani PWA.
Pro ty je potřeba manuální test nebo Playwright (nad rámec).