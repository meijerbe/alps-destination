/* Metrieken waarop de kaart, matrix en dagdata gekleurd/getoond kunnen worden.
   `good` vertaalt de ruwe waarde naar 0-100 zodat de kleurschaal altijd klopt. */
import { clamp, fmt } from "./dom.js";

export const METRICS = {
  score:{label:"score",     val:d=>d.s,        txt:v=>fmt(v),          good:v=>v},
  rain: {label:"mm",        val:d=>d.rain,     txt:v=>v.toFixed(1),    good:v=>clamp(100-v*13,0,100)},
  sun:  {label:"zonuren",   val:d=>d.sun/3600, txt:v=>v.toFixed(1),    good:v=>clamp(v*9,0,100)},
  tmax: {label:"°C max",    val:d=>d.tmax,     txt:v=>fmt(v),          good:v=>clamp(100-Math.abs(v-21)*6.5,0,100)},
  wind: {label:"km/u",      val:d=>d.wind,     txt:v=>fmt(v),          good:v=>clamp(100-Math.max(0,v-14)*3.2,0,100)},
  frz:  {label:"0 °C in m", val:d=>d.frz,      txt:v=>fmt(v),          good:v=>clamp((v-1900)/9,0,100)},
  // 15-jaars klimatologisch gemiddelde voor dezelfde kalenderdagen — geen
  // voorspelling, maar "hoe vaak is het hier normaal droog in deze periode".
  // val(d) is null tot ensureHistorical() de data heeft; overal waar dat
  // doorkomt (kaart, matrix) moet dat als "nog onbekend" behandeld worden,
  // niet als 0 mm.
  histRain: {label:"mm (15-jr gem.)", val:d=>d.histRain,
             txt:v=>v==null?"…":v.toFixed(1),
             good:v=>v==null?50:clamp(100-v*13,0,100)}
};

export const METRIC_NOTE = {
  score:"de gewogen dagscore voor het gekozen profiel",
  rain:"de neerslagsom per dag in millimeter",
  sun:"het aantal zonuren per dag",
  tmax:"de dagmaximumtemperatuur",
  wind:"de hoogste windsnelheid van de dag",
  frz:"de hoogte van het vriespunt — laag betekent sneeuw op de hoge routes",
  histRain:"de gemiddelde neerslag op deze kalenderdagen over de laatste 15 jaar — een klimatologisch gemiddelde, geen voorspelling voor dit jaar"
};
