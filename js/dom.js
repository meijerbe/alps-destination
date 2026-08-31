/* Kleine, generieke hulpfuncties — DOM, opmaak, geen kennis van de app zelf. */

export const $ = id => document.getElementById(id);
export const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
export const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
export const fmt = n => n==null||Number.isNaN(n) ? "–" : Math.round(n);

export const cssEsc = window.CSS && CSS.escape ? (s=>CSS.escape(s)) : (s=>s.replace(/[^a-zA-Z0-9_-]/g,"\\$&"));

export const darkMode = () => window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;

export const DAYS = ["ma","di","wo","do","vr","za","zo"];
export const dow = date => (new Date(date+"T12:00").getDay()+6)%7;
export const dm  = date => date.slice(8,10) + "-" + date.slice(5,7);

export function slug(s){
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");
}
