import { test, expect } from "@playwright/test";
import { mockWeather } from "../helpers/openmeteo.mjs";
import { groep } from "../helpers/groep.mjs";
import { mockSupabase } from "../helpers/supabase.mjs";

const PACK = "/index.html#p=hike&d=5&r=10&s=0&t=pack";

test.beforeEach(async ({ page }) => {
  await mockWeather(page);
  await mockSupabase(page);
});

test("een eigen item verschijnt één keer, niet dubbel", async ({ page }) => {
  // regressie: de realtime-echo van je eigen insert kwam terug vóór de eigen
  // await verderging, waardoor het item twee keer in de lijst belandde
  await page.goto(PACK);
  await page.waitForSelector(".packgroup");
  const g = groep(page, "Eten & koken");

  await g.locator(".packaddinput").fill("Extra koffiefilters");
  await g.locator(".packadd button[type=submit]").click();

  await expect(g.locator("li.packrow", { hasText: "Extra koffiefilters" })).toHaveCount(1);
});

test("een eigen item werkt als elk ander item: vinkje, notitie, verwijderen", async ({ page }) => {
  await page.goto(PACK);
  await page.waitForSelector(".packgroup");
  const g = groep(page, "Eten & koken");

  await g.locator(".packaddinput").fill("Extra koffiefilters");
  await g.locator(".packadd button[type=submit]").click();
  const rij = g.locator("li.packrow", { hasText: "Extra koffiefilters" });

  await rij.locator("input[type=checkbox]").check();
  expect(await page.evaluate(() =>
    [...window.__tables.packing_state.values()].some(r => r.item_key.includes("koffiefilters") && r.checked))).toBe(true);

  await rij.locator(".itemdel").click();
  await expect(g.locator("li.packrow", { hasText: "Extra koffiefilters" })).toHaveCount(0);
  await expect(page.locator("#toast")).toContainText("verwijderd");
});

test("een dubbele naam wordt geweigerd", async ({ page }) => {
  await page.goto(PACK);
  await page.waitForSelector(".packgroup");
  const g = groep(page, "Eten & koken");

  await g.locator(".packaddinput").fill("Brander, gasfles, aansteker");   // bestaat ingebouwd
  await g.locator(".packadd button[type=submit]").click();

  await expect(page.locator("#toast")).toContainText("Staat er al bij");
  expect(await page.evaluate(() => window.__tables.packing_custom_items?.size ?? 0)).toBe(0);
});

test("in een persoonlijke groep krijgt een eigen item ook A en B", async ({ page }) => {
  await page.goto(PACK);
  await page.waitForSelector(".packgroup");
  const kleding = groep(page, "Kleding");

  await kleding.locator(".packaddinput").fill("Extra sokken");
  await kleding.locator(".packadd button[type=submit]").click();

  await expect(kleding.locator("li.packrow", { hasText: "Extra sokken" }).locator(".chk")).toHaveCount(2);
});

test("een eigen item van de ander verschijnt zonder herladen", async ({ page }) => {
  await page.goto(PACK);
  await page.waitForSelector(".packgroup");

  await page.evaluate(() => window.__fire("packing_custom_items", "INSERT", {
    id: 99, trip: "ab-op-reis", group_name: "EHBO & klein",
    label: "Pleisters extra groot", personal: false, created_by: "B"
  }));

  await expect(page.locator("li.packrow", { hasText: "Pleisters extra groot" })).toHaveCount(1);
});

test("het kruisje is ruim genoeg om te raken", async ({ page }) => {
  // het knopje oogt 22px maar heeft een onzichtbare marge, want het verwijdert
  // meteen en zonder undo — op een telefoon moet dat te raken zijn
  await page.goto(PACK);
  await page.waitForSelector(".packgroup");
  const g = groep(page, "Eten & koken");
  await g.locator(".packaddinput").fill("Testitem");
  await g.locator(".packadd button[type=submit]").click();

  const knop = g.locator("li.packrow", { hasText: "Testitem" }).locator(".itemdel");
  const box = await knop.boundingBox();
  await page.mouse.click(box.x - 8, box.y + box.height / 2);      // net ernaast

  await expect(g.locator("li.packrow", { hasText: "Testitem" })).toHaveCount(0);
});
