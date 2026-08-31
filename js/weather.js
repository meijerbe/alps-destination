/* ==================================================================
   Score, databronnen en de afgeleide waarden (scores, vensters, kpi's)
================================================================== */
import { clamp, darkMode } from "./dom.js";
import { REGIONS, WEIGHTS, PARTS } from "./regions.js";
import { state } from "./state.js";

export function dayParts(d){
  return {
    dry:  clamp(100 - d.rain*13, 0, 100),
    prob: clamp(100 - (d.prob ?? 40), 0, 100),
    sun:  clamp((d.sun/Math.max(d.daylight,1))*115, 0, 100),
    wind: clamp(100 - Math.max(0, d.wind-14)*3.2, 0, 100),
    temp: clamp(100 - Math.abs(d.tmax-21)*6.5, 0, 100),
    // vriespunt onder 2600 m = sneeuw op de hoge routes
    snow: clamp((d.frz-1900)/9, 0, 100)
  };
}
export const weigh = (parts, w) => PARTS.reduce((a,p)=>a + parts[p.k]*w[p.k], 0);

export function scoreColor(s){
  // continue schaal nat → droog, zoals een kaartlegenda
  const t = clamp(s,0,100)/100;
  const wet = darkMode() ? [48,104,124] : [62,143,168];
  const dryc = darkMode() ? [232,154,74] : [224,138,51];
  const c = wet.map((v,i)=>Math.round(v+(dryc[i]-v)*t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

/* ==================================================================
   Data
================================================================== */
const LATS = REGIONS.map(p=>p.lat).join(",");
const LONS = REGIONS.map(p=>p.lon).join(",");
export const URLS = {
  data: "https://api.open-meteo.com/v1/forecast"
    + `?latitude=${LATS}&longitude=${LONS}`
    + "&daily=precipitation_sum,precipitation_probability_max,sunshine_duration,daylight_duration,"
    + "temperature_2m_max,temperature_2m_min,wind_speed_10m_max,weather_code"
    + "&hourly=freezing_level_height"
    + "&timezone=Europe%2FBerlin&forecast_days=10",
  // Innsbruck (574 m) en Bolzano (262 m)
  foehn: "https://api.open-meteo.com/v1/forecast"
    + "?latitude=47.267,46.498&longitude=11.393,11.354"
    + "&hourly=pressure_msl&timezone=Europe%2FBerlin&forecast_days=10"
};

export async function getJSON(url, tries = 3){
  for(let attempt = 1; ; attempt++){
    try{
      const res = await fetch(url, {signal: AbortSignal.timeout(15000)});
      if(!res.ok) throw new Error("Open-Meteo antwoordde met status " + res.status);
      return await res.json();
    }catch(err){
      if(attempt >= tries) throw err;
      await new Promise(r => setTimeout(r, 400 * 2 ** (attempt - 1)));
    }
  }
}

export async function load(){
  const [raw, foehnRaw] = await Promise.all([getJSON(URLS.data), getJSON(URLS.foehn)]);
  const arr  = Array.isArray(raw) ? raw : [raw];
  const fArr = Array.isArray(foehnRaw) ? foehnRaw : [foehnRaw];

  const places = arr.map((o,i)=>{
    const D = o.daily, H = o.hourly;
    // vriespuntniveau per dag: laagste uurwaarde van die dag
    const frzByDate = {};
    H.time.forEach((t,h)=>{
      const v = H.freezing_level_height[h];
      if(v == null) return;
      const d = t.slice(0,10);
      frzByDate[d] = frzByDate[d] == null ? v : Math.min(frzByDate[d], v);
    });
    const days = D.time.map((date,k)=>({
      date,
      rain: D.precipitation_sum[k] ?? 0,
      prob: D.precipitation_probability_max[k],
      sun:  D.sunshine_duration[k] ?? 0,
      daylight: D.daylight_duration[k] ?? 45000,
      tmax: D.temperature_2m_max[k] ?? 15,
      tmin: (D.temperature_2m_min || [])[k] ?? null,
      wind: D.wind_speed_10m_max[k] ?? 0,
      frz:  frzByDate[date] ?? 3500
    }));
    return {...REGIONS[i], days};
  });

  // föhn: dagelijks gemiddeld drukverschil noord − zuid
  const north = fArr[0].hourly, south = fArr[1].hourly;
  const byDate = {};
  north.time.forEach((t,i)=>{
    const a = north.pressure_msl[i], b = south.pressure_msl[i];
    if(a == null || b == null) return;
    (byDate[t.slice(0,10)] ||= []).push(a - b);
  });
  const foehn = Object.entries(byDate)
    .sort((a,b)=>a[0] < b[0] ? -1 : 1)
    .map(([date,v])=>({date, diff: v.reduce((x,y)=>x+y,0)/v.length}));

  return {places, foehn, raw: arr, foehnRaw: fArr};
}

/* ==================================================================
   Afleiden: scores, vensters, kpi's
================================================================== */
export function bestWindow(per, k){
  // beste aaneengesloten venster van k dagen
  if(per.length < k) k = per.length;
  let best = {i:0, avg:-1};
  for(let i=0; i+k<=per.length; i++){
    const avg = per.slice(i,i+k).reduce((a,b)=>a+b.s,0)/k;
    if(avg > best.avg) best = {i, avg};
  }
  return {...best, k, from:per[best.i].date, to:per[best.i+k-1].date};
}

export function derive(){
  const {places, foehn} = state.data;
  const w = WEIGHTS[state.profile];
  const total = places[0].days.length;
  const start = clamp(state.start, 0, Math.max(0, total-2));
  const n = Math.min(state.days, total - start);
  const win = Math.min(3, n);

  const all = places
    .map(p=>{
      const per = p.days.slice(start, start+n).map(d=>{
        const parts = dayParts(d);
        return {...d, parts, s: weigh(parts, w)};
      });
      const avgParts = {};
      PARTS.forEach(x => avgParts[x.k] = per.reduce((a,b)=>a+b.parts[x.k],0)/per.length);
      return {
        ...p, per, avgParts,
        total: per.reduce((a,b)=>a+b.s,0)/per.length,
        rainSum: per.reduce((a,b)=>a+b.rain,0),
        dryDays: per.filter(d=>d.rain < 1).length,
        sunAvg: per.reduce((a,b)=>a+b.sun,0)/per.length/3600,
        minFrz: Math.min(...per.map(d=>d.frz)),
        maxWind: Math.max(...per.map(d=>d.wind)),
        maxTemp: Math.max(...per.map(d=>d.tmax)),
        minTemp: Math.min(...per.map(d=>d.tmax)),
        maxRain: Math.max(...per.map(d=>d.rain)),
        window: bestWindow(per, win),
        far: p.drive > state.drive
      };
    });

  const scored = all.filter(p=>!p.far).sort((a,b)=>b.total-a.total);
  scored.forEach((p,i)=>{ p.rank = i+1; });

  const fwin = foehn.slice(start, start+n);
  const foehnAvg = fwin.length ? fwin.reduce((a,b)=>a+b.diff,0)/fwin.length : null;

  const dates = places[0].days.slice(start, start+n).map(d=>d.date);
  return {all, scored, n, start, total, win, dates, foehn: fwin, foehnAvg};
}

/* de regio waar de paklijst en de kaartkaart op slaan */
export function focusOf(v){
  if(!v.scored.length) return null;
  return v.scored.find(p=>p.n === state.sel) || v.scored[0];
}
export function selectedRegion(v){
  return v.all.find(p=>p.n === state.sel) || v.scored[0] || null;
}

export const foehnLabel = a =>
  a == null ? "geen data" : a > 2.5 ? "zuidkant droog" : a < -2.5 ? "noordkant droog" : "geen sturing";

/* welke waarde kleurt de kaart: één dag, of het gemiddelde over de periode */
export function metricValue(p, M){
  const d = state.day >= 0 ? p.per[state.day] : null;
  return d ? M.val(d) : p.per.reduce((a,x)=>a+M.val(x),0)/p.per.length;
}
