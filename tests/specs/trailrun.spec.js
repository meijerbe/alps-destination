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

  test("een geplakte uitslag overleeft een herlaadbeurt", async ({ page }) => {
    await page.goto(RACE);
    await page.waitForSelector("#panel-race");
    await page.locator("#fieldpaste").fill("1 x 3:12:44\n2 y 3.20.01\n3 z 4:05:59");
    await expect(page.locator("#racefield .card").first()).toContainText("3");

    await page.reload();
    await page.waitForSelector("#panel-race");
    await expect(page.locator("#fieldpaste")).toHaveValue("3:12:44\n3:20:01\n4:05:59");
    await expect(page.locator("#racefield")).toContainText("Mediaan");
  });

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

test("de geplakte uitslag wordt gedeeld en houdt alleen de tijden over", async ({ page }) => {
  await page.goto(RACE);
  await page.waitForSelector("#panel-race");

  await page.locator("#fieldpaste").fill(
    "1  Anna Huber  AUT  3:12:44\n2  Lukas Mair  AUT  3.20.01\nrommel zonder tijd\n3  Eva Gruber  GER  4:05:59");
  await expect(page.locator("#racefield .card").first()).toContainText("3");

  // wat er de database in gaat: de tijden, niet de namen
  const rijen = await page.evaluate(() => [...window.__tables.race_results.values()]);
  expect(rijen).toHaveLength(1);
  expect(rijen[0].race).toBe("muz30");
  expect(rijen[0].times).toBe("3:12:44\n3:20:01\n4:05:59");
  expect(rijen[0].times).not.toContain("Anna");

  // en de ander ziet hem binnenkomen zonder te verversen
  await page.locator("#fieldrace").selectOption("muz14");
  await page.evaluate(() => window.__fire("race_results", "INSERT", {
    id: 7, trip: "ab-op-reis", race: "muz14", jaar: 2025,
    times: "1:31:02\n1:44:19\n2:02:55", updated_by: "B", updated_at: "2026-09-01T10:00:00.000Z"
  }));
  await expect(page.locator("#racefield")).toContainText("Geplakt door B");
  await expect(page.locator("#racefield .card").first()).toContainText("3");
});

test("de link wijst naar de uitslag van de gekozen wedstrijd en editie", async ({ page }) => {
  await page.goto(RACE);
  await page.waitForSelector("#panel-race");

  const link = page.locator("#fieldlinktext .uitslaglink");
  await expect(link).toHaveAttribute("href", /mayrhofen-ultraks-zillertal-2025-muz30$/);

  await page.locator("#fieldrace").selectOption("rk50");
  await page.locator("#fieldyear").selectOption("2024");
  await expect(link).toHaveAttribute("href", /mayrhofen-ultraks-zillertal-2024-rk50$/);
});

test("elke wedstrijd houdt zijn eigen uitslag", async ({ page }) => {
  await page.goto(RACE);
  await page.waitForSelector("#panel-race");
  await page.locator("#fieldpaste").fill("1 x 3:12:44\n2 y 3:20:01\n3 z 4:05:59");
  await expect(page.locator("#racefield .card").first()).toContainText("3");

  await page.locator("#fieldrace").selectOption("muz14");
  await expect(page.locator("#fieldpaste")).toHaveValue("");
  await expect(page.locator("#racefield .empty")).toBeVisible();

  await page.locator("#fieldrace").selectOption("muz30");
  await expect(page.locator("#fieldpaste")).toHaveValue("3:12:44\n3:20:01\n4:05:59");
});

// De pagina draait in de bezoekers eigen browser, dus reikwijdte is geen
// probleem — de knop mag echt fetch() proberen. Wat wél in de weg zit is
// CORS, en dat weten we pas als de bron daadwerkelijk antwoordt. Deze tests
// nemen de rol van "de bron" over met page.route, zodat zowel het gelukte
// pad als de terugval op plakken zonder een echt netwerk getest worden.
test.describe("automatisch ophalen", () => {
  const URL1 = "https://de.ratemytrail.com/results/mayrhofen-ultraks-zillertal-2025-muz30";

  test("lukt het, dan vult de knop de uitslag automatisch in en deelt hem", async ({ page }) => {
    await page.route(URL1, route => route.fulfill({
      status: 200, contentType: "text/html",
      body: "<table><tr><td>1</td><td>Anna Huber</td><td>3:12:44</td></tr>"
          + "<tr><td>2</td><td>Lukas Mair</td><td>3:20:01</td></tr></table>"
    }));
    await page.route(URL1 + "/2", route => route.fulfill({ status: 404, body: "" }));

    await page.goto(RACE);
    await page.waitForSelector("#panel-race");
    await page.locator("#fieldfetch").click();

    await expect(page.locator("#toast")).toContainText("2 tijden");
    await expect(page.locator("#fieldpaste")).toHaveValue("3:12:44\n3:20:01");
    await expect(page.locator("#racefield .card").first()).toContainText("2");
    await expect(page.locator("#fieldfetch")).toBeEnabled();

    // gedeeld, net als een handmatige plak
    const rijen = await page.evaluate(() => [...window.__tables.race_results.values()]);
    expect(rijen).toHaveLength(1);
    expect(rijen[0].times).toBe("3:12:44\n3:20:01");
  });

  test("bladert door naar een volgende pagina als die bestaat", async ({ page }) => {
    await page.route(URL1, route => route.fulfill({
      status: 200, contentType: "text/html", body: "1 Anna 3:12:44\n2 Piet 3:20:01"
    }));
    await page.route(URL1 + "/2", route => route.fulfill({
      status: 200, contentType: "text/html", body: "3 Eva 4:05:59"
    }));
    await page.route(URL1 + "/3", route => route.fulfill({ status: 404, body: "" }));

    await page.goto(RACE);
    await page.waitForSelector("#panel-race");
    await page.locator("#fieldfetch").click();

    await expect(page.locator("#toast")).toContainText("3 tijden");
    await expect(page.locator("#toast")).toContainText("2 pagina's");
    await expect(page.locator("#racefield .card").first()).toContainText("3");
  });

  test("lukt het niet (CORS-achtige blokkade), dan blijft plakken gewoon werken", async ({ page }) => {
    await page.route(URL1, route => route.abort("failed"));

    await page.goto(RACE);
    await page.waitForSelector("#panel-race");
    await page.locator("#fieldfetch").click();

    await expect(page.locator("#toast")).toContainText("Automatisch ophalen lukt niet");
    await expect(page.locator("#toast")).toContainText("CORS");
    await expect(page.locator("#fieldpaste")).toHaveValue("");
    await expect(page.locator("#fieldfetch")).toBeEnabled();
    await expect(page.locator("#fieldfetch")).toHaveText("Probeer automatisch op te halen");

    // en de weg die altijd werkt, werkt nog steeds
    await page.locator("#fieldpaste").fill("1 x 3:12:44");
    await expect(page.locator("#racefield .card").first()).toContainText("1");
  });

  test("een pagina zonder tijden telt niet als gelukt", async ({ page }) => {
    await page.route(URL1, route => route.fulfill({
      status: 200, contentType: "text/html", body: "<html><body>geen resultaten</body></html>"
    }));

    await page.goto(RACE);
    await page.waitForSelector("#panel-race");
    await page.locator("#fieldfetch").click();

    await expect(page.locator("#toast")).toContainText("Automatisch ophalen lukt niet");
    await expect(page.locator("#fieldpaste")).toHaveValue("");
  });
});
