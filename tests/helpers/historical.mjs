// Nagebouwde archive-api.open-meteo.com — het klimatologisch gemiddelde
// achter de bron-toggle "Historisch". Vaste, verzonnen data per veld, per
// regio-index en per dag-in-het-venster, zodat een test het verwachte
// gemiddelde zelf kan uitrekenen zonder de mock te hoeven lezen. Dezelfde
// vier velden als historical.js opvraagt (zie FIELDS daar).
export function histRainFor(regionIndex, dayIndex) {
  return +(((regionIndex * 3 + dayIndex * 7) % 11) * 0.6).toFixed(1);
}
export function histSunFor(regionIndex, dayIndex) {
  return 3600 * (3 + (dayIndex + regionIndex) % 9);   // seconden, zoals de API
}
export function histTmaxFor(regionIndex, dayIndex) {
  return 10 + (dayIndex * 3 + regionIndex * 5) % 20;
}
export function histWindFor(regionIndex, dayIndex) {
  return 4 + (dayIndex * 4 + regionIndex * 6) % 34;
}

export async function mockHistorical(page) {
  await page.route("https://archive-api.open-meteo.com/**", route => {
    const url = new URL(route.request().url());
    const nLoc = decodeURIComponent(url.searchParams.get("latitude")).split(",").length;
    const start = new Date(url.searchParams.get("start_date") + "T00:00:00Z");
    const end = new Date(url.searchParams.get("end_date") + "T00:00:00Z");
    const nDays = Math.round((end - start) / 86400000) + 1;
    const time = [...Array(nDays)].map((_, k) => {
      const d = new Date(start); d.setUTCDate(d.getUTCDate() + k);
      return d.toISOString().slice(0, 10);
    });

    const one = i => ({
      latitude: 46.6 + i * 0.01, longitude: 10.7 + i * 0.02, elevation: 900 + i * 37,
      generationtime_ms: 0.3, utc_offset_seconds: 7200, timezone_abbreviation: "CEST",
      daily: {
        time,
        precipitation_sum: time.map((_, k) => histRainFor(i, k)),
        sunshine_duration: time.map((_, k) => histSunFor(i, k)),
        temperature_2m_max: time.map((_, k) => histTmaxFor(i, k)),
        wind_speed_10m_max: time.map((_, k) => histWindFor(i, k))
      }
    });

    route.fulfill({
      status: 200, contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify(nLoc > 1 ? [...Array(nLoc)].map((_, i) => one(i)) : one(0))
    });
  });
}

/** Laat elk archiefjaar mislukken — voor de foutmelding als geen enkel jaar lukt. */
export async function withoutHistorical(page) {
  await page.route("https://archive-api.open-meteo.com/**", r => r.abort());
}
