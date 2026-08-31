// Vaste, verzonnen weerdata. De tests mogen nooit van het echte Open-Meteo
// afhangen: dat maakt ze traag, flaky en afhankelijk van het weer van vandaag.
export async function mockWeather(page) {
  // Google Fonts is in de tests alleen maar wachttijd
  await page.route("https://fonts.googleapis.com/**", r => r.abort());
  await page.route("https://fonts.gstatic.com/**", r => r.abort());
  await page.route("https://api.open-meteo.com/**", route => {
    const url = route.request().url();
    const nLoc = decodeURIComponent(url.match(/latitude=([^&]+)/)[1]).split(",").length;
    const dates = [...Array(10)].map((_, k) => new Date(Date.UTC(2026, 7, 30 + k)).toISOString().slice(0, 10));
    const hours = dates.flatMap(d => [...Array(24)].map((_, h) => `${d}T${String(h).padStart(2, "0")}:00`));

    const one = i => url.includes("pressure_msl")
      ? {
          latitude: i ? 46.5 : 47.27, longitude: i ? 11.35 : 11.39, elevation: i ? 262 : 574,
          generationtime_ms: 0.4, timezone_abbreviation: "CEST",
          hourly: { time: hours, pressure_msl: hours.map((_, h) => 1015 + (i === 0 ? 4 : 0) + Math.sin(h / 8)) }
        }
      : {
          latitude: 46.6 + i * 0.01, longitude: 10.7 + i * 0.02, elevation: 900 + i * 37,
          generationtime_ms: 0.7, utc_offset_seconds: 7200, timezone_abbreviation: "CEST",
          daily: {
            time: dates,
            precipitation_sum: dates.map((_, k) => +(((k * 3 + i * 7) % 11) * 0.9).toFixed(1)),
            precipitation_probability_max: dates.map((_, k) => (k * 7 + i * 11) % 100),
            sunshine_duration: dates.map((_, k) => 3600 * (3 + (k + i) % 9)),
            daylight_duration: dates.map(() => 48000),
            temperature_2m_max: dates.map((_, k) => 10 + (k * 3 + i * 5) % 20),
            temperature_2m_min: dates.map((_, k) => 2 + (k * 2 + i * 3) % 12),
            wind_speed_10m_max: dates.map((_, k) => 4 + (k * 4 + i * 6) % 34),
            weather_code: dates.map((_, k) => [0, 1, 3, 61, 80, 95][(k + i) % 6])
          },
          hourly: { time: hours, freezing_level_height: hours.map((_, h) => 1800 + ((i * 137) % 1600) + h % 17 * 25) }
        };

    route.fulfill({
      status: 200, contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify(nLoc > 1 ? [...Array(nLoc)].map((_, i) => one(i)) : one(0))
    });
  });
}
