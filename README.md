# A&B op reis

Ons weerdashboard voor de Alpen. Eén statisch bestand dat 32 Alpenregio's op een kaart zet en
kleurt naar het weer voor een actieve vakantie — fietsen, hiken of aan het water hangen —
zodat we kunnen bepalen waar we heen gaan als het Mayrhofen-weekend erop zit.

Geen build-stap, geen dependencies, geen API-sleutel. `index.html` bevat de opmaak, `styles.css`
de stijl en `js/` de logica als losse ES-modules (`<script type="module">`) — rechtstreeks door de
browser geladen, niets te bouwen.

## Wat er in zit

**Kaart** — een echte topografische kaart van de Alpenboog (Leaflet + OpenTopoMap), met de 32
regio's als gekleurde stippen erop — elke stip is één meetpunt voor die regio, geen dekkingskaart.
Klik een regio om hem vast te zetten; de rest van het dashboard rekent daarna met die keuze.
Hoveren toont de score, het gekozen kenmerk en de kernwaarden voor die regio. Regio's buiten je
rijtijd zakken weg in plaats van te verdwijnen, zodat je ziet wat je laat liggen. Te kleuren op
score, neerslag, zon, temperatuur, wind of vriespunt — oranje is altijd gunstig, blauw altijd niet.

Onder de kaart zit een schuif voor de dag. Helemaal links staat het gemiddelde over de hele
periode; schuif naar rechts en de kaart kleurt één dag tegelijk, met de föhnstand van die dag
erbij. De afspeelknop loopt de dagen af, zodat je een front over de Alpen ziet trekken. In
dagstand blijven de ranglijst en de kerncijfers over de hele periode rekenen — alleen de kaart
zoomt in op die ene dag.

**Bron: Prognose / Historisch** — een schakelaar naast de kleurkeuze, boven zowel de kaart als de
dagmatrix. Op *Historisch* tonen Neerslag, Zon, Temp en Wind niet de 10-daagse voorspelling maar
het gemiddelde over de laatste 15 jaar voor exact deze kalenderdagen (dezelfde datums, andere
jaren) — geen voorspelling, maar "hoe is het hier normaal in deze periode". Nuttig als de
voorspelling nog onzeker is maar je toch een regio wilt kiezen. Score en Vriespunt hebben geen
historisch equivalent (score leunt op neerslagkans, die bestaat niet met terugwerkende kracht) en
gaan daarom uit zolang de bron op Historisch staat; de ranglijst, kerncijfers en föhnmeter blijven
altijd op de voorspelling rekenen. Kost 15 extra verzoeken (één per jaar, telkens alle regio's en
velden tegelijk) en wordt daarom pas opgehaald zodra je de bron ook echt omzet, en daarna 30 dagen
bewaard. Mislukt het ophalen een keer, dan probeert de pagina het na 10 minuten vanzelf opnieuw.

**Lijstje** — dezelfde regio's als rangschikking, met de föhnmeter erboven en per regio een
opbouw van de score: welk onderdeel de score trekt en welk onderdeel hem tegenhoudt.

**Per dag** — alle regio's tegen alle dagen in één matrix, voor als je zoekt naar een gat in de
buien in plaats van naar een goede week.

*Kaart*, *Lijstje*, *Per dag* en *Onder de motorkap* zitten samen onder de bovenste schakelaar
**Waar naartoe** — dat gaat over het kiezen van een bestemming. **Paklijst** en **Boodschappen**
zijn eigen tabbladen ernaast: dat gaat over wat je meeneemt, niet over waar je heen gaat.

**Onder de motorkap** — de twee API-verzoeken die de pagina doet, de onbewerkte dagwaarden zoals
Open-Meteo ze teruggeeft, en de hele rekensom van ruwe waarde via normalisatie en weging naar de
dagscore. Plus de kanttekeningen bij die bewerking.

