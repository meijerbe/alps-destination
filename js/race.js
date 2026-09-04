/* ==================================================================
   Trailrun — wie loopt welke afstand, en wanneer staat wie aan de finish.
   Dit bestand doet de opslag (gedeeld via Supabase, anders per browser),
   de invulkaartjes en de grafieken. Het rekenwerk zelf staat los in
   race-model.js, zodat het na te rekenen is zonder DOM eromheen.
================================================================== */
import { $, esc } from "./dom.js";
import { RACES, raceById, CLIMB, DUUR, GROND, TECH, PRESETS, JAREN, uitslagUrl, duvUrl, BRONNEN } from "./race-data.js";
import {
  predict, pBefore, pFirst, pUnder, density,
  fmtDur, fmtClock, fmtPace, parseResults, toonResults, statsOf, placeOf
} from "./race-model.js";
import { sb, supaEnabled, TRIP_ID, localId, supaErrText } from "./supabase-client.js";
import { me } from "./packing.js";
import { toast } from "./toast.js";

const RUN_KEY  = "abopreis:race:v1";
const OPTS_KEY = "abopreis:raceopts:v1";

export let runners = new Map();   // "<id>" → rij
export let uitslagen = new Map(); // "<race>" → {race, jaar, times, updated_by, updated_at}
export let raceOpts = {climb:"normaal", courses:{}, results:{}, fieldRace:"muz30"};

const nl = n => String(n).replace(".", ",");
const pct = p => Math.round(p*100) + "%";

/* ---------- routes: standaard uit race-data.js, bij te stellen in de app ---------- */
export function courseOf(id){
  const base = raceById(id);
  return {...base, ...(raceOpts.courses[id] || {})};
}

/* ---------- opslag ---------- */
function loadOpts(){
  try{ Object.assign(raceOpts, JSON.parse(localStorage.getItem(OPTS_KEY) || "{}")); }catch{}
}
function saveOpts(){ try{ localStorage.setItem(OPTS_KEY, JSON.stringify(raceOpts)); }catch{} }

function loadRunnersLocal(){
  try{
    const arr = JSON.parse(localStorage.getItem(RUN_KEY) || "[]");
    runners = new Map(arr.map(r => [String(r.id), r]));
  }catch{ runners = new Map(); }
}
function saveRunnersLocal(){ try{ localStorage.setItem(RUN_KEY, JSON.stringify([...runners.values()])); }catch{} }

// Zonder Supabase leven de geplakte uitslagen in raceOpts.results, mét
// Supabase in race_results — één rij per wedstrijd, zodat één van jullie
// hem plakt en de rest hem meteen heeft.
function uitslagenLokaal(){
  uitslagen = new Map(Object.entries(raceOpts.results || {})
    .filter(([, v]) => v)
    .map(([race, v]) => [race, typeof v === "string"
      ? {race, jaar: JAREN[0], times: v}
      : {race, jaar: v.jaar || JAREN[0], times: v.times || ""}]));
}

export async function loadRaceState(){
  loadOpts();
  if(!supaEnabled){ loadRunnersLocal(); uitslagenLokaal(); return; }
  try{
    const [lopers, lijsten] = await Promise.all([
      sb.from("race_runners").select("*").eq("trip", TRIP_ID).order("created_at"),
      sb.from("race_results").select("*").eq("trip", TRIP_ID)
    ]);
    if(lopers.error) throw lopers.error;
    runners = new Map(lopers.data.map(r => [String(r.id), r]));
    if(lijsten.error) throw lijsten.error;
    uitslagen = new Map(lijsten.data.map(r => [r.race, r]));
  }catch(err){
    console.error("[trailrun] laden mislukt:", err);
    toast("Trailrun laden mislukt\n" + supaErrText(err), 5000);
  }
}

export async function addRunner(name, raceId){
  name = String(name || "").trim();
  if(!name) return;
  const row = {
    trip: TRIP_ID, name, race: raceId || "muz30",
    ref_dist: 21.1, ref_gain: 80, ref_secs: 6300,
    duur: "gemiddeld", grond: "weg", tech: "gemiddeld", adjust: 0, target_secs: null,
    created_by: me
  };
  if(!supaEnabled){
    const id = localId();
    runners.set(id, {...row, id, created_at: new Date().toISOString()});
    saveRunnersLocal();
    renderRace();
    return;
  }
  try{
    const {data, error} = await sb.from("race_runners").insert(row).select().single();
    if(error) throw error;
    runners.set(String(data.id), data);
    renderRace();
  }catch(err){
    console.error("[trailrun] toevoegen mislukt:", err);
    toast("Toevoegen mislukt\n" + supaErrText(err), 5000);
  }
}

