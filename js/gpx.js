/* ------------------------------------------------------------------
   GPX lezen en doorrekenen. Eén bestand per etappe in routes/; hier
   wordt er een lijst punten van gemaakt plus de cijfers die je op een
   etappekaartje wil zien (afstand, stijgen, dalen, hoog/laag).

   Bewust klein en tolerant: komoot, swisstopo en Garmin schrijven
   allemaal net iets anders. Een <trk> met <trkseg>/<trkpt> wordt
   gelezen, een <rte> met <rtept> ook, en losse <wpt>'s worden de
   benoemde tussenpunten. Hoogte mag ontbreken — dan blijft het
   profiel leeg en vallen stijgen/dalen weg, de rest werkt gewoon.
------------------------------------------------------------------- */

const R = 6371000;                       // aardstraal in meter
const rad = d => d * Math.PI / 180;

/* Hemelsbrede afstand tussen twee punten, in meters. */
export function dist(a, b){
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat/2)**2
    + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon/2)**2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const num = v => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };
const text = (el, tag) => {
  const n = el.getElementsByTagName(tag)[0];
  return n && n.textContent ? n.textContent.trim() : "";
};

function point(el){
  const lat = num(el.getAttribute("lat")), lon = num(el.getAttribute("lon"));
  if(lat == null || lon == null) return null;
  const ele = num(text(el, "ele"));
  return { lat, lon, ele };
}

/* GPX-tekst → { name, desc, points, tracks, waypoints }. Gooit bij onleesbare XML.

   `points` is alles achter elkaar — handig als het bestand één etappe is.
   `tracks` houdt de opdeling vast zoals die in het bestand staat: één blok
   per <trk> (en anders per <trkseg>). Wie een tocht van meerdere dagen in
   één bestand exporteert, krijgt van komoot en consorten meestal precies
   die opdeling terug, en dan hoeft er niet geknipt te worden. */
export function parseGpx(xml){
  const doc = new window.DOMParser().parseFromString(xml, "application/xml");
  if(doc.getElementsByTagName("parsererror").length) throw new Error("geen geldige GPX");
  const root = doc.documentElement;
  if(!root || root.nodeName.toLowerCase() !== "gpx") throw new Error("geen GPX-bestand");

  const punten = el => Array.from(el.getElementsByTagName("trkpt")).map(point).filter(Boolean);

  const tracks = [];
  for(const trk of doc.getElementsByTagName("trk")){
    const naam = text(trk, "name");
    const segs = Array.from(trk.getElementsByTagName("trkseg"));
    // één <trk> met losse segmenten is meestal gewoon één doorlopende track
    // met gaten in de opname — die plakken we aan elkaar; meerdere <trk>'s
    // zijn wél bedoeld als aparte stukken
    const pts = segs.length ? segs.flatMap(punten) : punten(trk);
    if(pts.length > 1) tracks.push({ naam, points: pts });
  }
  // een <trk> met meerdere segmenten en verder niets: dan zijn de segmenten
  // de enige opdeling die er is, dus die bieden we alsnog aan
  if(tracks.length === 1){
    const segs = Array.from(doc.getElementsByTagName("trkseg")).map(punten).filter(p => p.length > 1);
    if(segs.length > 1){
      tracks.length = 0;
      segs.forEach(pts => tracks.push({ naam: "", points: pts }));
    }
  }
  if(!tracks.length){
    const rte = Array.from(doc.getElementsByTagName("rtept")).map(point).filter(Boolean);
    if(rte.length > 1) tracks.push({ naam: "", points: rte });
  }

  const waypoints = [];
  for(const el of doc.getElementsByTagName("wpt")){
    const p = point(el);
    if(!p) continue;
    waypoints.push({ ...p, name: text(el, "name"), desc: text(el, "desc"), type: text(el, "type") });
  }

  const meta = doc.getElementsByTagName("metadata")[0];
  const trk  = doc.getElementsByTagName("trk")[0];
  return {
    name: (meta && text(meta, "name")) || (trk && text(trk, "name")) || "",
    desc: (meta && text(meta, "desc")) || "",
    points: tracks.flatMap(t => t.points),
    tracks,
    waypoints
  };
}

