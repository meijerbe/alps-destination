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

  // dag 2 komt uit de komoot-planning: gemeten afstand, komoots looptijd
  const d2 = page.locator("#stage-d2");
  await expect(d2).toContainText("18,2 km");
  await expect(d2).toContainText("8 u 19");
  await expect(d2.locator(".statsrc")).toContainText("uit de track");
});

// De echte tocht: routes/greina-2026.gpx, één doorlopende komoot-export van
// Curaglia tot Campo (Blenio), met de drie hutten als <wpt>. Die cijfers zijn
// het ijkpunt — wijzigt het bestand, dan hoort deze test te vallen.
test("de tocht komt uit één komoot-export en valt in vier dagen uiteen", async ({ page }) => {
  await page.goto(TOCHT);
  await page.waitForSelector(".stage");

  const verwacht = [
    ["d1", "8,2 km", "3 u 32", "1.142 m", "0 m"],
    ["d2", "18,2 km", "8 u 19", "1.011 m", "1.249 m"],
    ["d3", "7,4 km", "2 u 52", "217 m", "164 m"],
    ["d4", "9,4 km", "3 u 23", "8 m", "1.012 m"]
  ];
  for (const [id, km, tijd, stijgen, dalen] of verwacht) {
    const kaart = page.locator(`#stage-${id}`);
    await expect(kaart.locator(".sstat").nth(0)).toContainText(km);
    await expect(kaart.locator(".sstat").nth(1)).toContainText(tijd);
    await expect(kaart.locator(".sstat").nth(2)).toContainText(stijgen);
    await expect(kaart.locator(".sstat").nth(3)).toContainText(dalen);
    await expect(kaart.locator(".statsrc")).toContainText("uit de track");
  }

  // dag 2 duikt echt Val Sumvitg in, en dag 4 loopt uit tot in het dal
  await expect(page.locator("#stage-d2 .profile")).toHaveAttribute("aria-label", /van 1387 tot 2496/);
  await expect(page.locator("#stage-d4 .profile")).toHaveAttribute("aria-label", /van 1208 tot 2225/);
  await expect(page.locator("#stage-d4")).toContainText("Campo (Blenio)");
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
  expect(gpx.match(/<trkpt /g).length).toBeGreaterThan(20);
  // het tussenpunt zelf, met de hoogte die van de track komt
  expect(gpx).toMatch(/<wpt[^>]*>\s*<ele>2350<\/ele>\s*<name>Passo della Greina<\/name>/);
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
    const js = (await bron.text()).replace(/gpx: "routes\/[^"]+",/, 'gpx: "routes/heel.gpx",');
    await r.fulfill({ status: 200, contentType: "text/javascript", body: js });
  });
  await page.route("**/routes/heel.gpx", r =>
    r.fulfill({ status: 200, contentType: "application/gpx+xml", body: heleTochtGpx() }));

  await page.goto(TOCHT);
  await page.waitForSelector(".stage");

  // dag 2 komt nu uit het bestand: geen getrokken lijn meer
  await expect(page.locator("#stage-d2 .statsrc")).toContainText("uit de track");
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
    const js = (await bron.text()).replace(/gpx: "routes\/[^"]+",/, 'gpx: "routes/voorbeeld.gpx",');
    await r.fulfill({ status: 200, contentType: "text/javascript", body: js });
  });
  await page.route("**/routes/voorbeeld.gpx", r =>
    r.fulfill({ status: 200, contentType: "application/gpx+xml", path: "fixtures/komoot-voorbeeld.gpx" }));

  await page.goto(TOCHT);
  await page.waitForSelector(".stage");

  // dag 2 komt uit de track — en die is 18,2 km, niet de 17,6 km die je
  // overhoudt als je op onze eigen hutcoördinaten knipt in plaats van op de
  // gelijknamige waypoints uit het bestand
  await expect(page.locator("#stage-d2 .sstat").first()).toContainText("18,2 km");
  await expect(page.locator("#stage-d2 .statsrc")).toContainText("uit de track");
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
  // Alp Sura, halverwege de klim van dag 1 — op de route zelf (die dag staat
  // vanzelf open: de tocht is nog niet begonnen)
  await context.setGeolocation({ latitude: 46.64889, longitude: 8.88953 });

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

// Open-Meteo geeft bij meerdere locaties een array terug, één blok per plek.
// Hier vier plekken × de vier dagen van de tocht, met opzet één dag waarop het
// vriespunt onder het hoogste punt van die etappe zakt.
function weerAntwoord() {
  const dagen = ["2026-09-11", "2026-09-12", "2026-09-13", "2026-09-14", "2026-09-15"];
  const uren = dagen.flatMap(d => Array.from({ length: 24 }, (_, h) =>
    `${d}T${String(h).padStart(2, "0")}:00`));
  const plek = (frz) => ({
    daily: {
      time: dagen,
      weather_code: [3, 61, 95, 71, 0],
      temperature_2m_max: [12, 9, 7, 2, 11],
      temperature_2m_min: [4, 2, 1, -3, 3],
      precipitation_sum: [0, 4.2, 11, 6, 0],
      precipitation_probability_max: [10, 70, 90, 80, 5],
      wind_speed_10m_max: [12, 28, 41, 30, 9],
      wind_gusts_10m_max: [20, 47, 72, 55, 15],
      sunrise: dagen.map(d => `${d}T07:01`),
      sunset: dagen.map(d => `${d}T19:47`)
    },
    hourly: { time: uren, freezing_level_height: uren.map((t) => t.startsWith("2026-09-14") ? frz : 3400) }
  });
  return [plek(2000), plek(2000), plek(2000), plek(2000)];
}