export async function patchRunner(id, patch){
  const cur = runners.get(String(id));
  if(!cur) return;
  runners.set(String(id), {...cur, ...patch, updated_by: me, updated_at: new Date().toISOString()});
  if(!supaEnabled){ saveRunnersLocal(); return; }
  try{
    const {error} = await sb.from("race_runners")
      .update({...patch, updated_by: me, updated_at: new Date().toISOString()}).eq("id", id);
    if(error) throw error;
  }catch(err){
    console.error("[trailrun] bijwerken mislukt:", err);
    toast("Bijwerken mislukt\n" + supaErrText(err), 5000);
  }
}

export async function deleteRunner(id){
  const r = runners.get(String(id));
  runners.delete(String(id));
  renderRace();
  toast(r ? `${r.name} verwijderd` : "Loper verwijderd");
  if(!supaEnabled){ saveRunnersLocal(); return; }
  try{
    const {error} = await sb.from("race_runners").delete().eq("id", id);
    if(error) throw error;
  }catch(err){
    console.error("[trailrun] verwijderen mislukt:", err);
    toast("Verwijderen mislukt\n" + supaErrText(err), 5000);
  }
}

export function handleRaceChange(payload){
  if(payload.eventType === "DELETE") runners.delete(String(payload.old.id));
  else runners.set(String(payload.new.id), payload.new);
  renderRace();
}

export function setClimb(id){ raceOpts.climb = id; saveOpts(); renderRace(); }
export function setCourse(id, patch){
  raceOpts.courses[id] = {...(raceOpts.courses[id] || {}), ...patch};
  saveOpts();
  // niet de kaartjes hertekenen: je bent misschien net naar het volgende veld
  // getabd, en dan sta je opeens nergens meer. Alleen het terugzetlinkje aan.
  const terug = document.querySelector(`.course[data-id="${id}"] .clink`);
  if(terug) terug.hidden = false;
  renderRaceOutputs();
}
export function resetCourse(id){ delete raceOpts.courses[id]; saveOpts(); renderRace(); }
export function setFieldRace(id){ raceOpts.fieldRace = id; saveOpts(); renderField({forceer:true}); }

export async function setFieldText(txt){
  const race = raceOpts.fieldRace;
  const tijden = parseResults(txt);
  const oud = uitslagen.get(race);
  const jaar = oud ? oud.jaar : JAREN[0];
  // alleen de tijden bewaren, geen namen: dat scheelt ruimte en er hoeft
  // niemands naam de database in om een spreiding te kunnen tekenen
  const times = toonResults(tijden);
  if(oud && oud.times === times) return;
  const rij = {race, jaar, times, updated_by: me, updated_at: new Date().toISOString()};
  tijden.length ? uitslagen.set(race, rij) : uitslagen.delete(race);
  renderField();
  await bewaarUitslag(race, rij, tijden.length);
}

export async function setFieldYear(jaar){
  const race = raceOpts.fieldRace;
  const oud = uitslagen.get(race) || {race, times: ""};
  const rij = {...oud, race, jaar, updated_by: me, updated_at: new Date().toISOString()};
  uitslagen.set(race, rij);
  renderField({forceer:true});
  await bewaarUitslag(race, rij, true);
}

async function bewaarUitslag(race, rij, houden){
  if(!supaEnabled){
    raceOpts.results = Object.fromEntries([...uitslagen].map(([k, v]) => [k, {jaar: v.jaar, times: v.times}]));
    saveOpts();
    return;
  }
  try{
    const {error} = houden
      ? await sb.from("race_results").upsert({trip: TRIP_ID, ...rij}, {onConflict: "trip,race"})
      : await sb.from("race_results").delete().eq("trip", TRIP_ID).eq("race", race);
    if(error) throw error;
  }catch(err){
    console.error("[trailrun] uitslag bewaren mislukt:", err);
    toast("Uitslag bewaren mislukt\n" + supaErrText(err), 5000);
  }
}

export function handleResultsChange(payload){
  if(payload.eventType === "DELETE") uitslagen.delete(payload.old.race);
  else uitslagen.set(payload.new.race, payload.new);
  renderField();
}

/* ---------- automatisch ophalen, met plakken als terugval ----------
   Deze pagina draait in de bezoekers eigen browser, niet in een sandbox —
   dus reikwijdte is geen probleem. Wat wél in de weg zit is CORS: Rate My
   Trail moet expliciet toestaan dat een andere site zijn HTML uitleest, en
   dat weten we pas als iemand hier echt op klikt. Lukt het niet, dan is de
   plakknop ernaast nog steeds gewoon de weg. */
async function haalPagina(url){
  const r = await fetch(url, {mode:"cors"});
  if(!r.ok) throw new Error("http " + r.status);
  return r.text();
}

