# Nasazení multiplayer serveru

Autor: Better DeepSeek (AI) · Zadavatel: Jan Hošek · 2026 · GPL-3.0-or-later

## Rychlý start (Docker)

```bash
# 1) Nakopíruj celou složku sachy/ na server
scp -r sachy/ user@server:/opt/

# 2) Spusť kontejner
cd /opt/sachy
docker compose up -d

# 3) Zkontroluj, že běží
docker compose logs -f sachy
curl http://127.0.0.1:8081/health
```

Server teď poslouchá na `127.0.0.1:8081`. K němu se připojí Caddy.

## Caddy

Zkopíruj `Caddyfile` do `/etc/caddy/Caddyfile` (nahraď `tvuj-web.cz` svou doménou).
Statické soubory hry umísti do `/var/www/chess/`.

```
sudo systemctl reload caddy
```

Po reloadu by mělo jít:

- `https://tvuj-web.cz/chess/` → hra (statické soubory)
- `wss://tvuj-web.cz/chess/ws` → multiplayer WebSocket
- `https://tvuj-web.cz/chess/api/leaderboard` → JSON s top 10

**Poznámka k subdoméně:** subpath je doporučený (jeden certifikát, méně konfigurace). Pokud budeš chtít časem subdoménu `sachy.tvuj-web.cz`, stačí v Caddy přidat nový blok — Caddy automaticky vydá certifikát.

## Struktura složek na serveru

```
/opt/sachy/
├── index.html, engine.js, game.js, ...   # statické soubory (klient)
├── client-net.js
├── server/
│   ├── server.js, rooms.js, db.js, engine-loader.js
│   ├── package.json
│   └── data/sachy.db                     # SQLite (vytvoří se automaticky)
├── Dockerfile
├── docker-compose.yml
└── Caddyfile

/var/www/chess/   ← sem nakopíruj statické soubory (nebo použij symlink)
```

## Bez Dockeru (přímo na hostiteli)

```
cd /opt/sachy/server
npm install
node server.js
```

Pro trvalý běh použij systemd (`/etc/systemd/system/sachy.service`):

```
[Unit]
Description=Sachy multiplayer server
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/sachy/server
ExecStart=/usr/bin/node server.js
Restart=on-failure
User=www-data
Environment=PORT=8081
Environment=HOST=127.0.0.1

[Install]
WantedBy=multi-user.target
```

Pak:

```
sudo systemctl daemon-reload
sudo systemctl enable --now sachy
```

## Zálohy

SQLite databáze je v `server/data/sachy.db` (plus `-wal` a `-shm` soubory).
Pro zálohu stačí zkopírovat celou složku `server/data/`:

```
# Jednorázová záloha
cp -r /opt/sachy/server/data /backup/sachy-$(date +%F)

# Nebo cron
0 3 * * * tar czf /backup/sachy-$(date +\%F).tar.gz -C /opt/sachy/server data/
```

## Logy

```
docker compose logs -f sachy
# nebo
journalctl -u sachy -f
```

## Aktualizace

```
cd /opt/sachy
git pull              # nebo nakopíruj nové soubory
docker compose down
docker compose up -d --build
```

## Škálování (poznámka do budoucna)

Současná konfigurace zvládne **~50 souběžných partií** (100 WebSocket spojení).
Pro vyšší zátěž by bylo potřeba:

1. **Více procesů** + sdílený stav (Redis pub/sub) za load balancerem.
2. **Přesunout hru do paměti** místo SQLite (SQLite jen pro historii).
3. **Horizontal scaling** – Nginx/Caddy round-robin.

Pro hobby provoz to ale není potřeba.

## Co NENÍ součástí (a proč)

- **Engine assistance detekce** – pro kamarádské hraní zbytečné.
- **Turnaje** – separátní feature, vyžaduje víc stavu.
- **Trvalé statistiky** – jen základní (rating, počet her). Víc by šlo doplnit.

</BDS:create_file>

<BDS:create_file fileName="sachy/MULTIPLAYER.md">

