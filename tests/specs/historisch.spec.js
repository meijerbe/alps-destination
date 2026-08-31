import { test, expect } from "@playwright/test";
import { mockWeather } from "../helpers/openmeteo.mjs";
import { withoutSupabase } from "../helpers/supabase.mjs";
import { mockHistorical, withoutHistorical } from "../helpers/historical.mjs";

test.beforeEach(async ({ page }) => {
  await mockWeather(page);
  await withoutSupabase(page);
});

test("Historisch droog kleurt de kaart zodra het 15-jaars-gemiddelde binnen is", async ({ page }) => {
  await mockHistorical(page);
  await page.goto("/index.html#p=bike&d=5&r=10&s=0&t=map");
  await page.waitForSelector(".mapwrap svg rect.c", { state: "attached" });
  const voor = await page.locator("#mapsvg").innerHTML();

  await page.locator('#mapmetric button[data-m="histRain"]').click();
  await expect(page.locator("#mapmetric button[aria-pressed=true]")).toHaveText("Historisch");

  // wacht tot de vlakken echt herkleurd zijn (de melding "wordt opgehaald" is weg)
  await expect(page.locator("#mapnote")).not.toContainText("wordt opgehaald");
  expect(await page.locator("#mapsvg").innerHTML()).not.toBe(voor);

  // geen enkele cel blijft in de "onbekend"-grijstint hangen
  const grijs = await page.evaluate(() =>
    [...document.querySelectorAll(".mapwrap svg rect.c")].filter(r => r.getAttribute("fill") === "#8a9aa0").length);
  expect(grijs).toBe(0);
});

test("laat tussentijds zien dat de historische data nog wordt opgehaald", async ({ page }) => {
  // dezelfde nagebouwde data als mockHistorical, alleen met een kunstmatige
  // vertraging zodat de "wordt opgehaald"-melding echt te zien is
  await page.route("https://archive-api.open-meteo.com/**", async route => {
    await new Promise(r => setTimeout(r, 400));
    const url = new URL(route.request().url());
    const nLoc = decodeURIComponent(url.searchParams.get("latitude")).split(",").length;
    const start = new Date(url.searchParams.get("start_date") + "T00:00:00Z");
    const end = new Date(url.searchParams.get("end_date") + "T00:00:00Z");
    const nDays = Math.round((end - start) / 86400000) + 1;
    const time = [...Array(nDays)].map((_, k) => {
      const d = new Date(start); d.setUTCDate(d.getUTCDate() + k);
      return d.toISOString().slice(0, 10);
    });
    const one = i => ({ daily: { time, precipitation_sum: time.map(() => 2.5) } });
    route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify(nLoc > 1 ? [...Array(nLoc)].map((_, i) => one(i)) : one(0))
    });
  });

  await page.goto("/index.html#p=bike&d=5&r=10&s=0&m=histRain&t=map");
  await page.waitForSelector(".mapwrap svg rect.c", { state: "attached" });

  await expect(page.locator("#mapnote")).toContainText("wordt opgehaald");
  await expect(page.locator("#mapnote")).not.toContainText("wordt opgehaald", { timeout: 5000 });
});

test("een gedeelde link met m=histRain herstelt de keuze", async ({ page }) => {
  await mockHistorical(page);
  await page.goto("/index.html#p=bike&d=5&r=10&s=0&m=histRain&t=map");
  await page.waitForSelector(".mapwrap svg rect.c", { state: "attached" });
  await expect(page.locator("#mapmetric button[aria-pressed=true]")).toHaveText("Historisch");
});

test("mislukt ophalen geeft een duidelijke melding, geen crash", async ({ page }) => {
  const fouten = [];
  page.on("pageerror", e => fouten.push(e.message));

  await withoutHistorical(page);
  await page.goto("/index.html#p=bike&d=5&r=10&s=0&m=histRain&t=map");
  await page.waitForSelector(".mapwrap svg rect.c", { state: "attached" });

  await expect(page.locator("#mapnote")).toContainText("niet gelukt", { timeout: 10000 });
  expect(fouten).toEqual([]);
});