/* Ruis eruit vóór we hoogtemeters optellen: een track van een telefoon
   wiebert een paar meter op en neer, en dat telt anders op tot honderden
   valse hoogtemeters. Alleen stijgingen groter dan `drempel` tellen mee —
   dezelfde truc die de meeste horloges gebruiken. */
function updown(points, drempel = 8){
  let gain = 0, loss = 0, ref = null;
  for(const p of points){
    if(p.ele == null) continue;
    if(ref == null){ ref = p.ele; continue; }
    const d = p.ele - ref;
    if(d >= drempel){ gain += d; ref = p.ele; }
    else if(d <= -drempel){ loss -= d; ref = p.ele; }
  }
  return { gain: Math.round(gain), loss: Math.round(loss) };
}

/* Punten → cijfers. `cum` is de afgelegde afstand per punt (meters),
   handig voor het hoogteprofiel. */
export function measure(points){
  const cum = [];
  let total = 0;
  points.forEach((p, i) => {
    if(i) total += dist(points[i-1], p);
    cum.push(total);
  });
  const eles = points.map(p => p.ele).filter(e => e != null);
  const { gain, loss } = updown(points);
  return {
    m: total,
    km: total / 1000,
    cum,
    gain, loss,
    hi: eles.length ? Math.max(...eles) : null,
    lo: eles.length ? Math.min(...eles) : null,
    hasEle: eles.length > 1
  };
}

/* Het punt op de track dat het dichtst bij een tussenpunt ligt — zo weten
   we waar een hut of pas op het profiel hoort te staan. */
export function nearestIndex(points, target){
  let best = 0, bd = Infinity;
  points.forEach((p, i) => {
    const d = dist(p, target);
    if(d < bd){ bd = d; best = i; }
  });
  return best;
}

/* Grove zwaarte-inschatting als er geen boektijd bekend is: DIN 33466 —
   300 hoogtemeters stijgen of 500 dalen per uur, 4 km/u vlak, en van de
   twee sommen de grootste plus de helft van de kleinste. */
export function boektijd({ km, gain, loss }){
  const vert = gain / 300 + loss / 500;
  const hor  = km / 4;
  const u = Math.max(vert, hor) + Math.min(vert, hor) / 2;
  return u;
}

/* Uren als "3 u 20". */
export function uren(u){
  if(!Number.isFinite(u)) return "–";
  const h = Math.floor(u), m = Math.round((u - h) * 60);
  return m === 60 ? `${h+1} u 00` : `${h} u ${String(m).padStart(2, "0")}`;
}

/* ---------------- de andere kant op: GPX schrijven ---------------- */

const xesc = s => String(s).replace(/[&<>"]/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" }[c]));
const f6 = n => Number(n).toFixed(6);
const tag = (naam, waarde) => waarde ? `<${naam}>${xesc(waarde)}</${naam}>` : "";

/* { points, waypoints } → GPX 1.1. Komt er een <wpt> zonder naam voorbij,
   dan slaan we die over: een naamloos punt zegt in een app niets. */
export function toGpx({ name, desc, points = [], waypoints = [] }){
  const wpts = waypoints.filter(w => w.name).map(w =>
    `  <wpt lat="${f6(w.lat)}" lon="${f6(w.lon)}">\n`
    + (w.ele != null ? `    <ele>${Math.round(w.ele)}</ele>\n` : "")
    + `    ${tag("name", w.name)}\n`
    + (w.desc ? `    ${tag("desc", w.desc)}\n` : "")
    + (w.type ? `    ${tag("type", w.type)}\n` : "")
    + "  </wpt>").join("\n");

  const trkpts = points.map(p =>
    `      <trkpt lat="${f6(p.lat)}" lon="${f6(p.lon)}">`
    + (p.ele != null ? `<ele>${Math.round(p.ele)}</ele>` : "")
    + "</trkpt>").join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="A&amp;B op reis — huttentocht" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    ${tag("name", name)}
    ${tag("desc", desc)}
  </metadata>
${wpts}
  <trk>
    ${tag("name", name)}
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>
`;
}

/* GPX aanbieden als download. Blob + object-URL, want de pagina is statisch
   en er is geen server die het bestand kan serveren. */
export function bewaarGpx(bestandsnaam, xml){
  const blob = new window.Blob([xml], { type: "application/gpx+xml" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = bestandsnaam;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => window.URL.revokeObjectURL(url), 1000);
}
