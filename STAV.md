# Stav projektu Šachy

Autor kódu: Better DeepSeek (AI) · Zadavatel: Jan Hošek · 2026
Licence: GPL-3.0-or-later · Verze: 2.2

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

### Herní pravidla (kompletní)
- Všechny tahy, rošáda, en passant, proměna pěšce (D/V/S/J)
- Mat, pat, šach
- Remízy: trojí opakování, 50 tahů, nedostatečný materiál

### Režimy hry
- **Singleplayer proti AI** – 5 obtížností
- **Self-play** (AI vs AI)
- **Hot-seat** – dva hráči u PC, se jmény a skóre
- **Multiplayer** – přes síť
- **Turnaje** – pavouk 4/8/16 hráčů

### Ovládání
- Klik-klik i drag & drop (na mobilu long-press)
- Otočení šachovnice, zvýraznění posledního tahu a krále v šachu
- Zelená šipka, tooltip s hodnocením tahu
- Klávesové zkratky: `N`, `Z`, `H`, `A`, `M`, `Esc`, `Ctrl+S`

### Vzhled
- Tři témata, zvuky, animace, eval bar
- **PWA** – instalace na plochu, offline režim
- **Lehký režim** – vypne animace, tooltip, eval bar, ohrožené figury,
  a sníží AI (méně hloubky, bez quiescence)

### Analýza, hádanky, multiplayer, turnaje, push — viz předchozí verze

---

## 3. Minimální HW konfigurace (upřesněno)

Hra je statická webová aplikace. Záleží hlavně na prohlížeči.

| Režim | Minimum |
|---|---|
| **Hot-seat / multiplayer** | Prakticky cokoli s moderním prohlížečem |
| **AI (Lehká)** | Dvoujádro ~2 GHz, 2 GB RAM, moderní prohlížeč |
| **AI (Střední)** | 4jádro, 4 GB RAM |
| **AI (Těžká/Expert)** | Moderní CPU (i3/Ryzen 3 z posledních ~10 let), 4+ GB RAM |
| **Analýza partie** | Moderní CPU; na starém stroji pomalé |

### Reálné zkušenosti

- **Acer tablet PC (2010), C2D, 4 GB RAM, Mint** – hra se **nezvládá**
  plynule ani v lite režimu. Prohlížeč sám spotřebuje 1,5–2,5 GB RAM,
  AI engine potřebuje dalších 500 MB–1 GB. I samotné načtení všech
  skriptů trvá dlouho. Viz „Poznámky pro slabé stroje".
- **Moderní PC (i5/Ryzen 5 z posledních ~5 let), 8 GB RAM** – běží
  bez problému i s Experty.
- **Mobily z posledních ~4 let** – plynulé, AI na Lehké a Střední.
- **Raspberry Pi 4 / 5** – funguje, AI pomalejší.

### Poznámky pro slabé stroje

Pokud máš **Core 2 Duo (2008–2010)** a 4 GB RAM:

1. **Hraj jen hot-seat nebo multiplayer** — bez AI na klientu.
2. Nebo použij **Lehký režim** (checkbox v panelu Vzhled, nebo
   `index.html?lite=1`).
3. **Nespouštěj analýzu partie** — projde všechny pozice a zablokuje
   prohlížeč na desítky sekund.
4. Zvaž **lehčí prohlížeč** (Pale Moon, Falkon) — moderní Firefox/Chrome
   jsou samy o sobě náročné.
5. Nejlepší je server + tenký klient: AI ať běží na serveru, tablet
   ať jen zobrazuje.

---

## 4. Detekce výkonu (bezpečná verze)

- Při prvním načtení se **nejdřív zkontroluje hardware**
  (`navigator.hardwareConcurrency`, `navigator.deviceMemory`).
- Na slabém stroji (≤2 jádra nebo ≤4 GB RAM) se **benchmark AI vůbec
  nespouští** (dřív to blokovalo prohlížeč).
- Profil: **rychlý / běžný / pomalejší / velmi pomalý**.
- Podle profilu se nastaví výchozí obtížnost a u slabých strojů
  se **automaticky zapne lehký režim**.
- Ruční volba obtížnosti se nikdy nepřepíše.

---

## 5. Lehký režim

Zapíná se:
- checkboxem **„Lehký režim (starý HW)"** v panelu **Vzhled**
- nebo URL parametrem `index.html?lite=1`

Vypíná:
- animace tahu a braní (`piece-land`, `capture-flash`)
- CSS přechody (`transition: none`)
- stíny (board-frame, status, box)
- **eval bar** (skrytý)
- **šipky nápovědy** (SVG vrstva skrytá)
- **zvuky** (Web Audio deaktivováno)
- **zvýrazňování ohrožených figur**
- **AI se zjednoduší** (menší hloubka, bez quiescence search)

---

## 6. Struktura souborů

```

sachy/
├── index.html
├── style.css, style-extras.css, style-net.css
├── manifest.json, sw.js
├── engine.js, openings-extra.js
├── game.js, analysis.js, analysis-export.js
├── extras.js, ui-extras.js, puzzles.js, puzzles-v2.js
├── hotseat.js         – hot-seat
├── lite-mode.js       – lehký režim (NEW)
├── client-net.js, tournament-client.js, push-client.js
├── polish-extras.js, copy-extras.js, pwa.js, perf-detect.js
├── server/ (Node.js)
├── Dockerfile, docker-compose.yml, Caddyfile
├── DEPLOY.md, MULTIPLAYER.md, ROZSIRENI.md, STAV.md
└── LICENSE, README.md

```

**Pořadí načítání skriptů:**
`engine.js` → `openings-extra.js` → `game.js` → `analysis.js` →
`analysis-export.js` → `extras.js` → `ui-extras.js` → `puzzles.js` →
`puzzles-v2.js` → `hotseat.js` → `lite-mode.js` → `client-net.js` →
`tournament-client.js` → `push-client.js` → `polish-extras.js` →
`copy-extras.js` → `pwa.js` → `perf-detect.js`

---

## 7. Instalace

### Singleplayer
Nakopíruj `sachy/` (bez `server/`, `Dockerfile`, `docker-compose.yml`,
`Caddyfile`) na web, otevři `index.html`.

### Multiplayer
Viz `DEPLOY.md`.

---

## 8. Co bych ještě přidal

- **Web Worker pro AI** (aby UI nezamrzalo při přemýšlení počítače)
  — *doporučeno pro slabé stroje*
- Varianty šachu (Chess960, King of the Hill)
- Round-robin turnaj
- NNUE neuronová síť (jiná liga, +500 Elo)

### Co bych NEDĚLAL

- Detekce motoru, P2P multiplayer, nativní appky, blockchain.

---

## 9. Poznámky k architektuře

- **engine.js** je jediný zdroj pravdy o pravidlech.
- **Nic není „přilepené"** – každá feature v samostatném souboru.
- **Zálohy**: `server/data/` + statické soubory.
- **Kapacita**: ~50 souběžných partií na Futro S720.
- **Remízy v turnaji**: opakování s prohozenými barvami, max 5×, pak ELO.

---

## 10. Kam dál

1. **Na moderním stroji**: otestuj vše (AI, hádanky, analýza, multiplayer).
2. **Na slabém stroji**: zapni lehký režim, hraj hot-seat nebo multiplayer.
3. **Bugy**: pošli text z konzole (F12 → Console).

Hodně štěstí. ♟