export async function probeerAutomatisch(){
  const btn = document.getElementById("fieldfetch");
  const race = raceOpts.fieldRace;
  const jaar = (uitslagen.get(race) || {}).jaar || JAREN[0];
  const url = uitslagUrl(race, jaar);

  if(btn){ btn.disabled = true; btn.dataset.busy = "1"; btn.textContent = "Ophalen…"; }
  try{
    let html = await haalPagina(url);
    let paginas = 1;
    // grotere velden staan over meerdere pagina's; doorbladeren tot een
    // pagina niets nieuws oplevert of niet meer bestaat
    for(let p = 2; p <= 8; p++){
      let extra;
      try{ extra = await haalPagina(`${url}/${p}`); }
      catch{ break; }
      if(!/\d{1,2}[:.][0-5]\d[:.][0-5]\d/.test(extra)) break;
      html += "\n" + extra;
      paginas = p;
    }
    const tijden = parseResults(html);
    if(!tijden.length) throw new Error("geen tijden op de pagina gevonden");
    await setFieldText(toonResults(tijden));
    toast(`Uitslag opgehaald: ${tijden.length} tijden${paginas > 1 ? ` over ${paginas} pagina's` : ""}.`);
  }catch(err){
    console.warn("[trailrun] automatisch ophalen mislukt:", err);
    toast("Automatisch ophalen lukt niet vanuit de browser — de bron blokkeert dit meestal voor andere sites (CORS).\nPlak de uitslag zelf hieronder.", 6000);
  }finally{
    if(btn){ btn.disabled = false; delete btn.dataset.busy; btn.textContent = "Probeer automatisch op te halen"; }
  }
}

/* ---------- de lijst lopers, op volgorde van toevoegen ---------- */
const sorted = () => [...runners.values()]
  .sort((a,b) => String(a.created_at||"").localeCompare(String(b.created_at||"")));

// Alleen wie een bruikbare referentie heeft doet mee in de grafieken.
function predictions(){
  return sorted().map(r => {
    const p = predict(r, courseOf(r.race), raceOpts.climb);
    return p ? {r, p} : null;
  }).filter(Boolean);
}

const raceIdx = id => Math.max(0, RACES.findIndex(r => r.id === id));
const raceColor = id => `var(--rc${raceIdx(id)+1})`;

/* ==================================================================
   Tekenen
================================================================== */
export function renderRace(){
  renderClimb();
  renderCourses();
  metFocus(renderRoster);
  renderRaceOutputs();
  renderHow();
}

function renderClimb(){
  $("climb").innerHTML = CLIMB.map(c =>
    `<button type="button" data-c="${c.id}" title="${esc(c.note)}" aria-pressed="${c.id === raceOpts.climb}">${esc(c.lab)}</button>`
  ).join("");
}

function renderCourses(){
  $("courses").innerHTML = RACES.map(base => {
    const c = courseOf(base.id), eigen = !!raceOpts.courses[base.id];
    return `<div class="course" data-id="${base.id}" style="--rc:${raceColor(base.id)}">
      <div class="cn">${esc(c.n)}<span>${esc(c.sub)}</span></div>
      <div class="cflds">
        <label><span class="lab">km</span><input type="number" step="0.1" min="1" max="200" data-cf="dist" value="${c.dist}"></label>
        <label><span class="lab">hm</span><input type="number" step="50" min="0" max="12000" data-cf="gain" value="${c.gain}"></label>
        <label><span class="lab">start</span><input type="text" inputmode="numeric" maxlength="5" data-cf="start" value="${esc(c.start)}"></label>
      </div>
      <button type="button" class="clink" data-reset="${base.id}"${eigen ? "" : " hidden"}>terug naar de folder</button>
    </div>`;
  }).join("");
}

function veld(lab, inner){ return `<label class="fld"><span class="lab">${lab}</span>${inner}</label>`; }
function keuze(f, opts, val){
  return `<select class="pick" data-f="${f}">` + opts.map(o =>
    `<option value="${o.id}"${o.id === val ? " selected" : ""}>${esc(o.lab)}</option>`).join("") + `</select>`;
}

/* Bewaar waar de cursor stond. Een binnenkomende wijziging van iemand anders
   tekent de hele lijst opnieuw, en zonder dit sta je middenin een getal opeens
   nergens meer — dezelfde valkuil als bij de notities in de paklijst. */
function metFocus(teken){
  const el = document.activeElement;
  const in_lijst = el && el.closest && el.closest("#racelist");
  const merk = in_lijst ? {id: el.closest(".runner").dataset.id, f: el.dataset.f,
                           pos: el.selectionStart, waarde: el.value} : null;
  teken();
  if(!merk) return;
  const terug = document.querySelector(`.runner[data-id="${CSS.escape(merk.id)}"] [data-f="${merk.f}"]`);
  if(!terug) return;
  if(terug.value !== merk.waarde && terug.tagName === "INPUT") terug.value = merk.waarde;
  terug.focus();
  try{ terug.setSelectionRange(merk.pos, merk.pos); }catch{}
}

function renderRoster(){
  const rows = sorted();
  const kies = $("raceinputrace");
  if(kies.options.length !== RACES.length){
    kies.innerHTML = RACES.map(r => `<option value="${r.id}">${esc(r.n)}</option>`).join("");
    kies.value = "muz30";
  }
  $("racecount").textContent = rows.length ? String(rows.length) : "";
  $("racesub").textContent = supaEnabled
    ? "Gedeeld: wat jij invult zien de anderen ook. Eén loop per persoon volstaat — hoe beter die op Mayrhofen lijkt, hoe scherper de schatting."
    : "Blijft in deze browser — koppel Supabase (zie README) om 'm te delen. Eén loop per persoon volstaat, hoe beter die op Mayrhofen lijkt hoe scherper de schatting.";

  $("racelist").innerHTML = rows.length ? rows.map(r => {
    const c = courseOf(r.race);
    return `<div class="runner" data-id="${esc(String(r.id))}" style="--rc:${raceColor(r.race)}">
      <div class="rtop">
        <input class="rname" type="text" data-f="name" value="${esc(r.name)}" maxlength="40" aria-label="Naam">
        <select class="pick rrace" data-f="race" aria-label="Wedstrijd">${
          RACES.map(x => `<option value="${x.id}"${x.id === r.race ? " selected" : ""}>${esc(x.n)}</option>`).join("")}</select>
        <button type="button" class="itemdel" data-runner="${esc(String(r.id))}" aria-label="${esc(r.name)} verwijderen">×</button>
      </div>
      <p class="rref">Wat heb je gelopen? <span>${esc(c.n)} is ${nl(c.dist)} km met ${c.gain} hm.</span></p>
      <div class="rgrid">
        ${veld("snelkeuze", `<select class="pick" data-f="preset"><option value="">—</option>${
          PRESETS.map(p => `<option value="${p.id}">${esc(p.lab)}</option>`).join("")}</select>`)}
        ${veld("afstand km", `<input type="number" step="0.1" min="1" max="200" data-f="ref_dist" value="${r.ref_dist}">`)}
        ${veld("hoogtemeters", `<input type="number" step="10" min="0" max="12000" data-f="ref_gain" value="${r.ref_gain}">`)}
        ${veld("tijd u:mm", `<input type="text" inputmode="numeric" maxlength="8" data-f="ref_time" value="${fmtDur(r.ref_secs)}">`)}
        ${veld("ondergrond", keuze("grond", GROND, r.grond))}
        ${veld("duurbasis", keuze("duur", DUUR, r.duur))}
        ${veld("in de bergen", keuze("tech", TECH, r.tech))}
        ${veld("bijstelling %", `<input type="number" step="1" min="-40" max="40" data-f="adjust" value="${r.adjust || 0}">`)}
        ${veld("streeftijd", `<input type="text" inputmode="numeric" maxlength="8" placeholder="—" data-f="target" value="${r.target_secs ? fmtDur(r.target_secs) : ""}">`)}
      </div>
      <p class="rout" data-out="${esc(String(r.id))}"></p>
    </div>`;
  }).join("") : `<p class="empty">Nog niemand ingevuld — zet hierboven de eerste naam erbij.</p>`;
}

/* ---------- de uitkomst per kaartje plus alle grafieken ---------- */
export function renderRaceOutputs(){
  const preds = predictions();
  preds.forEach(({r, p}) => {
    const el = document.querySelector(`.rout[data-out="${CSS.escape(String(r.id))}"]`);
    if(!el) return;
    const kans = r.target_secs ? ` · kans op ${fmtDur(r.target_secs)} of sneller: <b>${pct(pUnder(p, r.target_secs))}</b>` : "";
    el.innerHTML = `<b>${fmtDur(p.secs)}</b> verwacht · 80% kans tussen ${fmtDur(p.p10)} en ${fmtDur(p.p90)}`
      + ` · binnen rond <b>${fmtClock(p.finish)}</b> · ${fmtPace(p.pace)}/eff. km` + kans;
  });
  sorted().forEach(r => {
    if(preds.some(x => x.r === r)) return;
    const el = document.querySelector(`.rout[data-out="${CSS.escape(String(r.id))}"]`);
    if(el) el.innerHTML = `<i>Vul een afstand en een tijd in, dan verschijnt de schatting.</i>`;
  });

  renderTimeline(preds);
  renderTable(preds);
  renderDensity(preds);
  renderHead(preds);
  renderField();
}

/* ==================================================================
   Grafiek 1 — de finishvensters op de klok
================================================================== */
function renderTimeline(preds){
  const host = $("racetimeline");
  if(preds.length < 1){ host.innerHTML = `<p class="empty">Nog niets te tekenen.</p>`; return; }
  const W = 720, L = 108, R = 58, TOP = 24, ROW = 30;
  const H = TOP + preds.length*ROW + 26;
  const lo = Math.min(...preds.map(x => x.p.start));
  const hi = Math.max(...preds.map(x => x.p.finishHi));
  const t0 = Math.floor((lo - 900)/1800)*1800;
  const t1 = Math.ceil((hi + 900)/1800)*1800;
  const x = t => L + (t - t0)/(t1 - t0)*(W - L - R);
  const step = (t1 - t0) > 8*3600 ? 7200 : (t1 - t0) > 4*3600 ? 3600 : 1800;

  let g = "";
  for(let t = t0; t <= t1; t += step){
    g += `<line class="grid" x1="${x(t).toFixed(1)}" y1="${TOP-6}" x2="${x(t).toFixed(1)}" y2="${H-22}"/>`
       + `<text class="ax" x="${x(t).toFixed(1)}" y="${H-8}" text-anchor="middle">${fmtClock(t)}</text>`;
  }
  const rows = preds.map(({r, p}, i) => {
    const y = TOP + i*ROW + 9, mid = y + 6;
    const col = raceColor(r.race);
    const x10 = x(p.finishLo), x90 = x(p.finishHi), xm = x(p.finish);
    return `<g>
      <title>${esc(r.name)} — ${esc(courseOf(r.race).n)}: verwacht ${fmtDur(p.secs)}, binnen rond ${fmtClock(p.finish)}, 80% tussen ${fmtClock(p.finishLo)} en ${fmtClock(p.finishHi)}</title>
      <text class="nm" x="${L-12}" y="${mid+4}" text-anchor="end">${esc(r.name)}</text>
      <line class="onderweg" x1="${x(p.start).toFixed(1)}" y1="${mid}" x2="${x10.toFixed(1)}" y2="${mid}" stroke="${col}"/>
      <circle class="startdot" cx="${x(p.start).toFixed(1)}" cy="${mid}" r="3" fill="${col}"/>
      <rect x="${x10.toFixed(1)}" y="${y}" width="${Math.max(4, x90-x10).toFixed(1)}" height="12" rx="4" fill="${col}" opacity=".42"/>
      <rect class="mediaan" x="${(xm-1.5).toFixed(1)}" y="${y-2}" width="3" height="16" rx="1.5" fill="${col}"/>
      <text class="val" x="${W-2}" y="${mid+4}" text-anchor="end">${fmtClock(p.finish)}</text>
    </g>`;
  }).join("");

  host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img"
      aria-label="Verwachte finishtijden op de klok, met per persoon het venster waarin hij met 80% kans binnenkomt">
    ${g}${rows}</svg>` + legend();
}

function legend(){
  return `<div class="chartleg">` + RACES.map(r =>
    `<span><i style="background:${raceColor(r.id)}"></i>${esc(r.n)}</span>`).join("")
    + `<span class="lgnote">balk = 80%-venster · streepje = verwachte tijd · stip = start</span></div>`;
}

/* ==================================================================
   Grafiek 2 — de kansverdeling per persoon (hoe lang onderweg)
================================================================== */
function renderDensity(preds){
  const host = $("racedensity");
  if(!preds.length){ host.innerHTML = ""; return; }
  const W = 720, L = 108, R = 16, TOP = 10, ROW = 48;
  const H = TOP + preds.length*ROW + 28;
  const lo = Math.min(...preds.map(x => x.p.p10*0.86));
  const hi = Math.max(...preds.map(x => x.p.p90*1.10));
  const x = t => L + (t - lo)/(hi - lo)*(W - L - R);
  const step = (hi - lo) > 5*3600 ? 3600 : (hi - lo) > 2*3600 ? 1800 : 900;

  let g = "";
  for(let t = Math.ceil(lo/step)*step; t <= hi; t += step){
    g += `<line class="grid" x1="${x(t).toFixed(1)}" y1="${TOP}" x2="${x(t).toFixed(1)}" y2="${H-24}"/>`
       + `<text class="ax" x="${x(t).toFixed(1)}" y="${H-8}" text-anchor="middle">${fmtDur(t)}</text>`;
  }
  const rows = preds.map(({r, p}, i) => {
    const y0 = TOP + i*ROW + ROW - 8, hgt = ROW - 16, col = raceColor(r.race);
    const N = 80;
    const top = density(p, p.secs);
    let d = `M ${x(lo).toFixed(1)} ${y0}`;
    for(let k = 0; k <= N; k++){
      const t = lo + (hi - lo)*k/N;
      d += ` L ${x(t).toFixed(1)} ${(y0 - density(p, t)/top*hgt).toFixed(1)}`;
    }
    d += ` L ${x(hi).toFixed(1)} ${y0} Z`;
    return `<g>
      <title>${esc(r.name)}: verwacht ${fmtDur(p.secs)}, helft van de kans tussen ${fmtDur(p.p25)} en ${fmtDur(p.p75)}</title>
      <text class="nm" x="${L-12}" y="${y0-2}" text-anchor="end">${esc(r.name)}</text>
      <path d="${d}" fill="${col}" opacity=".28"/>
      <path d="${d}" fill="none" stroke="${col}" stroke-width="1.6"/>
      <line class="mediaan" x1="${x(p.secs).toFixed(1)}" y1="${y0}" x2="${x(p.secs).toFixed(1)}" y2="${(y0-hgt).toFixed(1)}" stroke="${col}"/>
      <text class="val" x="${x(p.secs).toFixed(1)}" y="${(y0-hgt-2).toFixed(1)}" text-anchor="middle">${fmtDur(p.secs)}</text>
    </g>`;
  }).join("");

  host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img"
      aria-label="Kansverdeling van de looptijd per persoon">${g}${rows}</svg>`;
}

/* ==================================================================
   De tabel — dezelfde cijfers, maar leesbaar en te kopiëren
================================================================== */
function renderTable(preds){
  const t = $("racetable");
  if(!preds.length){ t.innerHTML = ""; $("racenote").textContent = ""; return; }
  t.innerHTML = `<thead><tr>
      <th>Wie</th><th>Wedstrijd</th><th>Effectieve km</th><th>Verwacht</th>
      <th>80%-venster</th><th>Aan de finish</th><th>Tempo/eff. km</th><th>Uitrekking</th>
    </tr></thead><tbody>` + preds.map(({r, p}) => `<tr>
      <td>${esc(r.name)}</td>
      <td>${esc(courseOf(r.race).n)}</td>
      <td>${nl(p.eRace.toFixed(1))}</td>
      <td><b>${fmtDur(p.secs)}</b></td>
      <td>${fmtDur(p.p10)} – ${fmtDur(p.p90)}</td>
      <td>${fmtClock(p.finish)}</td>
      <td>${fmtPace(p.pace)}</td>
      <td>${nl(p.rek.toFixed(2))}×</td>
    </tr>`).join("") + `</tbody>`;

  const eerste = pFirst(preds.map(x => x.p));
  const beste = preds.map((x, i) => ({naam: x.r.name, p: eerste[i]})).sort((a,b) => b.p - a.p);
  $("racenote").innerHTML = `Uitrekking = hoeveel keer zo lang de wedstrijd is als je referentieloop, in effectieve kilometers. `
    + `Hoe verder boven of onder de 1, hoe breder het venster — dat is geen slordigheid maar eerlijkheid.`
    + (beste.length > 1 ? `<br>Als eerste van jullie binnen: ` + beste.slice(0,3).map(b => `${esc(b.naam)} ${pct(b.p)}`).join(" · ") : "");
}

/* ==================================================================
   Grafiek 3 — onderlinge kansen als warmtekaart
================================================================== */
function renderHead(preds){
  const host = $("racehead");
  if(preds.length < 2){
    host.innerHTML = `<p class="empty">Vanaf twee lopers verschijnt hier wie er waarschijnlijk eerder binnen is.</p>`;
    return;
  }
  const cel = p => {
    const k = Math.min(1, Math.abs(p - 0.5)*2);
    const kleur = p >= 0.5 ? "var(--dry)" : "var(--wet)";
    return `background:color-mix(in srgb, ${kleur} ${(k*62).toFixed(0)}%, transparent)`;
  };
  host.innerHTML = `<div class="scroller"><table class="dt heat">
    <thead><tr><th>komt eerder binnen dan →</th>${
      preds.map(({r}) => `<th>${esc(r.name)}</th>`).join("")}</tr></thead>
    <tbody>${preds.map(({r:ra, p:pa}) => `<tr><td>${esc(ra.name)}</td>${
      preds.map(({r:rb, p:pb}) => {
        if(ra === rb) return `<td class="zelf">·</td>`;
        const p = pBefore(pa, pb);
        return `<td style="${cel(p)}" title="${esc(ra.name)} is eerder binnen dan ${esc(rb.name)}">${pct(p)}</td>`;
      }).join("")}</tr>`).join("")}</tbody></table></div>
    <p class="mnote">Oranje: die kans is groter dan de helft. Blauw: kleiner. Starttijden zitten erin,
    dus een MUZ14-loper kan van een RK50'er winnen zonder harder te lopen.</p>`;
}

/* ==================================================================
   Grafiek 4 — het veld van een eerdere editie
================================================================== */
function renderField({forceer=false} = {}){
  const sel = $("fieldrace");
  if(sel.options.length !== RACES.length){
    sel.innerHTML = RACES.map(r => `<option value="${r.id}">${esc(r.n)}</option>`).join("");
  }
  sel.value = raceOpts.fieldRace;
  const rij = uitslagen.get(raceOpts.fieldRace);
  const jaar = rij ? rij.jaar : JAREN[0];
  const txt = rij ? rij.times : "";
  const box = $("fieldpaste");
  // niet overschrijven terwijl iemand in het veld staat te plakken of te typen —
  // behalve als hij zelf van wedstrijd of editie wisselt, want dan hóórt er
  // iets anders te staan
  if(box.value !== txt && (forceer || document.activeElement !== box)) box.value = txt;

  const jsel = $("fieldyear");
  if(jsel.options.length !== JAREN.length){
    jsel.innerHTML = JAREN.map(j => `<option value="${j}">${j}</option>`).join("");
  }
  jsel.value = String(jaar);

  const naam = raceById(raceOpts.fieldRace).n;
  const duv = duvUrl(raceOpts.fieldRace, jaar);
  $("fieldlinktext").innerHTML =
    `<a class="uitslaglink" href="${uitslagUrl(raceOpts.fieldRace, jaar)}" target="_blank" rel="noopener">of open 'm zelf ↗</a>`
    + (duv ? `<a class="uitslaglink" href="${duv}" target="_blank" rel="noopener">D-U-V ${esc(naam)} ${jaar} ↗</a>` : "")
    + `<span class="bronnen"> — daar alles selecteren en hieronder plakken. Staat die editie er niet, probeer dan `
    + BRONNEN.map(b => `<a href="${b.url}" target="_blank" rel="noopener" title="${esc(b.note)}">${esc(b.lab)}</a>`).join(", ")
    + `. Ranglijsten als UTMB en ITRA tellen alleen wie in hún klassement meedoet, dus daar is het veld kleiner en sneller dan het echt was.</span>`;

  const tijden = parseResults(txt);
  const st = statsOf(tijden);
  const host = $("racefield");
  if(!st){
    host.innerHTML = `<p class="empty">Nog geen uitslag geplakt voor ${esc(naam)} — gebruik de link hierboven.</p>`;
    return;
  }
  const mijn = predictions().filter(x => x.r.race === raceOpts.fieldRace);

  const bron = rij && rij.updated_by
    ? `<p class="mnote">Geplakt door ${esc(rij.updated_by)}${rij.updated_at ? " op " + new Date(rij.updated_at).toLocaleDateString("nl-NL", {day:"2-digit", month:"short"}) : ""}`
      + (supaEnabled ? " — iedereen ziet dezelfde lijst." : " — blijft in deze browser.") + `</p>`
    : "";

  const kaarten = [
    ["Finishers", String(st.n)],
    ["Snelste", fmtDur(st.min)],
    ["Mediaan", fmtDur(st.med)],
    ["Middelste helft", `${fmtDur(st.p25)} – ${fmtDur(st.p75)}`],
    ["Spreiding (sd)", `${fmtDur(st.sd)} · ${Math.round(st.sd/st.med*100)}%`],
    ["Laatste", fmtDur(st.max)]
  ].map(([k,v]) => `<div class="card"><div class="k">${k}</div><div class="v">${v}</div></div>`).join("");

  host.innerHTML = bron + `<div class="cards cards6">${kaarten}</div>`
    + histogram(tijden, st, mijn)
    + (mijn.length ? `<ul class="caveats plaats">` + mijn.map(({r,p}) => {
        const plaats = placeOf(tijden, p.secs);
        const lo = placeOf(tijden, p.p90), hi = placeOf(tijden, p.p10);
        return `<li><b>${esc(r.name)}</b> — met ${fmtDur(p.secs)} rond plek <b>${plaats}</b> van ${st.n}
          (bovenste ${Math.round(plaats/st.n*100)}%), en met het hele venster erbij ergens tussen plek ${hi} en ${lo}.</li>`;
      }).join("") + `</ul>`
      : `<p class="mnote">Zet iemand op ${esc(raceById(raceOpts.fieldRace).n)} in de lijst hierboven om te zien waar die in dit veld zou landen.</p>`);
}

function histogram(tijden, st, mijn){
  const W = 720, L = 34, R = 14, TOP = 16, BOT = 34, H = 250;
  const lo = st.min, hi = st.max;
  const stappen = [300, 600, 900, 1800, 3600];
  const bw = stappen.find(s => (hi - lo)/s <= 26) || 3600;
  const b0 = Math.floor(lo/bw)*bw, b1 = Math.ceil(hi/bw)*bw;
  const nb = Math.max(1, Math.round((b1 - b0)/bw));
  const bins = new Array(nb).fill(0);
  tijden.forEach(t => { bins[Math.min(nb-1, Math.floor((t - b0)/bw))]++; });
  const top = Math.max(...bins);
  const x = t => L + (t - b0)/(b1 - b0)*(W - L - R);
  const y = c => H - BOT - c/top*(H - BOT - TOP);

  const bars = bins.map((c, i) => {
    const x0 = x(b0 + i*bw), x1 = x(b0 + (i+1)*bw);
    if(!c) return "";
    return `<g><title>${fmtDur(b0+i*bw)}–${fmtDur(b0+(i+1)*bw)}: ${c} finisher${c===1?"":"s"}</title>`
      + `<rect x="${(x0+1).toFixed(1)}" y="${y(c).toFixed(1)}" width="${Math.max(1,x1-x0-2).toFixed(1)}"
          height="${(H-BOT-y(c)).toFixed(1)}" rx="3" class="bin"/></g>`;
  }).join("");

  const stap = (b1-b0) > 6*3600 ? 3600 : (b1-b0) > 3*3600 ? 1800 : 900;
  let as = "";
  for(let t = Math.ceil(b0/stap)*stap; t <= b1; t += stap){
    as += `<text class="ax" x="${x(t).toFixed(1)}" y="${H-16}" text-anchor="middle">${fmtDur(t)}</text>`;
  }
  const med = `<line class="veldmed" x1="${x(st.med).toFixed(1)}" y1="${TOP-6}" x2="${x(st.med).toFixed(1)}" y2="${H-BOT}"/>`
    + `<text class="ax mid" x="${x(st.med).toFixed(1)}" y="${TOP-10}" text-anchor="middle">mediaan ${fmtDur(st.med)}</text>`;

  const marks = mijn.map(({r, p}, i) => {
    const col = raceColor(r.race), xm = x(Math.min(b1, Math.max(b0, p.secs)));
    const yb = H - BOT + 1, yy = TOP + 14 + (i % 3)*15;
    const x10 = x(Math.min(b1, Math.max(b0, p.p10))), x90 = x(Math.min(b1, Math.max(b0, p.p90)));
    const xt = Math.min(W - R - 20, Math.max(L + 20, xm));
    return `<g><title>${esc(r.name)}: verwacht ${fmtDur(p.secs)}</title>
      <line x1="${x10.toFixed(1)}" y1="${yy}" x2="${x90.toFixed(1)}" y2="${yy}" stroke="${col}" stroke-width="3" opacity=".38" stroke-linecap="round"/>
      <path d="M ${xm.toFixed(1)} ${yb} l -5 9 l 10 0 Z" fill="${col}"/>
      <line x1="${xm.toFixed(1)}" y1="${yy}" x2="${xm.toFixed(1)}" y2="${yb}" stroke="${col}" stroke-width="1.5" stroke-dasharray="3 3"/>
      <text class="val" x="${xt.toFixed(1)}" y="${yy-6}" text-anchor="middle">${esc(r.name)}</text></g>`;
  }).join("");

  return `<svg viewBox="0 0 ${W} ${H}" class="chart hist" role="img"
      aria-label="Verdeling van de finishtijden van het geplakte veld, met de schattingen erin gemarkeerd">
    ${bars}${med}${as}<line class="grid" x1="${L}" y1="${H-BOT}" x2="${W-R}" y2="${H-BOT}"/>${marks}</svg>`;
}

/* ---------- uitleg onder aan het tabblad ---------- */
export function renderHow(){
  const c = CLIMB.find(x => x.id === raceOpts.climb) || CLIMB[1];
  $("racehow").innerHTML = [
    `<b>1. Hoogtemeters worden kilometers.</b> Klimmen kost tijd, dus tellen de hoogtemeters mee als extra
     vlakke kilometers: nu op <i>${esc(c.lab)}</i> (${esc(c.note)}). De MUZ30 is daarmee geen 30 maar
     ${nl((courseOf("muz30").dist + courseOf("muz30").gain/c.cost).toFixed(1))} effectieve kilometer. De afdaling zit in
     diezelfde vuistregel: op een rondje daal je alles weer af.`,
    `<b>2. Je referentietijd wordt uitgerekt.</b> Volgens Riegel (1977) geldt tussen twee afstanden
     <code>t₂ = t₁ · (d₂/d₁)^e</code>. Op de baan is <code>e</code> ≈ 1,06; zonder lange duurtrainingen loopt
     hij richting 1,15, en dat is precies wat de knop <i>duurbasis</i> zet.`,
    `<b>3. Terrein en techniek erbij.</b> Een kilometer asfalt is geen kilometer bergpad, ook niet als hij vlak
     is — daarom rekent <i>ondergrond</i> je referentie om naar Mayrhofens terrein. <i>In de bergen</i> gaat over
     durven dalen en wat 2000 hm met je benen doet.`,
    `<b>4. Er komt een venster omheen.</b> De uitkomst is geen getal maar een verdeling (lognormaal: te laat kan
     veel erger uitpakken dan te vroeg). De breedte groeit met hoe ver je referentie van de wedstrijd af ligt,
     met weinig bergervaring, en boven de vier uur — waar maag, kramp en opblazen beginnen mee te tellen.
     Het venster is 80%: één op de vijf keer val je erbuiten.`,
    `<b>Wat er níet in zit.</b> Weer en hitte, hoogte, hoe technisch juist déze route is, hoe het loopt met eten
     en drinken, en de dag zelf. Ook de startvakken en het gedrang op de eerste klim niet. Voor de kwartjes:
     plak de uitslag van een eerdere editie erbij, dat is meer waard dan welk model ook.`
  ].map(t => `<li>${t}</li>`).join("");
}
