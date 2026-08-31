/* Eén Supabase Realtime-kanaal voor alle drie de gedeelde tabellen. */
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
