/* ==================================================================
   Trailrun-pagina: alle DOM-events, los van het weerdashboard.
   Uitgesplitst uit ui.js toen Trailrun een eigen pagina kreeg — een
   ander onderwerp verdient een andere URL, zei de gebruiker, en had
   gelijk: dit stond hier toch al los van kaart, paklijst en boodschappen.
================================================================== */
import { $, clamp } from "./dom.js";
import { toast } from "./toast.js";
import {
  addRunner, patchRunner, deleteRunner, renderRace, renderRaceOutputs,
  setClimb, setCourse, resetCourse, setFieldRace, setFieldText, setFieldYear,
  probeerAutomatisch, runners
} from "./race.js";
import { PRESETS } from "./race-data.js";
import { parseDur, fmtDur, parseClock } from "./race-model.js";

$("climb").addEventListener("click", e=>{
  const b = e.target.closest("button"); if(!b) return;
  setClimb(b.dataset.c);
});
$("courses").addEventListener("change", e=>{
  const inp = e.target.closest("input[data-cf]"); if(!inp) return;
  const id = inp.closest(".course").dataset.id, f = inp.dataset.cf;
  if(f === "start"){
    const t = parseClock(inp.value);
    if(t == null){ toast("Starttijd als u:mm, bijvoorbeeld 08:30"); renderRace(); return; }
    setCourse(id, {start: inp.value.padStart(5, "0")});
    return;
  }
  const v = +inp.value;
  if(!isFinite(v) || v < 0){ renderRace(); return; }
  setCourse(id, {[f]: f === "dist" ? clamp(v, 1, 200) : Math.round(clamp(v, 0, 12000))});
});
$("courses").addEventListener("click", e=>{
  const b = e.target.closest("button[data-reset]"); if(!b) return;
  resetCourse(b.dataset.reset);
});

$("raceform").addEventListener("submit", e=>{
  e.preventDefault();
  const input = $("raceinput");
  addRunner(input.value, $("raceinputrace").value);
  input.value = "";
  input.focus();
});
$("racelist").addEventListener("change", e=>{
  const el = e.target.closest("[data-f]"); if(!el) return;
  const id = el.closest(".runner").dataset.id, f = el.dataset.f;
  const cur = runners.get(String(id)); if(!cur) return;

  if(f === "preset"){
    const p = PRESETS.find(x => x.id === el.value);
    el.value = "";
    if(!p) return;
    patchRunner(id, {ref_dist: p.dist, ref_gain: p.gain});
    renderRace();
    return;
  }
  if(f === "name"){
    const naam = el.value.trim();
    if(!naam){ el.value = cur.name; return; }
    patchRunner(id, {name: naam});
    renderRaceOutputs();
    return;
  }
  if(f === "race"){ patchRunner(id, {race: el.value}); renderRace(); return; }
  if(f === "ref_time" || f === "target"){
    const leeg = !el.value.trim();
    const secs = leeg ? null : parseDur(el.value);
    if(!leeg && !secs){ toast("Tijd als u:mm, bijvoorbeeld 1:47"); el.value = f === "target" ? (cur.target_secs ? fmtDur(cur.target_secs) : "") : fmtDur(cur.ref_secs); return; }
    if(f === "ref_time" && !secs){ el.value = fmtDur(cur.ref_secs); return; }   // referentietijd mag niet leeg
    patchRunner(id, f === "ref_time" ? {ref_secs: secs} : {target_secs: secs});
    el.value = secs ? fmtDur(secs) : "";
    renderRaceOutputs();
    return;
  }
  if(f === "ref_dist" || f === "ref_gain" || f === "adjust"){
    const v = +el.value;
    if(!isFinite(v)){ el.value = cur[f]; return; }
    const w = f === "ref_dist" ? clamp(v, 0.5, 200)
            : f === "ref_gain" ? Math.round(clamp(v, 0, 12000))
            : Math.round(clamp(v, -40, 40));
    el.value = w;
    patchRunner(id, {[f]: w});
    renderRaceOutputs();
    return;
  }
  patchRunner(id, {[f]: el.value});          // ondergrond, duurbasis, bergen
  renderRaceOutputs();
});
$("racelist").addEventListener("click", e=>{
  const b = e.target.closest("button[data-runner]"); if(!b) return;
  deleteRunner(b.dataset.runner);
});
$("fieldrace").addEventListener("change", e=>setFieldRace(e.target.value));
$("fieldyear").addEventListener("change", e=>setFieldYear(+e.target.value));
$("fieldfetch").addEventListener("click", probeerAutomatisch);
let veldTimer;
$("fieldpaste").addEventListener("input", e=>{
  clearTimeout(veldTimer);
  const v = e.target.value;
  veldTimer = setTimeout(()=>setFieldText(v), 400);
});
