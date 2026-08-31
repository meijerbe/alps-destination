/* ------------------------------------------------------------------
   De kaart zelf: een Leaflet-kaart met OpenTopoMap als ondergrond, de
   32 regio's als gekleurde stippen erop, en de dagschuif-synchronisatie.

   `L` komt van de Leaflet-CDN-<script> in index.html (net als
   `window.supabase`) — een globale, geen import.
------------------------------------------------------------------- */
import { $, esc, fmt, DAYS, dow, dm } from "./dom.js";
import { METRICS, METRIC_NOTE } from "./metrics.js";
import { REGIONS, COUNTRY, driveTxt, PROFILE_LABEL } from "./regions.js";
import { state } from "./state.js";
import { selectedRegion, metricValue, scoreColor } from "./weather.js";
import { histStatusNote } from "./historical.js";

const BASE = { lat: 47.162, lon: 11.859, label: "MAYRHOFEN" };   // vertrekpunt, geen regio

let leafletMap = null;
const markers = new Map();   // regionnaam → L.CircleMarker

/** Bouwt de kaart en de 32 stippen één keer op, vóór de eerste render().
 *  `onSelect(naam)` wordt aangeroepen bij een klik op een regio-stip.
 *
 *  In een try/catch: Leaflet en de tegels komen van buiten (jsdelivr,
 *  tile.opentopomap.org) en kunnen om redenen buiten onze macht (ad-blocker,
 *  netwerkbeleid, CDN-storing) niet laden. Zonder deze vangrail stopt
 *  main.js' init-volgorde daar hard — dan werken de paklijst en de
 *  boodschappenlijst ook niet meer, terwijl die niets met de kaart te maken
 *  hebben. renderMap() controleert `leafletMap` en doet daarna netjes niets. */
export function initMap(onSelect){
  try{
    leafletMap = L.map("mapview", { minZoom: 5, maxZoom: 17, scrollWheelZoom: false });
    L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", {
      maxZoom: 17,
      subdomains: "abc",
      attribution: 'Kaartgegevens: © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>-auteurs, SRTM · '
        + 'kaartweergave: © <a href="https://opentopomap.org" target="_blank" rel="noopener">OpenTopoMap</a> '
        + '(<a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noopener">CC-BY-SA</a>)'
    }).addTo(leafletMap);

    leafletMap.fitBounds(L.latLngBounds(REGIONS.map(rg=>[rg.lat, rg.lon])), { padding: [24, 24] });

    REGIONS.forEach(rg=>{
      const marker = L.circleMarker([rg.lat, rg.lon], {
        radius: 11, weight: 2, color: "#fff", fillOpacity: .92, fillColor: "#8a9aa0"
      }).addTo(leafletMap);
      marker.bindTooltip("", { sticky: true, direction: "top", className: "maptip" });
      marker.on("click", () => onSelect(rg.n));
      markers.set(rg.n, marker);
    });

    L.circleMarker([BASE.lat, BASE.lon], {
      radius: 6, weight: 2, color: "#fff", fillColor: "#2B2318", fillOpacity: 1, interactive: false
    }).addTo(leafletMap)
      .bindTooltip(BASE.label, { permanent: true, direction: "top", offset: [0, -4], className: "maplabel" });
  }catch(err){
    leafletMap = null;
    console.error("Kaart kon niet laden:", err);
    const el = $("mapview");
    if(el) el.innerHTML = `<p class="status err" style="margin:0">Kaart kon niet laden — geen verbinding met de kaart-CDN of tegelserver. `
      + `De rest van de pagina werkt gewoon door.</p>`;
  }
}

function tooltipHtml(rg, p, M){
  if(!p) return `<b>${esc(rg.n)}</b>geen data`;
  const mean = metricValue(p, M);
  const d0 = state.day >= 0 ? p.per[state.day] : null;
  const head = state.metric === "score"
    ? `<i>score ${fmt(p.total)}</i>`
    : `<i>${esc(M.label)} ${M.txt(mean)}</i> · score ${fmt(p.total)}`;
  return `<b>${esc(rg.n)}</b>`
    + `${esc(rg.r)}, ${esc(COUNTRY[rg.c]||rg.c)} · ${driveTxt(rg)}<br>`
    + head
    + (p.far ? " · buiten rijtijd" : (p.rank ? " · nr " + p.rank : "")) + `<br>`
    + (d0
        ? `${d0.rain.toFixed(1)} mm · ${(d0.sun/3600).toFixed(1)} u zon · ${fmt(d0.tmax)} °C · wind ${fmt(d0.wind)}`
        : `${p.rainSum.toFixed(1)} mm · ${p.sunAvg.toFixed(1)} u zon/dag · ${p.dryDays}/${p.per.length} droog`);
}

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
  if(!leafletMap) return;   // kaart kon niet laden — initMap() liet al een melding staan
  const M = METRICS[state.metric];
  const by = {}; v.all.forEach(p=>by[p.n]=p);
  const sel = selectedRegion(v);

  REGIONS.forEach(rg=>{
    const marker = markers.get(rg.n);
    const p = by[rg.n];
    const val = p ? metricValue(p, M) : null;
    const isSel = !!(sel && sel.n === rg.n);
    marker.setStyle({
      fillColor: val==null ? "#8a9aa0" : scoreColor(M.good(val)),
      fillOpacity: p && p.far ? .25 : .92,
      color: isSel ? "#2B2318" : "#fff",
      weight: isSel ? 4 : 2,
      radius: isSel ? 13 : 11
    });
    if(isSel) marker.bringToFront();
    marker.setTooltipContent(tooltipHtml(rg, p, M));
  });

  const a = v.dates[0], b = v.dates[v.n-1];
  const wat = state.metric === "score" ? "de score voor " + PROFILE_LABEL[state.profile].toLowerCase() : M.label;
  const wanneer = state.day >= 0
    ? `op ${DAYS[dow(v.dates[state.day])]} ${dm(v.dates[state.day])}`
    : `gemiddeld over ${v.n} dagen — ${DAYS[dow(a)]} ${dm(a)} t/m ${DAYS[dow(b)]} ${dm(b)}`;
  $("mapsub").textContent =
    `${REGIONS.length} regio's in de Alpenboog, gekleurd naar ${wat}, ${wanneer}. `
    + `Klik een regio om hem vast te zetten; de paklijst rekent daarna met die regio.`;
  $("mapnote").innerHTML = `Kleur = ${esc(METRIC_NOTE[state.metric])}${state.histMode ? " (historisch gemiddelde, geen voorspelling)" : ""}`
    + (state.day >= 0 ? ` op die ene dag — de ranglijst en de kerncijfers blijven over de hele periode rekenen` : "")
    + `. Weggevallen regio's vallen buiten je rijtijd. `
    + `Elke stip is één meetpunt voor die regio, geen dekkingskaart — het weer in de rest van de regio kan afwijken.`
    + (state.histMode ? histStatusNote(v.dates) : "");
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
