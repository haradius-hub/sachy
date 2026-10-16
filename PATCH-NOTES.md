# Patch notes – opravy chyb (Fáze B, 6. část)

Autor oprav: Better DeepSeek (AI) · Zadavatel: Jan Hošek · 2026
Licence: GPL-3.0-or-later

Tento balíček obsahuje opravy kritických i kosmetických chyb
nalezených při revizi repozitáře `haradius-hub/sachy`.

## Jak aplikovat

1. Rozbal ZIP přes stávající repozitář (přepíše stejné názvy souborů).
2. **Ručně smaž `script.js`** z rootu — je to mrtvý kód (viz níže),
   `index.html` ho už nenačítá.
3. Nahraď `Caddyfile` na serveru, reload Caddy:
   `sudo systemctl reload caddy`
4. Restartuj Node server (`docker compose restart sachy`
   nebo `sudo systemctl restart sachy`).
5. V prohlížeči bumpni cache (DevTools → Application → Clear storage),
   nebo počkej na aktivaci nového service workeru (`sachy-v3`).

## Seznam oprav

### Kritické
| # | Soubor | Co bylo špatně | Fix |
|---|---|---|---|
| 1 | `client-net.js` | Lokální `var state` shadowoval globální šachový stav → `applyRemoteMove` padal, multiplayer nefungoval | Přejmenováno na `mpState`; server nyní posílá i `state` (rošáda, en passant) |
| 2 | `hotseat.js` | Stejný shadowing → skóre se nepřičítalo | Přejmenováno na `hotseatState` |
| 3 | `Caddyfile` | `handle` (bez strip) → backend dostával `/chess/ws` místo `/ws` → multiplayer přes Caddy nešel | `handle_path`; klient odvozuje WS URL z `location.pathname` |
| 4 | `server/tournaments.js` | `resolveByElo` vždy rozhodl pro bílého (rating = 1200 u obou) | Načítá reálné ELO z DB |

### Důležité
| # | Soubor | Co bylo špatně | Fix |
|---|---|---|---|
| 5 | `server/server.js` | Server neznal 50-tah, trojí opakování, nedostatečný materiál | Přidány kontroly po každém tahu |
| 6 | `server/rooms.js` | `halfmoveClock` se nikdy neinkrementoval; chyběl `positionHashes` pro trojí opakování | Doplněno; obnova po restartu zachová i tyto údaje |
| 7 | `server/db.js` | Chybějící `getUserById` pro turnaje | Přidáno |
| 8 | `server/engine-loader.js` | Neexportoval `hashPosition` | Doplněno |
| 9 | `engine-worker.js` | Worker neznal `openings-extra.js` → AI ve workeru měla 17 zahájení, hlavní vlákno 37 | `importScripts('engine.js', 'openings-extra.js')` |
| 10 | `perf-detect.js` | Benchmark mutoval globální `board/state` a mohl zrušit hráčův tah | Přesunuto do Web Workeru (stejného jako AI) |
| 11 | `polish-extras.js` | „Notace s x" – hledal en-dash `–`, ale engine už generuje `x` → mrtvý kód | Sekce odstraněna |
| 12 | `garde.js` | `isDefended` přes 30 řádků triků, ve skutečnosti stačí `isAttacked` | Zjednodušeno |

### Drobnosti / infrastruktura
| # | Soubor | Změna |
|---|---|---|
| 13 | `sw.js` | Cache název `sachy-v2` → `sachy-v3`; přidány nové soubory do pre-cache |
| 14 | `.dockerignore` | **Nový** – aby se do image nekopírovaly `node_modules`, `.git`, `server/data`, `vapid.json` |
| 15 | `manifest.json` | Ikony přepnuty na SVG (PNG nebyly v repu) |
| 16 | `icon-192.svg`, `icon-512.svg` | **Nové** – minimalistický šachový znak |
| 17 | `MULTIPLAYER.md` | **Nový** – dokumentace protokolu (chyběl, odkazovalo na něj DEPLOY.md i STAV.md) |
| 18 | `ROZSIRENI.md` | **Nový** – roadmapa (chybělo, odkazoval STAV.md) |

### Co ještě doporučuji ručně
- **Smazat `script.js`** – mrtvá stará monolitická verze, duplikuje engine
  a AI. `index.html` ji nenačítá, ale motá se v search/replace.
- Doplnit `package-lock.json` (`cd server && npm install` v repu).
- Zvážit `docx` z CDN → self-host (`vendor/docx.umd.js`), jinak
  export do Wordu nefunguje offline.
- Přidat `defer` ke všem `<script src=...>` v `index.html`
  (čistě kosmetika, skripty už jsou na konci `<body>`).
