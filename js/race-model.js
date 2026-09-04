/* ==================================================================
   Het rekenmodel achter de finishtijden. Alleen wiskunde: geen DOM,
   geen opslag, niets dat weet hoe de app eruitziet — zo is elke stap
   los na te rekenen (en staat hij ook uitgelegd in het tabblad).

   In het kort, in drie stappen:
     1. hoogtemeters omrekenen naar vlakke kilometers  → "effectieve km"
     2. je referentietijd over die afstand uitrekken    → Riegel
     3. er een spreiding omheen leggen                  → lognormaal
================================================================== */
import { climbById, duurById, techById, grondById } from "./race-data.js";

/* ---------- tijd lezen en schrijven ---------- */

// "4:37", "4:37:20", "52" (minuten) → seconden. Alles wat er niet op lijkt: null.
export function parseDur(str){
  const s = String(str || "").trim().replace(",", ".");
  if(!s) return null;
  const m = s.match(/^(\d{1,2}):([0-5]?\d)(?::([0-5]?\d))?$/);
  if(m) return (+m[1])*3600 + (+m[2])*60 + (+(m[3] || 0));
  const min = s.match(/^(\d{1,3}(?:\.\d+)?)$/);
  if(min) return Math.round(+min[1] * 60);
  return null;
}
// seconden → "4:37" (uren:minuten, altijd twee cijfers achter de dubbele punt)
export function fmtDur(secs){
  if(secs == null || !isFinite(secs)) return "–";
  const t = Math.max(0, Math.round(secs));
  const u = Math.floor(t/3600), m = Math.round((t - u*3600)/60);
  return m === 60 ? `${u+1}:00` : `${u}:${String(m).padStart(2,"0")}`;
}
// "07:00" → seconden na middernacht (en terug)
export function parseClock(str){
  const m = String(str || "").trim().match(/^(\d{1,2}):([0-5]\d)$/);
  return m ? (+m[1])*3600 + (+m[2])*60 : null;
}
export function fmtClock(secs){
  const t = ((Math.round(secs/60)*60) % 86400 + 86400) % 86400;
  return `${String(Math.floor(t/3600)).padStart(2,"0")}:${String(Math.floor(t%3600/60)).padStart(2,"0")}`;
}
// tempo per effectieve kilometer, "5:42/km"
export function fmtPace(secsPerKm){
  if(!isFinite(secsPerKm)) return "–";
  const m = Math.floor(secsPerKm/60), s = Math.round(secsPerKm - m*60);
  return s === 60 ? `${m+1}:00` : `${m}:${String(s).padStart(2,"0")}`;
}

/* ---------- normale verdeling ---------- */

// Abramowitz & Stegun 7.1.26 — ruim nauwkeurig genoeg voor kansen die we
// toch als "ongeveer 70%" opschrijven.
function erf(x){
  const s = Math.sign(x); x = Math.abs(x);
  const t = 1/(1 + 0.3275911*x);
  const y = 1 - ((((1.061405429*t - 1.453152027)*t + 1.421413741)*t - 0.284496736)*t + 0.254829592)*t*Math.exp(-x*x);
  return s*y;
}
export const normCdf = z => 0.5*(1 + erf(z/Math.SQRT2));
const Z90 = 1.2815515655446004;   // 10e/90e percentiel
const Z75 = 0.6744897501960817;   // 25e/75e percentiel

/* ---------- stap 1: effectieve kilometers ---------- */

// Hoogtemeters kosten tijd, dus tellen ze als extra vlakke kilometers. De
// afdaling zit in dezelfde vuistregel verstopt: op een rondje daal je alles
// weer af, en dat is precies de situatie waarvoor "1 km per 100 hm" ooit is
// afgeregeld. Een route die alleen maar klimt (een vertical) valt er dus buiten.
export const effortKm = (dist, gain, cost) => dist + (gain || 0)/cost;

