/**
 * playwright.config.ts
 * Fleet Management System — E2E
 *
 * Runs against the locally running dev server by default.
 * Set BASE_URL in CI to point at the staging environment.
 *
 * Install:  npm install -D @playwright/test
 * Run:      npx playwright test
 * Debug:    npx playwright test --headed --debug
 * Report:   npx playwright show-report
 */

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",

  /* Fail fast in CI — useful for catching cascading fixture failures early */
  maxFailures: process.env.CI ? 5 : undefined,

  /* Retry flaky tests once in CI, never locally */
  retries: process.env.CI ? 1 : 0,

  /* Parallel workers — CI uses 2, local uses default (logical CPU count) */
  workers: process.env.CI ? 2 : undefined,

  /* HTML report saved to playwright-report/ — gitignored */
  reporter: [
    ["html", { open: "never" }],
    ["list"],
  ],

  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",

    /* Keep auth state between tests in the same worker */
    storageState: undefined, // overridden per fixture where needed

    /* Record traces on first retry so you can replay failures */
    trace: "on-first-retry",

    /* Screenshot only on failure */
    screenshot: "only-on-failure",

    /* Reasonable timeout for SPA navigation */
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },

  /* Test against Chromium only for now; add Firefox/WebKit when stable */
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  /* Spin up the Vite dev server automatically if not already running */
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,   // always reuse if already running
    timeout: 120_000,            
    stdout: "pipe",              
    stderr: "pipe",
  },
});