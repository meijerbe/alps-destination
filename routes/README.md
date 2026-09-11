# routes/ — echte GPX-tracks

Leeg is prima. De huttentochtpagina trekt haar lijnen standaard zélf: per etappe staat er in
[`js/tour-data.js`](../js/tour-data.js) een rijtje benoemde `punten` (hut, alp, pas, beek, met hoogte),
en [`js/route-build.js`](../js/route-build.js) maakt daar een vloeiende lijn van. Goed genoeg om te zien
waar de dag langsgaat — het is geen opgenomen track.

Heb je wél een echte track (komoot-export, swisstopo, een horloge), dan gaat die vóór. Dat kan op
twee manieren.

**Eén bestand voor de hele tocht** — zoals komoot een meerdaagse tour exporteert:

1. Zet het bestand hier neer, bijvoorbeeld `greina-2026.gpx`.
2. Zet in `js/tour-data.js` bij `TOUR`: `gpx: "routes/greina-2026.gpx"`.

`js/route-split.js` knipt het per dag op. Staan de dagen als losse `<trk>`'s in het bestand (zo doet
komoot het meestal), dan wordt elke track gekoppeld aan de etappe waarvan begin en eind er het dichtst
bij liggen; een omgekeerd gereden track wordt omgedraaid. Is het één doorlopende track, dan wordt er
geknipt bij het punt dat het dichtst bij elke hut ligt, in volgorde — zodat een hut die twee keer
voorkomt (eind van de ene dag, begin van de volgende) niet in de war raakt. Ligt een hut verder dan
1,5 km van de track, dan wordt die dag overgeslagen en blijft de getrokken lijn staan.

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
