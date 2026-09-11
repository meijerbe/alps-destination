/* ------------------------------------------------------------------
   De kaart van de huttentocht. Alles eromheen is open: Leaflet (BSD)
   staat als vendor-kopie in de repo, zodat de pagina het onderweg niet
   van een CDN hoeft te halen, en de kaarten zelf komen van OpenTopoMap
   (OpenStreetMap-data, ODbL, weergave CC-BY-SA) en swisstopo (open
   overheidsdata). Alleen de tegels komen van internet.

   De kaart is gestapeld, van onder naar boven:

     onderlaag   OpenTopoMap — ligt er altijd onder. Zo sta je nooit op
                 een leeg vlak als de bovenlaag hapert of nog laadt, en
                 buiten Zwitserland is dit meteen de hele kaart.
     bovenlaag   de Landeskarte van swisstopo (of de luchtfoto): de kaart
                 waar in Zwitserland op gewandeld wordt. Met de schuif
                 eronder kun je 'm doorzichtig maken en het reliëf van de
                 onderlaag erdoorheen laten komen.
     wegen       het complete wandelwegennet van swisstopo, optioneel.
     routes      onze eigen lijnen, hutten en passen.
------------------------------------------------------------------- */
import { $ } from "./dom.js";
import { POI, TOUR } from "./tour-data.js";

const SWISSTOPO = "© <a href=\"https://www.swisstopo.admin.ch/\" target=\"_blank\" rel=\"noopener\">swisstopo</a>";
const OSM = "© <a href=\"https://www.openstreetmap.org/copyright\" target=\"_blank\" rel=\"noopener\">OpenStreetMap</a>-bijdragers, "
  + "<a href=\"https://opentopomap.org/\" target=\"_blank\" rel=\"noopener\">OpenTopoMap</a> (CC-BY-SA)";

// `pane` expliciet meegeven: een undefined-waarde overschrijft Leaflets eigen
// standaard ("tilePane") en dan heeft de laag nergens om in te hangen
const swiss = (laag, ext, pane) => L.tileLayer(
  `https://wmts.geo.admin.ch/1.0.0/${laag}/default/current/3857/{z}/{x}/{y}.${ext}`,
  { maxZoom: 18, maxNativeZoom: 17, attribution: SWISSTOPO, pane: pane || "tilePane" }
);

let map = null;
let lagen = {};
let onderlaag = null;      // de laag die er altijd onder ligt
let bovenlaag = null;      // de laag waar de doorzichtigheidsschuif op werkt
let etappes = [];          // [{ def, route, stats }]
let lijnen = [];           // Leaflet-polylines, zelfde volgorde als etappes
let markers = [];
let ikLaag = null;
let dot = null;            // stip die het profiel op de kaart aanwijst
let tegelFouten = 0;

