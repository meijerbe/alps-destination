/* Eén Supabase Realtime-kanaal voor de trailrun-pagina: de lopers en de
   geplakte uitslag. Los van het kanaal in realtime.js — die is voor het
   weerdashboard (paklijst, boodschappen), en deze twee pagina's laden
   elkaars modules niet in. */
import { sb, supaEnabled, TRIP_ID } from "./supabase-client.js";
import { handleRaceChange, handleResultsChange } from "./race.js";

export function subscribeRace(){
  if(!supaEnabled) return;
  sb.channel("trailrun_" + TRIP_ID)
    .on("postgres_changes", {event:"*", schema:"public", table:"race_runners", filter:`trip=eq.${TRIP_ID}`}, handleRaceChange)
    .on("postgres_changes", {event:"*", schema:"public", table:"race_results", filter:`trip=eq.${TRIP_ID}`}, handleResultsChange)
    .subscribe();
}
