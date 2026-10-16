# Rozšíření – nápady a roadmapa

Autor: Better DeepSeek (AI) · Zadavatel: Jan Hošek · 2026 · GPL-3.0-or-later

Zásobník nápadů, od kterých se dá odpíchnout.

## 1. Herní varianty

- **Chess960 (Fischer Random)** – náhodné rozestavení figur.
- **King of the Hill** – vítězí ten, kdo dostane krále na střed.
- **Tři šachy (Three-check)** – vítězí ten, kdo dá tři šachy.
- **Antichess** – cílem je zbavit se všech figur.

## 2. Turnajové formáty

- **Round-robin (každý s každým)** – pro 4–6 hráčů.
- **Double elimination** – dva pavouky.
- **Švýcarský systém** – pro 8+ hráčů.
- **Týmové turnaje** – 2v2 nebo 4v4.

## 3. Analýza partie

- **Brilliant / Great / Book moves** – rozšířená klasifikace.
- **Heatmapa chyb** – která pole nejčastěji chybovala.
- **PGN s komentáři engine** – export s hlubšími anotacemi.
- **Vlastní analytický report** – DOCX se screenshotem.

## 4. AI engine

- **NNUE neuronová síť** – +500 Elo, složitější integrace.
- **Web Worker pool** – více jader = hlubší search.
- **Lichess Cloud Eval** – dotaz na cloudu.
- **Otevírací kniha z polyglotu** – místo hardcoded OPENING_BOOK.

## 5. Multiplayer / server

- **Rate limiting** – základní ochrana proti spamu.
- **Detekce motoru** – analýza časů tahů, shoda s engine.
- **Redis pub/sub** – pro horizontální škálování.
- **Server-side AI** – AI běží na serveru (pro slabé tablety).
- **P2P multiplayer** – WebRTC, bez centrálního serveru.

## 6. PWA / offline

- **Offline AI** – AI běží lokálně i bez sítě (už funguje).
- **Background sync** – odeslání tahu, když se klient vrátí online.
- **Push notifikace** – rozšířit o "turnaj začal".

## 7. UX / UI

- **Zvuky** – lepší zvuková banka.
- **Animace** – plynulejší pohyb figury.
- **Barevné schéma** – více témat.
- **Přístupnost** – ARIA role, klávesnicová navigace.
- **Mobile-first** – lepší ovládání na telefonu.

## 8. Dokumentace a komunita

- **Screenshoty a demo** – v README chybí obrázky.
- **GitHub Actions** – CI pro lint, test rules.
- **Unit testy** – pravidla šachu.
- **Kontribuční guide** – jak přispět, styl kódu.
- **Docker Hub image** – docker pull haradius/sachy:latest.

## 9. Co bych NEDĚLAL

- Detekce motoru – zbytečná pro kamarádské hraní.
- Nativní aplikace – PWA stačí.
- Blockchain / NFT – nesmysl pro šachy.
- Vlastní formát PGN – držet se standardu.

## 10. Priority (návrh pořadí)

1. Doplnit unit testy pravidel.
2. Smazat script.js + drobné bugy z PATCH-NOTES.md.
3. Server-side AI pro slabé klienty (Futro S720).
4. Rozšířená klasifikace tahů (Brilliant/Great).
5. Chess960 jako druhá hra.