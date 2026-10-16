# Multiplayer – odpovědi (vyplněno)

Tento soubor je historický záznam rozhodnutí k multiplayeru. Aktuální
stav je v `MULTIPLAYER.md` a `README.md`.

## Volby (dle zadání Jana Hoška)

| # | Volba |
|---|---|
| 1 | **Node.js** |
| 2 | **Docker kontejner** |
| 3 | Soukromé **i** veřejné místnosti |
| 4 | **Chat ano** |
| 5 | **Klasická 30 min + 30 s increment** |
| 6 | **SQLite** (obnova po restartu, historie) |
| 7 | **ELO rating** (K=32) |
| 8 | **Diváci s odkazem** |
| 9 | Reconnect: **60 s** |
| 10 | **Základní anti-cheat** (validace serverem) |
| 11 | **Subpath `/chess/`** (subdoména možná později) |
| 12 | **Caddy** |
| 13 | **Do 50 partií** |

## Poznámky

- **Subpath vs subdoména:** subpath je pro malý projekt jednodušší (jeden
  certifikát, méně konfigurace). Subdoménu lze doplnit později bez zásahu
  do kódu — jen přidat blok do Caddyfile.
- **Anti-cheat rozšířený** (detekce motoru): záměrně vynecháno. Pro
  kamarádské hraní je základní validace dostačující. Detekce motoru
  by přidala falešné poplachy a složitost.
- **Škálování:** aktuální návrh ~50 souběžných partií. Postup při
  potřebě škálovat je v `ROZSIRENI.md`, sekce 5.
