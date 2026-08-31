/* ------------------------------------------------------------------
   Ruwe data: laten zien wat er binnenkomt en wat ermee gebeurt
------------------------------------------------------------------- */
import { $, esc, fmt, clamp, DAYS, dow, dm } from "./dom.js";
import { REGIONS, PARTS, WEIGHTS, PROFILE_LABEL } from "./regions.js";
import { state } from "./state.js";
import { URLS, dayParts, weigh, scoreColor } from "./weather.js";

const WMO = {0:"onbewolkt",1:"overwegend helder",2:"half bewolkt",3:"bewolkt",45:"mist",48:"aanvriezende mist",
  51:"lichte motregen",53:"motregen",55:"dichte motregen",61:"lichte regen",63:"regen",65:"zware regen",
  71:"lichte sneeuw",73:"sneeuw",75:"zware sneeuw",77:"korrelsneeuw",80:"lichte buien",81:"buien",82:"zware buien",
  85:"sneeuwbuien",86:"zware sneeuwbuien",95:"onweer",96:"onweer met hagel",99:"zwaar onweer met hagel"};

const PIPE = [
  {k:"dry",  veld:"precipitation_sum",             eenheid:"mm",  raw:d=>d.rain.toFixed(1),
   formule:"100 − mm × 13",                    note:"0 mm = 100, vanaf ~7,7 mm = 0"},
  {k:"prob", veld:"precipitation_probability_max", eenheid:"%",   raw:d=>fmt(d.prob),
   formule:"100 − kans",                       note:"ontbreekt de kans, dan rekenen we met 40 %"},
  {k:"sun",  veld:"sunshine_duration / daylight_duration", eenheid:"s", raw:d=>`${(d.sun/3600).toFixed(1)} van ${(d.daylight/3600).toFixed(1)} u`,
   formule:"zonfractie × 115",                 note:"vanaf 87 % zon is het vol"},
  {k:"wind", veld:"wind_speed_10m_max",            eenheid:"km/u",raw:d=>fmt(d.wind),
   formule:"100 − (wind − 14) × 3,2",          note:"tot 14 km/u geen aftrek, vanaf ~45 km/u nul"},
  {k:"temp", veld:"temperature_2m_max",            eenheid:"°C",  raw:d=>fmt(d.tmax),
   formule:"100 − |T − 21| × 6,5",             note:"21 °C is het optimum, ±15 °C is nul"},
  {k:"snow", veld:"freezing_level_height (min/dag)",eenheid:"m",  raw:d=>fmt(d.frz),
   formule:"(hoogte − 1900) ÷ 9",              note:"1900 m = 0, vanaf 2800 m = 100"}
];

export function dataPlace(v){
  return v.all.find(p=>p.n === state.dataPlace)
      || (state.sel && v.all.find(p=>p.n === state.sel))
      || v.scored[0] || v.all[0];
}

