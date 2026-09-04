import { test, expect } from "@playwright/test";
import { mockWeather } from "../helpers/openmeteo.mjs";
import { mockSupabase, withoutSupabase } from "../helpers/supabase.mjs";

const RACE = "/index.html#p=bike&d=5&r=10&s=0&t=race";

// Eén loper neerzetten en zijn referentieloop invullen. Het kaartje heeft de
// naam alleen als input-waarde, dus zoeken op tekst werkt hier niet — vandaar
// de index.
async function zetLoper(page, i, {naam, race, dist, gain, tijd, grond, duur, tech}) {
  await page.locator("#raceinput").fill(naam);
  await page.locator("#raceinputrace").selectOption(race);
  await page.locator("#raceform button[type=submit]").click();
  const k = page.locator(".runner").nth(i);
  await expect(k).toBeVisible();
  for (const [veld, waarde] of [["ref_dist", dist], ["ref_gain", gain], ["ref_time", tijd]]) {
    if (waarde == null) continue;
    await k.locator(`[data-f=${veld}]`).fill(String(waarde));
    await k.locator(`[data-f=${veld}]`).blur();
  }
  for (const [veld, waarde] of [["grond", grond], ["duur", duur], ["tech", tech]]) {
    if (waarde) await k.locator(`[data-f=${veld}]`).selectOption(waarde);
  }
  return k;
}

test.beforeEach(async ({ page }) => {
  await mockWeather(page);
  await mockSupabase(page);
});

test("een loper toevoegen levert een schatting, een venster en een kloktijd op", async ({ page }) => {
  await page.goto(RACE);
  await page.waitForSelector("#panel-race");

  const k = await zetLoper(page, 0, {naam:"Berend", race:"muz30", dist:21.1, gain:80, tijd:"1:47", grond:"weg"});
  await expect(k.locator(".rout")).toContainText("verwacht");
  await expect(k.locator(".rout")).toContainText("80% kans tussen");
  await expect(k.locator(".rout")).toContainText("binnen rond");

  await expect(page.locator("#top-race .count")).toHaveText("1");
  await expect(page.locator("#racetable tbody tr")).toHaveCount(1);
  await expect(page.locator("#racetimeline svg")).toBeVisible();
  await expect(page.locator("#racedensity svg")).toBeVisible();
});

test("een langzamere referentietijd geeft een latere finish", async ({ page }) => {
  await page.goto(RACE);
  await page.waitForSelector("#panel-race");
  const k = await zetLoper(page, 0, {naam:"Berend", race:"muz30", dist:21.1, gain:80, tijd:"1:30", grond:"weg"});
  const snel = await k.locator(".rout").textContent();

  await k.locator("[data-f=ref_time]").fill("2:10");
  await k.locator("[data-f=ref_time]").blur();
  const traag = await k.locator(".rout").textContent();

  const uren = t => t.match(/^(\d+):(\d\d)/) && (+RegExp.$1 + +RegExp.$2/60);
  expect(uren(traag.trim())).toBeGreaterThan(uren(snel.trim()));
});

test("hoe verder de referentie van de wedstrijd af ligt, hoe breder het venster", async ({ page }) => {
  await page.goto(RACE);
  await page.waitForSelector("#panel-race");
  // 10 km vlak → RK50 is een enorme uitrekking; MUZ14 als referentie niet
  const ver  = await zetLoper(page, 0, {naam:"Ver",  race:"rk50",  dist:10,   gain:60,  tijd:"0:50", grond:"weg"});
  const dicht = await zetLoper(page, 1, {naam:"Dicht", race:"muz14", dist:14.5, gain:900, tijd:"1:55", grond:"berg"});

  const breedte = async k => {
    const m = (await k.locator(".rout").textContent()).match(/tussen (\d+):(\d\d) en (\d+):(\d\d)/);
    return (+m[3] + +m[4]/60) - (+m[1] + +m[2]/60);
  };
  expect(await breedte(ver)).toBeGreaterThan(await breedte(dicht));
});

test("onderlinge kansen verschijnen pas vanaf twee lopers en tellen op tot 100%", async ({ page }) => {
  await page.goto(RACE);
  await page.waitForSelector("#panel-race");
  await zetLoper(page, 0, {naam:"Berend", race:"muz30", dist:21.1, gain:80, tijd:"1:47", grond:"weg"});
  await expect(page.locator("#racehead .empty")).toBeVisible();

  await zetLoper(page, 1, {naam:"Sanne", race:"rk50", dist:42.2, gain:350, tijd:"3:38", grond:"heuvel"});
  const cellen = page.locator("#racehead td:not(.zelf):not(:first-child)");
  await expect(cellen).toHaveCount(2);
  const a = parseInt((await cellen.nth(0).textContent()), 10);
  const b = parseInt((await cellen.nth(1).textContent()), 10);
  expect(a + b).toBeGreaterThanOrEqual(99);
  expect(a + b).toBeLessThanOrEqual(101);
});

test("een geplakte uitslag geeft spreiding en een plek in het veld", async ({ page }) => {
  await page.goto(RACE);
  await page.waitForSelector("#panel-race");
  await zetLoper(page, 0, {naam:"Berend", race:"muz30", dist:21.1, gain:80, tijd:"1:47", grond:"weg"});

  const regels = ["3:12:44", "4:01:10", "4:37:02", "5:05:55", "6:20:31"]
    .map((t, i) => `${i + 1}  Loper ${i + 1}  AUT  ${t}`).join("\n");
  await page.locator("#fieldpaste").fill(regels);

  await expect(page.locator("#racefield .card").first()).toContainText("5");
  await expect(page.locator("#racefield")).toContainText("Mediaan");
  await expect(page.locator("#racefield .plaats")).toContainText("rond plek");
  await expect(page.locator("#racefield svg")).toBeVisible();
});