test("de verwachting per hut staat op elke dag, met hoogte en vriespunt", async ({ page }) => {
  let gevraagd = null;
  await page.route("**/api.open-meteo.com/**", r => {
    gevraagd = r.request().url();
    return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(weerAntwoord()) });
  });

  await page.goto(TOCHT);
  await page.waitForSelector(".stage");

  // hij vraagt het op de hoogte van de hut, niet op rasterhoogte
  await expect.poll(() => gevraagd).toContain("elevation=");
  expect(gevraagd).toContain("2524");
  expect(gevraagd).toContain("freezing_level_height");

  const d2 = page.locator("#weer-d2");
  await expect(d2).toContainText("onweer");
  await expect(d2).toContainText("11,0 mm");
  await expect(d2).toContainText("wind 41–72 km/u");
  await expect(d2).toContainText("licht 07:01–19:47");
  await expect(d2.locator(".wbron")).toContainText("Capanna Motterascio CAS, 2171 m");
  await expect(d2).toContainText("nergens te schuilen");

  // dag 3 (14 sep): vriespunt op 2000 m, en die etappe gaat over de Greinapas
  await expect(page.locator("#weer-d3")).toContainText("Boven 2000 m kan het sneeuwen");

  // en op het hutkaartje de nacht die je daar doorbrengt
  await expect(page.locator("#hutweer-scaletta")).toContainText("Die nacht");
});

test("zonder bereik blijft de laatst opgehaalde verwachting staan", async ({ page }) => {
  await page.route("**/api.open-meteo.com/**", r =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(weerAntwoord()) }));
  await page.goto(TOCHT);
  await expect(page.locator("#weer-d2")).toContainText("onweer");

  // nu valt het netwerk weg: wat er stond hoort te blijven staan, met de
  // ouderdom erbij in plaats van een leeg vak
  await page.unroute("**/api.open-meteo.com/**");
  await page.route("**/api.open-meteo.com/**", r => r.abort());
  await page.reload();
  await page.waitForSelector(".stage");
  await expect(page.locator("#weer-d2")).toContainText("onweer");
  await expect(page.locator("#weer-d2 .wbron")).toContainText("bijgewerkt");
});

test("de service worker serveert de verse pagina, niet die uit zijn voorraad", async ({ page }) => {
  await page.unroute("**/sw.js");                       // hier willen we de worker wél
  await page.route("**/api.open-meteo.com/**", r =>
    r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));

  const eerste = await page.goto(TOCHT);
  await page.waitForSelector(".stage");
  await page.evaluate(() => navigator.serviceWorker.ready);

  // De testserver zet een volgnummer in elk antwoord. Komt de tweede keer
  // hetzelfde nummer terug, dan diende de worker zijn eigen kopie op; een
  // nieuw nummer betekent dat hij netjes naar de server is gegaan.
  const tweede = await page.goto(TOCHT);
  await page.waitForSelector(".stage");
  expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  expect(tweede.headers()["x-vers"]).not.toBe(eerste.headers()["x-vers"]);
});

// Dit is de test die de storing op de echte site zou hebben gevangen. De
// server stuurt /huttentocht.html door naar /huttentocht (cleanUrls, net als
// Vercel). Bewaart de worker dat omgeleide antwoord en geeft hij het later
// terug voor een navigatie, dan weigert de browser het — en dan laadt de
// pagina niet meer, ook niet mét bereik.
test("zonder netwerk laadt de pagina uit de voorraad, via de omgeleide URL", async ({ page, context }) => {
  await page.unroute("**/sw.js");
  await page.route("**/api.open-meteo.com/**", r =>
    r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));

  await page.goto(TOCHT);
  await page.waitForSelector(".stage");
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));

  await context.setOffline(true);
  try {
    await page.goto(TOCHT);
    await expect(page.locator(".stage").first()).toBeVisible();
    await expect(page.locator("#stage-d2")).toContainText("Motterascio");
  } finally {
    await context.setOffline(false);
  }
});

test("?sw=uit zet de offline-voorraad uit, als noodrem", async ({ page }) => {
  await page.unroute("**/sw.js");
  await page.route("**/api.open-meteo.com/**", r =>
    r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));

  await page.goto(TOCHT);
  await page.evaluate(() => navigator.serviceWorker.ready);
  expect(await page.evaluate(() => navigator.serviceWorker.getRegistrations().then(r => r.length)))
    .toBeGreaterThan(0);

  // ?sw=uit schrijft de worker uit en herlaadt naar ?sw=weg; pas op die verse
  // pagina, zonder worker ertussen, gaat de voorraad eraan
  await page.goto(TOCHT + "?sw=uit");
  await page.waitForURL(/sw=weg/);
  await expect(page.locator("#offlinestand")).toContainText("uitgezet");
  expect(await page.evaluate(() => navigator.serviceWorker.getRegistrations().then(r => r.length))).toBe(0);
  expect(await page.evaluate(() => caches.keys().then(k => k.filter(n => n.startsWith("ab-huttentocht-")).length)))
    .toBe(0);
});

test("de pagina laadt zonder fouten in de console", async ({ page }) => {
  await page.route("**/api.open-meteo.com/**", r =>
    r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
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
