/* ------------------------------------------------------------------
   Kerncijfers, föhnmeter, ranglijst en matrix.
------------------------------------------------------------------- */
import { $, esc, fmt, clamp, DAYS, dow, dm } from "./dom.js";
import { PARTS, WEIGHTS, PROFILE_LABEL, COUNTRY, driveTxt } from "./regions.js";
import { METRICS } from "./metrics.js";
import { state } from "./state.js";
import { scoreColor, foehnLabel, metricGetter } from "./weather.js";
import { histStatusNote } from "./historical.js";

export function renderKpis(v){
  const el = $("kpis");
  if(!v.scored.length){ el.innerHTML = ""; return; }
  const top = v.scored[0];
  const runner = v.scored[1];
  const driest = [...v.scored].sort((a,b)=>a.rainSum-b.rainSum)[0];
  const bestWin = [...v.scored].sort((a,b)=>b.window.avg-a.window.avg)[0];
  const wd = bestWin.window;
  const gap = runner ? top.total - runner.total : null;

  const tiles = [
    {k:"Beste keuze", v:top.n,
     n:`score ${fmt(top.total)} · ${driveTxt(top)}` + (gap!=null ? ` · ${gap>=1?"+"+fmt(gap):"nek aan nek"} t.o.v. ${runner.n}` : "")},
    {k:`Beste ${wd.k} dagen`, v:bestWin.n,
     n:`${DAYS[dow(wd.from)]} ${dm(wd.from)} – ${DAYS[dow(wd.to)]} ${dm(wd.to)} · score ${fmt(wd.avg)}`},
    {k:"Droogst", v:driest.n,
     n:`${driest.rainSum.toFixed(1)} mm over ${v.n} dagen · ${driest.dryDays} van ${v.n} dagen droog`},
    {k:"Föhn", v:v.foehnAvg==null ? "—" : (v.foehnAvg>=0?"+":"") + v.foehnAvg.toFixed(1) + " hPa",
     n:foehnLabel(v.foehnAvg) + (v.foehnAvg==null ? "" : ` · gemiddeld over ${v.n} dagen`)}
  ];
  el.innerHTML = tiles.map(t=>
    `<div class="kpi"><div class="k">${esc(t.k)}</div><div class="v" title="${esc(t.v)}">${esc(t.v)}</div><div class="n">${esc(t.n)}</div></div>`
  ).join("");
}

export function renderFoehn(v){
  if(v.foehnAvg == null){
    $("verdict").textContent = "Geen drukdata beschikbaar.";
    $("foehnstrip").innerHTML = "";
    return;
  }
  const avg = v.foehnAvg;
  $("needle").style.left = clamp(50 + avg*5.5, 3, 97) + "%";   // ±9 hPa vult de schaal

  const signed = (avg >= 0 ? "+" : "") + avg.toFixed(1);
  let verdict;
  if(avg > 2.5)       verdict = `<strong>Nordföhn-signaal (${signed} hPa gemiddeld).</strong> Hogere druk noordelijk: de zuidkant — Vinschgau, Engadin, Dolomieten — ligt in de luwte en klaart waarschijnlijk op. Tirol vangt de bewolking.`;
  else if(avg < -2.5) verdict = `<strong>Südföhn-signaal (${signed} hPa gemiddeld).</strong> Aanvoer vanuit het zuiden: stuwingsregen aan de zuidrand, terwijl Tirol juist droog en warm wordt. Blijf dan noordelijk.`;
  else                verdict = `<strong>Vlak drukveld (${signed} hPa).</strong> Geen duidelijke föhnsturing. Beide kanten hebben ongeveer gelijke kansen — de lokale scores hieronder wegen dan zwaarder dan de grote lijn.`;
  $("verdict").innerHTML = verdict;

  // dag-voor-dag: waar zit het signaal, en draait het?
  $("foehnstrip").innerHTML = v.foehn.map(f=>{
    const t = clamp(50 + f.diff*5.5, 0, 100);
    return `<div style="background:${scoreColor(t)}" title="${f.date}: ${f.diff>=0?"+":""}${f.diff.toFixed(1)} hPa">
      ${DAYS[dow(f.date)]} ${f.diff>=0?"+":""}${f.diff.toFixed(1)}</div>`;
  }).join("");
}

