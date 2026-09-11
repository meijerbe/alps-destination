/* ==================================================================
   Service worker voor de huttentocht — zodat de pagina het doet op een
   hut zonder bereik.

   Twee voorraden, bewust gescheiden:

   SCHIL   de pagina zelf: HTML, stijl, de modules, Leaflet. Klein, en
           wordt bij installatie in één keer opgehaald. Serveren gaat
           uit de voorraad, met op de achtergrond een verse ophaal
           (stale-while-revalidate), zodat een nieuwe versie er bij het
           volgende bezoek vanzelf in zit.
   TEGELS  de kaarttegels. Die groeien met wat je bekijkt, en kunnen op
           verzoek van de pagina vooruit worden opgehaald voor de hele
           route. Wissen kan apart, zonder de pagina zelf kwijt te raken.

   Alles wat hier niet bij hoort — Open-Meteo, Supabase, de andere
   pagina's — wordt met rust gelaten: daar bemoeit deze worker zich niet
   mee, zodat het weerdashboard gewoon live blijft.
================================================================== */

const SCHIL = "ab-huttentocht-schil-v1";
const TEGELS = "ab-huttentocht-tegels-v1";

const SCHIL_BESTANDEN = [
  "./huttentocht.html",
  "./styles.css",
  "./vendor/leaflet/leaflet.css",
  "./vendor/leaflet/leaflet.js",
  "./vendor/leaflet/images/layers.png",
  "./vendor/leaflet/images/layers-2x.png",
  "./vendor/leaflet/images/marker-icon.png",
  "./js/dom.js",
  "./js/gpx.js",
  "./js/tiles.js",
  "./js/route-build.js",
  "./js/route-split.js",
  "./js/tour-data.js",
  "./js/tour-map.js",
  "./js/tour-profile.js",
  "./js/tour-ui.js",
  "./js/tour-live.js",
  "./js/tour-offline.js",
  "./js/huttentocht-main.js"
];

const TEGELHOSTS = ["wmts.geo.admin.ch", "tile.opentopomap.org"];
const isTegel = url => TEGELHOSTS.includes(url.hostname);

/* Hoort deze aanvraag bij de huttentochtpagina? Alleen dan bemoeien we
   ons ermee. Het pad wordt vergeleken zonder ./ ervoor. */
const isSchil = url =>
  url.origin === self.location.origin &&
  SCHIL_BESTANDEN.some(p => url.pathname === new URL(p, self.location).pathname);

self.addEventListener("install", ev => {
  ev.waitUntil((async () => {
    const c = await caches.open(SCHIL);
    // één voor één, zodat één ontbrekend bestand niet de hele installatie
    // laat klappen
    await Promise.all(SCHIL_BESTANDEN.map(p => c.add(p).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", ev => {
  ev.waitUntil((async () => {
    const namen = await caches.keys();
    await Promise.all(namen
      .filter(n => n.startsWith("ab-huttentocht-") && n !== SCHIL && n !== TEGELS)
      .map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

/* Uit de voorraad serveren, en ondertussen een verse halen voor de
   volgende keer. Lukt het ophalen niet, dan merk je daar niets van. */
async function uitVoorraadEnVerversen(req, cacheNaam){
  const c = await caches.open(cacheNaam);
  const uit = await c.match(req, { ignoreSearch: true });
  const vers = fetch(req).then(res => {
    if(res && (res.ok || res.type === "opaque")) c.put(req, res.clone());
    return res;
  }).catch(() => null);
  return uit || (await vers) || new Response("offline", { status: 503 });
}

/* Tegels: eerst de voorraad. Die veranderen niet, dus een keer opgehaald
   is goed genoeg — en onderweg wil je er geen byte meer aan kwijt. */
async function tegel(req){
  const c = await caches.open(TEGELS);
  const uit = await c.match(req);
  if(uit) return uit;
  try {
    const res = await fetch(req);
    if(res && (res.ok || res.type === "opaque")) c.put(req, res.clone());
    return res;
  } catch {
    // een doorzichtige pixel is netter dan een kapot plaatje: de kaart
    // blijft heel, er zit alleen een gat waar je niet geweest bent
    return new Response(null, { status: 504 });
  }
}

/* Vercel serveert de pagina ook zonder .html (cleanUrls). Navigeer je
   offline naar /huttentocht, dan moet dat dezelfde voorraad raken. */
const isPagina = (req, url) =>
  req.mode === "navigate" && url.origin === self.location.origin
  && /^\/huttentocht(\.html)?$/.test(url.pathname);

self.addEventListener("fetch", ev => {
  const req = ev.request;
  if(req.method !== "GET") return;
  const url = new URL(req.url);

  if(isTegel(url)){ ev.respondWith(tegel(req)); return; }
  if(isPagina(req, url)){
    ev.respondWith((async () =>
      (await caches.match("./huttentocht.html")) || uitVoorraadEnVerversen(req, SCHIL))());
    return;
  }
  if(isSchil(url)){ ev.respondWith(uitVoorraadEnVerversen(req, SCHIL)); return; }
  if(url.origin === self.location.origin && url.pathname.startsWith("/routes/")){
    ev.respondWith(uitVoorraadEnVerversen(req, SCHIL));
  }
  // al het andere: niet aankomen
});

/* ---------------- praten met de pagina ---------------- */

const zegTegen = (bron, bericht) => bron && bron.postMessage(bericht);

/* Een lijst tegel-URL's vooruit ophalen, met tussenstanden terug. */
async function haalVooruit(urls, bron){
  const c = await caches.open(TEGELS);
  let klaar = 0, nieuw = 0, mislukt = 0;
  for(const url of urls){
    if(!(await c.match(url))){
      try {
        // no-cors als uitwijk: een tegelserver zonder CORS-kop levert dan
        // een doorzichtig antwoord, en dat is prima om te bewaren
        let res = await fetch(url, { cache: "no-cache" }).catch(() => null);
        if(!res || (!res.ok && res.type !== "opaque")) res = await fetch(url, { mode: "no-cors" });
        if(res && (res.ok || res.type === "opaque")){ await c.put(url, res.clone()); nieuw++; }
        else mislukt++;
      } catch { mislukt++; }
    }
    klaar++;
    if(klaar % 10 === 0 || klaar === urls.length){
      zegTegen(bron, { type: "tegelstand", klaar, totaal: urls.length, nieuw, mislukt });
    }
  }
  zegTegen(bron, { type: "tegelklaar", klaar, totaal: urls.length, nieuw, mislukt });
}

async function stand(bron){
  const c = await caches.open(TEGELS);
  const keys = await c.keys();
  let bytes = null;
  if(self.navigator.storage && navigator.storage.estimate){
    try { bytes = (await navigator.storage.estimate()).usage; } catch { /* mag falen */ }
  }
  zegTegen(bron, { type: "stand", tegels: keys.length, bytes });
}

self.addEventListener("message", ev => {
  const bron = ev.source;
  const d = ev.data || {};
  if(d.type === "haalTegels") ev.waitUntil(haalVooruit(d.urls || [], bron));
  else if(d.type === "stand") ev.waitUntil(stand(bron));
  else if(d.type === "wisTegels") ev.waitUntil(caches.delete(TEGELS).then(() => stand(bron)));
  else if(d.type === "haalExtra") ev.waitUntil(caches.open(SCHIL)
    .then(c => Promise.all((d.urls || []).map(u => c.add(u).catch(() => {})))));
});
