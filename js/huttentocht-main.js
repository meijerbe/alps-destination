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
import { splitsTocht } from "./route-split.js";
import { ETAPPES, TOUR } from "./tour-data.js";
import { initMap, locateMe, hermeet, mengLagen } from "./tour-map.js";
import { render, kiesDag, dagVanVandaag } from "./tour-ui.js";

/* Een GPX ophalen en lezen; `null` als dat om welke reden dan ook niet lukt.
   Een ontbrekend of stuk bestand mag de pagina niet omver halen — dan
   tekenen we gewoon weer de lijn uit de tussenpunten. */
async function haalGpx(pad){
  try {
    const res = await fetch(pad, { cache: "no-cache" });
    if(!res.ok) throw new Error(res.status + " " + res.statusText);
    const route = parseGpx(await res.text());
    if(route.points.length < 2) throw new Error("geen punten in het bestand");
    return route;
  } catch (err) {
    console.warn(`${pad} niet gelezen (${err.message}) — terug naar de tussenpunten`);
    return null;
  }
}

/* De routes van alle dagen, in volgorde van voorkeur:
   1. een eigen GPX per etappe (`gpx:` op de etappe),
   2. het stuk uit één GPX van de hele tocht (`gpx` op TOUR),
   3. de lijn die de pagina zelf trekt door de tussenpunten. */
async function alleRoutes(){
  const heel = TOUR.gpx ? await haalGpx(TOUR.gpx) : null;
  const stukken = heel ? splitsTocht(heel, ETAPPES) : ETAPPES.map(() => null);

  return Promise.all(ETAPPES.map(async (def, i) => {
    if(def.gpx){
      const eigen = await haalGpx(def.gpx);
      if(eigen) return { ...eigen, uitGpx: true };
    }
    return stukken[i] || bouwRoute(def.punten);
  }));
}

async function start(){
  try {
    const routes = await alleRoutes();
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
