import { defineConfig, devices } from "@playwright/test";

// De site is één statisch bestand; de webserver hieronder serveert de repo-root.
export default defineConfig({
  testDir: "./specs",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "on-first-retry",
    // Op een machine met een eigen Chromium (zoals sommige dev-containers)
    // kun je PLAYWRIGHT_CHROMIUM_PATH zetten in plaats van er een te laten
    // downloaden. In CI blijft dit leeg en pakt Playwright zijn eigen build.
    ...(process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } }
      : {})
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobiel", use: { ...devices["Pixel 7"] } }
  ],
  webServer: {
    command: "node helpers/server.mjs",
    url: "http://127.0.0.1:4173/index.html",
    reuseExistingServer: !process.env.CI,
    stdout: "ignore"
  }
});
