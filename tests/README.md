# Browsertests

Playwright-tests voor `index.html`. Ze draaien tegen de echte pagina in een echte
browser, met Open-Meteo en Supabase afgevangen — geen netwerk, geen echte database,
dus ze zijn snel en geven altijd hetzelfde antwoord.

```bash
cd tests
npm ci
npx playwright install chromium   # eenmalig
npm test
```

Heb je al een Chromium op je machine staan en wil je er geen tweede downloaden:

```bash
PLAYWRIGHT_CHROMIUM_PATH=/pad/naar/chromium npm test
```

## Waarom dit apart staat van de site

De root van de repo heeft bewust géén `package.json`. `index.html` is een statisch
bestand zonder build-stap, en dat moet zo blijven: Vercel serveert het gewoon, er is
niets dat kan breken bij een deploy. Al het testgereedschap zit daarom hier.

## Wat er getest wordt

| Bestand | Waarover |
|---|---|
| `specs/dashboard.spec.js` | kaart, kerncijfers, tabbladen, dagschuif, deelbare links |
| `specs/paklijst.spec.js`  | vinkjes lokaal en gedeeld, notities, reset, foutafhandeling |
| `specs/eigen-items.spec.js` | zelf toegevoegde paklijst-regels |
| `specs/boodschappen.spec.js` | de boodschappenlijst |

Een paar tests staan er om een fout die we eerder echt hadden vast te pinnen —
die zijn als zodanig gemarkeerd in een comment. Haal ze niet weg omdat ze
"triviaal" lijken; dat is precies waarom ze er zijn.

De nagebouwde Supabase (`helpers/supabase.mjs`) doet expres een paar dingen na die
de echte ook doet en waar we op stukliepen: een `generated always as identity`-kolom
weigert een expliciete `id`, een upsert schrijft alleen de meegestuurde kolommen, en
je eigen insert echoot via Realtime terug vóór je eigen `await` verdergaat.
