/* ------------------------------------------------------------------
   De kaart zelf: een Leaflet-kaart met OpenTopoMap als ondergrond, de
   32 regio's als gekleurde Voronoi-vlakken erop, en de
   dagschuif-synchronisatie.

   `L` (Leaflet) en `d3` (d3-delaunay, voor de Voronoi-cellen) komen van
   CDN-<script>'s in index.html (net als `window.supabase`) — globalen,
   geen imports.
------------------------------------------------------------------- */
import { $, esc, fmt, DAYS, dow, dm } from "./dom.js";
import { METRICS, METRIC_NOTE } from "./metrics.js";
import { REGIONS, COUNTRY, driveTxt, PROFILE_LABEL } from "./regions.js";
import { state } from "./state.js";
import { selectedRegion, metricValue, scoreColor } from "./weather.js";
import { histStatusNote } from "./historical.js";

const BASE = { lat: 47.162, lon: 11.859, label: "MAYRHOFEN" };   // vertrekpunt, geen regio

// Op deze breedtegraad is een lengtegraad merkbaar korter dan een breedtegraad
// (~1° lon ≈ cos(46.5°) × 1° lat). Zonder correctie komt de Voronoi-berekening
// (die gewoon Euclidisch rekent) uit op oost-west uitgerekte cellen. K
// herschaalt de lengtegraad vóór het rekenen; bij het intekenen delen we 'm
// er weer uit.
const K = Math.cos(46.5 * Math.PI / 180);

let leafletMap = null;
const cells = new Map();   // regionnaam → L.Polygon (de Voronoi-cel van die regio)

/** Bouwt de kaart en de 32 Voronoi-vlakken één keer op, vóór de eerste
 *  render(). `onSelect(naam)` wordt aangeroepen bij een klik op een vlak.
 *
 *  In een try/catch: Leaflet, d3-delaunay en de tegels komen van buiten
 *  (jsdelivr, tile.opentopomap.org) en kunnen om redenen buiten onze macht
 *  (ad-blocker, netwerkbeleid, CDN-storing) niet laden. Zonder deze
 *  vangrail stopt main.js' init-volgorde daar hard — dan werken de
 *  paklijst en de boodschappenlijst ook niet meer, terwijl die niets met
 *  de kaart te maken hebben. renderMap() controleert `leafletMap` en doet
 *  daarna netjes niets. */
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

    const fitToRegions = () => {
      leafletMap.invalidateSize();
      leafletMap.fitBounds(L.latLngBounds(REGIONS.map(rg=>[rg.lat, rg.lon])), { padding: [24, 24] });
    };
    // initMap() draait synchroon, vaak vóór de browser ook maar één layout-
    // pas heeft gedaan (zeker op mobiel, met eigen lettertypes die nog
    // laden). Meet Leaflet de container dán, dan krijgt fitBounds soms een
    // te kleine/nul-grootte te zien en zoomt véél te ver uit. invalidateSize()
    // + een frame wachten dwingt een verse meting af; het window-'load'-
    // moment (na lettertype-reflow e.d.) doet dat nog een keer, voor de zekerheid.
    fitToRegions();
    requestAnimationFrame(fitToRegions);
    window.addEventListener("load", fitToRegions, { once: true });

    // Voronoi-diagram op de 32 regio-middelpunten: elke cel is precies het
    // gebied dat dichter bij die regio ligt dan bij enige andere — dus
    // altijd inclusief het eigen middelpunt. Geclipt op een ruime
    // bounding box rond de regio's (geen exacte Alpen-omtrek: dat vraagt
    // vlak-in-vlak-clipping tegen een niet-convexe vorm, en de echte kaart
    // eronder geeft nu toch al context aan de randcellen).
    const lons = REGIONS.map(rg=>rg.lon), lats = REGIONS.map(rg=>rg.lat);
    const pad = 0.6;
    const bounds = [
      (Math.min(...lons) - pad) * K, Math.min(...lats) - pad,
      (Math.max(...lons) + pad) * K, Math.max(...lats) + pad
    ];
    const delaunay = d3.Delaunay.from(REGIONS.map(rg=>[rg.lon * K, rg.lat]));
    const voronoi = delaunay.voronoi(bounds);

    REGIONS.forEach((rg,i)=>{
      const cell = voronoi.cellPolygon(i);
      // cell is normaal altijd gevuld (elk punt is uniek) — de fallback is
      // alleen een vangnet tegen toevallig samenvallende coördinaten.
      const latlngs = cell
        ? cell.map(([x,y])=>[y, x / K])
        : [[rg.lat-.05,rg.lon-.05],[rg.lat-.05,rg.lon+.05],[rg.lat+.05,rg.lon+.05],[rg.lat+.05,rg.lon-.05]];
      const poly = L.polygon(latlngs, {
        weight: 2, color: "#fff", fillOpacity: .82, fillColor: "#8a9aa0"
      }).addTo(leafletMap);
      poly.bindTooltip("", { sticky: true, direction: "top", className: "maptip" });
      poly.on("click", () => onSelect(rg.n));
      cells.set(rg.n, poly);
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
    const cell = cells.get(rg.n);
    const p = by[rg.n];
    const val = p ? metricValue(p, M) : null;
    const isSel = !!(sel && sel.n === rg.n);
    cell.setStyle({
      fillColor: val==null ? "#8a9aa0" : scoreColor(M.good(val)),
      // Hoog genoeg om de score in één oogopslag te vergelijken — het punt
      // van kleur-coderen — het reliëf schemert er nog net doorheen.
      fillOpacity: isSel ? .92 : (p && p.far ? .2 : .82),
      color: isSel ? "#2B2318" : "#fff",
      weight: isSel ? 3 : 2
    });
    if(isSel) cell.bringToFront();
    cell.setTooltipContent(tooltipHtml(rg, p, M));
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
    + `Vlakken zijn de Voronoi-cel rond het meetpunt van die regio, geen exacte grens — vlak bij een celrand kan het weer net zo goed op de andere regio lijken.`
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
