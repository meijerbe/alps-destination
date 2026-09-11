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
  // De service worker gaat vóór page.route zitten en zou de modules uit zijn
  // eigen voorraad serveren — dan komen de stubs hieronder er niet meer aan te
  // pas. Standaard dus uit; de test die er juist over gaat zet hem weer aan.
  await page.route("**/sw.js", r => r.abort());
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

// Eén GPX van de hele tocht, zoals je 'm uit komoot exporteert: vier tracks
// achter elkaar. De hoeken zijn niet echt — het gaat erom dat de pagina er de
// juiste dag uit knipt en er daarna mee rekent in plaats van met haar eigen lijn.
function heleTochtGpx() {
  const dagen = [
    [[46.6733, 8.8568, 1329], [46.6620, 8.8890, 1600], [46.6405, 8.9138, 2524]],
    [[46.6405, 8.9138, 2524], [46.6500, 8.9850, 1875], [46.5942, 9.0050, 2171]],
    [[46.5942, 9.0050, 2171], [46.6125, 8.9606, 2355], [46.6078, 8.9403, 2205]],
    [[46.6078, 8.9403, 2205], [46.5975, 8.9270, 1890]]
  ];
  const trk = d => `<trk><trkseg>${d.map(([lat, lon, ele]) =>
    `<trkpt lat="${lat}" lon="${lon}"><ele>${ele}</ele></trkpt>`).join("")}</trkseg></trk>`;
  return `<?xml version="1.0"?><gpx version="1.1" creator="test"
    xmlns="http://www.topografix.com/GPX/1/1">${dagen.map(trk).join("")}</gpx>`;
}

test("één GPX van de hele tocht wordt per dag opgeknipt", async ({ page }) => {
  // de pagina vraagt om TOUR.gpx zodra die is ingevuld; hier zetten we 'm aan
  // en serveren het bestand zelf
  await page.route("**/js/tour-data.js", async r => {
    const bron = await r.fetch();
    const js = (await bron.text()).replace("gpx: null,", 'gpx: "routes/heel.gpx",');
    await r.fulfill({ status: 200, contentType: "text/javascript", body: js });
  });
  await page.route("**/routes/heel.gpx", r =>
    r.fulfill({ status: 200, contentType: "application/gpx+xml", body: heleTochtGpx() }));

  await page.goto(TOCHT);
  await page.waitForSelector(".stage");

  // dag 2 komt nu uit het bestand: dat zegt "de track meet", niet "deze lijn meet"
  await expect(page.locator("#stage-d2 .statsrc")).toContainText("De track meet");
  await expect(page.locator("#stage-d2 .statsrc")).not.toContainText("snijdt de bochten af");
  await expect(page.locator(".stage")).toHaveCount(4);
  await expect(page.locator("#map path.leaflet-interactive")).toHaveCount(8);
});

