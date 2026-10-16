# Multiplayer – protokol a architektura

Autor: Better DeepSeek (AI) · Zadavatel: Jan Hošek · 2026 · GPL-3.0-or-later

## Přehled

Prohlížeč A ──┐
├──► Caddy (HTTPS, /chess/) ──► Node.js server (WS + REST)
Prohlížeč B ──┘                                  │
├── SQLite (users, games, active_games)
└── engine.js (validace tahů)

Server **validuje každý tah** – klient nemůže podvádět (poslat nelegální
tah, táhnout dvakrát apod.). Stav partie drží server, klient je jen
zobrazovač.

## Rozhodnutí (dle zadání)

| # ↕▾ | Volba ↕▾ |
|---|---|
| −1 | Node.js |
| −2 | Docker kontejner |
| −3 | Soukromé i veřejné místnosti |
| 4 | Chat ano |
| 5 | Klasická 30 min + 30 s increment |
| 6 | SQLite (obnova po restartu, historie) |
| 7 | ELO rating (K=32) |
| 8 | Diváci s odkazem |
| 9 | Reconnect: 60 s |
| 10 | Základní anti-cheat (validace serverem) |
| 11 | Subpath /chess/ (subdoména možná později) |
| 12 | Caddy |
| 13 | Do 50 partií |
⚙

## WebSocket zprávy

Endpoint: `wss://<host>/chess/ws` (za Caddy) nebo `wss://<host>/ws` (přímo).

Pozor: V `Caddyfile` musí být `handle_path /chess/ws { ... }` (nikoli
`handle`). `handle_path` odstraní prefix `/chess`, takže backend
dostane `/ws`, na který je WebSocketServer napojený.

### Klient → Server

| Typ ↕▾ | Data ↕▾ | Význam ↕▾ |
|---|---|---|
| −login | {nickname, password} | Registrace / přihlášení |
| −reconnect | {token, roomId} | Obnovení po odpojení |
| create-room | {isPublic, color?} | Nová místnost |
| join-room | {roomId} | Připojit se jako hráč |
| spectate | {roomId} | Připojit se jako divák |
| list-rooms | – | Seznam veřejných místností |
| move | {from, to, promotion} | Tah (UCI souřadnice) |
| chat | {text} | Zpráva do chatu |
| resign | – | Vzdát partii |
| offer-draw | – | Nabídnout remízu |
| accept-draw / decline-draw | – | Reakce na remízu |
| push-subscribe | {subscription} | Registrace Web Push |
| push-unsubscribe | {endpoint} | Odhlášení Web Push |
⚙

### Server → Klient

| Typ ↕▾ | Data ↕▾ | Význam ↕▾ |
|---|---|---|
| −logged-in | {user, token} | Úspěšné přihlášení |
| login-error | {message} | Chyba přihlášení |
| room-created | {roomId, color, isPublic} | Místnost vytvořena |
| room-list | {rooms: [...]} | Seznam veřejných místností |
| state | plný stav vč. state | Po přihlášení do místnosti |
| move | {from, to, promotion, uci} | Soupeř táhl |
| clock | {whiteTimeMs, blackTimeMs} | Časomíra |
| chat | {entry} | Chat zpráva |
| game-start | – | Hra začíná |
| game-over | {result, reason} | Konec partie |
| players-updated | {white, black} | Změna hráčů |
| player-disconnected | {color, timeoutMs} | Soupeř odpojen |
| player-reconnected | {color} | Soupeř zpět |
| error | {message} | Chybová zpráva |
⚙

### Důvody konce (reason)

| reason ↕▾ | Popis ↕▾ |
|---|---|
| −checkmate | Mat |
| stalemate | Pat |
| timeout | Vypršel čas |
| resign | Vzdání |
| agreement | Dohoda o remíze |
| forfeit | Soupeř odešel (60 s reconnect) |
| fifty-move | Pravidlo 50 tahů |
| threefold | Trojí opakování |
| material | Nedostatečný materiál |
⚙

## Databázové schéma

users (id, nickname, password_hash, salt, rating, games_played, created_at)
sessions (token, user_id, created_at)
games (id, white_id, black_id, white_nick, black_nick, pgn, result, reason, started_at, ended_at)
active_games (id, payload, updated_at)
push_subscriptions (endpoint, user_id, subscription, created_at)

- `active_games` slouží pro obnovu rozehraných partií po restartu serveru.
- Při každém tahu se uloží aktuální UCI historie + halfmoveClock.

## Bezpečnost

- Hesla: `crypto.scryptSync` + náhodný salt.
- Session tokeny: 24 bajtů náhodných, uložené v localStorage.
- Validace tahů: server vždy ověří legalitu tahu z engine.js.
- Chat: XSS ochrana na klientu (textContent, ne innerHTML).
- Co NENÍ: rate limiting, captcha, detekce motoru.

## Kapacita

- Aktuální konfigurace zvládne ~50 souběžných partií (100 WS spojení).
- Pro vyšší zátěž: viz `ROZSIRENI.md`.