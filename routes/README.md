# routes/ — de GPX van de tocht

Hier staat `greina-2026.gpx`: onze komoot-planning van Curaglia tot Campo (Blenio), in één stuk, met
de drie geboekte hutten als `<wpt>`. `TOUR.gpx` in [`js/tour-data.js`](../js/tour-data.js) wijst
ernaar en [`js/route-split.js`](../js/route-split.js) knipt 'm per dag op.

Zonder zo'n bestand trekt de pagina zelf een lijn door de benoemde `punten` van elke etappe
([`js/route-build.js`](../js/route-build.js)) — goed genoeg om te zien waar de dag langsgaat, maar
geen opgenomen track, en het etappekaartje zegt dat er dan bij.

Een andere of nieuwere track erin zetten kan op twee manieren.

**Eén bestand voor de hele tocht** — zoals komoot een meerdaagse tour exporteert:

1. Zet het bestand hier neer, bijvoorbeeld `greina-2026.gpx`.
2. Zet in `js/tour-data.js` bij `TOUR`: `gpx: "routes/greina-2026.gpx"`.

`js/route-split.js` knipt het per dag op. Staan de dagen als losse `<trk>`'s in het bestand (zo doet
komoot het meestal), dan wordt elke track gekoppeld aan de etappe waarvan begin en eind er het dichtst
bij liggen; een omgekeerd gereden track wordt omgedraaid. Is het één doorlopende track, dan wordt er
geknipt bij het punt dat het dichtst bij elke hut ligt, in volgorde — zodat een hut die twee keer
voorkomt (eind van de ene dag, begin van de volgende) niet in de war raakt. Ligt een hut verder dan
1,5 km van de track, dan wordt die dag overgeslagen en blijft de getrokken lijn staan.

Staat de hut als `<wpt>` in het bestand, dan wordt er op dát punt geknipt in plaats van op de
coördinaat uit `tour-data.js` — namen hoeven niet letterlijk gelijk te zijn ("Motterascio Hut" en
"Capanna Motterascio CAS" vinden elkaar; woorden die in élke huttennaam zitten, zoals *capanna* en
*hütte*, tellen daarbij niet mee). Dat scheelt de paar honderd meter aan begin en eind die je anders
kwijtraakt aan een coördinaat die nét ergens anders ligt.

**Of één bestand per dag:**

1. Zet het bestand hier neer, bijvoorbeeld `2026-09-13-medelserhuette-motterascio.gpx`.
2. Zet in `js/tour-data.js` bij die etappe `gpx: "routes/2026-09-13-medelserhuette-motterascio.gpx"`.

Een eigen bestand per etappe gaat vóór het bestand van de hele tocht.

Afstand, stijgen, dalen en het hoogteprofiel komen dan uit het bestand. Lukt het ophalen niet — offline,
bestand hernoemd — dan valt de pagina stilletjes terug op de punten uit `tour-data.js`.

Gelezen wordt: `<trkpt>` (anders `<rtept>`) voor de lijn, `<wpt>` voor de benoemde tussenpunten,
`<ele>` voor de hoogte. Ontbreekt `<ele>` helemaal, dan worden de hoogtes van de hutten en passen uit
`tour-data.js` op de track gehangen en daartussen geïnterpoleerd — een grove schets, maar beter dan
een leeg profiel.

Andersom kan ook: op de pagina zit per dag een knop **GPX voor deze dag**, en een **GPX hele tocht** —
die schrijft wat je op het scherm ziet naar een bestand dat komoot, de swisstopo-app en Garmin openen.
