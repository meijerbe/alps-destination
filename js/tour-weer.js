/* ------------------------------------------------------------------
   De verwachting per hut.

   Eén verzoek aan Open-Meteo voor alle eindpunten van de tocht tegelijk
   — dezelfde bron en dezelfde conventies als het weerdashboard, maar dan
   met `elevation` op de hoogte van de hut. Dat scheelt: het model rekent
   op een rasterhoogte die op een hut van 2524 m honderden meters naast
   de werkelijkheid kan liggen, en dat is precies het verschil tussen
   regen en natte sneeuw.

   Het vriespuntniveau is het laagste uur van de dag (net als op het
   dashboard): dat is het niveau waar je rekening mee houdt, niet het
   gemiddelde. Ligt het onder het hoogste punt van de etappe, dan staat
   dat er met zoveel woorden bij.

   Wat opgehaald is blijft in localStorage staan. Op een hut zonder
   bereik zie je dan de verwachting van gisteravond, met de tijd erbij —
   beter dan een leeg vak, zolang duidelijk is hoe oud het is.
------------------------------------------------------------------- */
import { $, esc } from "./dom.js";
import { getJSON } from "./net.js";
import { HUTTEN, ETAPPES } from "./tour-data.js";

const KEY = "ab-huttentocht-weer";
const VERS_MINUTEN = 60;

/* WMO-weercodes in gewoon Nederlands. */
const CODES = {
  0: ["helder", "☀"], 1: ["overwegend helder", "🌤"], 2: ["half bewolkt", "⛅"], 3: ["bewolkt", "☁"],
  45: ["mist", "🌫"], 48: ["aanvriezende mist", "🌫"],
  51: ["motregen", "🌦"], 53: ["motregen", "🌦"], 55: ["dichte motregen", "🌧"],
  56: ["ijzel", "🌧"], 57: ["ijzel", "🌧"],
  61: ["lichte regen", "🌦"], 63: ["regen", "🌧"], 65: ["zware regen", "🌧"],
  66: ["ijzel", "🌧"], 67: ["ijzel", "🌧"],
  71: ["lichte sneeuw", "🌨"], 73: ["sneeuw", "🌨"], 75: ["zware sneeuw", "❄"],
  77: ["sneeuwkorrels", "🌨"],
  80: ["buien", "🌦"], 81: ["buien", "🌧"], 82: ["zware buien", "⛈"],
  85: ["sneeuwbuien", "🌨"], 86: ["zware sneeuwbuien", "❄"],
  95: ["onweer", "⛈"], 96: ["onweer met hagel", "⛈"], 99: ["zwaar onweer", "⛈"]
};
const code = c => CODES[c] || ["—", "·"];

/* Waar vraag je het weer voor? Voor elke etappe het punt waar je die dag
   aankomt: de hut waar je slaapt, of anders het laatste tussenpunt. */
function plekken(){
  return ETAPPES.map(e => {
    const hut = HUTTEN.find(h => h.id === e.slaap);
    const eind = e.punten.at(-1);
    return {
      id: e.id,
      hutId: hut ? hut.id : null,
      naam: hut ? hut.naam : eind.naam,
      datum: e.datum,
      lat: hut ? hut.lat : eind.lat,
      lon: hut ? hut.lon : eind.lon,
      ele: Math.round(hut ? hut.hoogte : (eind.ele || 2000))
    };
  });
}

function url(ps, metHoogte){
  return "https://api.open-meteo.com/v1/forecast"
    + `?latitude=${ps.map(p => p.lat).join(",")}`
    + `&longitude=${ps.map(p => p.lon).join(",")}`
    + (metHoogte ? `&elevation=${ps.map(p => p.ele).join(",")}` : "")
    + "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,"
    + "precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,sunrise,sunset"
    + "&hourly=freezing_level_height"
    + "&timezone=Europe%2FBerlin&forecast_days=16";
}

/* Antwoord → per plek een rijtje dagen, op datum te vinden. */
function lees(ruw, ps){
  const arr = Array.isArray(ruw) ? ruw : [ruw];
  const uit = {};
  arr.forEach((o, i) => {
    if(!o || !o.daily || !ps[i]) return;
    const D = o.daily, H = o.hourly || { time: [], freezing_level_height: [] };

    // vriespunt per dag: het laagste uur — dat is het niveau waar je je
    // op kleedt, niet het gemiddelde
    const frz = {};
    (H.time || []).forEach((t, h) => {
      const v = H.freezing_level_height[h];
      if(v == null) return;
      const d = t.slice(0, 10);
      frz[d] = frz[d] == null ? v : Math.min(frz[d], v);
    });

    const dagen = {};
    D.time.forEach((datum, k) => {
      dagen[datum] = {
        code: D.weather_code[k],
        tmax: D.temperature_2m_max[k],
        tmin: D.temperature_2m_min[k],
        mm: D.precipitation_sum[k] ?? 0,
        kans: D.precipitation_probability_max[k],
        wind: D.wind_speed_10m_max[k],
        stoot: (D.wind_gusts_10m_max || [])[k],
        frz: frz[datum] ?? null,
        op: (D.sunrise || [])[k],
        onder: (D.sunset || [])[k]
      };
    });
    uit[ps[i].id] = dagen;
  });
  return uit;
}

/* Eerst met hoogtecorrectie vragen. Slikt de API geen rijtje hoogtes naast
   een rijtje locaties, dan vragen we het gewoon nog eens zonder — een
   verwachting op rasterhoogte is minder scherp, maar nog altijd een
   verwachting, en op het kaartje staat welke van de twee je ziet. */
