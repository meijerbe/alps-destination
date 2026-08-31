/* ==================================================================
   Interactie: alle DOM-events op één plek, plus de kleine
   UI-synchronisatiefuncties die daarbij horen.
================================================================== */
import { $, clamp, DAYS, dow, dm } from "./dom.js";
import { METRICS } from "./metrics.js";
import { state, writeUrlState, readUrlState, DASH_TABS, TOP_TABS, TABS, topOf, packDone, savePack } from "./state.js";
import { getLastView } from "./view.js";
import { render } from "./render.js";
import { toast } from "./toast.js";
import { selectedRegion } from "./weather.js";
import { supaEnabled } from "./supabase-client.js";
import {
  setNote, addCustomItem, deleteCustomItem, setMe, syncMe,
  setPackState, updatePackProgress, resetChecked, loadPackState, renderPack
} from "./packing.js";
import {
  addShoppingItem, toggleShoppingItem, deleteShoppingItem,
  loadShoppingState, renderShopping, shopRows
} from "./shopping.js";

/* ---------- dagschuif: afspelen ---------- */
let playTimer = null;
function stopPlay(){
  if(!playTimer) return;
  clearInterval(playTimer); playTimer = null;
  $("dayplay").setAttribute("aria-pressed","false");
  $("dayplay").textContent = "Speel af";
}
function startPlay(){
  stopPlay();
  if(state.day < 0) state.day = 0;
  $("dayplay").setAttribute("aria-pressed","true");
  $("dayplay").textContent = "Stop";
  playTimer = setInterval(()=>{
    const v = getLastView();
    const n = v ? v.n : 1;
    state.day = state.day + 1 >= n ? 0 : state.day + 1;
    writeUrlState();
    render();
  }, 1100);
}
function setDay(d){
  state.day = d;
  writeUrlState();
  if(state.data) render();
}

/* ---------- tabs ---------- */
export function showTab(t){
  if(t !== "map") stopPlay();
  state.tab = t;
  if(DASH_TABS.includes(t)) state.dashTab = t;
  const v = getLastView();
  if(t === "pack" && supaEnabled && v) loadPackState().then(()=>renderPack(v));
  if(t === "shop" && supaEnabled) loadShoppingState().then(renderShopping);
  TABS.forEach(x=>{ $("panel-" + x).hidden = (x !== t); });
  DASH_TABS.forEach(x=>{
    const on = x === t;
    const tab = $("tab-" + x);
    tab.setAttribute("aria-selected", String(on));
    tab.tabIndex = on ? 0 : -1;
  });
  syncTopNav();
  writeUrlState();
}

function syncTopNav(){
  const top = topOf(state.tab);
  TOP_TABS.forEach(x=>{
    const on = x === top;
    const b = $("top-" + x);
    b.setAttribute("aria-selected", String(on));
    b.tabIndex = on ? 0 : -1;
  });
  $("kpis").hidden = top !== "dash";
  $("subnav").hidden = top !== "dash";
}

function syncMetric(){
  ["metric","mapmetric"].forEach(id =>
    [...$(id).children].forEach(b => b.setAttribute("aria-pressed", String(b.dataset.m === state.metric))));
}

// Score en vriespunt bestaan niet historisch (zie historical.js) — die
// knoppen gaan uit in plaats van naar een lege/kapotte weergave te leiden.
function syncSource(){
  ["mapsource","source"].forEach(id =>
    [...$(id).children].forEach(b => b.setAttribute("aria-pressed", String((b.dataset.h === "1") === state.histMode))));
  ["mapmetric","metric"].forEach(id =>
    [...$(id).children].forEach(b => {
      const beschikbaar = !state.histMode || !!METRICS[b.dataset.m].histVal;
      b.disabled = !beschikbaar;
      b.title = beschikbaar ? "" : "Niet beschikbaar in historische weergave";
    }));
}

