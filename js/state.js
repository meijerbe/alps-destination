/* ==================================================================
   Applicatiestatus: wat er nu gekozen is, plus alles wat dat via
   sessionStorage/localStorage/de URL-hash bewaart of terugleest.
================================================================== */
import { REGIONS, PROFILES } from "./regions.js";
import { METRICS } from "./metrics.js";
import { PACK } from "./packing-data.js";
import { slug } from "./dom.js";

export const DASH_TABS = ["map","rank","matrix","data"];
export const TOP_TABS = ["dash","pack","shop","race"];
export const TABS = [...DASH_TABS, "pack", "shop", "race"];
export const topOf = t => DASH_TABS.includes(t) ? "dash" : t;

export const CACHE_KEY = "basiskamp:v2";
export const PACK_KEY  = "basiskamp:pack:v2";
export const PACK_KEY_LEGACY = "basiskamp:pack:v1";
export const CACHE_TTL = 30 * 60 * 1000;   // Open-Meteo ververst ~elk uur

export let state = {profile:"bike", days:5, drive:10, start:0, tab:"map", dashTab:"map", metric:"score",
             histMode:false,
             data:null, raw:null, foehnRaw:null, fromCache:false, fetchedAt:null,
             open:null, sel:null, view:null, day:-1, dataPlace:null, dataDay:0};

export let packDone = new Set();

export function readCache(){
  try{
    const hit = JSON.parse(sessionStorage.getItem(CACHE_KEY) || "null");
    if(!hit || Date.now() - hit.t > CACHE_TTL) return null;
    if(hit.places !== REGIONS.length) return null;   // lijst gewijzigd → opnieuw ophalen
    return hit;
  }catch{ return null; }
}
export function writeCache(data){
  try{ sessionStorage.setItem(CACHE_KEY, JSON.stringify({t:Date.now(), places:REGIONS.length, data})); }catch{}
}
export function loadPack(){
  try{ packDone = new Set(JSON.parse(localStorage.getItem(PACK_KEY) || "[]")); }catch{ packDone = new Set(); }
  if(packDone.size) return;
  // eenmalige migratie vanaf de vorige opslag (vóór de persoonlijke vinkjes)
  try{
    const legacy = JSON.parse(localStorage.getItem(PACK_KEY_LEGACY) || "[]");
    if(!legacy.length) return;
    const byText = {};
    PACK.forEach(g=>g.items.forEach(it=>{ byText[it.t] = {key: slug(g.g)+"__"+slug(it.t), personal: !!g.personal}; }));
    legacy.forEach(t=>{
      const m = byText[t]; if(!m) return;
      if(m.personal){ packDone.add(m.key+"|A"); packDone.add(m.key+"|B"); }
      else packDone.add(m.key+"|gedeeld");
    });
    if(packDone.size) savePack();
  }catch{}
}
export function savePack(){
  try{ localStorage.setItem(PACK_KEY, JSON.stringify([...packDone])); }catch{}
}

/* ==================================================================
   Deelbare URL
================================================================== */
export function readUrlState(){
  const q = new URLSearchParams(location.hash.replace(/^#/, ""));
  if(PROFILES.includes(q.get("p"))) state.profile = q.get("p");
  const d = +q.get("d"); if(d >= 2 && d <= 10) state.days = Math.round(d);
  const r = +q.get("r"); if(r >= 1 && r <= 10) state.drive = Math.round(r);
  const s = +q.get("s"); if(s >= 0 && s <= 8) state.start = Math.round(s);
  if(TABS.includes(q.get("t"))) state.tab = q.get("t");
  if(METRICS[q.get("m")]) state.metric = q.get("m");
  if(q.get("g") && REGIONS.some(r=>r.n === q.get("g"))) state.sel = q.get("g");
  const k = +q.get("k"); if(q.get("k") !== null && k >= 0 && k <= 9) state.day = Math.round(k);
  state.histMode = q.get("h") === "1";
  // score en vriespunt bestaan niet historisch — val terug op neerslag
  // in plaats van een lege/kapotte weergave
  if(state.histMode && !METRICS[state.metric].histVal) state.metric = "rain";
}
export function writeUrlState(){
  const q = new URLSearchParams({p:state.profile, d:state.days, r:state.drive, s:state.start,
                                 m:state.metric, t:state.tab});
  if(state.sel) q.set("g", state.sel);
  if(state.day >= 0) q.set("k", state.day);
  if(state.histMode) q.set("h", "1");
  history.replaceState(null, "", "#" + q);
}