async function haal(ps){
  try {
    return { per: lees(await getJSON(url(ps, true), 1), ps), hoogte: true };
  } catch (err) {
    console.warn("verwachting met hoogtecorrectie mislukt (" + err.message + ") — nog eens zonder");
    return { per: lees(await getJSON(url(ps, false)), ps), hoogte: false };
  }
}

/* ---------------- bewaren en terugvinden ---------------- */

function uitVoorraad(){
  try {
    const o = JSON.parse(window.localStorage.getItem(KEY) || "null");
    return o && o.t && o.per ? o : null;
  } catch { return null; }
}

function inVoorraad(per, hoogte){
  try { window.localStorage.setItem(KEY, JSON.stringify({ t: new Date().toISOString(), per, hoogte })); }
  catch { /* vol of geweigerd: dan maar niet */ }
}

const minutenOud = iso => (Date.now() - new Date(iso).getTime()) / 60000;

function ouderdom(iso){
  const m = minutenOud(iso);
  if(m < 90) return `bijgewerkt ${Math.round(m)} min geleden`;
  const u = Math.round(m / 60);
  if(u < 36) return `bijgewerkt ${u} uur geleden`;
  return `bijgewerkt op ${new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}`;
}

/* ---------------- tonen ---------------- */

const graden = t => t == null ? "–" : `${Math.round(t)}°`;
const klok = iso => iso ? iso.slice(11, 16) : "–";

function strip(d, hoogstePunt){
  const [tekst, sym] = code(d.code);
  const stukken = [
    `<b>${graden(d.tmax)}</b> / ${graden(d.tmin)}`,
    d.mm > 0.05 ? `${d.mm.toFixed(1).replace(".", ",")} mm${d.kans != null ? ` (${d.kans}%)` : ""}`
      : (d.kans != null && d.kans >= 30 ? `droog, ${d.kans}% kans` : "droog"),
    `wind ${Math.round(d.wind)}${d.stoot ? `–${Math.round(d.stoot)}` : ""} km/u`,
    d.frz != null ? `vriespunt ${Math.round(d.frz / 50) * 50} m` : null,
    d.op ? `licht ${klok(d.op)}–${klok(d.onder)}` : null
  ].filter(Boolean);

  const sneeuw = d.frz != null && hoogstePunt && d.frz < hoogstePunt - 50
    ? `<span class="wsneeuw">Boven ${Math.round(d.frz / 50) * 50} m kan het sneeuwen — het hoogste punt van deze dag ligt op ${Math.round(hoogstePunt)} m.</span>`
    : "";
  const onweer = [95, 96, 99].includes(d.code)
    ? `<span class="wsneeuw">Onweer in de verwachting: op de hoogvlakte is nergens te schuilen.</span>` : "";

  return `<span class="wsym" aria-hidden="true">${sym}</span> <span class="wkop">${esc(tekst)}</span>`
    + `<span class="wcijfers">${stukken.join(" · ")}</span>${sneeuw}${onweer}`;
}

function teken(per, t, etappes, hoogte){
  const ps = plekken();
  ETAPPES.forEach((e, i) => {
    const vak = $("weer-" + e.id);
    if(!vak) return;
    const d = (per[e.id] || {})[e.datum];
    if(!d){
      vak.innerHTML = `<span class="wleeg">Voor ${e.datum.slice(8, 10)}-${e.datum.slice(5, 7)} is er nog geen verwachting — `
        + "die gaat zestien dagen vooruit.</span>";
      return;
    }
    const hoog = etappes[i] && etappes[i].stats ? etappes[i].stats.hi : null;
    const plek = ps[i];
    vak.innerHTML = strip(d, hoog)
      + `<span class="wbron">${esc(plek.naam)}${hoogte === false ? " (rasterhoogte)" : `, ${plek.ele} m`}`
      + ` · Open-Meteo, ${esc(ouderdom(t))}</span>`;
  });

  // en op de hutkaartjes: de nacht die je daar doorbrengt
  HUTTEN.forEach(h => {
    const vak = $("hutweer-" + h.id);
    if(!vak) return;
    const e = ETAPPES.find(x => x.slaap === h.id);
    const d = e && (per[e.id] || {})[h.nacht];
    vak.textContent = d
      ? `Die nacht: ${graden(d.tmin)} bij de hut${d.frz != null ? `, vriespunt ${Math.round(d.frz / 50) * 50} m` : ""}.`
      : "";
  });
}

/* Ophalen, tekenen, en bewaren voor onderweg. Faalt het, dan blijft staan
   wat er al stond — een oude verwachting met de tijd erbij is bruikbaarder
   dan een leeg vak. */
export async function startWeer(etappes){
  const oud = uitVoorraad();
  if(oud) teken(oud.per, oud.t, etappes, oud.hoogte);

  if(oud && minutenOud(oud.t) < VERS_MINUTEN) return;

  const ps = plekken();
  try {
    const { per, hoogte } = await haal(ps);
    inVoorraad(per, hoogte);
    teken(per, new Date().toISOString(), etappes, hoogte);
  } catch (err) {
    console.warn("verwachting niet opgehaald:", err.message);
    if(!oud){
      ETAPPES.forEach(e => {
        const vak = $("weer-" + e.id);
        if(vak) vak.innerHTML = `<span class="wleeg">Geen verwachting opgehaald — geen bereik?</span>`;
      });
    }
  }
}