export function renderData(v){
  if(!state.raw) return;
  const p = dataPlace(v);
  const idx = REGIONS.findIndex(r=>r.n === p.n);
  const o = state.raw[idx] || {};
  const fresh = Date.now() - state.fetchedAt;
  const gen = (state.raw.reduce((a,x)=>a+(x.generationtime_ms||0),0)
             + state.foehnRaw.reduce((a,x)=>a+(x.generationtime_ms||0),0));
  const days = state.data.places[0].days.length;
  const punten = REGIONS.length*days*8 + REGIONS.length*days*24 + 2*days*24;

  $("datacards").innerHTML = [
    {k:"Bron", v:"Open-Meteo /v1/forecast",
     n:`best-match model · ${days} dagen · tijdzone ${esc(o.timezone_abbreviation||"CEST")} · geen sleutel`},
    {k:"Opgehaald", v:new Date(state.fetchedAt).toLocaleString("nl-NL",{weekday:"short",day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}),
     n:`${fresh < 60000 ? "zojuist" : Math.round(fresh/60000) + " min geleden"} · ${state.fromCache ? "uit de sessie-cache" : "vers opgehaald"} · cache vervalt na 30 min`},
    {k:"Omvang", v:`${punten.toLocaleString("nl-NL")} waarden`,
     n:`${REGIONS.length} regio's × ${days} dagen × 8 dagvelden, plus ${REGIONS.length*days*24} uurwaarden vriespunt en ${2*days*24} uurwaarden druk · rekentijd server ${gen.toFixed(1)} ms`}
  ].map(t=>`<div class="card"><div class="k">${esc(t.k)}</div><div class="v">${esc(t.v)}</div><div class="n">${t.n}</div></div>`).join("");

  const showUrl = (u) => esc(u).replace(/&amp;/g, "<i>&amp;</i>").replace(/(daily|hourly|latitude|longitude|timezone|forecast_days)=/g, "<b>$1</b>=");
  $("reqs").innerHTML = [
    ["Verzoek 1 — weer voor alle regio's", URLS.data, `${REGIONS.length} coördinatenparen in één request; het antwoord is een array met één object per regio, in dezelfde volgorde.`],
    ["Verzoek 2 — luchtdruk voor de föhnmeter", URLS.foehn, "Twee stations: Innsbruck (574 m) en Bolzano (262 m), alleen uurlijkse druk op zeeniveau."]
  ].map(([t,u,n])=>`
    <div class="req">
      <div class="t">${esc(t)}</div>
      <code>${showUrl(u)}</code>
      <p class="n" style="font-family:var(--body);font-size:12.5px;color:var(--ink3);margin:9px 0 0">${esc(n)}</p>
      <div class="acts">
        <a href="${esc(u)}" target="_blank" rel="noopener">Open de JSON</a>
        <button type="button" data-copy="${esc(u)}">Kopieer URL</button>
      </div>
    </div>`).join("");

  // ruwe dagwaarden
  $("dataplace").innerHTML = v.all.map(x=>
    `<option value="${esc(x.n)}"${x.n===p.n?" selected":""}>${esc(x.n)} — ${esc(x.r)}${x.far?" (buiten rijtijd)":""}</option>`).join("");
  const D = o.daily || {};
  $("rawtable").innerHTML = `
    <thead><tr>
      <th>time</th><th>precipitation<br>_sum</th><th>precipitation<br>_probability_max</th>
      <th>sunshine<br>_duration</th><th>daylight<br>_duration</th><th>temperature<br>_2m_max</th>
      <th>temperature<br>_2m_min</th><th>wind_speed<br>_10m_max</th><th>weather<br>_code</th><th>freezing_level<br>(min/dag)</th>
    </tr></thead>
    <tbody>${(D.time||[]).map((t,k)=>{
      const day = state.data.places[idx].days[k];
      const inWin = k >= v.start && k < v.start + v.n;
      return `<tr style="${inWin?"":"opacity:.42"}">
        <td>${t}</td>
        <td>${(D.precipitation_sum||[])[k] ?? "–"}</td>
        <td>${(D.precipitation_probability_max||[])[k] ?? "–"}</td>
        <td>${(D.sunshine_duration||[])[k] ?? "–"}</td>
        <td>${(D.daylight_duration||[])[k] ?? "–"}</td>
        <td>${(D.temperature_2m_max||[])[k] ?? "–"}</td>
        <td>${(D.temperature_2m_min||[])[k] ?? "–"}</td>
        <td>${(D.wind_speed_10m_max||[])[k] ?? "–"}</td>
        <td class="txt">${(D.weather_code||[])[k] ?? "–"} ${WMO[(D.weather_code||[])[k]] ? "· " + WMO[(D.weather_code||[])[k]] : ""}</td>
        <td>${fmt(day.frz)}</td>
      </tr>`;
    }).join("")}</tbody>`;
  $("rawmeta").innerHTML =
    `Gevraagd om <strong>${p.lat.toFixed(3)} N, ${p.lon.toFixed(3)} O</strong>; het model antwoordt voor de rastercel op `
    + `<strong>${(o.latitude ?? p.lat).toFixed(3)} N, ${(o.longitude ?? p.lon).toFixed(3)} O</strong> op `
    + `<strong>${fmt(o.elevation)} m</strong> hoogte. Die celhoogte is een gemiddelde over enkele kilometers — in een diep dal `
    + `ligt de echte bodem er honderden meters onder, en dat verklaart het grootste deel van het temperatuurverschil met de dalbodem. `
    + `Grijze rijen vallen buiten je gekozen venster.`;

  // rekensom voor één dag
  const maxDay = state.data.places[idx].days.length - 1;
  state.dataDay = clamp(state.dataDay, 0, maxDay);
  $("dataday").innerHTML = state.data.places[idx].days.map((d,k)=>
    `<option value="${k}"${k===state.dataDay?" selected":""}>${DAYS[dow(d.date)]} ${dm(d.date)}</option>`).join("");
  const d0 = state.data.places[idx].days[state.dataDay];
  const parts = dayParts(d0), w = WEIGHTS[state.profile];
  const totaal = weigh(parts, w);
  $("pipetable").innerHTML = `
    <thead><tr>
      <th>onderdeel</th><th>API-veld</th><th>ruwe waarde</th><th>normalisatie</th>
      <th>subscore</th><th>weging ${esc(PROFILE_LABEL[state.profile].toLowerCase())}</th><th>bijdrage</th>
    </tr></thead>
    <tbody>${PIPE.map(row=>{
      const P = PARTS.find(x=>x.k===row.k);
      return `<tr>
        <td><span style="display:inline-block;width:8px;height:8px;border-radius:1px;background:${P.c};margin-right:6px"></span>${P.label}</td>
        <td class="txt">${esc(row.veld)}</td>
        <td>${row.raw(d0)} ${esc(row.eenheid)}</td>
        <td class="form">${esc(row.formule)}<br><span style="opacity:.6">${esc(row.note)}</span></td>
        <td>${parts[row.k].toFixed(1)}</td>
        <td>${w[row.k].toFixed(2)}</td>
        <td>${(parts[row.k]*w[row.k]).toFixed(1)}</td>
      </tr>`;
    }).join("")}</tbody>
    <tfoot><tr><td colspan="6">Dagscore voor ${esc(p.n)} op ${DAYS[dow(d0.date)]} ${dm(d0.date)}</td><td>${totaal.toFixed(1)}</td></tr></tfoot>`;

  // föhn ruw
  const N = state.foehnRaw[0].hourly, S = state.foehnRaw[1].hourly;
  const agg = {};
  N.time.forEach((t,i)=>{
    const day = t.slice(0,10);
    (agg[day] ||= {n:[], s:[]});
    if(N.pressure_msl[i] != null) agg[day].n.push(N.pressure_msl[i]);
    if(S.pressure_msl[i] != null) agg[day].s.push(S.pressure_msl[i]);
  });
  const avg = a => a.reduce((x,y)=>x+y,0)/a.length;
  $("foehntable").innerHTML = `
    <thead><tr><th>dag</th><th>uren</th><th>Innsbruck hPa</th><th>Bolzano hPa</th><th>verschil</th><th>duiding</th></tr></thead>
    <tbody>${Object.entries(agg).map(([day,a])=>{
      const diff = avg(a.n) - avg(a.s);
      const inWin = v.dates.includes(day);
      return `<tr style="${inWin?"":"opacity:.42"}">
        <td>${DAYS[dow(day)]} ${dm(day)}</td><td>${a.n.length}</td>
        <td>${avg(a.n).toFixed(1)}</td><td>${avg(a.s).toFixed(1)}</td>
        <td style="color:${scoreColor(clamp(50+diff*5.5,0,100))};font-weight:600">${diff>=0?"+":""}${diff.toFixed(1)}</td>
        <td class="txt">${diff > 2.5 ? "nordföhn — zuidkant in de luwte" : diff < -2.5 ? "südföhn — noordkant in de luwte" : "vlak drukveld"}</td>
      </tr>`;
    }).join("")}</tbody>`;

  $("caveats").innerHTML = [
    `<b>Het drukverschil heeft een vaste bias.</b> Innsbruck ligt op 574 m, Bolzano op 262 m, en beide waarden zijn herleid naar zeeniveau. De absolute uitslag klopt daardoor niet als natuurkunde; het teken en de verandering van dag tot dag zijn wél het signaal.`,
    `<b>Best-match is niet één model.</b> Open-Meteo kiest per rastercel het best passende model (ICON-D2, ICON-EU, GFS …). Twee naburige regio's kunnen dus uit verschillende modellen komen, met een sprong op de grens.`,
    `<b>De rastercel is grover dan een dal.</b> Enkele kilometers per cel, en de modelhoogte is een gemiddelde. In de Alpen betekent dat systematisch te koele dagmaxima op dalbodems en te milde nachten op de toppen.`,
    `<b>Het vriespunt is de laagste uurwaarde van de dag.</b> Dat is bewust conservatief: het gaat om de vraag of er 's ochtends sneeuw op de hoge route ligt, niet om het daggemiddelde.`,
    `<b>Zonneschijn is model, geen meting.</b> <code>sunshine_duration</code> is afgeleid uit de voorspelde straling en overschat in de bergen makkelijk door schaduwwerking van de kammen.`,
    `<b>Neerslagkans is het dagmaximum</b>, niet het gemiddelde. Eén onweersuur kan de hele dag op 80 % zetten.`,
    `<b>De curves knippen af.</b> Boven ~7,7 mm scoort elke dag even nat, boven 45 km/u even winderig. Wie het verschil tussen fors en extreem wil zien, moet naar de dagtabel kijken, niet naar de score.`,
    `<b>Een gemiddelde verbergt een rotdag.</b> Vijf redelijke dagen en vijf natte geven dezelfde score als tien matige. Daarom staat de dag-voor-dag balk overal naast het cijfer.`,
    `<b>Voorbij dag vijf wordt het gokken.</b> De API geeft tien dagen, maar de betrouwbaarheid zakt daarna snel. Gebruik de verre dagen om een richting te kiezen, niet om een besluit op te bouwen.`,
    `<b>De regiokaart is schematisch.</b> Elk vlak is de verzameling rastercellen die het dichtst bij het middelpunt van die regio ligt — één meetpunt per regio, geen interpolatie en zeker geen grens.`
  ].map(x=>`<li>${x}</li>`).join("");
}
