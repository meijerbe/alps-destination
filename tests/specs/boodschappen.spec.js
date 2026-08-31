import { test, expect } from "@playwright/test";
import { mockWeather } from "../helpers/openmeteo.mjs";
import { mockSupabase, withoutSupabase } from "../helpers/supabase.mjs";

const SHOP = "/index.html#p=bike&d=5&r=10&s=0&t=shop";

test.beforeEach(async ({ page }) => {
  await mockWeather(page);
  await mockSupabase(page);
});

test("toevoegen, afvinken en de teller", async ({ page }) => {
  await page.goto(SHOP);
  await page.waitForSelector("#panel-shop");

  for (const p of ["Melk", "Brood"]) {
    await page.locator("#shopinput").fill(p);
    await page.locator("#shopinput").press("Enter");
  }
  await expect(page.locator("#shoplist .shoprow")).toHaveCount(2);
  await expect(page.locator("#shoptxt")).toContainText("0 van 2");

  await page.locator(".shoprow", { hasText: "Melk" }).locator("input[type=checkbox]").check();
  await expect(page.locator("#shoptxt")).toContainText("1 van 2");
  await expect(page.locator("#top-shop .count")).toHaveText("1/2");
  // afgevinkt zakt naar onderen
  await expect(page.locator("#shoplist .shoprow").first().locator(".it")).toHaveText("Brood");
});

test("wis afgevinkte laat de rest staan", async ({ page }) => {
  await page.goto(SHOP);
  await page.waitForSelector("#panel-shop");
  for (const p of ["Melk", "Brood"]) {
    await page.locator("#shopinput").fill(p);
    await page.locator("#shopinput").press("Enter");
  }
  await page.locator(".shoprow", { hasText: "Melk" }).locator("input[type=checkbox]").check();

  await page.locator("#shopclear").click();
  await expect(page.locator("#shoplist .shoprow")).toHaveCount(1);
  await expect(page.locator("#shoplist .shoprow")).toContainText("Brood");
});

test("een boodschap van de ander verschijnt zonder herladen", async ({ page }) => {
  await page.goto(SHOP);
  await page.waitForSelector("#panel-shop");

  await page.evaluate(() => window.__fire("shopping_items", "INSERT",
    { id: 77, trip: "ab-op-reis", label: "Koffie", checked: false, created_by: "A" }));

  await expect(page.locator(".shoprow", { hasText: "Koffie" })).toHaveCount(1);
});

test("lege lijst legt uit wat je moet doen", async ({ page }) => {
  await page.goto(SHOP);
  await page.waitForSelector("#panel-shop");
  await expect(page.locator(".shopempty")).toContainText("typ hierboven");
});

test("zonder Supabase blijft de lijst lokaal werken", async ({ page }) => {
  await withoutSupabase(page);
  await page.goto(SHOP);
  await page.waitForSelector("#panel-shop");

  await page.locator("#shopinput").fill("Kaas");
  await page.locator("#shopinput").press("Enter");
  await expect(page.locator(".shoprow", { hasText: "Kaas" })).toHaveCount(1);

  await page.reload();
  await page.waitForSelector("#panel-shop");
  await expect(page.locator(".shoprow", { hasText: "Kaas" })).toHaveCount(1);
});
