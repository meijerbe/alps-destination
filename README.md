# Basiskamp

Eén statisch bestand dat kandidaat-basiskampen in de Alpen rangschikt op fiets-, hike- en
zwemweer, plus een föhnmeter op basis van het luchtdrukverschil Innsbruck − Bolzano.

Geen build-stap, geen dependencies, geen API-sleutel. `index.html` is de hele app.

## Deployen op Vercel

**Via GitHub (aanbevolen)**

1. Ga naar [vercel.com/new](https://vercel.com/new) en importeer deze repo.
2. Framework Preset: **Other**. Build Command en Install Command leeg laten,
   Output Directory op de root (`./`).
3. Deploy. Vercel serveert `index.html` en pikt `vercel.json` op voor de headers.

Elke push naar `main` levert daarna een productie-deploy op, elke andere branch een preview.

**Via de CLI**

```bash
npm i -g vercel
vercel          # preview
vercel --prod   # productie
```

### vercel.json

`cleanUrls` en `trailingSlash` houden de URL's schoon, `index.html` krijgt
`must-revalidate` zodat een nieuwe deploy meteen zichtbaar is, en er staat een
Content-Security-Policy die precies drie externe hosts toestaat: Google Fonts (css),
`fonts.gstatic.com` (de fontbestanden) en `api.open-meteo.com` (de data).

> Zet je Vercel Web Analytics of Speed Insights aan, dan injecteert Vercel een script
> vanaf `/_vercel/insights/…`. Voeg in dat geval `'self'` toe aan `script-src` en
> `connect-src` in `vercel.json`, anders blokkeert de CSP het.

## Lokaal testen

```bash
python3 -m http.server 8000
```

en open <http://localhost:8000>. Het bestand direct openen via `file://` werkt ook,
zolang je browser de fetch naar Open-Meteo toestaat.

## Aanpassen

Alles zit bovenin het `<script>`-blok van `index.html`.

- **Bestemmingen** — de array `PLACES`. `drive` is de rijtijd vanaf Mayrhofen in uren
  (met de hand geschat, dus corrigeer gerust), `side` is puur informatief.
- **Weging** — `WEIGHTS`, per profiel (racefiets / hiken / meer) de weging van droogte,
  neerslagkans, zon, wind, temperatuur en vriespuntniveau. Sommeert per profiel naar 1.
- **Scorecurves** — de functie `dayScore`. Bijvoorbeeld `rain*13` bepaalt hoe hard
  neerslag doorwerkt: 0 mm = 100 punten, ~7,7 mm = 0.
- **Föhngevoeligheid** — `50 + avg*5.5` bepaalt de naalduitslag; de drempels voor de
  tekstuitleg staan op ±2,5 hPa.
- **Cache** — `CACHE_TTL` (30 min) bepaalt hoe lang een resultaat in `sessionStorage`
  blijft staan. De knop *Ververs* omzeilt de cache altijd.

Verander je `PLACES`, dan vervalt de cache automatisch zodra het aantal bestemmingen
wijzigt (zie `readCache`).

## Deelbare instellingen

Profiel, aantal dagen en maximale rijtijd staan in de URL-hash, dus een specifieke
weergave is te bookmarken of te appen:

```
/#p=hike&d=7&r=4     hiken, 7 dagen vooruit, max 4 uur rijden
```

`p` is `bike` | `hike` | `chill`, `d` is 2–10, `r` is 1–9 (9 = alles).

## Databron

Open-Meteo forecast API, best-match model, 10 dagen vooruit, geen API-sleutel.
Gratis tot 10.000 calls per dag voor niet-commercieel gebruik; data onder CC BY 4.0.
De app doet twee requests per koude load — daarna komt het uit de sessie-cache.

## Kanttekening bij de föhnmeter

Het drukverschil gebruikt naar zeeniveau herleide druk voor twee stations op
verschillende hoogte (Innsbruck 574 m, Bolzano 262 m). De absolute waarde heeft daardoor
een bias; de dag-tot-dag verandering en het teken zijn het signaal.
