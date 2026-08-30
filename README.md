# A&B op reis

Ons weerdashboard voor de Alpen. Eén statisch bestand dat 32 Alpenregio's op een kaart zet en
kleurt naar het weer voor een actieve vakantie — fietsen, hiken of aan het water hangen —
zodat we kunnen bepalen waar we heen gaan als het Mayrhofen-weekend erop zit.

Geen build-stap, geen dependencies, geen API-sleutel. `index.html` is de hele app.

## Wat er in zit

**Kaart** — de Alpenboog als rasterkaart, opgedeeld in 32 regio's. Elke cel hoort bij het
dichtstbijzijnde regiomiddelpunt (Voronoi), geknipt op een grove omtrek van de Alpen. Klik een
regio om hem vast te zetten; de rest van het dashboard rekent daarna met die keuze. Regio's buiten
je rijtijd zakken weg in plaats van te verdwijnen, zodat je ziet wat je laat liggen. Te kleuren op
score, neerslag, zon, temperatuur, wind of vriespunt — oranje is altijd gunstig, blauw altijd niet.

Onder de kaart zit een schuif voor de dag. Helemaal links staat het gemiddelde over de hele
periode; schuif naar rechts en de kaart kleurt één dag tegelijk, met de föhnstand van die dag
erbij. De afspeelknop loopt de dagen af, zodat je een front over de Alpen ziet trekken. In
dagstand blijven de ranglijst en de kerncijfers over de hele periode rekenen — alleen de kaart
zoomt in op die ene dag.

**Lijstje** — dezelfde regio's als rangschikking, met de föhnmeter erboven en per regio een
opbouw van de score: welk onderdeel de score trekt en welk onderdeel hem tegenhoudt.

**Per dag** — alle regio's tegen alle dagen in één matrix, voor als je zoekt naar een gat in de
buien in plaats van naar een goede week.

**Paklijst** — beweegt mee met het profiel én met de verwachting voor de gekozen regio. Zakt het
vriespunt, dan verschijnen muts en handschoenen; gaat het waaien, dan de stormharingen. Regels met
het label *weer* staan er alleen in omdat de voorspelling erom vraagt. Vinkjes blijven in je eigen
browser bewaard.

**Onder de motorkap** — de twee API-verzoeken die de pagina doet, de onbewerkte dagwaarden zoals
Open-Meteo ze teruggeeft, en de hele rekensom van ruwe waarde via normalisatie en weging naar de
dagscore. Plus de kanttekeningen bij die bewerking.

## Instellingen zitten in de URL

Profiel, vooruitkijkperiode, maximale rijtijd, vertrekdag, kleurmetriek, tabblad en de gekozen
regio staan allemaal in de hash. Een specifieke weergave is dus te bookmarken of te appen:

```
/#p=hike&d=7&r=4&s=2&m=sun&k=1&g=Dolomieten&t=map
```

`p` = `bike` | `hike` | `chill`, `d` = 2–10 dagen, `r` = 1–10 uur rijden (10 = alles),
`s` = vertrekdag als index in de voorspelling, `m` = `score` | `rain` | `sun` | `tmax` | `wind` | `frz`,
`g` = regionaam, `k` = dag binnen de periode (weglaten voor het gemiddelde),
`t` = `map` | `rank` | `matrix` | `pack` | `data`.

## Deployen op Vercel

**Via GitHub (aanbevolen)**

