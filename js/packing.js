/* ------------------------------------------------------------------
   Paklijst: eigen notities/vinkjes (met of zonder Supabase erachter)
   en de door de gebruiker toegevoegde regels per groep.
------------------------------------------------------------------- */
import { $, esc, cssEsc, slug } from "./dom.js";
import { PACK } from "./packing-data.js";
import { PROFILE_LABEL, PROFILES } from "./regions.js";
import { sb, supaEnabled, TRIP_ID, localId, supaErrText } from "./supabase-client.js";
import { state, packDone } from "./state.js";
import { focusOf } from "./weather.js";
import { toast } from "./toast.js";
import { getLastView } from "./view.js";

const ME_KEY = "abopreis:me";
const NOTES_KEY = "abopreis:notes:v1";
const CUSTOM_KEY = "abopreis:customitems:v1";

export let supaRows = new Map();      // "<item_key>|<scope>" → {checked, comment, updated_by, updated_at}
let supaReady = false;
let localNotes = {};           // fallback-notities, alleen gebruikt zonder Supabase
export let customItems = [];   // [{id, group_name, label, personal, created_by}] — zelf toegevoegde paklijst-regels
export let me = null;
try{ me = localStorage.getItem(ME_KEY); }catch{}

const rowKey = (item_key, scope) => item_key + "|" + scope;
const getRow = (item_key, scope) => supaRows.get(rowKey(item_key, scope)) || {checked:false, comment:"", updated_by:null, updated_at:null};
const isChecked = (key, scope) => supaEnabled ? !!getRow(key, scope).checked : packDone.has(key + "|" + scope);

export function syncMe(){
  [...$("me").children].forEach(b=>b.setAttribute("aria-pressed", String(b.dataset.me === me)));
}
export function setMe(val){
  me = val;
  try{ localStorage.setItem(ME_KEY, me); }catch{}
  syncMe();
}

export function loadNotes(){
  try{ localNotes = JSON.parse(localStorage.getItem(NOTES_KEY) || "{}"); }catch{ localNotes = {}; }
}
function saveNotes(){ try{ localStorage.setItem(NOTES_KEY, JSON.stringify(localNotes)); }catch{} }
export function getNote(key){ return supaEnabled ? (getRow(key,"gedeeld").comment || "") : (localNotes[key] || ""); }
export function setNote(key, val){
  if(supaEnabled){ setPackState(key, "gedeeld", {comment: val || null}); return; }
  if(val) localNotes[key] = val; else delete localNotes[key];
  saveNotes();
}

export function updatePackProgress(){
  const boxes = [...document.querySelectorAll("#packgrid input[type=checkbox]")];
  const done = boxes.filter(b=>b.checked).length, total = boxes.length;
  $("packfill").style.width = (total ? done/total*100 : 0) + "%";
  $("packtxt").textContent = `${done} van ${total} ingepakt`;
  $("packcount").textContent = total ? `${done}/${total}` : "";
}

export async function loadPackState(){
  if(!supaEnabled) return;
  try{
    const {data, error} = await sb.from("packing_state").select("*").eq("trip", TRIP_ID);
    if(error) throw error;
    supaRows = new Map(data.map(r=>[rowKey(r.item_key, r.scope), r]));
    supaReady = true;
  }catch(err){
    supaReady = false;
    console.error("[paklijst] laden mislukt:", err);
    toast("Paklijst-sync niet bereikbaar — vinkjes blijven lokaal\n" + supaErrText(err), 5000);
  }
}

export function applyRowToDom(item_key, scope, row){
  const cb = document.querySelector(`#packgrid input[type=checkbox][data-key="${cssEsc(item_key)}"][data-scope="${cssEsc(scope)}"]`);
  if(cb) cb.checked = !!row.checked;
  if(scope === "gedeeld"){
    const note = document.querySelector(`#packgrid .pi-note[data-key="${cssEsc(item_key)}"]`);
    if(note && document.activeElement !== note) note.value = row.comment || "";
  }
  updatePackProgress();
}

export async function setPackState(item_key, scope, patch){
  const cur = getRow(item_key, scope);
  const next = {...cur, ...patch, trip:TRIP_ID, item_key, scope, updated_by: me, updated_at: new Date().toISOString()};
  supaRows.set(rowKey(item_key, scope), next);
  applyRowToDom(item_key, scope, next);
  // Alleen sturen wat we echt wijzigen. Twee redenen:
  // 1. `next` kan een `id` bevatten (uit een select of realtime-echo) en die
  //    kolom is `generated always as identity` — een expliciete waarde wijst
  //    Postgres af met 428C9, waardoor elke tweede klik op een item faalde.
  // 2. bij een upsert zet PostgREST alleen de meegestuurde kolommen; laten we
  //    `comment` weg, dan blijft een bestaande notitie staan in plaats van
  //    overschreven te worden met null als onze lokale kopie nog leeg is.
  const payload = {trip: TRIP_ID, item_key, scope, updated_by: me, updated_at: next.updated_at};
  if("checked" in patch) payload.checked = !!patch.checked;
  if("comment" in patch) payload.comment = patch.comment || null;
  try{
    const {error} = await sb.from("packing_state").upsert(payload, {onConflict:"trip,item_key,scope"});
    if(error) throw error;
  }catch(err){
    console.error("[paklijst] opslaan mislukt:", err);
    toast("Opslaan mislukt\n" + supaErrText(err), 5000);
  }
}

