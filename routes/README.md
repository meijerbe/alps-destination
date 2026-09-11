# routes/ — echte GPX-tracks

Leeg is prima. De huttentochtpagina trekt haar lijnen standaard zélf: per etappe staat er in
[`js/tour-data.js`](../js/tour-data.js) een rijtje benoemde `punten` (hut, alp, pas, beek, met hoogte),
en [`js/route-build.js`](../js/route-build.js) maakt daar een vloeiende lijn van. Goed genoeg om te zien
waar de dag langsgaat — het is geen opgenomen track.

Heb je wél een echte track (komoot-export, swisstopo, een horloge), dan gaat die vóór:

1. Zet het bestand hier neer, bijvoorbeeld `2026-09-13-medelserhuette-motterascio.gpx`.
2. Zet in `js/tour-data.js` bij die etappe `gpx: "routes/2026-09-13-medelserhuette-motterascio.gpx"`.

Afstand, stijgen, dalen en het hoogteprofiel komen dan uit het bestand. Lukt het ophalen niet — offline,
bestand hernoemd — dan valt de pagina stilletjes terug op de punten uit `tour-data.js`.

Gelezen wordt: `<trkpt>` (anders `<rtept>`) voor de lijn, `<wpt>` voor de benoemde tussenpunten,
`<ele>` voor de hoogte. Zonder hoogte werkt de rest gewoon, alleen het profiel blijft dan leeg.

Andersom kan ook: op de pagina zit per dag een knop **GPX voor deze dag**, en een **GPX hele tocht** —
die schrijft wat je op het scherm ziet naar een bestand dat komoot, de swisstopo-app en Garmin openen.
