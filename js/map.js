/* ------------------------------------------------------------------
   De kaart zelf: het SVG, de dagschuif-synchronisatie en de kaart
   met dagcijfers voor de geselecteerde regio.
------------------------------------------------------------------- */
import { $, esc, fmt, DAYS, dow, dm } from "./dom.js";
import { METRICS, METRIC_NOTE } from "./metrics.js";
import { REGIONS, COUNTRY, driveTxt, PROFILE_LABEL } from "./regions.js";
import { MAP } from "./map-geometry.js";
import { state } from "./state.js";
import { selectedRegion, metricValue, scoreColor } from "./weather.js";
import { getHistoricalStatus, HIST_YEARS } from "./historical.js";

export function syncDay(v){
  state.day = state.day >= v.n ? v.n - 1 : Math.max(-1, state.day);
  const sl = $("dayslider");
  sl.max = String(v.n - 1);
  sl.value = String(state.day);
  $("dayprev").disabled = state.day < 0;
  $("daynext").disabled = state.day >= v.n - 1;
  const stops = ["gem"].concat(v.dates.map(d=>DAYS[dow(d)]));
  $("dayticks").innerHTML = stops.map((txt,i)=>{
    const day = i - 1;
    const cls = day===state.day ? "on" : (day>=0 && dow(v.dates[day])>=5 ? "we" : "");
    return `<span class="${cls}" style="left:${(i/(stops.length-1)*100).toFixed(3)}%">${txt}</span>`;
  }).join("");
  if(state.day < 0){
    $("daylabel").innerHTML = `<b>Gemiddeld over ${v.n} dagen</b> — schuif naar rechts voor één dag tegelijk, `
      + `of druk op afspelen om het weer over de Alpen te zien trekken.`;
  }else{
    const d = v.dates[state.day];
    const f = v.foehn[state.day];
    $("daylabel").innerHTML = `<b>${DAYS[dow(d)]} ${dm(d)}</b>`
      + (f ? ` — föhn ${f.diff>=0?"+":""}${f.diff.toFixed(1)} hPa, `
           + (f.diff > 2.5 ? "zuidkant in de luwte" : f.diff < -2.5 ? "noordkant in de luwte" : "vlak drukveld") : "")
      + ` · dag ${state.day+1} van ${v.n}`;
  }
}

export function renderMap(v){
  const M = METRICS[state.metric];
  const by = {}; v.all.forEach(p=>by[p.n]=p);
  const sel = selectedRegion(v);

  const vals = REGIONS.map(rg=>{ const p=by[rg.n]; return p ? metricValue(p, M) : null; });
  const fills = vals.map(x => x==null ? "#8a9aa0" : scoreColor(M.good(x)));

  const rects = MAP.runs.map(r=>{
    const p = by[REGIONS[r.r].n];
    return `<rect class="c${p&&p.far?" far":""}" data-r="${r.r}" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${fills[r.r]}"/>`;
  }).join("");

  // labels plaatsen van groot naar klein; wat botst laten we weg
  const taken = [{x0:MAP.base[0]-30, y0:MAP.base[1]-14, x1:MAP.base[0]+30, y1:MAP.base[1]+2}];
  const fits = b => !taken.some(t => b.x0 < t.x1 && b.x1 > t.x0 && b.y0 < t.y1 && b.y1 > t.y0);
  const labels = [...MAP.labels].sort((a,b)=>b.cells-a.cells).map(L=>{
    const rg = REGIONS[L.i], p = by[rg.n];
    const txt = (rg.s || rg.n).toUpperCase();
    const big = L.cells >= 40 && vals[L.i] != null;
    const w = txt.length * 5.2, hh = big ? 21 : 10;
    const box = {x0:L.x-w/2-1, y0:L.y-9, x1:L.x+w/2+1, y1:L.y-9+hh};
    if(!fits(box)) return "";
    taken.push(box);
    const far = p && p.far ? " far" : "";
    return `<text class="lb${far}" x="${L.x}" y="${L.y}">${esc(txt)}`
      + (big ? `<tspan x="${L.x}" dy="10.5" style="font-size:10px;font-weight:600">${M.txt(vals[L.i])}</tspan>` : "")
      + `</text>`;
  }).join("");

  const si = sel ? REGIONS.findIndex(r=>r.n===sel.n) : -1;
  const ring = si >= 0 ? `<path class="selring" d="${MAP.outlines[si]}"/>` : "";
  const bx = MAP.base[0], byy = MAP.base[1];

  $("mapsvg").innerHTML =
    `<svg viewBox="${MAP.viewBox}" role="img" aria-label="Kaart van de Alpen, regio's gekleurd naar ${esc(M.label)}">
      <g>${rects}</g>
      <path class="borders" d="${MAP.borders}"/>
      ${ring}
      <g>${labels}</g>
      <g class="base">
        <circle cx="${bx}" cy="${byy}" r="3.2"/>
        <text x="${bx}" y="${(byy + 11).toFixed(1)}">MAYRHOFEN</text>
      </g>
    </svg>`;

  const a = v.dates[0], b = v.dates[v.n-1];
  const wat = state.metric === "score" ? "de score voor " + PROFILE_LABEL[state.profile].toLowerCase() : M.label;
  const wanneer = state.day >= 0
    ? `op ${DAYS[dow(v.dates[state.day])]} ${dm(v.dates[state.day])}`
    : `gemiddeld over ${v.n} dagen — ${DAYS[dow(a)]} ${dm(a)} t/m ${DAYS[dow(b)]} ${dm(b)}`;
  $("mapsub").textContent =
    `${REGIONS.length} regio's in de Alpenboog, gekleurd naar ${wat}, ${wanneer}. `
    + `Klik een regio om hem vast te zetten; de paklijst rekent daarna met die regio.`;
  $("mapnote").innerHTML = `Kleur = ${esc(METRIC_NOTE[state.metric])}`
    + (state.day >= 0 ? ` op die ene dag — de ranglijst en de kerncijfers blijven over de hele periode rekenen` : "")
    + `. Weggezakte regio's vallen buiten je rijtijd. `
    + `De vlakken zijn schematisch — elke cel hoort bij het dichtstbijzijnde regiomiddelpunt, het is geen grenskaart.`
    + (state.metric === "histRain" ? histNote(v.dates) : "");
}

