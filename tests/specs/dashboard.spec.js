import { test, expect } from "@playwright/test";
import { mockWeather } from "../helpers/openmeteo.mjs";
import { withoutSupabase } from "../helpers/supabase.mjs";
import { mockLeaflet, mockTiles } from "../helpers/leaflet.mjs";

test.beforeEach(async ({ page }) => {
  await mockWeather(page);
  await withoutSupabase(page);
  // Moet ná withoutSupabase (die alle cdn.jsdelivr.net-verzoeken afbreekt):
  // Playwright matcht routes in omgekeerde registratievolgorde, dus deze
  // specifiekere leaflet-route (later geregistreerd) wint van die brede abort.
  await mockLeaflet(page);
  await mockTiles(page);
});

async function wachtOpKaartdata(page) {
  await page.waitForFunction(() => document.getElementById("mapsub").textContent !== "—");
}

test("kaart tekent alle 32 regio's met een basismarkering", async ({ page }) => {
  await page.goto("/index.html#p=bike&d=5&r=10&s=0&t=map");
  await wachtOpKaartdata(page);

  await expect(page.locator("#mapview.leaflet-container")).toBeAttached();
  await expect(page.locator("#mapview path.leaflet-interactive")).toHaveCount(32);
  await expect(page.locator("#mapview .leaflet-tooltip.maplabel")).toHaveText("MAYRHOFEN");
});

test("de vier kerncijfers en alle weertabbladen vullen zich", async ({ page }) => {
  await page.goto("/index.html#p=bike&d=5&r=10&s=0&t=map");
  await wachtOpKaartdata(page);
  await expect(page.locator(".kpi")).toHaveCount(4);

  await page.locator("#tab-rank").click();
  await expect(page.locator(".row")).toHaveCount(32);

  await page.locator("#tab-matrix").click();
  await expect(page.locator("table.matrix tbody tr")).toHaveCount(32);

  await page.locator("#tab-data").click();
  await expect(page.locator(".req")).toHaveCount(2);
  await expect(page.locator("#pipetable tbody tr")).toHaveCount(6);
});

test("de dagschuif kleurt één dag en zet die in de URL", async ({ page }) => {
  await page.goto("/index.html#p=bike&d=5&r=10&s=0&m=rain&t=map");
  await wachtOpKaartdata(page);

  const gemiddeld = await page.locator("#mapview").innerHTML();
  await page.locator("#daynext").click();

  await expect(page.locator("#daylabel")).toContainText("dag 1 van 5");
  expect(await page.locator("#mapview").innerHTML()).not.toBe(gemiddeld);
  expect(page.url()).toContain("k=0");
});

test("een gedeelde link herstelt de hele weergave", async ({ page }) => {
  await page.goto("/index.html#p=hike&d=7&r=6&s=2&m=sun&k=1&g=Dolomieten&t=map");
  await wachtOpKaartdata(page);

  await expect(page.locator("#selcard h3")).toHaveText("Dolomieten");
  await expect(page.locator("#profile button[aria-pressed=true]")).toHaveText("Hiken");
  await expect(page.locator("#mapmetric button[aria-pressed=true]")).toHaveText("Zon");
  await expect(page.locator("#daysval")).toHaveText("7 dagen");
  // geen aparte selectiering meer — de geselecteerde stip zelf krijgt een
  // dikkere rand (stroke-width 4 i.p.v. 2), precies één van de 32
  const dik = await page.evaluate(() =>
    [...document.querySelectorAll("#mapview path.leaflet-interactive")]
      .filter(p => p.getAttribute("stroke-width") === "4").length);
  expect(dik).toBe(1);
});

test("de drie hoofdonderdelen wisselen en onthouden waar je was", async ({ page }) => {
  await page.goto("/index.html#p=bike&d=5&r=10&s=0&t=map");
  await wachtOpKaartdata(page);

  await page.locator("#tab-matrix").click();
  await page.locator("#top-shop").click();
  await expect(page.locator("#panel-shop")).toBeVisible();
  await expect(page.locator("#kpis")).toBeHidden();
  await expect(page.locator("#subnav")).toBeHidden();

  await page.locator("#top-dash").click();
  await expect(page.locator("#panel-matrix")).toBeVisible();  // onthouden
});

test("klikken op een kaartstip zet de selectie en tonen van de tooltip werkt", async ({ page }) => {
  await page.goto("/index.html#p=bike&d=5&r=10&s=0&t=map");
  await wachtOpKaartdata(page);

  await page.locator("#mapview path.leaflet-interactive").first().hover({ force: true });
  await expect(page.locator("#mapview .leaflet-tooltip.maptip")).toBeVisible();
  await expect(page.locator("#mapview .leaflet-tooltip.maptip")).toContainText("score");

  await page.locator("#mapview path.leaflet-interactive").first().click({ force: true });
  await expect(page.locator("#selcard h3")).toBeVisible();
  expect(page.url()).toContain("g=");
});

test("als Leaflet niet laadt, blijft de rest van de pagina gewoon werken", async ({ page }) => {
  // registreren ná beforeEach's mockLeaflet — laatst geregistreerd wint, dus
  // deze abort overschrijft 'm specifiek voor deze test
  await page.route("https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js", r => r.abort());

  // #mapsub blijft expres op "—" staan — renderMap() slaat zichzelf over
  // zodra de kaart niet is geladen, dus wachtOpKaartdata() zou hier nooit
  // resolven. De rest van render() (kpi's, tabbladen, paklijst) loopt gewoon door.
  await page.goto("/index.html#p=bike&d=5&r=10&s=0&t=map");
  await expect(page.locator("#mapview .status.err")).toContainText("Kaart kon niet laden");
  await expect(page.locator(".kpi")).toHaveCount(4);

  await page.locator("#top-pack").click();
  await expect(page.locator("#panel-pack")).toBeVisible();
  await page.locator("#top-shop").click();
  await expect(page.locator("#panel-shop")).toBeVisible();
});

test("geen console-fouten bij een normale sessie", async ({ page }) => {
  const fouten = [];
  page.on("pageerror", e => fouten.push(e.message));
  page.on("console", m => { if (m.type() === "error" && !/cdn\.jsdelivr|Failed to load resource/.test(m.text())) fouten.push(m.text()); });

  await page.goto("/index.html#p=bike&d=5&r=10&s=0&t=map");
  await wachtOpKaartdata(page);
  for (const t of ["tab-rank", "tab-matrix", "tab-data"]) await page.locator("#" + t).click();
  await page.locator("#top-pack").click();
  await page.locator("#top-shop").click();

  expect(fouten).toEqual([]);
});
