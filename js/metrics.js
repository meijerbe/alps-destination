/* Metrieken waarop de kaart, matrix en dagdata gekleurd/getoond kunnen worden.
   `good` vertaalt de ruwe waarde naar 0-100 zodat de kleurschaal altijd klopt.

   `histVal` is de tegenhanger van `val` als de bron op "historisch" staat
   (zie de toggle in ui.js) — zelfde eenheid, zelfde `good`/`txt`, alleen een
   ander veld op de dag (`d.histRain` i.p.v. `d.rain`, enz.), gevuld door
   historical.js via derive() in weather.js. Score en vriespunt hebben geen
   `histVal`: score leunt op neerslagkans (bestaat niet met terugwerkende
   kracht) en vriespunt is bewust buiten scope gehouden (zie historical.js).
   Waar geen `histVal` is, valt de UI terug op "rain" — zie state.js. */
import { clamp, fmt } from "./dom.js";

// null-veilig: bij historische data kan een dag nog "onbekend" zijn (nog niet
// opgehaald door ensureHistorical()) — dat moet als zodanig getoond worden,
// niet als 0.
const histTxt = fmt_ => v => v==null ? "…" : fmt_(v);
const histGood = good_ => v => v==null ? 50 : good_(v);

export const METRICS = {
  score:{label:"score",     val:d=>d.s,        txt:v=>fmt(v),          good:v=>v},
  rain: {label:"mm",        val:d=>d.rain,     txt:v=>v.toFixed(1),    good:v=>clamp(100-v*13,0,100),
         histVal:d=>d.histRain},
  sun:  {label:"zonuren",   val:d=>d.sun/3600, txt:v=>v.toFixed(1),    good:v=>clamp(v*9,0,100),
         histVal:d=>d.histSun==null?null:d.histSun/3600},
  tmax: {label:"°C max",    val:d=>d.tmax,     txt:v=>fmt(v),          good:v=>clamp(100-Math.abs(v-21)*6.5,0,100),
         histVal:d=>d.histTmax},
  wind: {label:"km/u",      val:d=>d.wind,     txt:v=>fmt(v),          good:v=>clamp(100-Math.max(0,v-14)*3.2,0,100),
         histVal:d=>d.histWind},
  frz:  {label:"0 °C in m", val:d=>d.frz,      txt:v=>fmt(v),          good:v=>clamp((v-1900)/9,0,100)}
};
// txt/good null-veilig maken, alleen voor de metrieken die ook historisch kunnen
Object.values(METRICS).forEach(M => {
  if(!M.histVal) return;
  M.txt = histTxt(M.txt);
  M.good = histGood(M.good);
});

export const METRIC_NOTE = {
  score:"de gewogen dagscore voor het gekozen profiel",
  rain:"de neerslagsom per dag in millimeter",
  sun:"het aantal zonuren per dag",
  tmax:"de dagmaximumtemperatuur",
  wind:"de hoogste windsnelheid van de dag",
  frz:"de hoogte van het vriespunt — laag betekent sneeuw op de hoge routes"
};
