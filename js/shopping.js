/* ---------- boodschappenlijst — losstaand van de paklijst -------------- */
import { $, esc } from "./dom.js";
import { sb, supaEnabled, TRIP_ID, localId, supaErrText } from "./supabase-client.js";
import { me } from "./packing.js";
import { state } from "./state.js";
import { toast } from "./toast.js";

const SHOP_KEY = "abopreis:shopping:v1";

export let shopRows = new Map();      // "<id>" → {id, label, checked, created_by, updated_by, created_at}

function loadShopLocal(){
  try{
    const arr = JSON.parse(localStorage.getItem(SHOP_KEY) || "[]");
    shopRows = new Map(arr.map(r => [String(r.id), r]));
  }catch{ shopRows = new Map(); }
}
function saveShopLocal(){ try{ localStorage.setItem(SHOP_KEY, JSON.stringify([...shopRows.values()])); }catch{} }

export async function loadShoppingState(){
  if(!supaEnabled){ loadShopLocal(); return; }
  try{
    const {data, error} = await sb.from("shopping_items").select("*").eq("trip", TRIP_ID).order("created_at");
    if(error) throw error;
    shopRows = new Map(data.map(r => [String(r.id), r]));
  }catch(err){
    console.error("[boodschappen] laden mislukt:", err);
    toast("Boodschappenlijst laden mislukt\n" + supaErrText(err), 5000);
  }
}

export async function addShoppingItem(label){
  label = label.trim();
  if(!label) return;
  if(!supaEnabled){
    const id = localId();
    shopRows.set(id, {id, label, checked:false, created_by: me, created_at: new Date().toISOString()});
    saveShopLocal();
    renderShopping();
    return;
  }
  try{
    const {data, error} = await sb.from("shopping_items")
      .insert({trip: TRIP_ID, label, created_by: me}).select().single();
    if(error) throw error;
    shopRows.set(String(data.id), data);
    renderShopping();
  }catch(err){
    console.error("[boodschappen] toevoegen mislukt:", err);
    toast("Toevoegen mislukt\n" + supaErrText(err), 5000);
  }
}

export async function toggleShoppingItem(id, checked){
  const cur = shopRows.get(String(id));
  if(!cur) return;
  const stamp = new Date().toISOString();
  shopRows.set(String(id), {...cur, checked, updated_by: me, updated_at: stamp});
  if(!supaEnabled){ saveShopLocal(); return; }
  try{
    const {error} = await sb.from("shopping_items").update({checked, updated_by: me, updated_at: stamp}).eq("id", id);
    if(error) throw error;
  }catch(err){
    console.error("[boodschappen] bijwerken mislukt:", err);
    toast("Bijwerken mislukt\n" + supaErrText(err), 5000);
  }
}

export async function deleteShoppingItem(id, opts={}){
  const item = shopRows.get(String(id));
  shopRows.delete(String(id));
  renderShopping();
  if(!opts.silent) toast(item ? `${item.label} verwijderd` : "Product verwijderd");
  if(!supaEnabled){ saveShopLocal(); return; }
  try{
    const {error} = await sb.from("shopping_items").delete().eq("id", id);
    if(error) throw error;
  }catch(err){
    console.error("[boodschappen] verwijderen mislukt:", err);
    toast("Verwijderen mislukt\n" + supaErrText(err), 5000);
  }
}

export function handleShoppingChange(payload){
  if(payload.eventType === "DELETE") shopRows.delete(String(payload.old.id));
  else shopRows.set(String(payload.new.id), payload.new);
  if(state.tab === "shop") renderShopping();
}

export function renderShopping(){
  const rows = [...shopRows.values()].sort((a,b)=>{
    if(a.checked !== b.checked) return a.checked ? 1 : -1;
    return String(a.created_at||"").localeCompare(String(b.created_at||""));
  });
  $("shoplist").innerHTML = rows.length ? rows.map(r=>`
    <li class="shoprow">
      <label>
        <input type="checkbox" data-id="${esc(String(r.id))}"${r.checked?" checked":""}>
        <span class="it">${esc(r.label)}</span>
      </label>
      <button type="button" class="itemdel" data-shopid="${esc(String(r.id))}" aria-label="${esc(r.label)} verwijderen">×</button>
    </li>`).join("") : `<p class="empty shopempty">Nog niets op de lijst — typ hierboven een product.</p>`;
  const done = rows.filter(r=>r.checked).length;
  $("shopfill").style.width = (rows.length ? done/rows.length*100 : 0) + "%";
  $("shoptxt").textContent = `${done} van ${rows.length} in huis`;
  $("shopcount").textContent = rows.length ? `${done}/${rows.length}` : "";
  $("shopsub").textContent = supaEnabled
    ? "Gedeeld voor jullie allebei — typ een product en druk op Enter."
    : "Blijft in deze browser — koppel Supabase (zie README) om 'm te delen. Typ een product en druk op Enter.";
}
