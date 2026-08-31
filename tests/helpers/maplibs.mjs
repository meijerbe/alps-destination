// De sandbox waarin deze tests soms draaien heeft geen toegang tot
// cdn.jsdelivr.net (zelfde beperking als voor Supabase — vandaar dat die ook
// altijd wordt afgevangen). In plaats van Leaflet en d3-delaunay zelf na te
// bouwen — te veel oppervlak (DOM/geometrie/events, resp. de Voronoi-wiskunde
// zelf) om betrouwbaar te faken — draaien de tests tegen de échte builds,
// alleen lokaal geserveerd. Zie tests/vendor/ voor hoe die daar komen
// (npm pack, geen CDN nodig).
import fs from "node:fs";
import path from "node:path";

// Playwright transformt testhelpers op een manier waar `import.meta.url` niet
// doorheen komt, dus geen fileURLToPath hier (zoals server.mjs wel doet, die
// los via `node` draait). We leunen op process.cwd(), dat bij het draaien
// van de tests (vanuit tests/, zie tests/README.md) altijd deze map is.
const vendorDir = path.join(process.cwd(), "vendor");
const LEAFLET_JS = fs.readFileSync(path.join(vendorDir, "leaflet", "leaflet.js"), "utf8");
const LEAFLET_CSS = fs.readFileSync(path.join(vendorDir, "leaflet", "leaflet.css"), "utf8");
const D3_DELAUNAY_JS = fs.readFileSync(path.join(vendorDir, "d3-delaunay", "d3-delaunay.min.js"), "utf8");

/** Serveert de vendored Leaflet i.p.v. de echte CDN — zelfde versie als de
 *  <script>/<link> in index.html, dus verder precies wat de browser anders
 *  ook zou krijgen. */
export async function mockLeaflet(page) {
  await page.route("https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js", r =>
    r.fulfill({ status: 200, contentType: "text/javascript", body: LEAFLET_JS }));
  await page.route("https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css", r =>
    r.fulfill({ status: 200, contentType: "text/css", body: LEAFLET_CSS }));
}

/** Serveert de vendored d3-delaunay (de Voronoi-berekening achter de
 *  regio-vlakken) i.p.v. de echte CDN. */
export async function mockD3Delaunay(page) {
  await page.route("https://cdn.jsdelivr.net/npm/d3-delaunay@6.0.4/dist/d3-delaunay.min.js", r =>
    r.fulfill({ status: 200, contentType: "text/javascript", body: D3_DELAUNAY_JS }));
}

// 1×1 transparante PNG — de tests gaat het nooit om hoe een tegel eruitziet,
// alleen om wat de app rondom de kaart doet.
const TILE_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
);

/** Nagebouwde OpenTopoMap-tegelserver, één transparant pixeltje voor elke
 *  tegel-aanvraag — voorkomt netwerkverkeer zonder de kaart zelf te raken. */
export async function mockTiles(page) {
  await page.route("https://*.tile.opentopomap.org/**", r =>
    r.fulfill({ status: 200, contentType: "image/png", body: TILE_PNG }));
}

/** Alle drie tegelijk — het gebruikelijke geval: elke test die de kaart raakt
 *  (of alleen maar index.html laadt, want initMap() draait altijd) heeft ze
 *  alle drie nodig. Moet ná withoutSupabase/mockSupabase geregistreerd
 *  worden: Playwright matcht routes in omgekeerde registratievolgorde, dus
 *  anders vangt hun brede cdn.jsdelivr.net/**-abort deze ook af. */
export async function mockMapLibs(page) {
  await mockLeaflet(page);
  await mockD3Delaunay(page);
  await mockTiles(page);
}
