# Šachy – patch (Fáze B, 6. část)

Autor oprav: Better DeepSeek (AI) · Zadavatel: Jan Hošek · 2026

Tento balíček obsahuje kompletní přepis souborů, které bylo potřeba
opravit po revizi repozitáře. Všechny změny jsou popsány v
`PATCH-NOTES.md`.

## Rychlý checklist po aplikaci

1. Přepiš soubory z tohoto balíčku do stávajícího repa.
2. **Ručně smaž `script.js`** (mrtvý kód, `index.html` ho nenačítá).
3. Nahraj `Caddyfile` na server, reload Caddy.
4. Restartuj Node server.
5. V prohlížeči: DevTools → Application → Clear storage (kvůli `sachy-v3`).

## Co bylo změněno (zkratka)

- **Kritické**: shadowing `state` v client-net.js a hotseat.js;
Caddy WS path; turnajové ELO; chybějící remízová pravidla na serveru.
- **Drobné**: perf-detect v workeru; worker vidí openings-extra.js;
.dockerignore; SVG ikony; MULTIPLAYER.md + ROZSIRENI.md.

Detailní popis najdeš v `PATCH-NOTES.md`.