// De sandbox waarin deze tests soms draaien heeft geen toegang tot
// cdn.jsdelivr.net (zelfde beperking als voor Supabase — vandaar dat die ook
// altijd wordt afgevangen). In plaats van Leaflet zelf na te bouwen — te veel
// oppervlak om betrouwbaar te faken — draaien de tests tegen de échte
// Leaflet 1.9.4 build, alleen lokaal geserveerd. Zie tests/vendor/leaflet/
// voor hoe die daar komt (npm pack, geen CDN nodig).
import fs from "node:fs";
import path from "node:path";

// Playwright transformt testhelpers op een manier waar `import.meta.url` niet
// doorheen komt, dus geen fileURLToPath hier (zoals server.mjs wel doet, die
// los via `node` draait). We leunen op process.cwd(), dat bij het draaien
// van de tests (vanuit tests/, zie tests/README.md) altijd deze map is.
const vendorDir = path.join(process.cwd(), "vendor", "leaflet");
const JS = fs.readFileSync(path.join(vendorDir, "leaflet.js"), "utf8");
const CSS = fs.readFileSync(path.join(vendorDir, "leaflet.css"), "utf8");

/** Serveert de vendored Leaflet i.p.v. de echte CDN — zelfde versie als de
 *  <script>/<link> in index.html, dus verder precies wat de browser anders
 *  ook zou krijgen. */
export async function mockLeaflet(page) {
  await page.route("https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js", r =>
    r.fulfill({ status: 200, contentType: "text/javascript", body: JS }));
  await page.route("https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css", r =>
    r.fulfill({ status: 200, contentType: "text/css", body: CSS }));
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
