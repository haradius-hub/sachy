# Stav projektu Šachy

Autor kódu: Better DeepSeek (AI) · Zadavatel: Jan Hošek · 2026
Licence: GPL-3.0-or-later · Verze: 2.3 (Fáze B, 6. část)

---

## 1. Co to je

Šachová hra do prohlížeče — singleplayer (AI, self-play, hot-seat),
hádanky, analýza partie, multiplayer (ELO, chat, historie, push,
turnaje).

Dvě varianty nasazení:

- **Singleplayer** – statické soubory, žádný server.
- **Multiplayer** – Node.js server + WebSocket + SQLite.

---

## 2. Co to umí

### Herní pravidla (kompletní, perft-ověřená)

- Všechny tahy, rošáda, en passant, proměna pěšce (D/V/S/J)
- Mat, pat, šach
- Remízy: trojí opakování, 50 tahů, nedostatečný materiál
- **Ověřeno perft testy** (20 / 400 / 8902 / 197281) — zlatý standard
šachových engine

### Režimy hry

- **Singleplayer proti AI** – 5 obtížností
- **Self-play** (AI vs AI)
- **Hot-seat** – dva hráči u PC, se jmény a skóre
- **Multiplayer** – přes síť
- **Turnaje** – pavouk 4/8/16 hráčů

### Ovládání

- Klik-klik i drag & drop (na mobilu long-press)
- Otočení šachovnice, zvýraznění posledního tahu a krále v šachu
- Zelená šipka, tooltip s hodnocením tahu (vypnutý v lite režimu)
- Klávesové zkratky: `N`, `Z`, `H`, `A`, `M`, `Esc`, `Ctrl+S`

### Vzhled

- Tři témata, zvuky, animace, eval bar
- **PWA** – instalace na plochu, offline režim
- **Lehký režim** – vypne animace, tooltip, eval bar, ohrožené figury,
a sníží AI

### Analýza, hádanky, multiplayer, turnaje, push

- **Analýza partie**: report, graf, PGN + DOCX export

- Kategorie: **book, best, good, inaccuracy, mistake, miss, blunder**
- Accuracy podle Lichess vzorce (winPercent + exp decay)
- **Server-side AI** (volitelné `?serverAI=1`): AI počítá server,
klient jen zobrazuje. Fallback na lokální AI po 15 s.
- **Rate limiting**: token bucket per IP (60 tokenů, 10/s refill).
- **Testy**: `tests/` (bez závislostí, `node tests/run.js`).

---

## 3. Minimální HW konfigurace

Hra je statická webová aplikace. Záleží hlavně na prohlížeči.

| Režim ↕▾ | Minimum ↕▾ |
|---|---|
| −**Hot-seat / multiplayer** | Prakticky cokoli s moderním prohlížečem |
| **AI (Lehká)** | Dvoujádro ~2 GHz, 2 GB RAM, moderní prohlížeč |
| **AI (Střední)** | 4jádro, 4 GB RAM |
| **AI (Těžká/Expert)** | Moderní CPU (i3/Ryzen 3 z posledních ~10 let), 4+ GB RAM |
| **Analýza partie** | Moderní CPU; na starém stroji pomalé |
⚙

### Poznámky pro slabé stroje

Pokud máš **Core 2 Duo (2008–2010)** a 4 GB RAM:

1. **Hraj jen hot-seat nebo multiplayer** — bez AI na klientu.
2. Nebo použij **Lehký režim** (checkbox v panelu Vzhled, nebo
`index.html?lite=1`).
3. **Nespouštěj analýzu partie** — projde všechny pozice a zablokuje
prohlížeč na desítky sekund.
4. Zvaž **lehčí prohlížeč** (Pale Moon, Falkon).
5. **Server-side AI** (`?serverAI=1`) — AI počítá server, klient jen
zobrazuje. Pro velmi slabé tablety ideální.

---

## 4. Detekce výkonu (bezpečná verze)

- Při prvním načtení se **nejdřív zkontroluje hardware**
(`navigator.hardwareConcurrency`, `navigator.deviceMemory`).
- Na slabém stroji (≤2 jádra nebo ≤4 GB RAM) se **benchmark AI vůbec
nespouští**.
- Profil: **rychlý / běžný / pomalejší / velmi pomalý**.
- Podle profilu se nastaví výchozí obtížnost a u slabých strojů
se **automaticky zapne lehký režim**.
- Ruční volba obtížnosti se nikdy nepřepíše.
- Benchmark běží ve Web Workeru (od Fáze B, 6. část) — nemutuje
globální stav hry.

---

## 5. Lehký režim

Zapíná se:

- checkboxem **„Lehký režim (starý HW)"** v panelu **Vzhled**
- nebo URL parametrem `index.html?lite=1`

Vypíná:

- animace tahu a braní
- CSS přechody
- stíny
- **eval bar**
- **šipky nápovědy**
- **zvuky**
- **zvýrazňování ohrožených figur**
- **tooltip s hodnocením tahu** (nové ve Fázi B, 6. část)
- **AI se zjednoduší** (menší hloubka, bez quiescence search)

---

## 6. Server-side AI

Volitelné. Zapíná se přepínačem v URL:

```
https://<host>/chess/?serverAI=1
```

Klient pošle pozici přes WebSocket (`ai-compute`), server spočítá
ve worker thread (`server/ai-worker.js`) a pošle zpět (`ai-result`).
Timeout 15 s, potom klient spadne na lokální AI.

**Vhodné pro slabé klienty** (tablety, mobilní zařízení) — server
počítá, klient jen zobrazuje.

Protokol:

- `ai-compute` → `{ id, board, state, turn, difficulty }`
- `ai-result` → `{ id, move: 'e2e4', score }`
- `ai-error` → `{ id, error }`

---

## 7. Rate limiting

Server má token bucket limiter per IP:

- Kapacita: 60 tokenů
- Doplnění: 10 tokenů/s
- AI compute stojí 20 tokenů
- Login 5, create-room 3, create-tournament 5
- Ostatní (move, chat) 1

Překročení → server pošle `error: 'Rate limit…'`. Buckety se
uklízejí po 5 minutách nečinnosti. IP se čte z `X-Forwarded-For`
(za Caddy) nebo z `req.socket.remoteAddress`.

---

## 8. Struktura souborů

```
sachy/
├── index.html
├── style.css, style-extras.css, style-net.css
├── manifest.json, sw.js
├── engine.js, openings-extra.js
├── game.js, analysis.js, analysis-export.js
├── extras.js, ui-extras.js, puzzles.js, puzzles-v2.js
├── hotseat.js, lite-mode.js
├── client-net.js, client-server-ai.js, tournament-client.js, push-client.js
├── polish-extras.js, copy-extras.js, pwa.js, perf-detect.js
├── tests/
│   ├── run.js
│   ├── engine-loader.js
│   ├── perft.js
│   ├── test-rules.js
│   └── test-perft.js
├── server/
│   ├── server.js, rooms.js, db.js, engine-loader.js
│   ├── ai-worker.js, ai-client.js, rate-limit.js
│   ├── push.js, tournaments.js
│   └── package.json
├── Dockerfile, docker-compose.yml, Caddyfile
├── DEPLOY.md, MULTIPLAYER.md, ROZSIRENI.md, STAV.md
└── LICENSE, README.md
```

**Pořadí načítání skriptů:**
`engine.js` → `openings-extra.js` → `game.js` → `analysis.js` →
`analysis-export.js` → `extras.js` → `ui-extras.js` → `puzzles.js` →
`puzzles-v2.js` → `hotseat.js` → `lite-mode.js` → `notice.js` →
`garde.js` → `worker-ai.js` → `client-net.js` → `client-server-ai.js` →
`tournament-client.js` → `push-client.js` → `polish-extras.js` →
`copy-extras.js` → `pwa.js` → `perf-detect.js`

---

## 9. Instalace

### Singleplayer

Nakopíruj `sachy/` (bez `server/`, `tests/`, `Dockerfile`,
`docker-compose.yml`, `Caddyfile`) na web, otevři `index.html`.

### Multiplayer

Viz `DEPLOY.md`.

### Testy

```
node tests/run.js
```

---

## 10. Co bych ještě přidal

- **Unit testy pro server-side AI** (WS protokol, rate limiter)
- **E2E testy v Playwright** (UI, multiplayer)
- **Round-robin turnaj** (každý s každým)
- **NNUE neuronová síť** (jiná liga, +500 Elo)
- **GitHub Actions CI** (spouštět testy při každém pushi)
- **Package-lock.json** (reprodukovatelné buildy)

### Co bych NEDĚLAL

- Detekce motoru, P2P multiplayer, nativní appky, blockchain.

---

## 11. Poznámky k architektuře

- **engine.js** je jediný zdroj pravdy o pravidlech.
- **Nic není „přilepené"** – každá feature v samostatném souboru.
- **Zálohy**: `server/data/` + statické soubory.
- **Kapacita**: ~50 souběžných partií (100 WS spojení).
- **Remízy v turnaji**: opakování s prohozenými barvami, max 5×, pak ELO.

---

## 12. Kam dál

1. **Na moderním stroji**: otestuj vše (AI, hádanky, analýza, multiplayer).
2. **Na slabém stroji**: zapni lehký režim, hraj hot-seat nebo multiplayer,
případně použij `?serverAI=1`.
3. **Bugy**: pošli text z konzole (F12 → Console).

Hodně štěstí. ♟