/* Kleine ronde speld met een letter of cijfer erin. */
function speld(tekst, soort){
  return L.divIcon({
    className: "",
    html: `<span class="pin pin-${soort}">${tekst}</span>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -12]
  });
}

function popupHut(h){
  return `<b>${h.naam}</b><br>${h.hoogte} m`
    + (h.ook ? `<br><i>${h.ook}</i>` : "")
    + (h.note ? `<br>${h.note}` : "")
    + (h.site ? `<br><a href="${h.site}" target="_blank" rel="noopener">website</a>` : "");
}

/* Welke laag ligt er bovenop, en dus waar de doorzichtigheidsschuif op werkt.
   Een lege laag ("Alleen OpenTopoMap") is geen tegellaag; dan doet de schuif
   niets, want je kijkt al op de onderlaag. */
function kiesBoven(laag){
  if(!map.hasLayer(laag)) map.addLayer(laag);
  bovenlaag = typeof laag.setOpacity === "function" ? laag : null;
  const sl = $("laagmix");
  if(sl){
    sl.disabled = !bovenlaag;
    if(bovenlaag) bovenlaag.setOpacity(sl.value / 100);
  }
}

/* De schuif tussen onder- en bovenlaag: op 100 zie je alleen de Landeskarte,
   naar links komt het reliëf van OpenTopoMap eronder erdoorheen. */
export function mengLagen(pct){
  if(bovenlaag) bovenlaag.setOpacity(Math.max(0, Math.min(100, pct)) / 100);
}

/* Zakt swisstopo weg (geen bereik, tegelserver stuk), dan schuiven we
   zonder omhaal door naar de onderlaag — beter een kaart dan een gat. */
function bewaakTegels(laag, opUitwijk){
  laag.on("tileerror", () => {
    if(++tegelFouten === 10 && map.hasLayer(laag)) opUitwijk();
  });
  laag.on("tileload", () => { tegelFouten = 0; });
}

export function initMap(lijst){
  etappes = lijst;

  map = L.map("map", { scrollWheelZoom: false, zoomControl: true })
    .setView(TOUR.centrum, TOUR.zoom);
  map.on("click", () => map.scrollWheelZoom.enable());

  // eigen lagen tussen Leaflets standaardlagen in: tegels staan op 200,
  // onze lijnen op 400 — de onderlaag hoort daaronder, de wandelwegen
  // ertussenin
  map.createPane("onderlaag").style.zIndex = 190;
  map.createPane("wegen").style.zIndex = 350;
  map.getPane("wegen").style.pointerEvents = "none";

  // de onderlaag: OpenTopoMap, ligt er altijd onder
  onderlaag = L.tileLayer("https://tile.opentopomap.org/{z}/{x}/{y}.png",
    { maxZoom: 18, maxNativeZoom: 17, attribution: OSM, pane: "onderlaag" }).addTo(map);

  lagen = {
    "Landeskarte (swisstopo)": swiss("ch.swisstopo.pixelkarte-farbe", "jpeg"),
    "Luchtfoto (swisstopo)": swiss("ch.swisstopo.swissimage", "jpeg"),
    "Alleen OpenTopoMap": L.layerGroup()
  };
  const wandelwegen = swiss("ch.swisstopo.swisstlm3d-wanderwege", "png", "wegen");

  kiesBoven(lagen["Landeskarte (swisstopo)"]);
  map.on("baselayerchange", ev => kiesBoven(ev.layer));

  L.control.layers(lagen, { "Wandelwegen (swisstopo)": wandelwegen }, { position: "topright" }).addTo(map);
  L.control.scale({ imperial: false, position: "bottomleft" }).addTo(map);

  bewaakTegels(lagen["Landeskarte (swisstopo)"], () => {
    map.removeLayer(lagen["Landeskarte (swisstopo)"]);
    kiesBoven(lagen["Alleen OpenTopoMap"]);
    const st = $("maphint");
    if(st) st.textContent = "swisstopo laadt niet — je kijkt nu op de onderlaag, OpenTopoMap.";
  });

  // de lijnen: eerst een witte onderlaag zodat ze op elke ondergrond leesbaar
  // blijven, daarna de gekleurde lijn er bovenop
  etappes.forEach((e, i) => {
    const pad = e.route.points.map(p => [p.lat, p.lon]);
    const casing = L.polyline(pad, { color: "#fff", weight: 8, opacity: .85, lineCap: "round" }).addTo(map);
    const lijn = L.polyline(pad, { color: "#E08A33", weight: 4.5, opacity: 1, lineCap: "round" }).addTo(map);
    lijn.bindTooltip(`Dag ${i+1}: ${e.def.van} → ${e.def.naar}`, { sticky: true });
    lijnen.push({ casing, lijn, bounds: L.latLngBounds(pad) });
  });

  // hutten en passen uit de GPX-waypoints; dubbele namen (een hut is het
  // eind van de ene en het begin van de volgende etappe) maar één keer
  const gezien = new Set();
  etappes.forEach((e, i) => {
    e.route.waypoints.forEach(w => {
      const sleutel = w.name + "|" + w.lat.toFixed(3);
      if(gezien.has(sleutel)) return;
      gezien.add(sleutel);
      const belangrijk = w.type === "hut" || w.type === "pass" || w.type === "start" || w.type === "finish";
      const m = L.marker([w.lat, w.lon], {
        icon: belangrijk
          ? speld(w.type === "hut" ? "⌂" : w.type === "pass" ? "∧" : "•", w.type)
          : speld("", "tussen"),
        zIndexOffset: belangrijk ? 400 : 0,
        keyboard: belangrijk
      }).addTo(map);
      m.bindPopup(`<b>${w.name}</b><br>${w.ele != null ? Math.round(w.ele) + " m" : ""}`
        + (w.desc ? `<br>${w.desc}` : ""));
      markers.push({ m, dag: i, belangrijk });
    });
  });

  POI.forEach(p => {
    if(gezien.has(p.naam + "|" + p.lat.toFixed(3))) return;
    gezien.add(p.naam + "|" + p.lat.toFixed(3));
    const m = L.marker([p.lat, p.lon], { icon: speld(p.type === "pas" ? "∧" : "⌂", p.type === "pas" ? "pass" : "hut") })
      .addTo(map).bindPopup(popupHut(p));
    markers.push({ m, dag: -1, belangrijk: true });
  });

  return map;
}

/* Eén dag uitlichten (-1 = de hele tocht). De andere dagen blijven staan,
   maar dof — zo zie je waar de dag in het geheel valt. */
export function showDay(idx){
  lijnen.forEach((l, i) => {
    const aan = idx < 0 || i === idx;
    l.lijn.setStyle({ color: aan ? "#E08A33" : "#3D6B5C", weight: aan ? 4.5 : 3, opacity: aan ? 1 : .38 });
    l.casing.setStyle({ opacity: aan ? .85 : .3, weight: aan ? 8 : 5 });
    if(aan) l.lijn.bringToFront();
  });
  markers.forEach(({ m, dag, belangrijk }) => {
    const el = m.getElement();
    if(el) el.style.opacity = (belangrijk || idx < 0 || dag === idx) ? "1" : ".35";
  });
  const b = idx < 0
    ? lijnen.reduce((acc, l) => acc ? acc.extend(l.bounds) : L.latLngBounds(l.bounds.getSouthWest(), l.bounds.getNorthEast()), null)
    : lijnen[idx] && lijnen[idx].bounds;
  if(b) map.fitBounds(b, { padding: [34, 34] });
}

/* Stip op de kaart op de plek waar de muis het hoogteprofiel aanraakt. */
export function wijsAan(punt){
  if(!map) return;
  if(!punt){ if(dot){ map.removeLayer(dot); dot = null; } return; }
  const ll = [punt.lat, punt.lon];
  if(dot) dot.setLatLng(ll);
  else dot = L.circleMarker(ll, { radius: 6, color: "#fff", weight: 2, fillColor: "#B4462F", fillOpacity: 1 }).addTo(map);
}

/* De tegelsjablonen van wat er nu ligt — dat is wat offline opgeslagen
   moet worden als je de kaart wil meenemen. */
export function tegelBronnen(){
  const uit = [];
  if(onderlaag) uit.push(onderlaag._url);
  if(bovenlaag && map.hasLayer(bovenlaag)) uit.push(bovenlaag._url);
  return uit;
}

/* Waar we zelf staan. `volgen` schuift de kaart mee zodra je uit beeld
   dreigt te lopen — maar niet zolang je hem net met de hand verschoven
   hebt staan kijken, want dan trek je 'm onder je vandaan. */
export function zetIk(lat, lon, nauwkeurig, volgen){
  if(!map) return;
  const ll = [lat, lon];
  if(!ikLaag){
    ikLaag = {
      ring: L.circle(ll, { radius: Math.max(nauwkeurig || 0, 10), color: "#3E8FA8", weight: 1, fillOpacity: .12 }).addTo(map),
      stip: L.circleMarker(ll, { radius: 7, color: "#fff", weight: 2, fillColor: "#3E8FA8", fillOpacity: 1 }).addTo(map)
    };
  } else {
    ikLaag.ring.setLatLng(ll).setRadius(Math.max(nauwkeurig || 0, 10));
    ikLaag.stip.setLatLng(ll);
  }
  ikLaag.stip.bringToFront();
  if(volgen && !map.getBounds().pad(-0.25).contains(ll)) map.panTo(ll, { animate: true });
}

export function wisIk(){
  if(ikLaag && map){
    map.removeLayer(ikLaag.ring);
    map.removeLayer(ikLaag.stip);
  }
  ikLaag = null;
}

/* Leaflet moet opnieuw meten als de kaart van grootte verandert. */
export function hermeet(){ if(map) map.invalidateSize(); }
