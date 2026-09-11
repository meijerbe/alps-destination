import { test, expect } from "@playwright/test";

const TOCHT = "/huttentocht.html";

// De kaarttegels komen van swisstopo/OpenTopoMap; in de test willen we geen
// internet. Alles wat een tegel is, wordt een doorzichtige pixel — de kaart
// zelf (Leaflet, de lijnen, de spelden) doet het daar gewoon op.
const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64"
);

test.beforeEach(async ({ page }) => {
  await page.route(/geo\.admin\.ch|opentopomap\.org/, r =>
    r.fulfill({ status: 200, contentType: "image/png", body: PIXEL }));
});

test("de vier dagen staan er, met kaart, profiel en cijfers", async ({ page }) => {
  await page.goto(TOCHT);
  await page.waitForSelector(".stage");

  await expect(page.locator(".stage")).toHaveCount(4);
  await expect(page.locator("#tourstatus")).toBeHidden();

  // de kaart is opgebouwd: Leaflet-paneel, vier routelijnen, hutspelden
  await expect(page.locator("#map.leaflet-container")).toBeVisible();
  await expect(page.locator("#map path.leaflet-interactive")).toHaveCount(8);   // lijn + witte onderlaag
  await expect(page.locator("#map .pin-hut").first()).toBeVisible();

  // elke dag heeft een profiel en vier cijfers
  for (const id of ["d1", "d2", "d3", "d4"]) {
    await expect(page.locator(`#stage-${id} .profile`)).toBeVisible();
    await expect(page.locator(`#stage-${id} .sstat`)).toHaveCount(4);
  }

  // de planning uit komoot staat op dag 2, de eigen meting eronder
  const d2 = page.locator("#stage-d2");
  await expect(d2).toContainText("18,5 km");
  await expect(d2).toContainText("8 u 18");
  await expect(d2.locator(".statsrc")).toContainText("Deze lijn meet");
});

test("een dag kiezen licht die dag uit en zet de kaart erop", async ({ page }) => {
  await page.goto(TOCHT);
  await page.waitForSelector(".stage");

  await page.locator("#daypick [data-dag='2']").click();
  await expect(page.locator("#daypick [data-dag='2']")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#stage-d3")).toHaveClass(/(^| )on( |$)/);
  await expect(page.locator("#stage-d1")).not.toHaveClass(/(^| )on( |$)/);
  await expect(page.locator("#mapnow")).toContainText("Capanna Motterascio");

  // "Alles" zet ze allemaal weer aan
  await page.locator("#daypick [data-dag='-1']").click();
  await expect(page.locator(".stage.on")).toHaveCount(4);
});

test("de kaart is gestapeld: OpenTopoMap eronder, swisstopo erbovenop", async ({ page }) => {
  await page.goto(TOCHT);
  await page.waitForSelector(".stage");

  const onder = page.locator("#map .leaflet-pane.leaflet-onderlaag-pane img").first();
  const boven = page.locator("#map .leaflet-tile-pane img").first();
  await expect(onder).toHaveAttribute("src", /opentopomap\.org/);
  await expect(boven).toHaveAttribute("src", /geo\.admin\.ch/);

  // de schuif maakt de bovenlaag doorzichtig, zodat de onderlaag doorkomt
  const bovenlaag = page.locator("#map .leaflet-tile-pane .leaflet-layer").first();
  await expect(bovenlaag).toHaveCSS("opacity", "1");
  await page.locator("#laagmix").fill("40");
  await expect(bovenlaag).toHaveCSS("opacity", "0.4");
});

test("de reserveringsnummers van de drie hutten staan op de pagina", async ({ page }) => {
  await page.goto(TOCHT);
  await page.waitForSelector(".hutcard");

  await expect(page.locator(".hutcard")).toHaveCount(3);
  for (const nr of ["6640519", "6640678", "6640829"]) {
    await expect(page.locator("#hutlist")).toContainText(nr);
  }
  await expect(page.locator("#hutlist")).toContainText("Medelserhütte SAC");
});

test("elke dag is als GPX te downloaden, met hoogte en tussenpunten erin", async ({ page }) => {
  await page.goto(TOCHT);
  await page.waitForSelector(".stage");

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.locator("#stage-d3 [data-gpx]").click()
  ]);
  expect(download.suggestedFilename()).toBe("dag3-motterascio-scaletta.gpx");

  const stream = await download.createReadStream();
  const gpx = (await stream.toArray()).map(String).join("");
  expect(gpx).toContain("<gpx version=\"1.1\"");
  expect(gpx).toContain("Passo della Greina");
  expect(gpx.match(/<trkpt /g).length).toBeGreaterThan(20);
  expect(gpx).toContain("<ele>2355</ele>");
});

test("het hoogteprofiel aanwijzen geeft kilometer en hoogte", async ({ page }) => {
  await page.goto(TOCHT);
  await page.waitForSelector("#stage-d1 .profile");

  const svg = page.locator("#stage-d1 .profile");
  await svg.scrollIntoViewIfNeeded();
  const box = await svg.boundingBox();
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height / 2);

  await expect(page.locator("#phint-d1")).toContainText("km");
  await expect(page.locator("#phint-d1")).toContainText("m");
});

test("de pagina laadt zonder fouten in de console", async ({ page }) => {
  const fouten = [];
  // de webfonts komen van Google; in een testomgeving zonder internet is dat
  // geen paginafout, dus die ene melding filteren we eruit
  page.on("console", m => {
    if (m.type() === "error" && !/Failed to load resource/.test(m.text())) fouten.push(m.text());
  });
  page.on("pageerror", e => fouten.push(e.message));

  await page.goto(TOCHT);
  await page.waitForSelector(".stage");
  expect(fouten).toEqual([]);
});