function histNote(dates){
  const status = getHistoricalStatus(dates);
  if(status === "ready") return "";
  if(status === "failed") return ` <strong>Historische data ophalen is niet gelukt — probeer het over een paar minuten opnieuw.</strong>`;
  return ` <strong>Historische data (${HIST_YEARS} jaar) wordt opgehaald — dit verschijnt vanzelf zodra dat klaar is.</strong>`;
}

export function renderSelCard(v){
  const el = $("selcard");
  const p = selectedRegion(v);
  if(!p){ el.innerHTML = ""; return; }
  const wd = p.window;
  const facts = [
    ["Neerslag", p.rainSum.toFixed(1) + " mm"],
    ["Droge dagen", p.dryDays + " van " + p.per.length],
    ["Zon", p.sunAvg.toFixed(1) + " u/dag"],
    ["Warmst", fmt(p.maxTemp) + " °C"],
    ["Wind max", fmt(p.maxWind) + " km/u"],
    ["Vriespunt", fmt(p.minFrz) + " m"]
  ];
  el.innerHTML = `
    <div class="selcard">
      <div class="top">
        <div>
          <h3>${esc(p.n)}</h3>
          <p class="meta">${esc(p.r)}, ${esc(COUNTRY[p.c]||p.c)} · ${driveTxt(p)} · ${esc(p.side)}
            ${p.far ? "· <strong>buiten je rijtijdfilter</strong>" : (p.rank ? "· nummer " + p.rank + " van " + v.scored.length : "")}</p>
        </div>
        <div style="text-align:right">
          <div class="sc">${fmt(p.total)}</div>
          <div class="scorelabel">score</div>
        </div>
      </div>
      <div class="strip">${p.per.map((d,i)=>
        `<div class="cell${i===state.day?" now":""}" style="background:${scoreColor(d.s)}" title="${d.date}: score ${fmt(d.s)}, ${d.rain.toFixed(1)} mm"><span>${d.rain >= 9.5 ? fmt(d.rain) : d.rain.toFixed(1)}</span></div>`).join("")}</div>
      <div class="striplabels">${p.per.map(d=>`<div class="${dow(d.date)>=5?"we":""}">${DAYS[dow(d.date)]}</div>`).join("")}</div>
      <div class="facts">${facts.map(x=>`<div><div class="k">${x[0]}</div><div class="v">${x[1]}</div></div>`).join("")}</div>
      <p class="whynote" style="margin-top:14px">Beste aaneengesloten venster: <strong>${DAYS[dow(wd.from)]} ${dm(wd.from)} – ${DAYS[dow(wd.to)]} ${dm(wd.to)}</strong> (score ${fmt(wd.avg)}).</p>
      <div class="acts">
        <button type="button" data-go="rank">Opbouw van de score</button>
        <button type="button" data-go="pack">Paklijst hiervoor</button>
        ${p.far ? `<button type="button" data-drive="${Math.ceil(p.drive)}">Rijtijd naar ${Math.ceil(p.drive)} u</button>` : ""}
        ${state.sel===p.n ? `<button type="button" data-go="clear">Selectie loslaten</button>` : ""}
      </div>
    </div>`;
}
