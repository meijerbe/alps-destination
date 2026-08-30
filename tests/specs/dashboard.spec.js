import { test, expect } from "@playwright/test";
import { mockWeather } from "../helpers/openmeteo.mjs";
import { withoutSupabase } from "../helpers/supabase.mjs";

test.beforeEach(async ({ page }) => {
  await mockWeather(page);
  await withoutSupabase(page);
});

test("kaart tekent alle 32 regio's met labels en de basismarkering", async ({ page }) => {
  await page.goto("/index.html#p=bike&d=5&r=10&s=0&t=map");
  await page.waitForSelector(".mapwrap svg rect.c", { state: "attached" });

  const regios = await page.evaluate(() =>
    new Set([...document.querySelectorAll(".mapwrap svg rect.c")].map(r => r.dataset.r)).size);
  expect(regios).toBe(32);
  await expect(page.locator(".mapwrap svg text.lb").first()).toBeAttached();
  await expect(page.locator(".mapwrap svg .base text")).toHaveText("MAYRHOFEN");
});

test("de vier kerncijfers en alle weertabbladen vullen zich", async ({ page }) => {
  await page.goto("/index.html#p=bike&d=5&r=10&s=0&t=map");
  await page.waitForSelector(".mapwrap svg rect.c", { state: "attached" });
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
  await page.waitForSelector(".mapwrap svg rect.c", { state: "attached" });

  const gemiddeld = await page.locator("#mapsvg").innerHTML();
  await page.locator("#daynext").click();

  await expect(page.locator("#daylabel")).toContainText("dag 1 van 5");
  expect(await page.locator("#mapsvg").innerHTML()).not.toBe(gemiddeld);
  expect(page.url()).toContain("k=0");
});

test("een gedeelde link herstelt de hele weergave", async ({ page }) => {
  await page.goto("/index.html#p=hike&d=7&r=6&s=2&m=sun&k=1&g=Dolomieten&t=map");
  await page.waitForSelector(".mapwrap svg rect.c", { state: "attached" });

  await expect(page.locator("#selcard h3")).toHaveText("Dolomieten");
  await expect(page.locator("#profile button[aria-pressed=true]")).toHaveText("Hiken");
  await expect(page.locator("#mapmetric button[aria-pressed=true]")).toHaveText("Zon");
  await expect(page.locator("#daysval")).toHaveText("7 dagen");
  await expect(page.locator(".selring")).toHaveCount(1);
});

test("de drie hoofdonderdelen wisselen en onthouden waar je was", async ({ page }) => {
  await page.goto("/index.html#p=bike&d=5&r=10&s=0&t=map");
  await page.waitForSelector(".mapwrap svg rect.c", { state: "attached" });

  await page.locator("#tab-matrix").click();
  await page.locator("#top-shop").click();
  await expect(page.locator("#panel-shop")).toBeVisible();
  await expect(page.locator("#kpis")).toBeHidden();
  await expect(page.locator("#subnav")).toBeHidden();

  await page.locator("#top-dash").click();
  await expect(page.locator("#panel-matrix")).toBeVisible();  // onthouden
});

test("geen console-fouten bij een normale sessie", async ({ page }) => {
  const fouten = [];
  page.on("pageerror", e => fouten.push(e.message));
  page.on("console", m => { if (m.type() === "error" && !/cdn\.jsdelivr|Failed to load resource/.test(m.text())) fouten.push(m.text()); });

  await page.goto("/index.html#p=bike&d=5&r=10&s=0&t=map");
  await page.waitForSelector(".mapwrap svg rect.c", { state: "attached" });
  for (const t of ["tab-rank", "tab-matrix", "tab-data"]) await page.locator("#" + t).click();
  await page.locator("#top-pack").click();
  await page.locator("#top-shop").click();

  expect(fouten).toEqual([]);
});
