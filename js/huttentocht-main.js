/* ==================================================================
   Boot voor de huttentochtpagina. Zet de routes klaar (uit de punten
   in tour-data.js, of uit een GPX-bestand als dat er is), rekent ze
   door, tekent de kaart en de dagkaartjes, en zet de pagina op de dag
   waar we vandaag in zitten.

   Los van main.js (het weerdashboard): geen gedeelde state, alleen
   dezelfde stijl.
================================================================== */
import { $ } from "./dom.js";
import { parseGpx, measure } from "./gpx.js";
import { bouwRoute } from "./route-build.js";
import { ETAPPES } from "./tour-data.js";
import { initMap, locateMe, hermeet, mengLagen } from "./tour-map.js";
import { render, kiesDag, dagVanVandaag } from "./tour-ui.js";

async function routeVan(def){
  if(def.gpx){
    // een echte opgenomen track gaat vóór de punten; lukt het ophalen
    // niet (offline, bestand weg), dan vallen we terug op de punten
    try {
      const res = await fetch(def.gpx, { cache: "no-cache" });
      if(!res.ok) throw new Error(res.status + " " + res.statusText);
      const route = parseGpx(await res.text());
      if(route.points.length > 1) return route;
      throw new Error("geen punten in het bestand");
    } catch (err) {
      console.warn(`${def.gpx} niet gelezen (${err.message}) — terug naar de tussenpunten`);
    }
  }
  return bouwRoute(def.punten);
}

async function start(){
  try {
    const routes = await Promise.all(ETAPPES.map(routeVan));
    const etappes = ETAPPES.map((def, i) => ({ def, route: routes[i], stats: measure(routes[i].points) }));

    initMap(etappes);
    render(etappes);
    kiesDag(dagVanVandaag(), false);
    hermeet();

    $("tourstatus").textContent = "";
    $("tourstatus").hidden = true;
  } catch (err) {
    const st = $("tourstatus");
    st.className = "status err";
    st.textContent = "De routes konden niet worden opgebouwd: " + err.message;
    console.error(err);
  }
}

$("locate").addEventListener("click", () => locateMe(txt => { $("maphint").textContent = txt; }));
$("laagmix").addEventListener("input", ev => mengLagen(+ev.target.value));
window.addEventListener("resize", hermeet);

start();
