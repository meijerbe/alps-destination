import { $ } from "./dom.js";

let toastTimer;
export function toast(msg, ms){
  const el = $("toast");
  el.textContent = msg;
  el.classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>el.classList.remove("on"), ms || 2200);
}
