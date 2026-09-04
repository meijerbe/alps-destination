/* ==================================================================
   Boot: data ophalen (of uit de cache), alles voor het eerst tekenen,
   en de gedeelde paklijst/boodschappenlijst aankoppelen.
================================================================== */
import { $ } from "./dom.js";
import { state, readCache, writeCache, loadPack, readUrlState } from "./state.js";
import { load } from "./weather.js";
import { render } from "./render.js";
import { getLastView } from "./view.js";
import { fillStart, syncControls } from "./ui.js";
import { supaEnabled } from "./supabase-client.js";
import { loadNotes, loadPackState, loadCustomItems, syncMe, renderPack } from "./packing.js";
import { loadShoppingState, renderShopping } from "./shopping.js";
import { loadRaceState, renderRace } from "./race.js";
import { subscribeShared } from "./realtime.js";

async function boot({force=false} = {}){
  const st = $("status"), rf = $("refresh");
  const cached = force ? null : readCache();
  if(cached){
    state.data = cached.data;
    state.raw = state.data.raw;
    state.foehnRaw = state.data.foehnRaw;
    state.fromCache = true;
    state.fetchedAt = cached.t;
    st.hidden = true;
    fillStart();
    render();
    return;
  }
  rf.disabled = true;
  st.className = "status";
  st.hidden = false;
  st.textContent = "Weerdata ophalen…";
  $("eyebrow").textContent = "Laden…";
  try{
    state.data = await load();
    state.raw = state.data.raw;
    state.foehnRaw = state.data.foehnRaw;
    state.fromCache = false;
    state.fetchedAt = Date.now();
    writeCache(state.data);
    st.hidden = true;
    fillStart();
    render();
  }catch(err){
    st.className = "status err";
    st.textContent = "Ophalen mislukt: " + (err.message || err) + ".";
    const again = document.createElement("button");
    again.type = "button";
    again.textContent = "Opnieuw";
    again.addEventListener("click", ()=>boot({force:true}));
    st.appendChild(again);
    $("eyebrow").textContent = "Geen verbinding";
  }finally{
    rf.disabled = false;
  }
}
$("refresh").addEventListener("click", ()=>boot({force:true}));

function initPackSync(){
  if(supaEnabled){
    $("mectl").hidden = false;
    syncMe();
    subscribeShared();
  }
  Promise.all([loadPackState(), loadCustomItems(), loadShoppingState(), loadRaceState()]).then(()=>{
    const v = getLastView();
    if(v){ renderPack(v); renderShopping(); }
    renderRace();
  });
}

loadNotes();
loadPack();
readUrlState();
syncControls();
boot();
initPackSync();
