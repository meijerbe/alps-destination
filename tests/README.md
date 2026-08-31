# Browsertests

Playwright-tests voor de site (`index.html`, `styles.css`, `js/`). Ze draaien tegen de echte
pagina in een echte browser, met Open-Meteo (voorspelling én archief) en Supabase afgevangen —
geen netwerk, geen echte database, dus ze zijn snel en geven altijd hetzelfde antwoord.

```bash
cd tests
npm ci
npx playwright install chromium   # eenmalig
npm run lint    # snelle no-undef/dode-code-check op js/
npm test
```

Heb je al een Chromium op je machine staan en wil je er geen tweede downloaden:

```bash
PLAYWRIGHT_CHROMIUM_PATH=/pad/naar/chromium npm test
```

## Waarom dit apart staat van de site

De root van de repo heeft bewust géén `package.json`. De site is statische bestanden zonder
build-stap (`index.html`, `styles.css`, `js/*.js` als ES-modules), en dat moet zo blijven: Vercel
serveert ze gewoon, er is niets dat kan breken bij een deploy. Al het testgereedschap zit daarom hier.

## Wat er getest wordt

| Bestand | Waarover |
|---|---|
| `specs/dashboard.spec.js` | kaart, kerncijfers, tabbladen, dagschuif, deelbare links |
| `specs/paklijst.spec.js`  | vinkjes lokaal en gedeeld, notities, reset, foutafhandeling |
| `specs/eigen-items.spec.js` | zelf toegevoegde paklijst-regels |
| `specs/boodschappen.spec.js` | de boodschappenlijst |
| `specs/historisch.spec.js` | de bron-toggle Prognose/Historisch — laden, metriekkeuze, Score/Vriespunt uitschakelen, matrix-sync, tussentijdse melding, mislukt ophalen |

Een paar tests staan er om een fout die we eerder echt hadden vast te pinnen —
die zijn als zodanig gemarkeerd in een comment. Haal ze niet weg omdat ze
"triviaal" lijken; dat is precies waarom ze er zijn.

De nagebouwde Supabase (`helpers/supabase.mjs`) doet expres een paar dingen na die
de echte ook doet en waar we op stukliepen: een `generated always as identity`-kolom
weigert een expliciete `id`, een upsert schrijft alleen de meegestuurde kolommen, en
je eigen insert echoot via Realtime terug vóór je eigen `await` verdergaat.