/* ---------- stap 2 en 3: de voorspelling ---------- */

/* Onzekerheid, in log-eenheden (≈ procenten). Opgeteld uit vier stukjes:
   ook een perfect ingevulde referentie voorspelt geen wedstrijd exact. */
const SIG_BASIS   = 0.07;   // dagvorm, weer, hoe de wedstrijd valt
const SIG_REK     = 0.09;   // per e-voud dat je de referentie uitrekt
const SIG_LANG    = 0.05;   // boven de vier uur: maag, kramp, opblazen

export function predict(runner, race, climbId){
  const cost = climbById(climbId).cost;
  const duur = duurById(runner.duur), tech = techById(runner.tech), grond = grondById(runner.grond);
  const refSecs = runner.ref_secs;
  if(!refSecs || !(runner.ref_dist > 0)) return null;

  const eRef  = effortKm(runner.ref_dist, runner.ref_gain, cost);
  const eRace = effortKm(race.dist, race.gain, cost);
  const rek   = eRace/eRef;
  const adj   = 1 + (runner.adjust || 0)/100;

  // Riegel: dezelfde loper wordt per kilometer langzamer naarmate de afstand
  // groeit. t2 = t1 · (d2/d1)^exp, met de effectieve afstanden.
  const base  = refSecs * Math.pow(rek, duur.exp);
  const secs  = base * grond.f * tech.f * adj;

  const sigma = Math.min(0.30,
      SIG_BASIS
    + SIG_REK * Math.abs(Math.log(rek))
    + tech.extra
    + (secs > 4*3600 ? SIG_LANG * Math.min(1, (secs/3600 - 4)/4) : 0));

  const q = z => secs * Math.exp(z*sigma);
  const start = parseClock(race.start) ?? 0;
  return {
    race, eRef, eRace, rek, exp: duur.exp, grondF: grond.f, techF: tech.f, adj,
    secs, sigma, start,
    p10: q(-Z90), p25: q(-Z75), p75: q(Z75), p90: q(Z90),
    finish: start + secs, finishLo: start + q(-Z90), finishHi: start + q(Z90),
    paceRef: refSecs/eRef, pace: secs/eRace, paceRaw: secs/race.dist
  };
}

// Kans dat deze loper binnen `secs` finisht.
export const pUnder = (pred, secs) => normCdf(Math.log(secs/pred.secs)/pred.sigma);

/* Kans dat a eerder over de finish komt dan b — met hun eigen starttijd erin,
   want dat is de vraag die je aan de finish stelt. Twee lognormalen met een
   verschuiving ertussen hebben geen nette formule, dus integreren we over de
   verdeling van a numeriek: 600 stapjes is ruim genoeg voor twee decimalen. */
export function pBefore(a, b){
  const N = 600, lo = Math.log(a.secs) - 4.5*a.sigma, hi = Math.log(a.secs) + 4.5*a.sigma;
  const du = (hi - lo)/N;
  let p = 0;
  for(let i = 0; i <= N; i++){
    const u = lo + i*du;
    const dens = Math.exp(-0.5*Math.pow((u - Math.log(a.secs))/a.sigma, 2)) / (a.sigma*Math.sqrt(2*Math.PI));
    // b is later binnen als b's finishklok voorbij a's finishklok ligt
    const nodig = a.start + Math.exp(u) - b.start;
    const later = nodig <= 0 ? 1 : 1 - normCdf(Math.log(nodig/b.secs)/b.sigma);
    const w = (i === 0 || i === N) ? 0.5 : 1;      // trapezium
    p += w * dens * later * du;
  }
  return Math.min(1, Math.max(0, p));
}

/* ---------- uitslagen van een eerdere editie ---------- */

