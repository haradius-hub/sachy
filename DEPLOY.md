# Nasazení multiplayer serveru

Autor: Better DeepSeek (AI) · Zadavatel: Jan Hošek · 2026 · GPL-3.0-or-later

Tento dokument popisuje nasazení **Fáze B, 6. část** — s testy,
server-side AI a rate limitingem.

## Rychlý start (Docker)

```
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

Zkopíruj `Caddyfile` do `/etc/caddy/Caddyfile` (nahraď `tvuj-web.cz`
svou doménou). Statické soubory hry umísti do `/var/www/chess/`.

**Pozor:** WS cesta musí být `handle_path /chess/ws` (nikoli `handle`),
aby backend dostal `/ws` (server naslouchá na `new WebSocketServer({ path: '/ws' })`).

```
sudo systemctl reload caddy
```

Po reloadu by mělo jít:

- `https://tvuj-web.cz/chess/` → hra (statické soubory)
- `wss://tvuj-web.cz/chess/ws` → multiplayer WebSocket
- `https://tvuj-web.cz/chess/api/leaderboard` → JSON s top 10

## Struktura složek na serveru

```
/opt/sachy/
├── index.html, engine.js, game.js, ...   # statické soubory (klient)
├── client-net.js, client-server-ai.js
├── tests/                                 # testy (volitelné v produkci)
│   ├── run.js, perft.js
│   ├── test-rules.js, test-perft.js
│   └── engine-loader.js
├── server/
│   ├── server.js, rooms.js, db.js, engine-loader.js
│   ├── ai-worker.js, ai-client.js, rate-limit.js
│   ├── push.js, tournaments.js
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

## Testy (Fáze B, 6. část)

Před nasazením nebo po každé změně `engine.js` spusť testy:

```
node tests/run.js
```

Očekávaný výstup:

```
== Šachy testy ==
Soubory: 2

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
Čas:    X.XX s
```

**Pokud testy selžou, engine počítá špatně** — nepushuj to.
Perft je zlatý standard šachových engine.

### Kdy testy pouštět

- Po každé změně `engine.js`
- Po každé změně `game.js` (tahy, pravidla)
- V CI (GitHub Actions) při každém pushi
- Před nasazením do produkce

## Server-side AI (volitelné)

Klient může počítat AI na serveru, ne lokálně. Zapíná se přepínačem
v URL:

```
https://<host>/chess/?serverAI=1
```

**Výhody:**

- Slabý klient (tablet, mobil) nemusí počítat engine
- AI může být silnější (server má víc CPU)
- Klient zůstává responzivní

**Nevýhody:**

- Vyžaduje WebSocket spojení
- Latence (typicky 50–500 ms)
- Server musí mít volný CPU

**Jak to funguje:**

1. Klient pošle `ai-compute` s pozicí.
2. Server spustí `server/ai-worker.js` (worker thread) s enginem.
3. Worker vrátí `ai-result` s tahem.
4. Pokud worker nedokončí do 15 s, klient dostane `ai-error` a spadne
zpět na lokální AI (`worker-ai.js`).

**Doporučení:** Zapni `?serverAI=1` na veřejném serveru, aby slabí
klienti měli silnou AI. Na lokálním vývoji to nech vypnuté (rychlejší).

## Rate limiting

Server má token bucket limiter per IP:

- Kapacita: 60 tokenů
- Doplnění: 10 tokenů/s
- AI compute: 20 tokenů
- Login: 5
- Create-room / create-tournament: 3 / 5
- Ostatní (move, chat): 1

Překročení → server pošle `error: 'Rate limit…'`.

**Co to znamená pro uživatele:**

- Běžné hraní (move, chat) — limiter nepoznáš
- AI compute — limiter poznáš, pokud klikneš 3× rychle za sebou
- Login — max ~12× za minutu
- Create-room — max ~20× za minutu

**Konfigurace:** `server/rate-limit.js`, konstanty `MAX_TOKENS` a
`REFILL_PER_SEC`. Uprav, pokud potřebuješ jiné limity.

## Zálohy

SQLite databáze je v `server/data/sachy.db` (plus `-wal` a `-shm`).
Pro zálohu stačí zkopírovat celou složku `server/data/`:

```
# Jednorázová záloha
cp -r /opt/sachy/server/data /backup/sachy-$(date +%F)

# Nebo cron
0 3 * * * tar czf /backup/sachy-$(date +\%F).tar.gz -C /opt/sachy/server data/
```

**Pozor:** složka `server/data/` obsahuje i `vapid.json` (VAPID klíče
pro Web Push). Zálohuj ji — po smazání klíčů přestanou fungovat
push notifikace.

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

# Po každé změně engine.js spusť testy
node tests/run.js
```

## Škálování (poznámka do budoucna)

Současná konfigurace zvládne **~50 souběžných partií** (100 WebSocket
spojení). Pro vyšší zátěž by bylo potřeba:

1. **Více procesů** + sdílený stav (Redis pub/sub) za load balancerem.
2. **Přesunout hru do paměti** místo SQLite (SQLite jen pro historii).
3. **Horizontal scaling** – Nginx/Caddy round-robin.

Pro hobby provoz to ale není potřeba.

## Řešení problémů

### `?serverAI=1` nefunguje

Zkontroluj:

1. WebSocket je připojený (DevTools → Network → WS → `/ws`).
2. Server má `ai-worker.js` v `server/` složce.
3. V konzoli není `ai-error` zpráva.

### Analyze tlačítko nereaguje

1. Otevři DevTools (F12) → Console.
2. Napiš `typeof analyzeGame` — má být `'function'`.
3. Klikni na Analyzovat a sleduj chyby v konzoli.
4. Zkus analyzovat krátkou hru (5–10 tahů), jestli to funguje.
5. Clear storage (DevTools → Application → Clear storage) → reload.

### Multiplayer se nepřipojí

1. Zkontroluj `Caddyfile` — musí být `handle_path` (nikoli `handle`).
2. Zkontroluj, že server běží: `curl http://127.0.0.1:8081/health`.
3. Zkontroluj WS v DevTools (Network → WS).
4. Pokud jsi za firewallem, otevři port 443 (Caddy) a 8081 (backend).

## Co NENÍ součástí (a proč)

- **Engine assistance detekce** – pro kamarádské hraní zbytečné.
- **Turnaje** – separátní feature, vyžaduje víc stavu (implementováno).
- **Trvalé statistiky** – jen základní (rating, počet her).
- **Round-robin turnaj** – plánováno, ale není prioritou.
- **NNUE neuronová síť** – jiná liga, +500 Elo, vyžaduje víc práce.