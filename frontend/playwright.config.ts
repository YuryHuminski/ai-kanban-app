import { defineConfig, devices } from "@playwright/test";

// The app needs the FastAPI backend (auth), so e2e tests run against the Docker app.
// Start it with scripts/start.sh. Override the URL with BASE_URL.
export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  // All tests share one database (the app under test), so they must not run in parallel.
  workers: 1,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:8000",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