**Paklijst** — beweegt mee met het profiel én met de verwachting voor de gekozen regio. Zakt het
vriespunt, dan verschijnen muts en handschoenen; gaat het waaien, dan de stormharingen. Regels met
het label *weer* staan er alleen in omdat de voorspelling erom vraagt. Onderaan elke groep staat een
regel om er zelf iets aan toe te voegen — die telt gewoon mee als vinkje en krijgt een ×'je om hem
weer weg te halen. Groepen met *ieder apart* (Kleding, Op de fiets, Op pad, Aan het water) geven elk
zelf toegevoegd item ook een vinkje per persoon. Elk item heeft een notitieveld.

**Boodschappen** — een losse lijst, geen relatie met de paklijst en geen weerlogica: typen, Enter,
klaar. Afgevinkte producten zakken naar onderen; *Wis afgevinkte* ruimt ze in één keer op.

Zonder Supabase (zie hieronder) blijven vinkjes, notities, eigen paklijst-items en de boodschappen-
lijst per browser bewaard. Mét Supabase staat alles gedeeld en zie je elkaars wijzigingen vanzelf
verschijnen, zonder te hoeven verversen.

## Instellingen zitten in de URL

Profiel, vooruitkijkperiode, maximale rijtijd, vertrekdag, kleurmetriek, bron, tabblad en de
gekozen regio staan allemaal in de hash. Een specifieke weergave is dus te bookmarken of te appen:

```
/#p=hike&d=7&r=4&s=2&m=sun&h=1&k=1&g=Dolomieten&t=map
```

`p` = `bike` | `hike` | `chill`, `d` = 2–10 dagen, `r` = 1–10 uur rijden (10 = alles),
`s` = vertrekdag als index in de voorspelling, `m` = `score` | `rain` | `sun` | `tmax` | `wind` | `frz`,
`h` = `1` voor de historische bron (weglaten voor de voorspelling; `m=score` of `m=frz` samen met
`h=1` valt terug op `rain`, die twee bestaan niet historisch),
`g` = regionaam, `k` = dag binnen de periode (weglaten voor het gemiddelde),
`t` = `map` | `rank` | `matrix` | `pack` | `shop` | `data`.

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

`cleanUrls` en `trailingSlash` houden de URL's schoon; `index.html`, `styles.css` en `js/*.js`
krijgen `must-revalidate` zodat een nieuwe deploy overal meteen zichtbaar is — zonder dat zou een
gecachete oude `js/main.js` naast een verse `index.html` kunnen komen te staan. Verder staat er een
Content-Security-Policy die `default-src
'none'` als basis neemt en per soort bestand precies openzet wat nodig is: `'self'` voor de eigen
`styles.css` en `js/*.js`, `cdn.jsdelivr.net` voor de Supabase-client, Google Fonts (css) en
`fonts.gstatic.com` (de fontbestanden) voor de typografie, en `api.open-meteo.com` plus
`*.supabase.co` (ook `wss://`, voor Realtime) voor data.

> Zet je Vercel Web Analytics of Speed Insights aan, dan injecteert Vercel een script vanaf
> `/_vercel/insights/…`. `script-src` staat al open voor `'self'`; voeg dan ook `'self'` toe aan
> `connect-src` in `vercel.json`, anders blokkeert de CSP de meetbeacon.

## Lokaal bekijken

```bash
python3 -m http.server 8000
```

en open <http://localhost:8000>.

## Tests

```bash
cd tests
npm ci
npx playwright install chromium   # eenmalig
npm test
```

52 browsertests over kaart, tabbladen, paklijst en boodschappen, op desktop en
mobiel, in ongeveer twintig seconden. Open-Meteo en Supabase worden afgevangen, dus
er is geen netwerk en geen echte database nodig en de uitkomst is altijd hetzelfde.
Daarnaast een ESLint-check (`npm run lint`) die alleen op `no-undef` en dode code let —
geen stijlregels, wel de klasse fout (een vergeten import) die anders pas in de browser
opvalt. Beide draaien automatisch op elke pull request (zie `.github/workflows/tests.yml`).
Meer erover in [`tests/README.md`](tests/README.md).

## Waarom deze techniek

Kort: **statische bestanden, geen build-stap, Supabase voor wat gedeeld moet zijn.**
Dat is een bewuste keuze, geen toeval, en het staat hier zodat we het over een jaar
niet opnieuw hoeven uit te zoeken.

