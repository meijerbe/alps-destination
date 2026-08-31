/* ------------------------------------------------------------------
   Gedeelde paklijst via Supabase — optioneel. Zonder configuratie
   blijft alles precies zoals voorheen: vinkjes en notities per browser,
   via localStorage. Vul SUPABASE_URL en SUPABASE_ANON_KEY hieronder in
   (zie README, kopje "Gedeelde paklijst") om ze met elkaar te delen.
   SUPABASE_ANON_KEY is de publieke sleutel uit Settings → API — de
   klassieke "anon"-JWT of de nieuwere "publishable"-sleutel (sb_publishable_…)
   werken hier allebei, nooit de service_role-sleutel.
------------------------------------------------------------------- */
export const SUPABASE_URL = "https://civolabgzdvzfrsrzimq.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_zYrXuDJOFwprFKVD5Y3qbg_6X0uNn2R";
export const TRIP_ID = "ab-op-reis";

export const supaEnabled = !!(SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase);
export const sb = supaEnabled ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

export const localId = () => (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : "id" + Date.now() + Math.random().toString(36).slice(2);

// leesbare samenvatting van een Supabase/PostgREST-fout, voor in de toast —
// zodat "kan geen verbinding maken" wordt wat het écht is: een RLS-afwijzing,
// een verkeerde sleutel, een CORS-blokkade, …
export function supaErrText(err){
  if(!err) return "onbekende fout";
  // de paar fouten die je in de praktijk tegenkomt, met wat je eraan doet —
  // de ruwe Postgres-tekst zegt een mens weinig
  if(err.code === "42501") return "de database laat dit nog niet toe — draai supabase/schema.sql opnieuw in de SQL Editor";
  if(err.code === "42P01" || err.code === "PGRST205") return "die tabel bestaat nog niet — draai supabase/schema.sql in de SQL Editor";
  if(err.code === "23505") return "dat staat er al op";
  const bits = [err.message || String(err)];
  if(err.hint) bits.push("hint: " + err.hint);
  if(err.code) bits.push("code " + err.code);
  return bits.join(" · ");
}
