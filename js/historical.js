/* ------------------------------------------------------------------
   Historische weergave: hoe zag het weer er in de gekozen kalenderweek
   gemiddeld uit over de laatste HIST_YEARS jaar? Los van de 10-daagse
   voorspelling — dit is een klimatologisch gemiddelde, geen voorspelling,
   en dient om regio's te vinden die in deze periode van het jaar
   doorgaans gunstig zijn, ook als de actuele voorspelling nog onzeker is.

   Bron: Open-Meteo Historical Weather API (ERA5-reanalyse, terug tot
   1940, gratis, geen sleutel) — dezelfde vorm als de forecast-call:
   alle regio's in één request per jaar. Geen "score" en geen "vriespunt"
   historisch: score leunt op neerslagkans (bestaat niet met terugwerkende
   kracht) en vriespunt zou uurdata over 15 jaar × alle regio's vergen —
   dat staat niet in verhouding tot wat het toevoegt.
------------------------------------------------------------------- */
import { REGIONS } from "./regions.js";
import { getJSON } from "./net.js";

export const HIST_YEARS = 15;
const HIST_CACHE_KEY = "abopreis:hist:v2";
const READY_TTL  = 30 * 24 * 60 * 60 * 1000;   // 30 dagen — klimaat verandert niet per dag
const FAILED_TTL = 10 * 60 * 1000;             // 10 min — daarna mag een nieuwe poging

// metric-sleutel (zoals METRICS in metrics.js) → Open-Meteo daily-veldnaam
const FIELDS = { rain: "precipitation_sum", sun: "sunshine_duration", tmax: "temperature_2m_max", wind: "wind_speed_10m_max" };
const FIELD_KEYS = Object.keys(FIELDS);

const LATS = REGIONS.map(p=>p.lat).join(",");
const LONS = REGIONS.map(p=>p.lon).join(",");

// in-memory spiegel van localStorage:
// { [windowKey]: {status:"ready", byRegion:{naam:{rain:[...],sun:[...],tmax:[...],wind:[...]}}, fetchedAt}
//               | {status:"failed", fetchedAt} }
let cache = null;
const pending = new Map();   // windowKey -> Promise, voorkomt dubbele fetch-rondes

function loadCacheFromStorage(){
  if(cache) return cache;
  try{ cache = JSON.parse(localStorage.getItem(HIST_CACHE_KEY) || "{}"); }catch{ cache = {}; }
  return cache;
}
function saveCacheToStorage(){
  try{ localStorage.setItem(HIST_CACHE_KEY, JSON.stringify(cache)); }catch{}
}

/* "2026-08-29".."2026-09-02" → "08-29,08-30,08-31,09-01,09-02" — de jaartallen
   doen er niet toe, alleen welke kalenderdagen we vergelijken. */
export function windowKey(dates){
  return dates.map(d => d.slice(5)).join(",");
}

function freshEntry(dates){
  const entry = loadCacheFromStorage()[windowKey(dates)];
  if(!entry) return null;
  const ttl = entry.status === "ready" ? READY_TTL : FAILED_TTL;
  return Date.now() - entry.fetchedAt > ttl ? null : entry;
}

/** Geeft de klaarstaande gegevens voor dit venster, of null als ze er nog niet
 *  (goed) zijn — nooit opgehaald, aan het laden, verlopen, of mislukt. Puur
 *  lezen, veilig om vanuit derive() bij elke render te doen. Per regio een
 *  object {rain, sun, tmax, wind}, elk een array met één gemiddelde per dag
 *  in het venster. */
export function getHistoricalSnapshot(dates){
  const entry = freshEntry(dates);
  return entry && entry.status === "ready" ? entry.byRegion : null;
}

/** Voor de UI-melding: "empty" (nog niets geprobeerd), "loading",
 *  "ready" of "failed" (alle jaren mislukt, probeert het later opnieuw). */
export function getHistoricalStatus(dates){
  if(pending.has(windowKey(dates))) return "loading";
  const entry = freshEntry(dates);
  return entry ? entry.status : "empty";
}

