/* ------------------------------------------------------------------
   Waar ben ik, en hoeveel heb ik nog te gaan?

   Eén druk op de knop zet de telefoon aan het volgen. Bij elke nieuwe
   positie zoeken we het dichtstbijzijnde punt van de route van de dag
   die op dat moment openstaat, en daaruit rolt het enige wat je halverwege
   een klim wil weten: hoe ver ben ik, wat ligt er nog voor me, en hoeveel
   klimmen zit daar nog in.

   Geen kaartje met een pijl die je de berg op stuurt — de route is een
   lijn op een kaart, niet een navigatie-instructie. Dit vertelt alleen
   waar je staat ten opzichte van de dag.
------------------------------------------------------------------- */
import { $ } from "./dom.js";
import { dist } from "./gpx.js";
import { zetIk, wisIk } from "./tour-map.js";

const VER_VAN_DE_ROUTE = 250;    // meter waarboven we het zeggen

let etappes = [];
let welkeDag = () => 0;
let wachter = null;              // id van watchPosition
let restCache = new Map();       // route → resterende stijging per punt

const km1 = n => n.toFixed(1).replace(".", ",");

/* Hoeveel klimmen er vanaf elk punt nog komt. Eén keer per route
   uitrekenen; een lijst van 1400 punten is zo doorlopen, maar niet bij
   elke positiefix opnieuw. */
function restStijging(route){
  if(restCache.has(route)) return restCache.get(route);
  const p = route.points;
  const rest = new Array(p.length).fill(0);
  for(let i = p.length - 2; i >= 0; i--){
    const d = (p[i+1].ele ?? 0) - (p[i].ele ?? 0);
    rest[i] = rest[i+1] + (d > 0 ? d : 0);
  }
  restCache.set(route, rest);
  return rest;
}

/* Het punt van de route waar we het dichtst bij staan. */
function dichtstbij(points, hier){
  let best = 0, bd = Infinity;
  for(let i = 0; i < points.length; i++){
    const d = dist(points[i], hier);
    if(d < bd){ bd = d; best = i; }
  }
  return { i: best, d: bd };
}

/* Het eerstvolgende benoemde punt dat nog vóór ons ligt. */
function volgendePunt(e, vanafIndex){
  const p = e.route.points;
  let beste = null;
  for(const w of e.route.waypoints){
    if(!w.name) continue;
    const { i } = dichtstbij(p, w);
    if(i <= vanafIndex + 1) continue;
    if(!beste || i < beste.i) beste = { i, w };
  }
  return beste;
}

function zin(e, stats, hier, nauwkeurig){
  const { i, d } = dichtstbij(e.route.points, hier);
  const gedaan = stats.cum[i] / 1000;
  const rest = (stats.m - stats.cum[i]) / 1000;
  const klim = restStijging(e.route)[i];
  const nog = volgendePunt(e, i);

  // Sta je ver van de lijn af, dan is "nog 1,0 km te gaan" misleidend: dat
  // geldt langs de route, niet vanaf waar jij staat. Dus dan eerst dát.
  if(d > VER_VAN_DE_ROUTE){
    return `Je staat ${Math.round(d)} m van de lijn van vandaag af. `
      + `Het dichtstbijzijnde punt van de route ligt op km ${km1(gedaan)} van ${km1(stats.km)}.`;
  }

  const stukken = [
    `Km ${km1(gedaan)} van ${km1(stats.km)}`,
    `nog ${km1(rest)} km en ±${Math.round(klim / 10) * 10} m klimmen`
  ];
  if(nog){
    const naar = (stats.cum[nog.i] - stats.cum[i]) / 1000;
    stukken.push(`volgende: ${nog.w.name} over ${km1(naar)} km`);
  }
  return stukken.join(", ") + (nauwkeurig > 50 ? ` (positie ±${Math.round(nauwkeurig)} m)` : "") + ".";
}

function meld(tekst, fout){
  const el = $("livestand");
  if(!el) return;
  el.textContent = tekst;
  el.classList.toggle("err", !!fout);
}

function stop({ stil = true } = {}){
  if(wachter != null) navigator.geolocation.clearWatch(wachter);
  wachter = null;
  wisIk();
  const b = $("locate");
  b.textContent = "Waar ben ik";
  b.setAttribute("aria-pressed", "false");
  if(stil) meld("");
}

function start(){
  if(!navigator.geolocation){ meld("Deze browser geeft geen locatie door.", true); return; }
  const b = $("locate");
  b.textContent = "Volgen uit";
  b.setAttribute("aria-pressed", "true");
  meld("Locatie zoeken…");

  wachter = navigator.geolocation.watchPosition(pos => {
    const { latitude: lat, longitude: lon, accuracy } = pos.coords;
    zetIk(lat, lon, accuracy, true);
    const i = welkeDag();
    const e = etappes[i < 0 ? 0 : i];
    if(!e){ meld("Hier sta je."); return; }
    meld(zin(e, e.stats, { lat, lon }, accuracy));
  }, err => {
    // Geen toestemming is definitief; al het andere is onderweg de normale
    // gang van zaken — een dal in lopen, een wolk, een seconde geen fix. Dan
    // blijven we gewoon luisteren: de volgende meting overschrijft dit weer.
    if(err.code === 1){
      meld("Geen toestemming voor locatie — zet het aan in de browserinstellingen.", true);
      stop({ stil: false });
      return;
    }
    meld("Even geen positie — blijft proberen. Buiten, met zicht op de hemel, gaat het meestal vanzelf.", true);
  }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
}

export function koppelLive(lijst, dagNu){
  etappes = lijst;
  welkeDag = dagNu;
  $("locate").addEventListener("click", () => (wachter == null ? start() : stop()));
  // volgen kost batterij; zodra de pagina echt weg is, zetten we het uit
  window.addEventListener("pagehide", stop);
}