1. Ga naar [vercel.com/new](https://vercel.com/new) en importeer deze repo.
2. Framework Preset: **Other**. Build Command en Install Command leeg laten,
   Output Directory op de root (`./`).
3. Deploy. Vercel serveert `index.html` en pikt `vercel.json` op voor de headers.

Elke push naar `main` levert een productie-deploy op, elke andere branch een preview.

**Via de CLI**

```bash
npm i -g vercel
vercel          # preview
vercel --prod   # productie
```

### vercel.json

`cleanUrls` en `trailingSlash` houden de URL's schoon, `index.html` krijgt `must-revalidate` zodat
een nieuwe deploy meteen zichtbaar is, en er staat een Content-Security-Policy die precies drie
externe hosts toestaat: Google Fonts (css), `fonts.gstatic.com` (de fontbestanden) en
`api.open-meteo.com` (de data).

> Zet je Vercel Web Analytics of Speed Insights aan, dan injecteert Vercel een script vanaf
> `/_vercel/insights/…`. Voeg in dat geval `'self'` toe aan `script-src` en `connect-src` in
> `vercel.json`, anders blokkeert de CSP het.

## Lokaal testen

```bash
python3 -m http.server 8000
```

en open <http://localhost:8000>.

## Aanpassen

Alles zit bovenin het `<script>`-blok van `index.html`.

- **Regio's** — de array `REGIONS`. `lat`/`lon` is het punt waarvoor het weer wordt opgehaald én
  het middelpunt waar de kaart de cellen omheen legt; `drive` is de rijtijd vanaf Mayrhofen in uren
  (met de hand geschat, dus corrigeer gerust); `s` is een kortere naam voor op de kaart; `side` is
  puur informatief. Een regio toevoegen of verplaatsen hertekent de kaart vanzelf.
- **Omtrek van de Alpen** — `ARC`, een grove polygoon in lon/lat. Alleen bedoeld om het raster af
  te knippen, het is geen grens.
- **Rastergrofte** — `GEO.latStep`. Kleiner = fijnere kaart en meer SVG.
- **Weging** — `WEIGHTS`, per profiel de weging van droogte, neerslagkans, zon, wind, temperatuur
  en vriespuntniveau. Sommeert per profiel naar 1.
- **Scorecurves** — de functie `dayParts`. Het tabblad *Onder de motorkap* laat elke curve met
  formule en al zien, dus daar zie je meteen wat een aanpassing doet.
- **Paklijst** — de array `PACK`. Een regel met `when` verschijnt alleen als de verwachting eraan
  voldoet, `why` legt in één zin uit waarom hij er staat. Een groep met `personal:true` (Kleding, Op
  de fiets, Op pad, Aan het water) krijgt een vinkje per persoon in plaats van één gedeeld vinkje.
- **Cache** — `CACHE_TTL` (30 min) bepaalt hoe lang een resultaat in `sessionStorage` blijft staan.
  De knop *Ververs* omzeilt de cache altijd.

## Gedeelde paklijst (Supabase)

Zonder verdere configuratie werkt de paklijst zoals eerst: vinkjes en notities blijven per browser
bewaard (`localStorage`). Vul je een Supabase-project in, dan staan diezelfde vinkjes en notities
gedeeld voor jullie allebei, en zie je elkaars wijzigingen vanzelf verschijnen zonder te hoeven
verversen.

**Zo zet je hem aan**

1. Maak een gratis project op [supabase.com](https://supabase.com) (geen creditcard nodig voor de
   hobby-laag).
2. Open **SQL Editor → New query**, plak de inhoud van [`supabase/schema.sql`](supabase/schema.sql)
   en klik **Run**. Dit zet één tabel neer (`packing_state`) met rijbeveiliging die de anon-sleutel
   alleen toegang geeft tot rijen van deze ene reis.
3. Ga naar **Settings → API** en kopieer de **Project URL** en de **anon public**-sleutel.
4. Zet ze in `index.html`, bovenaan het paklijst-gedeelte van het script (zoek naar
   `SUPABASE_URL`):
   ```js
   const SUPABASE_URL = "https://xxxxxxxx.supabase.co";
   const SUPABASE_ANON_KEY = "eyJ…";
   ```
5. Commit en push (of `vercel --prod`). Klaar — het tabblad *Paklijst* laat nu een *Wie ben jij*-
   knop zien (A of B), groepen met *ieder apart* krijgen twee vinkjes, en elk item krijgt een
   notitieveld dat meteen wordt opgeslagen.

**Hoe het werkt**

Elk item krijgt een stabiele sleutel (groep + omschrijving, geslugd) en per persoon een eigen rij
in `packing_state`: `gedeeld` voor de gewone spullen, `A`/`B` voor kleding, fiets-, wandel- en
zwemspullen. De notitie hangt aan de `gedeeld`-rij, ook bij persoonlijke items — één notitieveld
per item, niet per persoon. Wijzigingen gaan via Supabase Realtime meteen naar de ander door; komt
de verbinding even niet tot stand, dan blijft alles gewoon werken en probeert de pagina het bij het
volgende bezoek aan het tabblad opnieuw.

**Kanttekening bij de beveiliging** — er zit geen login achter. De anon-sleutel staat zichtbaar in
de broncode (dat is met Supabase de bedoeling; rijbeveiliging bepaalt wat hij mag) en is beperkt
tot precies deze tabel en deze ene reis-id. Prima voor een privélink tussen jullie twee, niet
geschikt voor iets gevoeligers.

**Voor de volgende reis** — wis de tabel (`truncate packing_state;` in de SQL Editor) of pas de
`TRIP_ID`-constante aan én de bijbehorende waarde in de drie policies in `schema.sql`.

## Databron

Open-Meteo forecast API, best-match model, 10 dagen vooruit, geen API-sleutel. Gratis tot 10.000
calls per dag voor niet-commercieel gebruik; data onder CC BY 4.0. De app doet twee requests per
koude load — één voor alle 32 regio's samen, één voor de twee drukstations — en haalt daarna alles
uit de sessie-cache.

## Kanttekeningen

De belangrijkste staan in de app zelf, op het tabblad *Onder de motorkap*. Kort samengevat: de
föhnmeter gebruikt naar zeeniveau herleide druk voor twee stations op verschillende hoogte, dus
alleen het teken en de verandering zijn het signaal; de rastercel van het model is grover dan een
Alpendal; en één meetpunt per regio is precies dat — een steekproef, geen dekking.