// Plukt per regel de eerste tijd die op u:mm:ss lijkt — met dubbele punt of
// punt als scheidingsteken, want dat verschilt per uitslagensite. Rommel
// eromheen (plaats, naam, land, categorie) mag gewoon blijven staan.
//
// Bewust de EERSTE match per regel, niet allemaal: D-U-V (en andere uitgebreide
// uitslagen) zet naast de officiële tijd ook een leeftijdsgecorrigeerde tijd op
// dezelfde regel, en die is geen kloktijd — meetellen zou elk veld stiekem
// verdubbelen met verzonnen extra "finishers". Zie race.js voor de tegenhanger:
// rechtstreeks opgehaalde HTML heeft zelden echte regeleinden, dus die wordt
// eerst op rijgrenzen geknipt vóórdat hij hier binnenkomt.
export function parseResults(text){
  const out = [];
  String(text || "").split(/[\n\r]+/).forEach(line => {
    const m = line.match(/(?<![\d.:])(\d{1,2})[:.]([0-5]\d)[:.]([0-5]\d)(?![\d.:])/);
    if(m) out.push((+m[1])*3600 + (+m[2])*60 + (+m[3]));
  });
  return out.sort((a,b) => a - b);
}

// De opgeschoonde lijst zoals we hem bewaren en delen: alleen de tijden,
// geen namen — dat scheelt ruimte en er hoeft niemands naam de database in.
export const toonResults = tijden =>
  tijden.map(t => `${Math.floor(t/3600)}:${String(Math.floor(t%3600/60)).padStart(2,"0")}:${String(t%60).padStart(2,"0")}`).join("\n");

export function statsOf(sorted){
  const n = sorted.length;
  if(!n) return null;
  const q = p => {
    const i = (n - 1)*p, lo = Math.floor(i), hi = Math.ceil(i);
    return sorted[lo] + (sorted[hi] - sorted[lo])*(i - lo);
  };
  const mean = sorted.reduce((a,b) => a + b, 0)/n;
  const sd = n > 1 ? Math.sqrt(sorted.reduce((a,b) => a + (b-mean)**2, 0)/(n-1)) : 0;
  return {n, min: sorted[0], max: sorted[n-1], mean, sd,
          p10: q(0.10), p25: q(0.25), med: q(0.50), p75: q(0.75), p90: q(0.90)};
}

// Hoeveel finishers zaten er vóór deze tijd (1 = winnaar).
export function placeOf(sorted, secs){
  let i = 0;
  while(i < sorted.length && sorted[i] < secs) i++;
  return i + 1;
}

/* Kans dat elk van deze lopers als eerste van het hele gezelschap binnen is:
   voor ieder de eigen verdeling, vermenigvuldigd met de kans dat alle anderen
   op dat moment nog onderweg zijn. Zelfde integratie als hierboven. */
export function pFirst(preds){
  return preds.map(a => {
    const N = 400, lo = Math.log(a.secs) - 4.5*a.sigma, hi = Math.log(a.secs) + 4.5*a.sigma;
    const du = (hi - lo)/N;
    let p = 0;
    for(let i = 0; i <= N; i++){
      const u = lo + i*du;
      const dens = Math.exp(-0.5*Math.pow((u - Math.log(a.secs))/a.sigma, 2)) / (a.sigma*Math.sqrt(2*Math.PI));
      let alleen = 1;
      preds.forEach(b => {
        if(b === a) return;
        const nodig = a.start + Math.exp(u) - b.start;
        alleen *= nodig <= 0 ? 1 : 1 - normCdf(Math.log(nodig/b.secs)/b.sigma);
      });
      p += ((i === 0 || i === N) ? 0.5 : 1) * dens * alleen * du;
    }
    return Math.min(1, Math.max(0, p));
  });
}

// Dichtheid van de finishtijd op `secs` — de klokvorm onder de tijdlijn.
export const density = (pred, secs) =>
  Math.exp(-0.5*Math.pow(Math.log(secs/pred.secs)/pred.sigma, 2)) / (secs*pred.sigma*Math.sqrt(2*Math.PI));