// Een échte komoot-export (fixtures/komoot-voorbeeld.gpx): één doorlopende
// track van 1433 punten, Medelserhütte → Motterascio → Capanna Adula, met
// komoots eigen waypoints erin ("Motterascio Hut", niet "Capanna Motterascio
// CAS"). Hij dekt onze dag 2 en verder niet: dag 1, 3 en 4 horen dus gewoon
// hun eigen getrokken lijn te houden.
test("een echte komoot-export levert de dag die erin zit, en laat de rest met rust", async ({ page }) => {
  await page.route("**/js/tour-data.js", async r => {
    const bron = await r.fetch();
    const js = (await bron.text()).replace("gpx: null,", 'gpx: "routes/voorbeeld.gpx",');
    await r.fulfill({ status: 200, contentType: "text/javascript", body: js });
  });
  await page.route("**/routes/voorbeeld.gpx", r =>
    r.fulfill({ status: 200, contentType: "application/gpx+xml", path: "fixtures/komoot-voorbeeld.gpx" }));

  await page.goto(TOCHT);
  await page.waitForSelector(".stage");

  // dag 2 komt uit de track — en die is 18,2 km, niet de 17,6 km die je
  // overhoudt als je op onze eigen hutcoördinaten knipt in plaats van op de
  // gelijknamige waypoints uit het bestand
  await expect(page.locator("#stage-d2 .statsrc")).toContainText("De track meet 18,2 km");
  // de track zakt in Val Sumvitg tot 1387 m — dat hoort in het profiel te staan
  await expect(page.locator("#stage-d2 .profile")).toHaveAttribute("aria-label", /van 138\d tot 249\d meter/);

  for (const id of ["d1", "d3", "d4"]) {
    await expect(page.locator(`#stage-${id} .statsrc`)).toContainText("Deze lijn meet");
  }
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

test("offline meenemen: de strook tegels langs de route, niet de halve Alpen", async ({ page }) => {
  await page.unroute("**/sw.js");          // hier willen we de worker juist wél
  await page.goto(TOCHT);
  await page.waitForSelector(".stage");

  // het blok staat er en meldt wat er opgeslagen staat
  await expect(page.locator("#offlinebox")).toBeVisible();
  await expect(page.locator("#offlinestand")).toContainText(/opgeslagen|internet/i);

  // de tegelwiskunde: een strook langs de route, en fors minder dan het
  // omhullende vierkant van dezelfde route
  const som = await page.evaluate(async () => {
    const { tegelsLangs, tegelVan, tegelBreedte } = await import("/js/tiles.js");
    const { ETAPPES } = await import("/js/tour-data.js");
    const { bouwRoute } = await import("/js/route-build.js");
    const punten = ETAPPES.flatMap(e => bouwRoute(e.punten).points);
    const strook = tegelsLangs(punten, [12, 13, 14, 15], 1);

    const bij = z => strook.filter(t => t.z === z);
    const vierkant = z => {
      const hoeken = punten.map(p => tegelVan(p.lon, p.lat, z));
      const xs = hoeken.map(t => t.x), ys = hoeken.map(t => t.y);
      return (Math.max(...xs) - Math.min(...xs) + 1) * (Math.max(...ys) - Math.min(...ys) + 1);
    };
    return { totaal: strook.length, strook15: bij(15).length, vak15: vierkant(15), breedte15: tegelBreedte(15) };
  });

  expect(som.totaal).toBeGreaterThan(50);
  expect(som.totaal).toBeLessThan(1500);          // blijft een redelijke download
  expect(som.strook15).toBeLessThan(som.vak15);   // de strook is zuiniger dan het vak
  expect(som.breedte15).toBeGreaterThan(700);     // ±840 m per tegel op deze breedtegraad
  expect(som.breedte15).toBeLessThan(1000);
});

test("waar ben ik: hoe ver ben je, en wat ligt er nog voor je", async ({ page, context }) => {
  await context.grantPermissions(["geolocation"]);
  // Alp Sura, halverwege de klim van dag 1 (die dag staat vanzelf open:
  // de tocht is nog niet begonnen)
  await context.setGeolocation({ latitude: 46.6520, longitude: 8.9010 });

  await page.goto(TOCHT);
  await page.waitForSelector(".stage");
  await page.locator("#locate").click();

  await expect(page.locator("#livestand")).toContainText(/Km \d/);
  await expect(page.locator("#livestand")).toContainText("klimmen");
  await expect(page.locator("#livestand")).toContainText("volgende:");
  await expect(page.locator("#locate")).toHaveText("Volgen uit");
  await expect(page.locator("#map .leaflet-overlay-pane path")).toHaveCount(10);  // 8 lijnstukken + de ring en de stip van je positie

  // een eind van de route af hoort dat erbij te staan
  await context.setGeolocation({ latitude: 46.6620, longitude: 8.9300 });
  await expect(page.locator("#livestand")).toContainText("van de lijn van vandaag af");

  // en uit is uit
  await page.locator("#locate").click();
  await expect(page.locator("#locate")).toHaveText("Waar ben ik");
  await expect(page.locator("#livestand")).toHaveText("");
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