```markdown
# Multiplayer – protokol a architektura

Autor: Better DeepSeek (AI) · Zadavatel: Jan Hošek · 2026 · GPL-3.0-or-later

## Přehled

Prohlížeč A ──┐
├──► Caddy (HTTPS, /chess/) ──► Node.js server (WS + REST)
Prohlížeč B ──┘                                    │
├── SQLite (users, games, active_games)
└── engine.js (validace tahů, stejný jako klient)

```

Server **validuje každý tah** – klient nemůže podvádět (poslat nelegální tah, táhnout dvakrát apod.).
Stav partie drží server, klient je jen zobrazovač.

## Rozhodnutí (dle zadání)

| # | Volba |
|---|---|
| 1 | Node.js |
| 2 | Docker kontejner |
| 3 | Soukromé **i** veřejné místnosti |
| 4 | Chat ano |
| 5 | Klasická 30 min + 30 s increment |
| 6 | SQLite (obnova po restartu, historie) |
| 7 | ELO rating (K=32) |
| 8 | Diváci s odkazem |
| 9 | Reconnect: 60 s |
| 10 | Základní anti-cheat (validace serverem) |
| 11 | Subpath `/chess/` (subdoména možná později) |
| 12 | Caddy |
| 13 | Do 50 partií (poznámka pro škálování v DEPLOY.md) |

## WebSocket zprávy

Endpoint: `wss://<host>/chess/ws`

### Klient → Server

| Typ | Data | Význam |
|---|---|---|
| `login` | `{nickname, password}` | Registrace / přihlášení |
| `reconnect` | `{token, roomId}` | Obnovení po odpojení |
| `create-room` | `{isPublic}` | Nová místnost (hráč = hostitel) |
| `join-room` | `{roomId}` | Připojit se jako hráč |
| `spectate` | `{roomId}` | Připojit se jako divák |
| `list-rooms` | – | Seznam veřejných místností |
| `move` | `{from, to, promotion}` | Tah (UCI souřadnice, např. `e2`,`e4`) |
| `chat` | `{text}` | Zpráva do chatu |
| `resign` | – | Vzdát partii |
| `offer-draw` | – | Nabídnout remízu |
| `accept-draw` / `decline-draw` | – | Reakce na nabídku remízy |

### Server → Klient

| Typ | Data | Význam |
|---|---|---|
| `logged-in` | `{user, token}` | Úspěšné přihlášení |
| `login-error` | `{message}` | Chyba přihlášení |
| `room-created` | `{roomId, color, isPublic}` | Místnost vytvořena |
| `room-list` | `{rooms: [...]}` | Seznam veřejných místností |
| `state` | plný stav | Po přihlášení do místnosti |
| `move` | `{from, to, promotion, uci}` | Soupeř táhl |
| `clock` | `{whiteTimeMs, blackTimeMs}` | Aktuální časomíra |
| `chat` | `{entry: {from, text, t}}` | Chat zpráva |
| `game-start` | – | Oba hráči připojeni, hra začíná |
| `game-over` | `{result, reason}` | Konec partie |
| `players-updated` | `{white, black}` | Změna hráčů |
| `player-disconnected` | `{color, timeoutMs}` | Soupeř odpojen |
| `player-reconnected` | `{color}` | Soupeř zpět |
| `error` | `{message}` | Chybová zpráva |

## Databázové schéma

```sql
users (id, nickname, password_hash, salt, rating, games_played, created_at)
sessions (token, user_id, created_at)
games (id, white_id, black_id, pgn, result, started_at, ended_at)
active_games (id, payload, updated_at)
```

- `active_games` slouží pro obnovu rozehraných partií po restartu serveru.
- Při každém tahu se uloží aktuální UCI historie.
- Při startu serveru se všechny aktivní hry načtou zpět do paměti.

## Bezpečnost

