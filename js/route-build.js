/* ------------------------------------------------------------------
   Van tussenpunten naar een route. Per etappe staat er in tour-data.js
   een handvol benoemde punten (hut, alp, pas, beek); hier worden dat de
   punten van een lijn die je op de kaart kan leggen en waar een
   hoogteprofiel uit te rekenen valt.

   Twee stappen:
   1. bijvullen — om de ±120 m een punt, met de hoogte er lineair tussenin;
   2. hoeken afronden — Chaikin, twee rondes. Dat haalt de knikken eruit
      zonder dat de lijn buiten de omhullende van de punten schiet (een
      spline zou dat wél doen, en dan loopt je route ineens door een wand).

   Het blijft een getrokken lijn tussen bekende punten, geen opgenomen
   track: goed genoeg om te zien waar de dag langsgaat, niet om blind op
   te navigeren. Ligt er wel een echte track, zet die dan als GPX in
   routes/ en verwijs er in tour-data.js naar — die gaat dan vóór.
------------------------------------------------------------------- */
import { dist } from "./gpx.js";

const STAP = 120;          // meter tussen twee punten van de lijn
const RONDES = 2;          // hoeveel keer Chaikin

const mix = (a, b, t) => ({
  lat: a.lat + (b.lat - a.lat) * t,
  lon: a.lon + (b.lon - a.lon) * t,
  ele: a.ele + (b.ele - a.ele) * t
});

function bijvullen(punten, stap = STAP){
  const uit = [];
  for(let i = 0; i < punten.length - 1; i++){
    const a = punten[i], b = punten[i+1];
    const n = Math.max(1, Math.round(dist(a, b) / stap));
    for(let k = 0; k < n; k++) uit.push(mix(a, b, k / n));
  }
  uit.push({ lat: punten.at(-1).lat, lon: punten.at(-1).lon, ele: punten.at(-1).ele });
  return uit;
}

/* Chaikin: elk segment vervangen door zijn kwart- en driekwartpunt. Het
   eerste en laatste punt blijven staan — de hut moet op de hut blijven. */
function afronden(punten, rondes = RONDES){
  let cur = punten;
  for(let r = 0; r < rondes; r++){
    const next = [cur[0]];
    for(let i = 0; i < cur.length - 1; i++){
      next.push(mix(cur[i], cur[i+1], 0.25), mix(cur[i], cur[i+1], 0.75));
    }
    next.push(cur.at(-1));
    cur = next;
  }
  return cur;
}

/* Tussenpunten → { points, waypoints } in hetzelfde formaat als parseGpx(),
   zodat de rest van de pagina niet hoeft te weten waar de route vandaan komt. */
export function bouwRoute(punten){
  const schoon = punten.map(p => ({ lat: p.lat, lon: p.lon, ele: p.ele }));
  return {
    points: afronden(bijvullen(schoon)),
    waypoints: punten.map(p => ({
      lat: p.lat, lon: p.lon, ele: p.ele,
      name: p.naam, desc: p.note || "", type: p.type || ""
    })),
    gebouwd: true
  };
}
