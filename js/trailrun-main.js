/* ==================================================================
   Boot voor de trailrun-pagina: lopers en uitslag laden, voor het
   eerst tekenen, en de realtime-koppeling aanzetten zodra Supabase
   er is. Los van main.js (het weerdashboard) — geen gedeelde state,
   geen gedeelde opstartvolgorde, alleen dezelfde stijl en dezelfde
   Supabase-tabellen.
================================================================== */
import { loadRaceState, renderRace } from "./race.js";
import { subscribeRace } from "./race-realtime.js";
import { supaEnabled } from "./supabase-client.js";
import "./race-ui.js";   // hangt alle DOM-events op — alleen het side effect telt hier

loadRaceState().then(()=>{
  renderRace();
  if(supaEnabled) subscribeRace();
});
