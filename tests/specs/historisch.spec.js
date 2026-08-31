import { test, expect } from "@playwright/test";
import { mockWeather } from "../helpers/openmeteo.mjs";
import { withoutSupabase } from "../helpers/supabase.mjs";
import { mockHistorical, withoutHistorical } from "../helpers/historical.mjs";
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

async function aantalGrijzeStippen(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll("#mapview path.leaflet-interactive")]
      .filter(p => p.getAttribute("fill") === "#8a9aa0").length);
}

test("de bron-toggle kleurt de kaart zodra het 15-jaars-gemiddelde binnen is", async ({ page }) => {
  await mockHistorical(page);
  await page.goto("/index.html#p=bike&d=5&r=10&s=0&t=map");
  await wachtOpKaartdata(page);
  const voor = await page.locator("#mapview").innerHTML();

  await page.locator('#mapsource button[data-h="1"]').click();
  await expect(page.locator("#mapsource button[aria-pressed=true]")).toHaveText("Historisch");
  // schakelt zelf naar Neerslag — Score bestaat niet historisch
  await expect(page.locator("#mapmetric button[aria-pressed=true]")).toHaveText("Neerslag");

  await expect(page.locator("#mapnote")).not.toContainText("wordt opgehaald");
  expect(await page.locator("#mapview").innerHTML()).not.toBe(voor);
  expect(await aantalGrijzeStippen(page)).toBe(0);
});

test("in historische weergave blijven Neerslag, Zon, Temp en Wind kiesbaar", async ({ page }) => {
  await mockHistorical(page);
  await page.goto("/index.html#p=bike&d=5&r=10&s=0&h=1&t=map");
  await wachtOpKaartdata(page);
  await expect(page.locator("#mapnote")).not.toContainText("wordt opgehaald");

  for (const m of ["sun", "tmax", "wind", "rain"]) {
    const voor = await page.locator("#mapview").innerHTML();
    await page.locator(`#mapmetric button[data-m="${m}"]`).click();
    await expect(page.locator("#mapmetric button[aria-pressed=true]")).toHaveAttribute("data-m", m);
    expect(await page.locator("#mapview").innerHTML()).not.toBe(voor);
  }
});

test("Score en Vriespunt zijn uitgeschakeld zolang de bron op Historisch staat", async ({ page }) => {
  await mockHistorical(page);
  await page.goto("/index.html#p=bike&d=5&r=10&s=0&t=map");
  await wachtOpKaartdata(page);

  await page.locator('#mapsource button[data-h="1"]').click();
  await expect(page.locator('#mapmetric button[data-m="score"]')).toBeDisabled();
  await expect(page.locator('#mapmetric button[data-m="frz"]')).toBeDisabled();

  await page.locator('#mapsource button[data-h="0"]').click();
  await expect(page.locator('#mapmetric button[data-m="score"]')).toBeEnabled();
  await expect(page.locator('#mapmetric button[data-m="frz"]')).toBeEnabled();
});

test("de matrix volgt dezelfde bron-toggle als de kaart", async ({ page }) => {
  await mockHistorical(page);
  await page.goto("/index.html#p=bike&d=5&r=10&s=0&t=map");
  await wachtOpKaartdata(page);

  await page.locator('#mapsource button[data-h="1"]').click();
  await page.locator("#tab-matrix").click();
  await expect(page.locator("#source button[aria-pressed=true]")).toHaveText("Historisch");
  await expect(page.locator("#metric button[aria-pressed=true]")).toHaveText("Neerslag");
  await expect(page.locator('#metric button[data-m="score"]')).toBeDisabled();
  await expect(page.locator("#mnote")).toContainText("historisch");
});

test("een gedeelde link met h=1 herstelt de historische weergave", async ({ page }) => {
  await mockHistorical(page);
  await page.goto("/index.html#p=bike&d=5&r=10&s=0&m=sun&h=1&t=map");
  await wachtOpKaartdata(page);
  await expect(page.locator("#mapsource button[aria-pressed=true]")).toHaveText("Historisch");
  await expect(page.locator("#mapmetric button[aria-pressed=true]")).toHaveText("Zon");
});

test("een gedeelde link met h=1&m=score valt terug op neerslag", async ({ page }) => {
  await mockHistorical(page);
  // score bestaat niet historisch — een handmatig samengestelde (of oude) link
  // met die combinatie mag niet op een kapotte weergave uitkomen
  await page.goto("/index.html#p=bike&d=5&r=10&s=0&m=score&h=1&t=map");
  await wachtOpKaartdata(page);
  await expect(page.locator("#mapmetric button[aria-pressed=true]")).toHaveText("Neerslag");
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
    const one = () => ({ daily: {
      time,
      precipitation_sum: time.map(() => 2.5),
      sunshine_duration: time.map(() => 18000),
      temperature_2m_max: time.map(() => 20),
      wind_speed_10m_max: time.map(() => 15)
    } });
    route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify(nLoc > 1 ? [...Array(nLoc)].map(one) : one())
    });
  });

  await page.goto("/index.html#p=bike&d=5&r=10&s=0&h=1&t=map");
  await wachtOpKaartdata(page);

  await expect(page.locator("#mapnote")).toContainText("wordt opgehaald");
  await expect(page.locator("#mapnote")).not.toContainText("wordt opgehaald", { timeout: 5000 });
});

test("mislukt ophalen geeft een duidelijke melding, geen crash", async ({ page }) => {
  const fouten = [];
  page.on("pageerror", e => fouten.push(e.message));

  await withoutHistorical(page);
  await page.goto("/index.html#p=bike&d=5&r=10&s=0&h=1&t=map");
  await wachtOpKaartdata(page);

  await expect(page.locator("#mapnote")).toContainText("niet gelukt", { timeout: 10000 });
  expect(fouten).toEqual([]);
});