export async function resetChecked(rows){
  // in één verzoek in plaats van tientallen losse — `rows` is [{key, scope}]
  const stamp = new Date().toISOString();
  const payload = rows.map(({key, scope})=>{
    supaRows.set(rowKey(key, scope), {...getRow(key, scope), checked:false, updated_by:me, updated_at:stamp});
    return {trip:TRIP_ID, item_key:key, scope, checked:false, updated_by:me, updated_at:stamp};
  });
  try{
    const {error} = await sb.from("packing_state").upsert(payload, {onConflict:"trip,item_key,scope"});
    if(error) throw error;
    toast("Vinkjes gewist");
  }catch(err){
    console.error("[paklijst] wissen mislukt:", err);
    toast("Wissen mislukt\n" + supaErrText(err), 5000);
  }
}

// ---- zelf toegevoegde paklijst-regels ----------------------------------
function loadCustomLocal(){
  try{ customItems = JSON.parse(localStorage.getItem(CUSTOM_KEY) || "[]"); }catch{ customItems = []; }
}
function saveCustomLocal(){ try{ localStorage.setItem(CUSTOM_KEY, JSON.stringify(customItems)); }catch{} }

export async function loadCustomItems(){
  if(!supaEnabled){ loadCustomLocal(); return; }
  try{
    const {data, error} = await sb.from("packing_custom_items").select("*").eq("trip", TRIP_ID);
    if(error) throw error;
    customItems = data;
  }catch(err){
    console.error("[paklijst] eigen items laden mislukt:", err);
    toast("Eigen items laden mislukt\n" + supaErrText(err), 5000);
  }
}

// voorkomt een tweede regel die op hetzelfde vinkje/notitie zou uitkomen
// als een bestaande (ingebouwde of eerder toegevoegde) regel in die groep
function itemKeyTaken(groupName, label, excludeId){
  const wantKey = slug(groupName) + "__" + slug(label);
  const g = PACK.find(x => x.g === groupName);
  if(g && g.items.some(it => slug(groupName) + "__" + slug(it.t) === wantKey)) return true;
  return customItems.some(ci => ci.id !== excludeId && ci.group_name === groupName
    && slug(groupName) + "__" + slug(ci.label) === wantKey);
}

export async function addCustomItem(groupName, label){
  label = label.trim();
  if(!label) return;
  if(itemKeyTaken(groupName, label)){ toast("Staat er al bij"); return; }
  const g = PACK.find(x => x.g === groupName);
  const personal = !!(g && g.personal);
  if(!supaEnabled){
    customItems.push({id: localId(), group_name: groupName, label, personal, created_by: me});
    saveCustomLocal();
    const v = getLastView(); if(v) renderPack(v);
    return;
  }
  try{
    const {data, error} = await sb.from("packing_custom_items")
      .insert({trip: TRIP_ID, group_name: groupName, label, personal, created_by: me})
      .select().single();
    if(error) throw error;
    // de realtime-echo van deze eigen insert kan sneller aankomen dan deze
    // await hier verdergaat en al hebben gepusht — niet nog eens toevoegen
    if(!customItems.some(ci => ci.id === data.id)) customItems.push(data);
    const v = getLastView(); if(v) renderPack(v);
  }catch(err){
    console.error("[paklijst] item toevoegen mislukt:", err);
    toast("Toevoegen mislukt\n" + supaErrText(err), 5000);
  }
}

export async function deleteCustomItem(id){
  const item = customItems.find(ci => String(ci.id) === String(id));
  customItems = customItems.filter(ci => String(ci.id) !== String(id));
  const v = getLastView(); if(v) renderPack(v);
  toast(item ? `${item.label} verwijderd` : "Item verwijderd");
  if(!supaEnabled){ saveCustomLocal(); return; }
  try{
    const {error} = await sb.from("packing_custom_items").delete().eq("id", id);
    if(error) throw error;
  }catch(err){
    console.error("[paklijst] item verwijderen mislukt:", err);
    toast("Verwijderen mislukt\n" + supaErrText(err), 5000);
  }
}

// ---- realtime-echo's vanuit realtime.js --------------------------------
export function handlePackingStateChange(payload){
  const r = (payload.new && Object.keys(payload.new).length) ? payload.new : payload.old;
  if(!r) return;
  if(payload.eventType === "DELETE") supaRows.delete(rowKey(r.item_key, r.scope));
  else supaRows.set(rowKey(r.item_key, r.scope), r);
  if(state.tab === "pack") applyRowToDom(r.item_key, r.scope, r);
}
export function handleCustomItemsChange(payload){
  if(payload.eventType === "DELETE"){
    customItems = customItems.filter(ci => ci.id !== payload.old.id);
  }else{
    const r = payload.new;
    if(!customItems.some(ci => ci.id === r.id)) customItems.push(r);
  }
  const v = getLastView();
  if(state.tab === "pack" && v) renderPack(v);
}

