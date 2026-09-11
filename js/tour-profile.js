/* ------------------------------------------------------------------
   Het hoogteprofiel onder elk etappekaartje. Eén SVG per dag: hoogte
   tegen afgelegde afstand, met een streepje bij elke hut en pas.

   Schuif je er met de muis of een vinger overheen, dan loopt er een
   stip mee over de kaart — zo zie je waar die klim in het profiel op
   de kaart ligt.
------------------------------------------------------------------- */
const W = 640, H = 150;
const PAD = { l: 38, r: 10, t: 12, b: 20 };

/* Ronde stapgrootte voor de horizontale lijnen: 100, 200 of 500 m. */
function stap(bereik){
  for(const s of [100, 200, 250, 500]) if(bereik / s <= 5) return s;
  return 1000;
}

export function profielSvg(route, stats){
  if(!stats.hasEle) return "";
  const pts = route.points;
  const lo = Math.floor(stats.lo / 100) * 100;
  const hi = Math.ceil(stats.hi / 100) * 100;
  const span = Math.max(hi - lo, 100);
  const x = m => PAD.l + (m / Math.max(stats.m, 1)) * (W - PAD.l - PAD.r);
  const y = e => PAD.t + (1 - (e - lo) / span) * (H - PAD.t - PAD.b);

  const lijn = pts.map((p, i) => `${i ? "L" : "M"}${x(stats.cum[i]).toFixed(1)},${y(p.ele ?? lo).toFixed(1)}`).join("");
  const vlak = `${lijn}L${x(stats.m).toFixed(1)},${y(lo)}L${PAD.l},${y(lo)}Z`;

  const raster = [];
  for(let e = lo; e <= hi; e += stap(span)){
    raster.push(`<line class="pgrid" x1="${PAD.l}" y1="${y(e).toFixed(1)}" x2="${W - PAD.r}" y2="${y(e).toFixed(1)}"/>`
      + `<text class="pax" x="${PAD.l - 6}" y="${(y(e) + 3.5).toFixed(1)}" text-anchor="end">${e}</text>`);
  }

  // streepjes bij de punten die ertoe doen
  const merk = (route.waypoints || [])
    .map(w => ({ w, i: dichtstbij(pts, w) }))
    .filter(({ w }) => w.type === "hut" || w.type === "pass" || w.type === "start" || w.type === "finish")
    .map(({ w, i }) => {
      const px = x(stats.cum[i]), py = y(pts[i].ele ?? lo);
      return `<line class="pmark" x1="${px.toFixed(1)}" y1="${py.toFixed(1)}" x2="${px.toFixed(1)}" y2="${H - PAD.b}"/>`
        + `<circle class="pdotfix" cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="3"/>`;
    }).join("");

  const km = stats.km;
  const asX = [0, km / 2, km].map(v => {
    const px = x(v * 1000);
    const anc = v === 0 ? "start" : v === km ? "end" : "middle";
    return `<text class="pax" x="${px.toFixed(1)}" y="${H - 6}" text-anchor="${anc}">${v.toFixed(1).replace(".", ",")} km</text>`;
  }).join("");

  return `<svg class="profile" viewBox="0 0 ${W} ${H}" role="img"
      aria-label="Hoogteprofiel: ${stats.km.toFixed(1)} kilometer, van ${Math.round(stats.lo)} tot ${Math.round(stats.hi)} meter">
    ${raster.join("")}
    <path class="parea" d="${vlak}"/>
    <path class="pline" d="${lijn}"/>
    ${merk}
    ${asX}
    <line class="phair" x1="0" y1="${PAD.t}" x2="0" y2="${H - PAD.b}" style="opacity:0"/>
    <circle class="pdot" cx="0" cy="0" r="4.5" style="opacity:0"/>
  </svg>`;
}

function dichtstbij(pts, w){
  let best = 0, bd = Infinity;
  pts.forEach((p, i) => {
    const d = (p.lat - w.lat) ** 2 + (p.lon - w.lon) ** 2;
    if(d < bd){ bd = d; best = i; }
  });
  return best;
}

/* Aanwijzen: muis of vinger over het profiel → index in de route.
   `opPunt(punt|null)` krijgt het aangewezen punt, `opLabel` de tekst. */
export function koppelProfiel(svg, route, stats, opPunt, opLabel){
  if(!svg || !stats.hasEle) return;
  const hair = svg.querySelector(".phair");
  const dot = svg.querySelector(".pdot");
  const lo = Math.floor(stats.lo / 100) * 100;
  const span = Math.max(Math.ceil(stats.hi / 100) * 100 - lo, 100);

  const aan = ev => {
    const box = svg.getBoundingClientRect();
    if(!box.width) return;
    const frac = (ev.clientX - box.left) / box.width;
    const m = Math.max(0, Math.min(1, (frac * W - PAD.l) / (W - PAD.l - PAD.r))) * stats.m;
    let i = 0;
    while(i < stats.cum.length - 1 && stats.cum[i + 1] < m) i++;
    const p = route.points[i];
    const px = PAD.l + (stats.cum[i] / Math.max(stats.m, 1)) * (W - PAD.l - PAD.r);
    const py = PAD.t + (1 - ((p.ele ?? lo) - lo) / span) * (H - PAD.t - PAD.b);
    hair.setAttribute("x1", px); hair.setAttribute("x2", px); hair.style.opacity = "1";
    dot.setAttribute("cx", px); dot.setAttribute("cy", py); dot.style.opacity = "1";
    opPunt(p);
    opLabel(`${(stats.cum[i] / 1000).toFixed(1).replace(".", ",")} km · ${Math.round(p.ele ?? 0)} m`);
  };
  const uit = () => {
    hair.style.opacity = "0"; dot.style.opacity = "0";
    opPunt(null); opLabel("");
  };

  svg.addEventListener("pointermove", aan);
  svg.addEventListener("pointerdown", aan);
  svg.addEventListener("pointerleave", uit);
  svg.addEventListener("pointercancel", uit);
}
