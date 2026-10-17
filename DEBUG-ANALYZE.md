# Debug: Analyze tlačítko nereaguje

Autor: Better DeepSeek (AI) · Zadavatel: Jan Hošek · 2026
Licence: GPL-3.0-or-later

Tento dokument popisuje, jak diagnostikovat problém, kdy tlačítko
**Analyzovat** nereaguje (nic se nestane).

## 1. Rychlá kontrola

Otevři DevTools (F12) → Console. Napiš:

```
typeof analyzeGame
```

**Očekávaný výstup:** `'function'`

Pokud výstup je `'undefined'`, znamená to, že `analysis.js` se
nenahrál (nebo má syntax error). Zkontroluj:

```
// V konzoli
document.querySelector('script[src="analysis.js"]')   // má vrátit element
```

Pokud vrátí `null`, `analysis.js` není v HTML (nebo je jinak pojmenovaný).

## 2. Klikni a sleduj konzoli

Klikni na tlačítko **Analyzovat** a sleduj Console. Pokud se objeví
červená chyba, pošli mi ji. Typické chyby:

| Chyba ↕▾ | Příčina ↕▾ |
|---|---|
| −`analyzeGame is not defined` | `analysis.js` se nenahrál |
| `Cannot read property 'score' of undefined` | `searchRoot` vrátil `null` |
| `state is undefined` | `shadowing state` v jiném souboru |
| `Cannot read property 'counts' of undefined` | Stará verze `analysis.js` |
⚙

## 3. Zkus analyzovat krátkou hru

1. Nová hra (klávesa N)
2. Zahraj 3–5 tahů
3. Klikni Analyzovat

Pokud krátká hra funguje a dlouhá ne, je problém v datech (např.
`moveHistory` má corrupted položku).

## 4. Zkontroluj cache (Service Worker)

Pokud máš nasazenou PWA, service worker může servírovat **starou
verzi** `analysis.js`.

1. DevTools → Application → Service Workers → Unregister
2. DevTools → Application → Clear storage → Clear site data
3. Reload (Ctrl+Shift+R)

Nebo bumpni cache v `sw.js`:

```
var CACHE_NAME = 'sachy-v3';  // změň na 'sachy-v4'
```

## 5. Manuální test v konzoli

V konzoli napiš:

```
// Zkontroluj, že globální stav je OK
console.log('moveHistory:', moveHistory.length);
console.log('board:', board ? 'OK' : 'NULL');
console.log('state:', state ? 'OK' : 'NULL');
console.log('thinking:', thinking);
console.log('gameOver:', gameOver);

// Zkus analýzu přímo
analyzeGame();
```

Sleduj, co se stane. Pokud se status změní na „Analyzuji partii… 0 %"
a pak se zasekne, problém je v `step()` (engine search).

## 6. Známe problémy (Fáze B, 6. část)

### AI přemýšlí během analýzy

`analyzeGame()` nepozastaví AI. Pokud AI právě přemýšlí a ty klikneš
Analyzovat, oba procesy běží paralelně. AI může provést tah během
analýzy, což rozbije výpočet.

**Workaround:** Počkej, až AI dohraje (stav „Na tahu: …" bez
„přemýšlí"), potom klikni Analyzovat.

### Trojí opakování

Pokud hra skončila trojím opakováním (`gameOver = true`), analýza
by měla stále fungovat. Pokud ne, je to bug — pošli mi ho.

## 7. Co poslat, pokud problém přetrvává

1. **Screenshot konzole** (F12 → Console) s chybou
2. **Výstup z**:

```
console.log({
  moveHistoryLen: moveHistory.length,
  gameOver: gameOver,
  thinking: thinking,
  selfPlay: selfPlay,
  aiEnabled: aiEnabled,
  playerColor: playerColor,
  typeofAnalyzeGame: typeof analyzeGame
});
```
3. **Verzi prohlížeče** (Help → About)
4. **URL** (jestli máš `?serverAI=1` apod.)

S tím můžu diagnostikovat.