function whyBlock(p){
  const w = WEIGHTS[state.profile];
  const contrib = PARTS.map(x=>({...x, val: p.avgParts[x.k]*w[x.k]})).filter(x=>w[x.k] > 0);
  const bars = contrib.map(x=>`<i style="width:${x.val}%;background:${x.c}" title="${x.label}: ${x.val.toFixed(1)} van ${fmt(p.total)}"></i>`).join("");
  const leg = contrib.map(x=>`<span><b style="background:${x.c}"></b>${x.label} ${x.val.toFixed(1)}</span>`).join("");
  const strong = [...contrib].sort((a,b)=>b.val-a.val)[0];
  const weakest = [...contrib].sort((a,b)=>(a.val/Math.max(w[a.k],.001))-(b.val/Math.max(w[b.k],.001)))[0];
  const wd = p.window;
  return `
    <div class="why">
      <div class="whytitle">Opbouw van de score — ${fmt(p.total)} van 100</div>
      <div class="whybar">${bars}</div>
      <div class="whylegend">${leg}</div>
      <p class="whynote">
        Trekker is <strong>${strong.label}</strong>; zwakste schakel is <strong>${weakest.label}</strong>.
        Beste aaneengesloten venster: <strong>${DAYS[dow(wd.from)]} ${dm(wd.from)} – ${DAYS[dow(wd.to)]} ${dm(wd.to)}</strong>
        (score ${fmt(wd.avg)}). ${p.dryDays} van ${p.per.length} dagen onder 1 mm,
        ${p.rainSum.toFixed(1)} mm totaal, gemiddeld ${p.sunAvg.toFixed(1)} zonuren,
        vriespunt zakt tot ${fmt(p.minFrz)} m.
      </p>
    </div>`;
}

export function renderRank(v){
  const list = $("list");
  list.innerHTML = "";

  if(!v.scored.length){
    list.innerHTML = `<p class="empty">Geen bestemmingen binnen ${state.drive} u rijden. Schuif de rijtijd omhoog.</p>`;
  }

  const top = v.scored[0];
  v.scored.forEach((p,i)=>{
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "row";
    btn.dataset.open = p.n;
    btn.setAttribute("aria-expanded", state.open===p.n ? "true" : "false");

    const strip = p.per.map(d=>
      `<div class="cell" style="background:${scoreColor(d.s)}" title="${d.date}: score ${fmt(d.s)}, ${d.rain.toFixed(1)} mm, ${(d.sun/3600).toFixed(1)} zonuren"><span>${d.rain >= 9.5 ? fmt(d.rain) : d.rain.toFixed(1)}</span></div>`
    ).join("");
    const stripLabels = p.per.map(d=>{
      const i = dow(d.date);
      return `<div class="${i>=5?"we":""}">${DAYS[i]}</div>`;
    }).join("");

    const tags = [];
    if(i === 0) tags.push('<span class="tag best">beste keuze</span>');
    if(p.dryDays === p.per.length) tags.push('<span class="tag">alles droog</span>');
    else if(p.dryDays >= p.per.length - 1) tags.push(`<span class="tag">${p.dryDays}/${p.per.length} droog</span>`);
    if(p.minFrz < 2600) tags.push(`<span class="tag">sneeuw &lt; ${fmt(p.minFrz)} m</span>`);

    btn.innerHTML = `
      <div class="rank">${String(i+1).padStart(2,"0")}</div>
      <div>
        <div class="name">${esc(p.n)}${tags.join("")}</div>
        <div class="meta">${esc(p.r)}, ${esc(COUNTRY[p.c]||p.c)} · ${driveTxt(p)} · ${esc(p.side)} · ${p.rainSum.toFixed(1)} mm · ${p.sunAvg.toFixed(1)} u zon/dag</div>
        <div class="strip">${strip}</div>
        <div class="striplabels">${stripLabels}</div>
      </div>
      <div>
        <div class="score">${fmt(p.total)}</div>
        <div class="scorelabel">score</div>
        <div class="delta">${i===0 ? "&nbsp;" : "−" + (top.total-p.total).toFixed(1)}</div>
      </div>`;
    list.appendChild(btn);

    if(state.open===p.n){
      const det = document.createElement("div");
      det.className = "detail";
      det.innerHTML = whyBlock(p) + `
        <div class="scroller"><table>
          <thead><tr>
            <th>dag</th><th>mm</th><th>kans</th><th>zon</th><th>max</th><th>wind</th><th>0 °C</th><th>score</th>
          </tr></thead>
          <tbody>
          ${p.per.map(d=>`
            <tr>
              <td>${DAYS[dow(d.date)]} ${dm(d.date)}</td>
              <td>${d.rain.toFixed(1)}</td>
              <td>${fmt(d.prob)}%</td>
              <td>${(d.sun/3600).toFixed(1)}u</td>
              <td>${fmt(d.tmax)}°</td>
              <td>${fmt(d.wind)}</td>
              <td class="${d.frz<2600?"snow":""}">${fmt(d.frz)}m</td>
              <td>${fmt(d.s)}</td>
            </tr>`).join("")}
          </tbody>
        </table></div>`;
      list.appendChild(det);
    }
  });

  const f = v.dates[0], l = v.dates[v.n-1];
  $("sectionsub").textContent =
    `${v.scored.length} bestemmingen, gewogen voor ${PROFILE_LABEL[state.profile].toLowerCase()} over ${v.n} dagen `
    + `(${dm(f)} t/m ${dm(l)}). De balk is de dag-voor-dag score, het getal erin is de neerslag in mm.`;
}

