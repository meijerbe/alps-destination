import { test, expect } from "@playwright/test";
import { mockWeather } from "../helpers/openmeteo.mjs";
import { groep } from "../helpers/groep.mjs";
import { mockSupabase, withoutSupabase } from "../helpers/supabase.mjs";

const PACK = "/index.html#p=hike&d=5&r=10&s=0&t=pack";

test.describe("zonder Supabase (alles lokaal)", () => {
  test.beforeEach(async ({ page }) => {
    await mockWeather(page);
    await withoutSupabase(page);
  });

  test("persoonlijke groepen krijgen een vinkje per persoon", async ({ page }) => {
    await page.goto(PACK);
    await page.waitForSelector(".packgroup");
    const rij = page.locator("li.packrow", { hasText: "Regenjas" }).first();

    await expect(rij.locator(".chk")).toHaveCount(2);
    await rij.locator(".chk", { hasText: "A" }).locator("input").check();
    await expect(rij.locator(".it")).toHaveCSS("text-decoration-line", "none");

    await rij.locator(".chk", { hasText: "B" }).locator("input").check();
    await expect(rij.locator(".it")).toHaveCSS("text-decoration-line", "line-through");
  });

  test("vinkjes overleven een herlaadbeurt", async ({ page }) => {
    await page.goto(PACK);
    await page.waitForSelector(".packgroup");
    await groep(page, "Eten & koken").locator("input[type=checkbox]").first().check();
    await expect(page.locator("#packtxt")).toContainText("1 van");

    await page.reload();
    await page.waitForSelector(".packgroup");
    await expect(page.locator("#packtxt")).toContainText("1 van");
  });

  test("de mm-cijfers in de dagbalk zijn ook op een telefoon zichtbaar", async ({ page }) => {
    await page.goto("/index.html#p=bike&d=5&r=10&s=0&t=rank");
    await page.waitForSelector(".row .cell span");
    const cel = page.locator(".row .cell span").first();
    await expect(cel).toBeVisible();
    expect(await cel.evaluate(e => getComputedStyle(e).display)).not.toBe("none");
  });
});

test.describe("met Supabase (gedeeld)", () => {
  test.beforeEach(async ({ page }) => {
    await mockWeather(page);
    await mockSupabase(page);
  });

  test("een tweede klik op hetzelfde item blijft werken", async ({ page }) => {
    // regressie: de upsert stuurde ooit de identity-kolom `id` mee zodra de rij
    // één keer gelezen was, wat Postgres afwijst met 428C9
    await page.goto(PACK);
    await page.waitForSelector(".packgroup");
    const cb = groep(page, "Eten & koken").locator("input[type=checkbox]").first();

    await cb.check();
    await cb.uncheck();
    await cb.check();

    await expect(page.locator("#toast")).toHaveText("");
    expect(await page.evaluate(() =>
      window.__upserts.flat().every(u => !Object.prototype.hasOwnProperty.call(u, "id")))).toBe(true);
  });

  test("een vinkje wist geen bestaande notitie", async ({ page }) => {
    await page.goto(PACK);
    await page.waitForSelector(".packgroup");
    const cb = groep(page, "Eten & koken").locator("input[type=checkbox]").first();
    const key = await cb.getAttribute("data-key");

    await page.evaluate(k => window.__seed({
      __table: "packing_state", trip: "ab-op-reis", item_key: k, scope: "gedeeld",
      checked: false, comment: "bestaande notitie", id: 99
    }), key);

    await cb.check();
    expect(await page.evaluate(k =>
      window.__tables.packing_state.get("ab-op-reis|" + k + "|gedeeld").comment, key)).toBe("bestaande notitie");
  });

  test("een notitie slaat op tijdens het typen, zonder het veld te verlaten", async ({ page }) => {
    await page.goto(PACK);
    await page.waitForSelector(".packgroup");
    const rij = page.locator("li.packrow", { hasText: "Brander, gasfles" });
    const notitie = rij.locator(".pi-note");
    const key = await notitie.getAttribute("data-key");

    await notitie.click();
    await notitie.pressSequentially("rode gasfles");

    await expect.poll(() => page.evaluate(k =>
      window.__tables.packing_state.get("ab-op-reis|" + k + "|gedeeld")?.comment, key)).toBe("rode gasfles");
  });

  test("een binnenkomende wijziging overschrijft niet wat je aan het typen bent", async ({ page }) => {
    await page.goto(PACK);
    await page.waitForSelector(".packgroup");
    const notitie = page.locator("li.packrow", { hasText: "Pannenset" }).locator(".pi-note");
    const key = await notitie.getAttribute("data-key");

    await notitie.click();
    await notitie.fill("nog aan het typen");
    await page.evaluate(k => window.__fire("packing_state", "UPDATE", {
      trip: "ab-op-reis", item_key: k, scope: "gedeeld", checked: false, comment: "van de ander"
    }), key);

    await expect(notitie).toHaveValue("nog aan het typen");
  });

  test("reset wist alles in één verzoek en laat notities staan", async ({ page }) => {
    page.on("dialog", d => d.accept());
    await page.goto(PACK);
    await page.waitForSelector(".packgroup");

    await groep(page, "Eten & koken").locator("input[type=checkbox]").first().check();
    await groep(page, "Elektronica").locator("input[type=checkbox]").first().check();
    const voor = await page.evaluate(() => window.__upserts.length);

    await page.locator("#packreset").click();
    await expect(page.locator("#packgrid input[type=checkbox]:checked")).toHaveCount(0);
    expect(await page.evaluate(() => window.__upserts.length) - voor).toBe(1);
  });

  test("een RLS-fout legt uit wat je eraan doet", async ({ page }) => {
    await page.goto(PACK);
    await page.waitForSelector(".packgroup");
    await page.evaluate(() => { window.__failNext = { message: "new row violates row-level security policy", code: "42501" }; });

    await groep(page, "Elektronica").locator("input[type=checkbox]").first().check();
    await expect(page.locator("#toast")).toContainText("schema.sql");
  });
});
