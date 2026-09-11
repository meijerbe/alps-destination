/* ------------------------------------------------------------------
   De tocht offline meenemen.

   De pagina zelf (tekst, profielen, reserveringsnummers) staat na één
   bezoek in de voorraad van de service worker. De kaarttegels niet: die
   komen binnen naarmate je rondkijkt. Daarom deze knop — hij haalt van
   tevoren de strook tegels op waar de route doorheen loopt, zodat de
   kaart het ook doet in een dal zonder bereik.

   Alles hier is optioneel: kan de browser geen service worker (of staat
   de pagina niet op https), dan verdwijnt het blok en werkt de rest
   gewoon.
------------------------------------------------------------------- */
import { $ } from "./dom.js";
import { tegelsLangs, tegelUrl, schatBytes, leesbaarBytes } from "./tiles.js";
import { tegelBronnen } from "./tour-map.js";

const ZOOMS = [12, 13, 14, 15];

let etappes = [];
let bezig = false;

const kan = () => "serviceWorker" in window.navigator;

/* Noodrem: ?sw=uit zet de service worker uit en gooit alles wat hij bewaart
   weg. Mocht er ooit iets vastlopen in de voorraad, dan is dit de manier om
   er zonder browserinstellingen weer uit te komen — en dat wil je kunnen
   uitleggen aan iemand die met een telefoon op een hut staat. */
/* De noodrem gaat in twee stappen, en dat is met opzet. Zolang deze pagina
   nog door de worker bestuurd wordt, blijft hij verzoeken afhandelen — en
   elke tegel die ondertussen binnenkomt maakt zijn voorraad meteen weer aan.
   Uitschrijven werkt pas echt bij de volgende navigatie. Dus: eerst
   uitschrijven en herladen, en pas op die verse pagina, met niets meer
   ertussen, de voorraad weggooien. */
async function schrijfUit(){
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.all(regs.map(r => r.unregister()));
  window.location.replace(window.location.pathname + "?sw=weg");
}

async function wisAlles(){
  const namen = (await window.caches.keys()).filter(n => n.startsWith("ab-huttentocht-"));
  await Promise.all(namen.map(n => window.caches.delete(n)));
  const over = (await window.caches.keys()).filter(n => n.startsWith("ab-huttentocht-"));
  meld(over.length
    ? "Uitgezet, maar er staat nog iets in de voorraad. Herlaad en probeer het nog eens."
    : "Service worker uitgezet en de voorraad gewist. Herlaad zonder ?sw=weg en alles is weer vers.");
}

async function stuur(bericht){
  const reg = await navigator.serviceWorker.ready;
  const w = reg.active || navigator.serviceWorker.controller;
  if(w) w.postMessage(bericht);
}

/* Alle tegel-URL's die deze tocht nodig heeft: de strook langs elke
   etappe, voor elke kaartlaag die nu aan staat. */
function alleUrls(){
  const punten = etappes.flatMap(e => e.route.points);
  const tegels = tegelsLangs(punten, ZOOMS, 1);
  return tegelBronnen().flatMap(sjabloon => tegels.map(t => tegelUrl(sjabloon, t)));
}

function meld(tekst){ const el = $("offlinestand"); if(el) el.textContent = tekst; }

function voortgang(klaar, totaal){
  const wrap = $("offlineprog"), vul = $("offlinefill"), txt = $("offlinetxt");
  if(!wrap) return;
  wrap.hidden = false;
  if(vul) vul.style.width = `${Math.round(klaar / Math.max(totaal, 1) * 100)}%`;
  if(txt) txt.textContent = `${klaar} van ${totaal} tegels`;
}

function toonStand({ tegels, bytes }){
  if(!tegels){
    meld("Nog niets opgeslagen. De kaart komt nu van internet.");
    return;
  }
  const maat = bytes ? leesbaarBytes(bytes) : `ongeveer ${leesbaarBytes(schatBytes(tegels))}`;
  meld(`${tegels.toLocaleString("nl-NL")} tegels opgeslagen (${maat}). Die heb je onderweg zonder bereik ook.`);
}

async function haalOp(){
  if(bezig) return;
  const urls = alleUrls();
  bezig = true;
  $("offlinehaal").disabled = true;
  meld(`${urls.length.toLocaleString("nl-NL")} tegels ophalen — ongeveer ${leesbaarBytes(schatBytes(urls.length))}. `
    + "Laat de pagina open staan.");
  voortgang(0, urls.length);
  await stuur({ type: "haalTegels", urls });
}

async function wissen(){
  if(bezig) return;
  meld("Opgeslagen tegels wissen…");
  await stuur({ type: "wisTegels" });
}

/* Binnenkomende berichten van de service worker. */
function luister(){
  navigator.serviceWorker.addEventListener("message", ev => {
    const d = ev.data || {};
    if(d.type === "tegelstand") voortgang(d.klaar, d.totaal);
    else if(d.type === "tegelklaar"){
      bezig = false;
      $("offlinehaal").disabled = false;
      voortgang(d.totaal, d.totaal);
      const mis = d.mislukt ? ` ${d.mislukt} tegels lukten niet — probeer het zo nog eens.` : "";
      meld(`Klaar: ${d.nieuw.toLocaleString("nl-NL")} nieuwe tegels erbij.${mis}`);
      stuur({ type: "stand" });
    }
    else if(d.type === "stand"){
      toonStand(d);
      const wrap = $("offlineprog");
      if(wrap && !bezig && !d.tegels) wrap.hidden = true;
    }
  });
}

export async function startOffline(lijst, extraUrls = []){
  etappes = lijst;
  const blok = $("offlinebox");
  if(!kan()){
    if(blok) blok.hidden = true;
    return;
  }
  const stand = new window.URLSearchParams(window.location.search).get("sw");
  if(stand === "uit"){ await schrijfUit(); return; }
  if(stand === "weg"){
    if(blok) blok.open = true;
    await wisAlles();
    return;
  }
  try {
    await navigator.serviceWorker.register("sw.js");
  } catch (err) {
    // file://, http zonder tls, of uitgezet in de browser — geen ramp
    if(blok) blok.hidden = true;
    console.warn("service worker niet geregistreerd:", err.message);
    return;
  }
  luister();
  $("offlinehaal").addEventListener("click", haalOp);
  $("offlinewis").addEventListener("click", wissen);
  await stuur({ type: "stand" });
  if(extraUrls.length) await stuur({ type: "haalExtra", urls: extraUrls });
}
