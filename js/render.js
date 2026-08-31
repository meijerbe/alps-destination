/* ---------- alles: de ene plek die alle render*-functies aanroept ---------- */
import { $ } from "./dom.js";
import { state } from "./state.js";
import { setLastView } from "./view.js";
import { derive } from "./weather.js";
import { syncDay, renderMap, renderSelCard } from "./map.js";
import { renderKpis, renderFoehn, renderRank, renderMatrix } from "./dashboard.js";
import { renderPack } from "./packing.js";
import { renderShopping } from "./shopping.js";
import { renderData } from "./data-tab.js";
import { ensureHistorical } from "./historical.js";

export function render(){
  const v = setLastView(derive());
  // klimatologisch gemiddelde alleen ophalen als de gebruiker 'm ook echt
  // wil zien — kost 15 verzoeken, niet iets om altijd standaard te doen
  if(state.histMode) ensureHistorical(v.dates, render);
  syncDay(v);
  renderKpis(v);
  renderMap(v);
  renderSelCard(v);
  renderFoehn(v);
  renderRank(v);
  renderMatrix(v);
  renderPack(v);
  renderShopping();
  renderData(v);
  $("eyebrow").textContent =
    "Bijgewerkt " + new Date(state.fetchedAt).toLocaleString("nl-NL",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"});
}