/** Kant-en-klare melding voor onder de kaart/matrix — leeg als de data er al
 *  is (of de bron niet op historisch staat), anders een korte uitleg. */
export function histStatusNote(dates){
  const status = getHistoricalStatus(dates);
  if(status === "ready") return "";
  if(status === "failed") return " <strong>Historische data ophalen is niet gelukt — probeer het over een paar minuten opnieuw.</strong>";
  return ` <strong>Historische data (${HIST_YEARS} jaar) wordt opgehaald — dit verschijnt vanzelf zodra dat klaar is.</strong>`;
}

function yearWindow(dates, year){
  const first = dates[0].slice(5), last = dates[dates.length-1].slice(5);
  const wraps = last < first;   // venster loopt over de jaarwisseling heen
  return { start: `${year}-${first}`, end: `${wraps ? year+1 : year}-${last}` };
}

async function fetchYear(dates, year){
  const {start, end} = yearWindow(dates, year);
  const url = "https://archive-api.open-meteo.com/v1/archive"
    + `?latitude=${LATS}&longitude=${LONS}&start_date=${start}&end_date=${end}`
    + `&daily=${FIELD_KEYS.map(k=>FIELDS[k]).join(",")}&timezone=Europe%2FBerlin`;
  const raw = await getJSON(url);
  const arr = Array.isArray(raw) ? raw : [raw];
  // per regio, per veld de reeks voor dit ene jaar, in dezelfde volgorde als REGIONS
  return arr.map(o => {
    const row = {};
    FIELD_KEYS.forEach(k => { row[k] = (o.daily && o.daily[FIELDS[k]]) || []; });
    return row;
  });
}

/** Zorgt dat er data is voor dit venster: leest de cache, en start zo nodig
 *  op de achtergrond HIST_YEARS ophaalverzoeken (parallel, één per jaar, elk
 *  meteen alle regio's en alle velden tegelijk). Roept `onReady` altijd aan
 *  zodra dit venster klaar is — gelukt of niet — zodat de aanroeper opnieuw
 *  kan renderen en de melding kan bijwerken. Nooit dubbel bezig voor
 *  hetzelfde venster. */
export async function ensureHistorical(dates, onReady){
  const key = windowKey(dates);
  if(freshEntry(dates)) return;                      // al vers genoeg (goed of recent mislukt)
  if(pending.has(key)) return pending.get(key);       // al mee bezig

  const thisYear = new Date().getFullYear();
  const years = Array.from({length: HIST_YEARS}, (_, i) => thisYear - 1 - i);

  const job = (async () => {
    const perYear = await Promise.allSettled(years.map(y => fetchYear(dates, y)));
    const ok = perYear.filter(r => r.status === "fulfilled").map(r => r.value);
    const store = loadCacheFromStorage();

    if(!ok.length){
      console.error("[historisch] geen enkel jaar kon worden opgehaald");
      store[key] = {status: "failed", fetchedAt: Date.now()};
    }else{
      const byRegion = {};
      REGIONS.forEach((rg, i) => {
        const perField = {};
        FIELD_KEYS.forEach(field => {
          perField[field] = dates.map((_, k) => {
            const vals = ok.map(yearRows => yearRows[i]?.[field]?.[k]).filter(v => v != null);
            return vals.length ? vals.reduce((a,b)=>a+b,0) / vals.length : null;
          });
        });
        byRegion[rg.n] = perField;
      });
      store[key] = {status: "ready", byRegion, fetchedAt: Date.now()};
    }
    saveCacheToStorage();
    // vóór onReady() verwijderen: die roept render() aan, dat via
    // getHistoricalStatus() precies dit pending-entry zou controleren —
    // stond dat er dan nog, dan meldde de nieuwe render zichzelf als "nog
    // aan het laden" terwijl de data al klaarstond.
    pending.delete(key);
    if(onReady) onReady();
  })();

  pending.set(key, job);
  return job;
}