export function syncControls(){
  $("days").value = state.days;
  $("daysval").textContent = state.days + " dagen";
  $("drive").value = state.drive;
  $("driveval").textContent = state.drive>=10 ? "alles" : "max " + state.drive + " u";
  [...$("profile").children].forEach(b=>b.setAttribute("aria-pressed", String(b.dataset.p===state.profile)));
  syncSource();
  syncMetric();
  syncMe();
  showTab(state.tab);
}

/* vertrekdag */
export function fillStart(){
  const days = state.data.places[0].days;
  const max = Math.max(0, days.length - 2);
  state.start = clamp(state.start, 0, max);
  $("start").innerHTML = days.slice(0, max+1).map((d,i)=>{
    const lab = i===0 ? "vandaag" : i===1 ? "morgen" : DAYS[dow(d.date)] + " " + dm(d.date);
    return `<option value="${i}"${i===state.start?" selected":""}>${lab}</option>`;
  }).join("");
}

/* ==================================================================
   Alle addEventListener's
================================================================== */
$("me").addEventListener("click", e=>{
  const b = e.target.closest("button"); if(!b) return;
  setMe(b.dataset.me);
});

$("profile").addEventListener("click", e=>{
  const b = e.target.closest("button"); if(!b) return;
  state.profile = b.dataset.p;
  [...e.currentTarget.children].forEach(x=>x.setAttribute("aria-pressed", String(x===b)));
  writeUrlState();
  if(state.data) render();
});
["metric","mapmetric"].forEach(id=>{
  $(id).addEventListener("click", e=>{
    const b = e.target.closest("button"); if(!b) return;
    state.metric = b.dataset.m;
    syncMetric();
    writeUrlState();
    if(state.data) render();
  });
});
["mapsource","source"].forEach(id=>{
  $(id).addEventListener("click", e=>{
    const b = e.target.closest("button"); if(!b) return;
    state.histMode = b.dataset.h === "1";
    if(state.histMode && !METRICS[state.metric].histVal) state.metric = "rain";
    syncSource();
    syncMetric();
    writeUrlState();
    if(state.data) render();
  });
});
$("days").addEventListener("input", e=>{
  stopPlay();
  state.days = +e.target.value;
  $("daysval").textContent = state.days + " dagen";
  writeUrlState();
  if(state.data) render();
});
$("drive").addEventListener("input", e=>{
  state.drive = +e.target.value;
  $("driveval").textContent = state.drive>=10 ? "alles" : "max " + state.drive + " u";
  writeUrlState();
  if(state.data) render();
});
$("subnav").addEventListener("click", e=>{
  const b = e.target.closest("button[role=tab]"); if(!b) return;
  showTab(b.dataset.t);
});
$("subnav").addEventListener("keydown", e=>{
  const i = DASH_TABS.indexOf(state.tab);
  let j = null;
  if(e.key === "ArrowRight") j = (i+1) % DASH_TABS.length;
  if(e.key === "ArrowLeft")  j = (i-1+DASH_TABS.length) % DASH_TABS.length;
  if(j == null) return;
  e.preventDefault();
  showTab(DASH_TABS[j]);
  $("tab-" + DASH_TABS[j]).focus();
});
$("toplevel").addEventListener("click", e=>{
  const b = e.target.closest("button[data-top]"); if(!b) return;
  const t = b.dataset.top;
  showTab(t === "dash" ? (state.dashTab || "map") : t);
});
$("toplevel").addEventListener("keydown", e=>{
  if(e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
  e.preventDefault();
  const i = TOP_TABS.indexOf(topOf(state.tab));
  const j = e.key === "ArrowRight" ? (i+1) % TOP_TABS.length : (i-1+TOP_TABS.length) % TOP_TABS.length;
  const t = TOP_TABS[j];
  showTab(t === "dash" ? (state.dashTab || "map") : t);
  $("top-" + t).focus();
});
// Notities slaan tijdens het typen op (afgeremd), niet pas bij het verlaten
// van het veld — anders raak je een net getikte notitie kwijt als je de tab
// sluit of je telefoon wegzet zonder ergens anders te tikken.
const noteTimers = new Map();
function flushNote(key, value){
  clearTimeout(noteTimers.get(key));
  noteTimers.delete(key);
  setNote(key, value.trim());
}
$("packgrid").addEventListener("input", e=>{
  const note = e.target.closest(".pi-note"); if(!note) return;
  const key = note.dataset.key;
  clearTimeout(noteTimers.get(key));
  noteTimers.set(key, setTimeout(()=>flushNote(key, note.value), 700));
});
$("packgrid").addEventListener("change", e=>{
  const note = e.target.closest(".pi-note");
  if(note){ flushNote(note.dataset.key, note.value); return; }
  const cb = e.target.closest("input[type=checkbox]"); if(!cb) return;
  const key = cb.dataset.key, scope = cb.dataset.scope;
  if(supaEnabled){ setPackState(key, scope, {checked: cb.checked}); return; }
  cb.checked ? packDone.add(key+"|"+scope) : packDone.delete(key+"|"+scope);
  savePack();
  updatePackProgress();
});

$("packreset").addEventListener("click", async ()=>{
  const boxes = [...document.querySelectorAll("#packgrid input[type=checkbox]:checked")];
  if(!boxes.length){ toast("Er stond nog niets aangevinkt"); return; }
  if(supaEnabled && !confirm(`${boxes.length} vinkjes wissen, voor jullie allebei? Dit kan niet ongedaan gemaakt worden.`)) return;

  boxes.forEach(cb=>{ cb.checked = false; });
  updatePackProgress();

  if(!supaEnabled){
    boxes.forEach(cb=>packDone.delete(cb.dataset.key + "|" + cb.dataset.scope));
    savePack();
    toast("Vinkjes gewist");
    return;
  }
  // in één verzoek in plaats van tientallen losse; resetChecked() toast zelf
  await resetChecked(boxes.map(cb=>({key: cb.dataset.key, scope: cb.dataset.scope})));
});
$("packprint").addEventListener("click", ()=>window.print());
$("packcopy").addEventListener("click", async ()=>{
  const groups = [...document.querySelectorAll("#packgrid .packgroup")];
  if(!groups.length) return;
  const txt = groups.map(sec=>{
    const title = sec.querySelector("h3").textContent;
    const lines = [...sec.querySelectorAll("li.packrow")].map(li=>{
      const label = [...li.querySelector(".it").childNodes].map(n=>n.textContent).join(" ").replace(/\s+/g," ").trim();
      const boxes = [...li.querySelectorAll("input[type=checkbox]")];
      const mark = boxes.length > 1
        ? boxes.map(b=>`${b.dataset.scope}:[${b.checked?"x":" "}]`).join(" ")
        : `[${boxes[0].checked?"x":" "}]`;
      const note = li.querySelector(".pi-note");
      return mark + " " + label + (note && note.value ? `  · ${note.value}` : "");
    });
    return title + "\n" + lines.join("\n");
  }).join("\n\n");
  try{
    await navigator.clipboard.writeText(txt);
    toast("Paklijst gekopieerd");
  }catch{
    toast("Kopiëren geblokkeerd door de browser");
  }
});

$("packgrid").addEventListener("submit", e=>{
  const form = e.target.closest(".packadd"); if(!form) return;
  e.preventDefault();
  const input = form.querySelector(".packaddinput");
  addCustomItem(form.dataset.group, input.value);
  input.value = "";
  input.focus();
});
$("packgrid").addEventListener("click", e=>{
  const b = e.target.closest(".itemdel"); if(!b) return;
  deleteCustomItem(b.dataset.id);
});
$("list").addEventListener("click", e=>{
  const b = e.target.closest("button.row"); if(!b) return;
  const n = b.dataset.open;
  state.open = state.open === n ? null : n;
  render();
});

/* ---------- boodschappenlijst ---------- */
$("shopform").addEventListener("submit", e=>{
  e.preventDefault();
  const input = $("shopinput");
  addShoppingItem(input.value);
  input.value = "";
  input.focus();
});
$("shoplist").addEventListener("change", e=>{
  const cb = e.target.closest("input[type=checkbox]"); if(!cb) return;
  toggleShoppingItem(cb.dataset.id, cb.checked);
});
$("shoplist").addEventListener("click", e=>{
  const b = e.target.closest(".itemdel"); if(!b) return;
  deleteShoppingItem(b.dataset.shopid);
});
$("shopclear").addEventListener("click", ()=>{
  const done = [...shopRows.values()].filter(r=>r.checked);
  if(!done.length){ toast("Er staat niets afgevinkt"); return; }
  done.forEach(r=>deleteShoppingItem(r.id, {silent:true}));
  toast(`${done.length} product${done.length===1?"":"en"} gewist`);
});
$("shopcopy").addEventListener("click", async ()=>{
  const rows = [...document.querySelectorAll("#shoplist .shoprow")];
  if(!rows.length) return;
  const txt = rows.map(li=>{
    const cb = li.querySelector("input[type=checkbox]");
    return `[${cb.checked?"x":" "}] ` + li.querySelector(".it").textContent.trim();
  }).join("\n");
  try{
    await navigator.clipboard.writeText(txt);
    toast("Boodschappenlijst gekopieerd");
  }catch{
    toast("Kopiëren geblokkeerd door de browser");
  }
});

$("start").addEventListener("change", e=>{
  stopPlay();
  state.start = +e.target.value;
  writeUrlState();
  if(state.data) render();
});

/* kaart: klik-om-te-selecteren. De kaart zelf is een Leaflet-instantie
   (zie map.js); hover-inhoud en positionering doet Leaflet's eigen
   tooltip, deze functie is alleen het klik-gedrag erachter — als
   callback aan initMap() meegegeven vanuit main.js. */
export function selectRegion(n){
  state.sel = state.sel === n ? null : n;
  writeUrlState();
  render();
}

$("selcard").addEventListener("click", e=>{
  const b = e.target.closest("button"); if(!b) return;
  if(b.dataset.drive){
    state.drive = +b.dataset.drive;
    $("drive").value = state.drive;
    $("driveval").textContent = state.drive>=10 ? "alles" : "max " + state.drive + " u";
    writeUrlState(); render(); return;
  }
  const go = b.dataset.go;
  const v = getLastView();
  const p = v ? selectedRegion(v) : null;
  if(go === "clear"){ state.sel = null; writeUrlState(); render(); return; }
  if(go === "rank"){
    if(p) state.open = p.n;
    showTab("rank"); render();
    $("panel-rank").scrollIntoView({behavior:"smooth", block:"start"});
  }
  if(go === "pack"){
    if(p && !p.far){ state.sel = p.n; writeUrlState(); }
    showTab("pack"); render();
    $("panel-pack").scrollIntoView({behavior:"smooth", block:"start"});
  }
});

$("dayslider").addEventListener("input", e=>{ stopPlay(); setDay(+e.target.value); });
$("dayprev").addEventListener("click", ()=>{ stopPlay(); setDay(Math.max(-1, state.day-1)); });
$("daynext").addEventListener("click", ()=>{
  stopPlay();
  const v = getLastView();
  setDay(Math.min((v ? v.n : 1) - 1, state.day + 1));
});
$("dayplay").addEventListener("click", ()=>{ playTimer ? stopPlay() : startPlay(); });

$("dataplace").addEventListener("change", e=>{ state.dataPlace = e.target.value; if(state.data) render(); });
$("dataday").addEventListener("change", e=>{ state.dataDay = +e.target.value; if(state.data) render(); });
$("reqs").addEventListener("click", async e=>{
  const b = e.target.closest("button[data-copy]"); if(!b) return;
  try{ await navigator.clipboard.writeText(b.dataset.copy); toast("Verzoek-URL gekopieerd"); }
  catch{ toast("Kopiëren geblokkeerd door de browser"); }
});

window.addEventListener("hashchange", ()=>{
  readUrlState();
  syncControls();
  if(state.data) render();
});