export function renderMatrix(v){
  const M = METRICS[state.metric];
  const get = metricGetter(M);
  const t = $("matrix");
  if(!v.scored.length){ t.innerHTML = ""; $("mnote").textContent = ""; return; }

  // sorteer op hoe goed de bestemming scoort op de getoonde metriek — bij
  // historische data kan een dag nog "onbekend" (null) zijn; die telt dan
  // niet mee in het gemiddelde van de laatste kolom
  const rows = [...v.scored].map(p=>{
    const vals = p.per.map(get);
    const known = vals.filter(x => x != null);
    return {p, vals, mean: known.length ? known.reduce((a,b)=>a+b,0)/known.length : null,
            goodMean: p.per.reduce((a,d)=>a+M.good(get(d)),0)/p.per.length};
  }).sort((a,b)=>b.goodMean-a.goodMean);

  const head = v.dates.map(d=>`<th class="${dow(d)>=5?"we":""}">${DAYS[dow(d)]}<br>${dm(d)}</th>`).join("");
  const body = rows.map(({p,vals,mean})=>{
    const tds = vals.map((val,k)=>{
      const d = p.per[k];
      return `<td class="m" style="background:${scoreColor(M.good(val))}"
        title="${esc(p.n)} · ${d.date} — score ${fmt(d.s)}, ${d.rain.toFixed(1)} mm, ${(d.sun/3600).toFixed(1)} u zon, ${fmt(d.tmax)} °C, wind ${fmt(d.wind)} km/u, 0 °C op ${fmt(d.frz)} m"
        >${M.txt(val)}</td>`;
    }).join("");
    return `<tr><th><b>${esc(p.n)}</b><em>${esc(COUNTRY[p.c]||p.c)} · ${driveTxt(p)}</em></th>${tds}<td class="avg">${M.txt(mean)}</td></tr>`;
  }).join("");

  t.innerHTML = `<thead><tr><th style="text-align:left">bestemming</th>${head}<th class="avgh">gem</th></tr></thead><tbody>${body}</tbody>`;

  $("matrixsub").textContent = state.histMode
    ? `Alle ${v.scored.length} bestemmingen tegen alle ${v.n} dagen, als 15-jaars klimatologisch gemiddelde — geen voorspelling.`
    : `Alle ${v.scored.length} bestemmingen tegen alle ${v.n} dagen. Oranje is gunstig, blauw ongunstig — `
    + `ook bij neerslag, wind en vriespunt, zodat de kleur altijd hetzelfde betekent.`;
  $("mnote").innerHTML =
    `Getoond: <strong>${M.label}</strong>${state.histMode ? " (historisch)" : ""}. Rijen staan gesorteerd op hoe `
    + `gunstig die waarde gemiddeld uitpakt, niet op de totaalscore. Hover of tik een cel voor alle waarden van die dag.`
    + (state.histMode ? histStatusNote(v.dates) : "");
}
