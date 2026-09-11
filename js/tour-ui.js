/* ------------------------------------------------------------------
   Wat je op de huttentochtpagina ziet: de dagkiezer, de etappekaartjes
   met hun hoogteprofiel, en het lijstje hutten met de reserveringen.

   De cijfers komen uit twee bronnen en dat blijft zichtbaar: wat de
   planning ervan maakte (komoot, boektijden) staat groot, wat de lijn
   op deze pagina zelf meet staat er als klein regeltje onder.
------------------------------------------------------------------- */
import { $, esc } from "./dom.js";
import { boektijd, uren, toGpx, bewaarGpx } from "./gpx.js";
import { profielSvg, koppelProfiel } from "./tour-profile.js";
import { ETAPPES, HUTTEN, TOUR } from "./tour-data.js";
import { showDay, wijsAan } from "./tour-map.js";

const DAG = ["zo", "ma", "di", "wo", "do", "vr", "za"];
const MND = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

const d8 = s => new Date(s + "T12:00:00");
const kort = s => { const d = d8(s); return `${DAG[d.getDay()]} ${d.getDate()}`; };
const lang = s => { const d = d8(s); return `${DAG[d.getDay()]} ${d.getDate()} ${MND[d.getMonth()]}`; };
const vandaag = () => new Date().toISOString().slice(0, 10);
const getal = n => n == null ? "–" : Math.round(n).toLocaleString("nl-NL");
const km1 = n => n.toFixed(1).replace(".", ",");

let etappes = [];      // [{ def, route, stats }]
let actief = 0;

/* De dag waar we nu in zitten; vóór vertrek dag 1, na afloop de laatste. */
export function dagVanVandaag(){
  const nu = vandaag();
  const i = ETAPPES.findIndex(e => e.datum === nu);
  if(i >= 0) return i;
  return nu < ETAPPES[0].datum ? 0 : ETAPPES.length - 1;
}

function stats4(e){
  const g = e.def.gepland || {};
  const s = e.stats;
  return [
    ["Afstand", g.afstand || `${km1(s.km)} km`],
    ["Lopen", g.tijd || uren(boektijd(s))],
    ["Stijgen", `${getal(g.stijgen != null ? g.stijgen : s.gain)} m`],
    ["Dalen", `${getal(g.dalen != null ? g.dalen : s.loss)} m`]
  ];
}

function kaartje(e, i){
  const d = e.def;
  const hut = HUTTEN.find(h => h.id === d.slaap);
  const g = d.gepland;
  const echt = !e.route.gebouwd;
  const meet = echt
    ? `De track meet ${km1(e.stats.km)} km, +${getal(e.stats.gain)} / −${getal(e.stats.loss)} m`
    : `Deze lijn meet ${km1(e.stats.km)} km, +${getal(e.stats.gain)} / −${getal(e.stats.loss)} m`;
  const nuance = echt ? "" : " — een getrokken lijn snijdt de bochten af";

  const wpts = e.route.waypoints.filter(w => w.name).map(w =>
    `<li><b>${esc(w.name)}</b> <span class="wele">${w.ele != null ? Math.round(w.ele) + " m" : ""}</span>`
    + (w.desc ? `<span class="wnote">${esc(w.desc)}</span>` : "") + "</li>").join("");

  return `<article class="stage" id="stage-${esc(d.id)}" data-i="${i}">
    <header class="stagehead">
      <div class="stagewhen">
        <p class="stagedate">${lang(d.datum)}</p>
        <h3 class="stagetitle">${esc(d.van)} → ${esc(d.naar)}</h3>
      </div>
      <span class="tgrade" title="${esc(d.zwaarteNote || "")}">${esc(d.zwaarte || "")}</span>
    </header>

    <div class="stagestats">${stats4(e).map(([k, v]) =>
      `<div class="sstat"><span class="k">${k}</span><span class="v">${esc(v)}</span></div>`).join("")}</div>
    <p class="statsrc">${g ? `Planning: ${esc(g.bron)}. ${meet}${nuance}.` : `${meet}; de tijd is een boektijd (300 m stijgen of 4 km per uur).`}</p>

    ${profielSvg(e.route, e.stats)}
    <p class="phint" id="phint-${esc(d.id)}"></p>

    <p class="stagetext">${esc(d.verhaal)}</p>
    ${d.heenweg ? `<p class="stagetext"><b>Heen:</b> ${esc(d.heenweg)}</p>` : ""}
    ${d.terugweg ? `<p class="stagetext"><b>Terug:</b> ${esc(d.terugweg)}</p>` : ""}
    ${d.let ? `<p class="stagelet"><b>Let op</b> — ${esc(d.let)}</p>` : ""}
    ${d.tip ? `<p class="stagetip"><b>Optie</b> — ${esc(d.tip)}</p>` : ""}

    <details class="wpts"><summary>Onderweg langs (${e.route.waypoints.length})</summary>
      <ul class="wptlist">${wpts}</ul></details>

    ${hut ? `<p class="stagehut">Slapen: <b>${esc(hut.naam)}</b> · ${hut.hoogte} m · reservering ${esc(hut.reservering)} · ${esc(hut.status.toLowerCase())}</p>` : ""}

    <div class="stagebtns">
      <button type="button" data-kaart="${i}">Toon op de kaart</button>
      <button type="button" data-gpx="${i}">GPX voor deze dag</button>
    </div>
  </article>`;
}

