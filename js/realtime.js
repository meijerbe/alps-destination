/* Eén Supabase Realtime-kanaal voor de paklijst en de boodschappenlijst.
   De trailrun-pagina heeft zijn eigen kanaal (race-realtime.js) — die twee
   lopen niet samen, want de pagina's laden elkaars modules niet in. */
import { sb, supaEnabled, TRIP_ID } from "./supabase-client.js";
import { handlePackingStateChange, handleCustomItemsChange } from "./packing.js";
import { handleShoppingChange } from "./shopping.js";

export function subscribeShared(){
  if(!supaEnabled) return;
  sb.channel("shared_" + TRIP_ID)
    .on("postgres_changes", {event:"*", schema:"public", table:"packing_state", filter:`trip=eq.${TRIP_ID}`}, handlePackingStateChange)
    .on("postgres_changes", {event:"*", schema:"public", table:"packing_custom_items", filter:`trip=eq.${TRIP_ID}`}, handleCustomItemsChange)
    .on("postgres_changes", {event:"*", schema:"public", table:"shopping_items", filter:`trip=eq.${TRIP_ID}`}, handleShoppingChange)
    .subscribe();
}
