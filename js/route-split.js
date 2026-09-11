/* ------------------------------------------------------------------
   Eén GPX van de hele tocht opknippen in dagen.

   Exporteer je de tocht in één bestand, dan hoef je hem hier niet met
   de hand op te delen: zet `gpx` op TOUR in tour-data.js en deze module
   zoekt per etappe het stuk erbij. Twee gevallen:

   1. Het bestand bevat net zoveel <trk>'s als er etappes zijn (zo
      exporteert komoot een meerdaagse tour meestal). Dan wordt elke
      track aan de etappe gekoppeld waarvan begin- en eindpunt er het
      dichtst bij liggen — omgekeerd gereden tracks worden omgedraaid.
   2. Het is één doorlopende track. Dan wordt er geknipt op het punt dat
      het dichtst bij elke hut ligt, in volgorde, zodat een hut die twee
      keer voorkomt (eind van de ene dag, begin van de volgende) niet
      verwart.

   Past een etappe niet — het stuk is leeg, of de hut ligt kilometers van
   de track — dan geeft deze module voor die dag niets terug en valt de
   pagina terug op de getrokken lijn uit de tussenpunten.
------------------------------------------------------------------- */
import { dist } from "./gpx.js";

const MAX_AFSTAND = 1500;      // meter die een hut van de track mag liggen
const MAX_NAAM = 2000;         // zover mag een gelijknamig waypoint ernaast liggen

/* Woorden die in elke huttennaam voorkomen en dus niets onderscheiden. */
const RUIS = new Set(["capanna", "camona", "hutte", "huette", "cabane", "rifugio",
  "refuge", "berghaus", "hut", "sac", "cas", "sat", "alpe"]);

const woorden = naam => new Set(
  String(naam || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().split(/[^a-z0-9]+/)
    .filter(w => w.length >= 4 && !RUIS.has(w))
);

/* Heet dit waypoint uit het bestand hetzelfde als dit tussenpunt van ons?
   "Capanna Motterascio CAS" en "Motterascio Hut" horen bij elkaar,
   "Capanna Motterascio" en "Capanna Scaletta" niet — vandaar dat de
   woorden die in élke huttennaam zitten niet meetellen. */
function zelfdePlek(a, b){
  const wa = woorden(a), wb = woorden(b);
  for(const w of wa) if(wb.has(w)) return true;
  return false;
}

/* Het punt waar we willen knippen. Noemt het bestand de hut zelf bij naam,
   dan is dát het punt — die staat exacter dan onze eigen opgave, en het
   scheelt een paar honderd meter aan begin en eind van elke etappe. */
function knippunt(eigen, wpts){
  const kandidaten = (wpts || [])
    .filter(w => zelfdePlek(w.name, eigen.naam))
    .map(w => ({ w, d: dist(w, eigen) }))
    .filter(k => k.d <= MAX_NAAM)
    .sort((a, b) => a.d - b.d);
  return kandidaten.length ? kandidaten[0].w : eigen;
}

const eersteLaatste = (e, wpts) =>
  [knippunt(e.punten[0], wpts), knippunt(e.punten.at(-1), wpts)];

/* Index van het punt dat het dichtst bij `doel` ligt, vanaf `vanaf`. */
function dichtstbij(points, doel, vanaf = 0){
  let best = vanaf, bd = Infinity;
  for(let i = vanaf; i < points.length; i++){
    const d = dist(points[i], doel);
    if(d < bd){ bd = d; best = i; }
  }
  return { i: best, d: bd };
}

/* Geval 1: losse tracks aan etappes koppelen. */
function perTrack(tracks, etappes, wpts){
  const vrij = tracks.slice();
  return etappes.map(def => {
    const [start, eind] = eersteLaatste(def, wpts);
    let beste = null;
    vrij.forEach((t, idx) => {
      const kop = t.points[0], staart = t.points.at(-1);
      const heen = dist(kop, start) + dist(staart, eind);
      const terug = dist(staart, start) + dist(kop, eind);
      const score = Math.min(heen, terug);
      if(!beste || score < beste.score) beste = { idx, score, omdraaien: terug < heen };
    });
    if(!beste || beste.score > MAX_AFSTAND * 2) return null;
    const t = vrij.splice(beste.idx, 1)[0];
    return beste.omdraaien ? t.points.slice().reverse() : t.points;
  });
}

/* Geval 2: één doorlopende track in stukken knippen bij de hutten. */
function doorknippen(points, etappes, wpts){
  const uit = [];
  let vanaf = 0;
  for(const def of etappes){
    const [start, eind] = eersteLaatste(def, wpts);
    const a = dichtstbij(points, start, vanaf);
    const b = dichtstbij(points, eind, a.i + 1);
    if(a.d > MAX_AFSTAND || b.d > MAX_AFSTAND || b.i - a.i < 2){ uit.push(null); continue; }
    uit.push(points.slice(a.i, b.i + 1));
    vanaf = b.i;      // de volgende dag begint waar deze ophield
  }
  return uit;
}

/* Sommige exports laten <ele> weg. Dan zou het hoogteprofiel leeg blijven,
   terwijl we van de hutten en passen wél weten hoe hoog ze liggen: die
   hangen we op de dichtstbijzijnde punten van de track en daartussen
   interpoleren we. Een grove schets, maar beter dan een lege grafiek. */
function hoogteBijschatten(points, punten){
  if(points.some(p => p.ele != null)) return points;
  const ankers = punten
    .filter(p => p.ele != null)
    .map(p => ({ i: dichtstbij(points, p).i, ele: p.ele }))
    .sort((a, b) => a.i - b.i);
  if(ankers.length < 2) return points;

  return points.map((p, i) => {
    if(i <= ankers[0].i) return { ...p, ele: ankers[0].ele };
    if(i >= ankers.at(-1).i) return { ...p, ele: ankers.at(-1).ele };
    const k = ankers.findIndex(a => a.i > i);
    const v = ankers[k - 1], n = ankers[k];
    const t = (i - v.i) / Math.max(1, n.i - v.i);
    return { ...p, ele: v.ele + (n.ele - v.ele) * t };
  });
}

/* Route van de hele tocht + de etappes → een lijst met per etappe een
   `{ points, waypoints, uitGpx }` of `null`. De tussenpunten uit
   tour-data.js blijven de waypoints: dat zijn de namen die de pagina
   toont, en die staan los van de track zelf. */
export function splitsTocht(route, etappes){
  const wpts = route.waypoints || [];
  const stukken = (route.tracks && route.tracks.length >= etappes.length)
    ? perTrack(route.tracks, etappes, wpts)
    : doorknippen(route.points, etappes, wpts);

  return stukken.map((points, i) => {
    if(!points || points.length < 2) return null;
    const def = etappes[i];
    // waypoints uit het bestand die binnen deze dag vallen gaan mee, plus
    // altijd de benoemde tussenpunten van de etappe zelf
    const eigen = def.punten.map(p => ({
      lat: p.lat, lon: p.lon, ele: p.ele, name: p.naam, desc: p.note || "", type: p.type || ""
    }));
    return { points: hoogteBijschatten(points, def.punten), waypoints: eigen, uitGpx: true };
  });
}