function packContext(v){
  const top = focusOf(v);
  return {
    profiles: new Set(PROFILES), n: v.n, top,
    countries: new Set(["AT", top.c]),
    minFrz: top.minFrz, maxWind: top.maxWind, maxRain: top.maxRain,
    maxTemp: top.maxTemp, minTemp: top.minTemp, sunAvg: top.sunAvg,
    wetDays: top.per.filter(d=>d.rain >= 2).length
  };
}

function packRow(it){
  const badge = it.cond ? '<span class="cond">weer</span>' : "";
  const why = it.why ? `<span class="wy">${esc(it.why)}</span>` : "";
  const del = it.custom ? `<button type="button" class="itemdel" data-id="${esc(String(it.id))}" aria-label="${esc(it.t)} verwijderen">×</button>` : "";
  const note = `<input class="pi-note" type="text" placeholder="notitie…" maxlength="200" value="${esc(getNote(it.key))}" data-key="${esc(it.key)}">`;
  if(it.personal){
    const a = isChecked(it.key,"A"), b = isChecked(it.key,"B");
    return `<li class="packrow">
      <div class="pi-top">
        <div class="pi-chips">
          <label class="chk"><input type="checkbox" data-key="${esc(it.key)}" data-scope="A"${a?" checked":""}>A</label>
          <label class="chk"><input type="checkbox" data-key="${esc(it.key)}" data-scope="B"${b?" checked":""}>B</label>
        </div>
        <span class="it">${esc(it.t)} ${badge} ${why}</span>
        ${del}
      </div>
      ${note}
    </li>`;
  }
  const chk = isChecked(it.key,"gedeeld");
  return `<li class="packrow">
    <div class="pi-row">
      <label class="pi-single">
        <input type="checkbox" data-key="${esc(it.key)}" data-scope="gedeeld"${chk?" checked":""}>
        <span class="it">${esc(it.t)} ${badge} ${why}</span>
      </label>
      ${del}
    </div>
    ${note}
  </li>`;
}

export function renderPack(v){
  const grid = $("packgrid");
  if(!v.scored.length){
    grid.innerHTML = `<p class="empty">Geen bestemming geselecteerd — schuif de rijtijd omhoog.</p>`;
    $("packsub").textContent = "—";
    $("packcount").textContent = "";
    return;
  }
  const c = packContext(v);
  const groups = PACK.filter(g => !g.when || g.when(c)).map(g=>{
    const builtin = g.items.filter(it => !it.when || it.when(c)).map(it=>({
      t: it.t,
      key: slug(g.g) + "__" + slug(it.t),
      why: it.why ? (typeof it.why === "function" ? it.why(c) : it.why) : null,
      cond: !!it.when,
      personal: !!g.personal
    }));
    const custom = customItems.filter(ci => ci.group_name === g.g).map(ci=>({
      t: ci.label,
      key: slug(g.g) + "__" + slug(ci.label),
      why: null, cond: false,
      personal: !!ci.personal,
      custom: true, id: ci.id
    }));
    return {g: g.g, personal: !!g.personal, items: [...builtin, ...custom]};
  });

  grid.innerHTML = groups.map(g=>`
    <section class="packgroup${g.personal?" personal":""}">
      <h3>${esc(g.g)}</h3>
      <ul>${g.items.map(packRow).join("")}</ul>
      <form class="packadd" data-group="${esc(g.g)}">
        <input type="text" class="packaddinput" placeholder="+ item toevoegen…" maxlength="80" aria-label="Nieuw item voor ${esc(g.g)}">
        <button type="submit" aria-label="Toevoegen">+</button>
      </form>
    </section>`).join("");

  $("packsub").innerHTML =
    `Voor de hele vakantie — <strong>${PROFILES.map(p=>esc(PROFILE_LABEL[p].toLowerCase())).join(", ")}</strong> staan er samen in — `
    + `en op de voorspelling voor <strong>${esc(c.top.n)}</strong> — de regio waar de kaart nu op staat. Regels met het label `
    + `<em>weer</em> staan er alleen in omdat de verwachting erom vraagt; ze verdwijnen weer als het weer draait. `
    + `Groepen met <em>ieder apart</em> hebben een vinkje per persoon. `
    + (supaEnabled
        ? `Vinkjes en notities staan gedeeld voor jullie allebei${supaReady?"":" — sync lukt nu niet, dit ververst zodra dat weer kan"}.`
        : `Vinkjes en notities blijven in deze browser — koppel Supabase (zie README) om ze te delen.`);
  updatePackProgress();
}
