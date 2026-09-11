import { chromium } from "@playwright/test";
const PIXEL = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=","base64");
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await b.newPage({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 2 });
p.on("console", m => console.log("[console]", m.type(), m.text()));
p.on("pageerror", e => console.log("[pageerror]", e.message));
await p.route(/geo\.admin\.ch|opentopomap\.org/, r => r.fulfill({status:200, contentType:"image/png", body: PIXEL}));
await p.goto("http://127.0.0.1:4173/huttentocht.html");
await p.waitForSelector(".stage");
for (const id of ["d1","d2","d3","d4"]) {
  console.log(`\n--- ${id} ---`);
  console.log((await p.locator(`#stage-${id} .stagestats`).innerText()).replace(/\n/g, " | "));
  console.log(await p.locator(`#stage-${id} .statsrc`).innerText());
}
console.log("\nroutepunten per dag:", await p.evaluate(() =>
  [...document.querySelectorAll("#map path.leaflet-interactive")].map(el => el.getAttribute("d").split(/[ML]/).length - 1)));
await b.close();