test("een aangepaste route rekent door in de schatting", async ({ page }) => {
  await page.goto(RACE);
  await page.waitForSelector("#panel-race");
  const k = await zetLoper(page, 0, {naam:"Berend", race:"muz30", dist:21.1, gain:80, tijd:"1:47", grond:"weg"});
  const voor = await k.locator(".rout").textContent();

  const muz30 = page.locator(".course[data-id=muz30]");
  await muz30.locator("[data-cf=gain]").fill("3500");
  await muz30.locator("[data-cf=gain]").blur();

  await expect(k.locator(".rout")).not.toHaveText(voor);
  await expect(muz30.locator(".clink")).toBeVisible();          // terug naar de folder
  await muz30.locator(".clink").click();
  await expect(muz30.locator("[data-cf=gain]")).toHaveValue("2000");
});

test("verwijderen haalt de loper uit de lijst én uit de grafieken", async ({ page }) => {
  await page.goto(RACE);
  await page.waitForSelector("#panel-race");
  await zetLoper(page, 0, {naam:"Berend", race:"muz30", dist:21.1, gain:80, tijd:"1:47", grond:"weg"});
  await page.locator(".runner .itemdel").click();

  await expect(page.locator(".runner")).toHaveCount(0);
  await expect(page.locator("#racetable tbody tr")).toHaveCount(0);
  await expect(page.locator("#top-race .count")).toHaveText("");
});

test("onzin in het tijdveld wordt geweigerd, niet stilzwijgend geslikt", async ({ page }) => {
  await page.goto(RACE);
  await page.waitForSelector("#panel-race");
  const k = await zetLoper(page, 0, {naam:"Berend", race:"muz30", dist:21.1, gain:80, tijd:"1:47", grond:"weg"});

  await k.locator("[data-f=ref_time]").fill("gisteren");
  await k.locator("[data-f=ref_time]").blur();
  await expect(page.locator("#toast")).toContainText("Tijd als u:mm");
  await expect(k.locator("[data-f=ref_time]")).toHaveValue("1:47");
});

test.describe("zonder Supabase (alles lokaal)", () => {
  test.beforeEach(async ({ page }) => { await withoutSupabase(page); });

  test("lopers en routes overleven een herlaadbeurt", async ({ page }) => {
    await page.goto(RACE);
    await page.waitForSelector("#panel-race");
    await zetLoper(page, 0, {naam:"Berend", race:"muz30", dist:21.1, gain:80, tijd:"1:47", grond:"weg"});

    await page.reload();
    await page.waitForSelector("#panel-race");
    const k = page.locator(".runner").first();
    await expect(k.locator("[data-f=name]")).toHaveValue("Berend");
    await expect(k.locator("[data-f=ref_time]")).toHaveValue("1:47");
    await expect(k.locator(".rout")).toContainText("verwacht");
  });
});

test("een wijziging van de ander komt binnen zonder verversen", async ({ page }) => {
  await page.goto(RACE);
  await page.waitForSelector("#panel-race");
  await zetLoper(page, 0, {naam:"Berend", race:"muz30", dist:21.1, gain:80, tijd:"1:47", grond:"weg"});

  await page.evaluate(() => window.__fire("race_runners", "INSERT", {
    id: 99, trip: "ab-op-reis", name: "Fleur", race: "muz14",
    ref_dist: 10, ref_gain: 60, ref_secs: 3000,
    duur: "gemiddeld", grond: "weg", tech: "gemiddeld", adjust: 0,
    created_at: "2026-01-01T00:00:00.000Z"
  }));
  await expect(page.locator(".runner")).toHaveCount(2);
  await expect(page.locator("#racetable tbody tr")).toHaveCount(2);
});

// regressie: met vier tabbladen paste de bovenste balk niet meer op een
// telefoon, waardoor "Trailrun" half buiten beeld viel en de hele pagina
// horizontaal ging schuiven
test("de bovenbalk past op een telefoon, ook met vier tabbladen", async ({ page, isMobile }) => {
  test.skip(!isMobile, "gaat alleen over de smalle weergave");
  await page.goto(RACE);
  await page.waitForSelector("#panel-race");

  const knop = await page.locator("#top-race").boundingBox();
  const breed = await page.evaluate(() => document.documentElement.clientWidth);
  expect(knop.x + knop.width).toBeLessThanOrEqual(breed);
  expect(await page.evaluate(() => document.body.scrollWidth)).toBeLessThanOrEqual(breed);
});

// regressie: een binnenkomende wijziging tekende de hele lijst opnieuw, ook
// terwijl je zelf in een veld stond te typen — en dan was je invoer weg
test("een wijziging van de ander overschrijft niet wat je aan het typen bent", async ({ page }) => {
  await page.goto(RACE);
  await page.waitForSelector("#panel-race");
  const k = await zetLoper(page, 0, {naam:"Berend", race:"muz30", dist:21.1, gain:80, tijd:"1:47", grond:"weg"});

  await k.locator("[data-f=ref_time]").click();
  await k.locator("[data-f=ref_time]").fill("2:0");          // halverwege het typen
  await page.evaluate(() => window.__fire("race_runners", "INSERT", {
    id: 98, trip: "ab-op-reis", name: "Fleur", race: "muz14",
    ref_dist: 10, ref_gain: 60, ref_secs: 3000,
    duur: "gemiddeld", grond: "weg", tech: "gemiddeld", adjust: 0,
    created_at: "2027-01-01T00:00:00.000Z"
  }));

  await expect(page.locator(".runner")).toHaveCount(2);
  await expect(k.locator("[data-f=ref_time]")).toHaveValue("2:0");
  await expect(k.locator("[data-f=ref_time]")).toBeFocused();
});