function hutkaartje(h){
  return `<div class="hutcard">
    <h4>${esc(h.naam)}</h4>
    <p class="hutmeta">${h.hoogte} m${h.ook ? ` · ${esc(h.ook)}` : ""}</p>
    <p class="hutmeta">Nacht van ${lang(h.nacht)} · ${h.personen} personen</p>
    <p class="hutres">Reservering <b>${esc(h.reservering)}</b> — ${esc(h.status.toLowerCase())}</p>
    <p class="hutnote">${esc(h.note)}</p>
    ${h.tel ? `<p class="hutmeta">Hut: <a href="tel:${esc(h.tel.replace(/\s/g, ""))}">${esc(h.tel)}</a></p>` : ""}
    <p><a href="${esc(h.site)}" target="_blank" rel="noopener">website van de hut</a></p>
  </div>`;
}

export function render(lijst){
  etappes = lijst;

  $("daypick").innerHTML = etappes.map((e, i) =>
    `<button type="button" data-dag="${i}" aria-pressed="false">${kort(e.def.datum)}</button>`).join("")
    + `<button type="button" data-dag="-1" aria-pressed="false">Alles</button>`;

  $("stages").innerHTML = etappes.map(kaartje).join("");
  $("hutlist").innerHTML = HUTTEN.map(hutkaartje).join("");

  etappes.forEach(e => {
    const svg = document.querySelector(`#stage-${e.def.id} .profile`);
    const hint = $("phint-" + e.def.id);
    koppelProfiel(svg, e.route, e.stats, wijsAan, txt => { if(hint) hint.textContent = txt; });
  });

  $("stages").addEventListener("click", ev => {
    const kaart = ev.target.closest("[data-kaart]");
    if(kaart){ kiesDag(+kaart.dataset.kaart, true); return; }
    const g = ev.target.closest("[data-gpx]");
    if(g) downloadEtappe(+g.dataset.gpx);
  });

  $("daypick").addEventListener("click", ev => {
    const b = ev.target.closest("[data-dag]");
    if(b) kiesDag(+b.dataset.dag, false);
  });

  $("gpxalles").addEventListener("click", downloadAlles);
}

/* Een dag kiezen: knoppen bij, kaart bij, en het kaartje uitlichten. */
export function kiesDag(i, scrollNaarKaart){
  actief = i;
  document.querySelectorAll("#daypick [data-dag]").forEach(b =>
    b.setAttribute("aria-pressed", String(+b.dataset.dag === i)));
  document.querySelectorAll(".stage").forEach(el =>
    el.classList.toggle("on", i < 0 || +el.dataset.i === i));
  showDay(i);
  const tekst = i < 0
    ? `Alle ${etappes.length} dagen op de kaart.`
    : `${lang(etappes[i].def.datum)} — ${etappes[i].def.van} → ${etappes[i].def.naar}.`;
  $("mapnow").textContent = tekst;
  if(scrollNaarKaart) $("map").scrollIntoView({ behavior: "smooth", block: "center" });
}

export function huidigeDag(){ return actief; }

/* ------------------------- GPX eruit ------------------------- */

function downloadEtappe(i){
  const e = etappes[i];
  bewaarGpx(`${e.def.bestand || e.def.id}.gpx`, toGpx({
    name: `${e.def.van} → ${e.def.naar} (${e.def.datum})`,
    desc: herkomst(e),
    points: e.route.points,
    waypoints: e.route.waypoints
  }));
}

/* De hele tocht in één bestand: de dagen achter elkaar, met alle
   tussenpunten als waypoints erbij. */
function downloadAlles(){
  const points = [];
  const waypoints = [];
  const gezien = new Set();
  etappes.forEach(e => {
    points.push(...e.route.points);
    e.route.waypoints.forEach(w => {
      const sleutel = w.name + "|" + w.lat.toFixed(4);
      if(gezien.has(sleutel)) return;
      gezien.add(sleutel);
      waypoints.push(w);
    });
  });
  bewaarGpx("greina-huttentocht.gpx", toGpx({
    name: TOUR.naam,
    desc: herkomst(etappes[0]),
    points, waypoints
  }));
}

const herkomst = e => e.route.gebouwd
  ? "Lijn getrokken langs de genoemde tussenpunten door de pagina zelf — geen opgenomen track. "
    + "Navigeer op de wegwijzers en de landkaart."
  : `Uit ${e.def.gpx || TOUR.gpx || "de meegeleverde GPX"}.`;