- **Hesla**: `crypto.scryptSync` + náhodný salt (bezpečné).
- **Session tokeny**: 24 bajtů náhodných, uložené v `localStorage` prohlížeče.
- **Validace tahů**: server vždy ověří legalitu tahu z `engine.js`.
- **Chat**: XSS ochrana na klientu (`textContent`, ne `innerHTML`).
- **Co NENÍ**: rate limiting, captcha, detekce motoru. Pro kamarádské hraní dostačující.

</BDS:create_file>

<BDS:create_file fileName="sachy/index.html">

```html
<!DOCTYPE html>
<!--
  Šachy – hra do prohlížeče
  Autor: Better DeepSeek (AI) · Zadavatel: Jan Hošek · 2026
  SPDX-License-Identifier: GPL-3.0-or-later
-->
<html lang="cs">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Šachy</title>
<link rel="stylesheet" href="style.css">
<link rel="stylesheet" href="style-extras.css">
<link rel="stylesheet" href="style-net.css">
</head>
<body data-theme="light">
<div class="app">
  <header class="head">
    <h1>Šachy</h1>
    <p class="sub">Dvouhráčová hra, proti počítači, AI vs AI, nebo multiplayer</p>
  </header>

  <main class="main">
    <div class="board-area">
      <div class="eval-bar" title="Hodnocení pozice">
        <div class="eval-fill" id="evalFill" style="width:50%"></div>
        <span class="eval-label" id="evalLabel">0.00</span>
      </div>

      <div class="board-frame" id="boardFrame">
        <div class="coords coords-files coords-top" id="filesTop"></div>
        <div class="coords coords-ranks coords-left" id="ranksLeft"></div>
        <div class="board" id="board"></div>
        <div class="coords coords-ranks coords-right" id="ranksRight"></div>
        <div class="coords coords-files coords-bottom" id="filesBottom"></div>
      </div>

      <div class="board-controls">
        <button id="rotateBtn" class="btn btn-outline">Otočit</button>
        <button id="puzzleBtn" class="btn btn-outline">Hádanky</button>
      </div>
    </div>

    <aside class="panel">
      <div class="status" id="status">Na tahu: Bílý</div>

      <div class="controls">
        <button id="newGame" class="btn">Nová hra</button>
        <button id="undo" class="btn btn-outline">Zpět</button>
      </div>

      <div class="controls">
        <button id="hintBtn" class="btn btn-outline">Napověz tah</button>
        <button id="analyzeBtn" class="btn btn-outline">Analyzovat</button>
      </div>

      <div class="box">
        <div class="box-title">Partie</div>
        <div class="controls">
          <button id="saveBtn" class="btn btn-outline">Uložit</button>
          <button id="loadBtn" class="btn btn-outline">Nahrát</button>
        </div>
        <div class="controls">
          <button id="exportBtn" class="btn btn-outline">Export PGN</button>
          <button id="importBtn" class="btn btn-outline">Import PGN</button>
        </div>
        <div class="controls">
          <button id="shareBtn" class="btn btn-outline">Sdílet odkaz</button>
        </div>
      </div>

      <div class="box">
        <div class="box-title">FEN</div>
        <input type="text" id="fenInput" class="fen-input" readonly>
        <button id="copyFenBtn" class="btn btn-outline" style="margin-top:8px;width:100%">Kopírovat FEN</button>
      </div>

      <div class="box">
        <div class="box-title">Vzhled</div>
        <label class="field">
          <span class="field-label">Téma</span>
          <select id="themeSelect">
            <option value="light">Světlé</option>
            <option value="dark">Tmavé</option>
            <option value="wooden">Dřevěné</option>
          </select>
        </label>
        <label class="toggle"><input type="checkbox" id="soundToggle" checked><span>Zvuky</span></label>
        <label class="toggle"><input type="checkbox" id="threatToggle"><span>Zvýraznit ohrožené figury</span></label>
      </div>

      <div class="box">
        <div class="box-title">Nastavení hry</div>
        <label class="field">
          <span class="field-label">Hraji za</span>
          <select id="sideSelect">
            <option value="w">Bílé</option>
            <option value="b">Černé</option>
          </select>
        </label>
        <label class="field">
          <span class="field-label">Obtížnost</span>
          <select id="difficultySelect">
            <option value="easy">Lehká</option>
            <option value="club">Klubový hráč</option>
            <option value="medium" selected>Střední</option>
            <option value="hard">Těžká</option>
            <option value="expert">Expert</option>
          </select>
        </label>
        <label class="toggle"><input type="checkbox" id="aiToggle"><span>Počítač hraje soupeře</span></label>
        <label class="toggle"><input type="checkbox" id="selfPlayToggle"><span>AI vs AI</span></label>
        <div class="field" id="selfPlaySpeedRow" style="display:none">
          <span class="field-label">Rychlost</span>
          <select id="selfPlaySpeedSelect">
            <option value="100">Rychle</option>
            <option value="500" selected>Normálně</option>
            <option value="1200">Pomalu</option>
          </select>
        </div>
      </div>

      <div class="box">
        <div class="box-title">Zajaté figurky</div>
        <div class="cap-row"><span class="cap-label">Bílý:</span><span id="capByWhite" class="cap-pieces"></span></div>
        <div class="cap-row"><span class="cap-label">Černý:</span><span id="capByBlack" class="cap-pieces"></span></div>
      </div>

      <div class="box history-box">
        <div class="box-title">Tahy</div>
        <ol id="moveList" class="move-list"></ol>
      </div>

      <div class="box shortcuts">
        <div class="box-title">Zkratky</div>
        <div class="shortcut-row"><kbd>N</kbd> nová · <kbd>Z</kbd> zpět · <kbd>H</kbd> nápověda · <kbd>A</kbd> analýza · <kbd>Ctrl</kbd>+<kbd>S</kbd> uložit</div>
      </div>
    </aside>
  </main>
</div>

<div class="modal-backdrop" id="importModal" hidden>
  <div class="modal">
    <h2>Import partie</h2>
    <p class="modal-desc">Vlož PGN v SAN (např. 1. e4 e5 2. Nf3) nebo UCI (např. e2e4 e7e5).</p>
    <textarea id="importText" class="import-area"></textarea>
    <div class="modal-actions">
      <button id="importCancel" class="btn btn-outline">Zrušit</button>
      <button id="importConfirm" class="btn">Importovat</button>
    </div>
  </div>
</div>

<div class="modal-backdrop" id="promoModal" hidden>
  <div class="modal promo-modal">
    <h2>Vyber proměnu</h2>
    <div class="promo-buttons">
      <button class="promo-btn" data-piece="q">♛</button>
      <button class="promo-btn" data-piece="r">♜</button>
      <button class="promo-btn" data-piece="b">♝</button>
      <button class="promo-btn" data-piece="n">♞</button>
    </div>
  </div>
</div>

<div class="modal-backdrop" id="reportModal" hidden>
  <div class="modal report-modal">
    <div class="report-head">
      <h2 id="reportTitle">Report partie</h2>
      <button id="reportClose" class="report-close">✕</button>
    </div>
    <div id="reportContent" class="report-content"></div>
    <div class="report-foot">
      <button id="reportCloseBtn" class="btn btn-outline">Zavřít</button>
    </div>
  </div>
</div>

<div class="modal-backdrop" id="puzzleModal" hidden>
  <div class="modal">
    <div class="report-head">
      <h2>Hádanky</h2>
      <button id="puzzleClose" class="report-close">✕</button>
    </div>
    <p class="modal-desc">Vyber hádanku. Cílem je dát mat. Při chybném tahu se pozice vrátí.</p>
    <div id="puzzleList" class="puzzle-list"></div>
    <div class="modal-actions">
      <button id="puzzleCloseBtn" class="btn btn-outline">Zavřít</button>
    </div>
  </div>
</div>

<div class="toast" id="toast" hidden></div>

<script src="engine.js"></script>
<script src="openings-extra.js"></script>
<script src="game.js"></script>
<script src="analysis.js"></script>
<script src="extras.js"></script>
<script src="ui-extras.js"></script>
<script src="puzzles.js"></script>
<script src="client-net.js"></script>
</body>
</html>