- **Geen build-stap, geen framework.** De app wordt een paar keer per jaar aangeraakt.
  Een Next.js- of Vite-opzet zou hier *fragieler* zijn, niet robuuster: dan is er een
  `node_modules` die veroudert, een build die kan breken, en een framework dat om de
  zoveel tijd een migratie wil. Nu zijn het bestanden die de browser rechtstreeks laadt
  en die het over vijf jaar nog gewoon doen.
- **ES-modules in plaats van één script.** De logica staat als `<script type="module">`
  opgeknipt in `js/*.js` — elk bestand één onderwerp (kaart, paklijst, boodschappen,
  Supabase-sync, …), met gewone `import`/`export` ertussen. Dat kan zonder build-stap:
  browsers laden modules al jaren native. `index.html` zelf is nu alleen nog opmaak.
- **Supabase** voor de gedeelde lijstjes: Postgres met een REST-laag en live updates,
  gratis voor dit volume, en geen server die wij moeten onderhouden. Het alternatief
  (zelf een API'tje, of Firebase) is hier niet beter.
- **Vercel** serveert statische bestanden. Er is met opzet géén `package.json` in de
  root, zodat er ook niets te bouwen valt; het testgereedschap staat in `tests/`.
- **Open-Meteo** heeft geen sleutel nodig en is gratis voor dit gebruik.
- **Leaflet + OpenTopoMap** voor de kaart: Leaflet is open source (BSD-2-Clause), heeft
  geen build-stap nodig (net als de rest van de app — één `<script>`) en de tegels van
  OpenTopoMap zijn zelf ook open (OpenStreetMap-data, CC-BY-SA), passen thematisch bij
  een fiets/hike-app (reliëf, paden) en vragen geen sleutel of account. Beide komen via
  jsdelivr binnen, dus die host staat naast Open-Meteo en Supabase in de CSP van
  `vercel.json` (`script-src`/`style-src`/`img-src`). We gebruiken uitsluitend
  `L.circleMarker` (nooit `L.marker`), zodat Leaflet nooit zijn standaard marker-PNG's
  van een ander CDN probeert te laden.

**Wanneer je dit wél moet omgooien:** als een los `js/*.js`-bestand zelf weer te groot
wordt om in te werken, of als de app een reden krijgt om ergens *state* buiten de
browser te delen die Supabase niet dekt. Tot die tijd is een framework hier een
oplossing voor een probleem dat deze app niet heeft.

## Aanpassen

De logica staat in `js/`, één onderwerp per bestand:

| bestand | wat erin zit |
| --- | --- |
| `dom.js` | generieke hulpfuncties: `$`, `esc`, `clamp`, `fmt`, `slug`, datumnotatie |
| `regions.js` | `REGIONS`, `ARC`, `GEO`, `WEIGHTS`, `PARTS` — de bestemmingen en de weging |
| `metrics.js` | `METRICS` — wat er te kleuren valt (score, mm, zon, …) |
| `state.js` | de gedeelde `state`, cache, paklijst-vinkjes, de URL-hash |
| `net.js` | de gedeelde fetch-met-terugval (`getJSON`) |
| `weather.js` | scoreberekening, Open-Meteo ophalen, `derive()` |
| `historical.js` | het 15-jaars-gemiddelde achter de bron-toggle *Historisch* |
| `map.js` | de Leaflet-kaart: opbouw, de 32 stippen en hun kleur/tooltip per render |
| `dashboard.js` / `data-tab.js` | kerncijfers, föhnmeter, ranglijst, matrix, *onder de motorkap* |
| `packing-data.js` / `packing.js` | de paklijst-inhoud en -logica |
| `shopping.js` | de boodschappenlijst |
| `supabase-client.js` / `realtime.js` | de Supabase-verbinding en live sync |
| `render.js` / `ui.js` / `main.js` | de render-regisseur, alle DOM-events, en het opstarten |

Meestal is maar één bestand relevant:

- **Regio's** — `REGIONS` in `regions.js`. `lat`/`lon` is het punt waarvoor het weer wordt
  opgehaald én waar de stip op de kaart komt te staan; `drive` is de rijtijd vanaf Mayrhofen in
  uren (met de hand geschat, dus corrigeer gerust); `s` is een kortere naam voor op de kaart;
  `side` is puur informatief. Een regio toevoegen of verplaatsen hertekent de kaart vanzelf.
- **Weging** — `WEIGHTS` in `regions.js`, per profiel de weging van droogte, neerslagkans, zon,
  wind, temperatuur en vriespuntniveau. Sommeert per profiel naar 1.
- **Scorecurves** — de functie `dayParts` in `weather.js`. Het tabblad *Onder de motorkap* laat
  elke curve met formule en al zien, dus daar zie je meteen wat een aanpassing doet.
- **Paklijst** — de array `PACK` in `packing-data.js` bevat de ingebouwde groepen en regels. Een
  regel met `when` verschijnt alleen als de verwachting eraan voldoet, `why` legt in één zin uit
  waarom hij er staat. Een groep met `personal:true` (Kleding, Op de fiets, Op pad, Aan het water)
  krijgt een vinkje per persoon in plaats van één gedeeld vinkje. Zelf toegevoegde regels (via het
  `+`-veld onderaan een groep) staan niet in deze array — die leven in `packing_custom_items` (of
  lokaal, zonder Supabase) en volgen automatisch de `personal`-instelling van hun groep.
- **Cache** — `CACHE_TTL` (30 min) in `state.js` bepaalt hoe lang een resultaat in
  `sessionStorage` blijft staan. De knop *Ververs* omzeilt de cache altijd.

## Gedeelde paklijst (Supabase)

Zonder verdere configuratie werkt alles zoals eerst: per browser bewaard (`localStorage`). Vul je
een Supabase-project in, dan staat het gedeeld voor jullie allebei.

**Zo zet je hem aan**

1. Maak een gratis project op [supabase.com](https://supabase.com) (geen creditcard nodig voor de
   hobby-laag).
2. Pas het schema toe — kies één van de twee:

   **Automatisch, eenmalig instellen** (aanbevolen — daarna hoeft dit nooit meer met de hand)

   - Ga naar **Project Settings → Database → Connection string**, kies **Session pooler**, en vul
     je databasewachtwoord in de URI in (dat wachtwoord staat op diezelfde pagina, of reset het
     daar als je het kwijt bent).
   - Zet die URI als GitHub-secret: repo → **Settings → Secrets and variables → Actions →
     New repository secret**, naam `SUPABASE_DB_URL`, waarde de URI van hierboven.
   - Klaar. De workflow [`apply-schema.yml`](.github/workflows/apply-schema.yml) past
     `supabase/schema.sql` vanaf nu automatisch toe, elke keer dat dat bestand verandert en naar
     `main` gaat. Staat het secret er al vóórdat deze PR merget, dan gebeurt het vanzelf bij de
     merge. Zet je het pas daarna, ga dan naar **Actions → Supabase-schema toepassen → Run
     workflow** om hem alsnog te laten draaien.

   **Handmatig** (als je liever niets in GitHub-secrets zet)

   - Open **SQL Editor → New query** in Supabase, plak de inhoud van
     [`supabase/schema.sql`](supabase/schema.sql) en klik **Run**.

   Beide manieren zetten dezelfde drie tabellen neer — `packing_state` (vinkjes/notities),
   `packing_custom_items` (zelf toegevoegde paklijst-regels) en `shopping_items`
   (boodschappenlijst) — elk met rijbeveiliging die de sleutel beperkt tot rijen van deze ene reis.
   Het script is veilig om zo vaak te draaien als je wilt, en controleert zichzelf: staat er iets
   niet goed, dan krijg je een foutmelding in plaats van stil half werk. Bij de handmatige route
   hoort onderaan een tabel met **twaalf rijen** te verschijnen, vier policies per tabel; bij de
   automatische route is een groene run in de Actions-tab het teken. Zie je in de app *"de
   database laat dit nog niet toe"*, dan is dit de stap die je opnieuw moet doen.
3. Ga naar **Settings → API** en kopieer de **Project URL** en de publieke sleutel (de klassieke
   **anon**-sleutel of de nieuwere **publishable**-sleutel, `sb_publishable_…` — beide werken).
4. Zet ze bovenin `js/supabase-client.js`:
   ```js
   export const SUPABASE_URL = "https://xxxxxxxx.supabase.co";
   export const SUPABASE_ANON_KEY = "eyJ…";
   ```
5. Commit en push (of `vercel --prod`). Klaar — het tabblad *Paklijst* laat nu een *Wie ben jij*-
   knop zien (A of B), groepen met *ieder apart* krijgen twee vinkjes, elk item krijgt een
   notitieveld, en de nieuwe paklijst-regels en boodschappen staan gedeeld.

**Waarom de sessiepooler en niet de directe verbinding** — die werkt over gewoon IPv4, wat
GitHub Actions-runners nodig hebben; de directe verbinding van Supabase is IPv6-only tenzij je een
addon koopt. Voor een script als dit (op zichzelf staande statements, geen langlopende sessie)
maakt het verder niets uit.

**Hoe het werkt**

Elk ingebouwd item krijgt een stabiele sleutel (groep + omschrijving, geslugd) en per persoon een
eigen rij in `packing_state`: `gedeeld` voor de gewone spullen, `A`/`B` voor kleding, fiets-, wandel-
en zwemspullen. Zelf toegevoegde items krijgen dezelfde sleutel, dus hun vinkje/notitie werkt
identiek — alleen hun *bestaan* (label, groep) staat apart in `packing_custom_items`, zodat je ze
ook weer kunt verwijderen zonder een ingebouwd item aan te raken. Wijzigingen gaan via Supabase
Realtime meteen naar de ander door; komt de verbinding even niet tot stand, dan blijft alles gewoon
werken en probeert de pagina het bij het volgende bezoek aan het tabblad opnieuw.

**Kanttekening bij de beveiliging** — er zit geen login achter. De sleutel staat zichtbaar in de
broncode (dat is met Supabase de bedoeling; rijbeveiliging bepaalt wat hij mag) en is beperkt tot
deze drie tabellen en deze ene reis-id. Prima voor een privélink tussen jullie twee, niet geschikt
voor iets gevoeligers. Verwijderen kan zonder bevestiging — het ×'je is met opzet ruimer dan het
lijkt om te tikken (zie `.itemdel` in de CSS), en je krijgt een toast met wát er weg is.

**Voor de volgende reis** — wis de tabellen (`truncate packing_state, packing_custom_items,
shopping_items;` in de SQL Editor) of pas de `TRIP_ID`-constante aan én de bijbehorende waarde in
alle policies in `schema.sql`.

## Databron

Open-Meteo forecast API, best-match model, 10 dagen vooruit, geen API-sleutel. Gratis tot 10.000
calls per dag voor niet-commercieel gebruik; data onder CC BY 4.0. De app doet twee requests per
koude load — één voor alle 32 regio's samen, één voor de twee drukstations — en haalt daarna alles
uit de sessie-cache.

Voor de bron **Historisch** komen neerslag, zon, temperatuur en wind van Open-Meteo's Historical
Weather API (`archive-api.open-meteo.com`, ERA5-reanalyse, terug tot 1940) — zelfde vorm, geen
sleutel, alleen alle 32 regio's en alle vier velden tegelijk per jaar in plaats van per periode.
Die data staat lang genoeg vast (het is een klimatologisch gemiddelde) om 30 dagen in
`localStorage` te bewaren in plaats van in de sessie-cache.

## Kanttekeningen

De belangrijkste staan in de app zelf, op het tabblad *Onder de motorkap*. Kort samengevat: de
föhnmeter gebruikt naar zeeniveau herleide druk voor twee stations op verschillende hoogte, dus
alleen het teken en de verandering zijn het signaal; de rastercel van het model is grover dan een
Alpendal; en één meetpunt per regio is precies dat — een steekproef, geen dekking.
