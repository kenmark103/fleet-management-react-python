/**
 * tests/e2e/fixtures.ts
 * Fleet Management System — E2E
 *
 * Shared fixtures that extend Playwright's base test object.
 *
 * Usage:
 *   import { test, expect } from "./fixtures";
 *
 * Fixtures provided:
 *   adminPage      — logged in as ADMIN
 *   mechanicPage   — logged in as MECHANIC
 *   driverPage     — logged in as DRIVER
 *   dispatcherPage — logged in as DISPATCHER  (trips, fleet reads)
 *   financePage    — logged in as FINANCE     (expenses, fuel reports)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CREDENTIAL ALIGNMENT
 * These must stay in sync with SEED dict in tests/conftest.py.
 * If you change a password there, change it here too.
 *
 * FIXES vs previous version:
 *   1. mechanic.email had a leading \t character → "	rashida@fleetms.com"
 *      Fixed to: mechanic@fleetms.com (matches conftest.py SEED["mechanic"])
 *   2. mechanic.password was "12345678" — conftest.py seeds "Test1234!"
 *      Fixed to: Test1234!
 *   3. Added DISPATCHER and FINANCE users (seeded in conftest.py but
 *      missing from fixtures — needed by fleet, fuel, and settings specs)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { test as base, expect, type Browser, type BrowserContext, type Page } from "@playwright/test";

// ─────────────────────────────────────────────────────────────────────────────
// CREDENTIALS — must match SEED dict in tests/conftest.py exactly
// ─────────────────────────────────────────────────────────────────────────────

export const USERS = {
  admin: {
    email: "admin@fleetms.com",
    password: "Admin1234!",
    role: "ADMIN",
  },
  mechanic: {
    // FIX: was "\trashida@fleetms.com" (leading tab) with wrong password
    email: "mechanic@fleetms.com",
    password: "Test1234!",
    role: "MECHANIC",
  },
  dispatcher: {
    // NEW: required for trip creation and fleet read tests
    email: "dispatcher@fleetms.com",
    password: "Dispatch1234!",
    role: "DISPATCHER",
  },
  finance: {
    // NEW: required for expense and fuel log tests
    email: "finance@fleetms.com",
    password: "Finance1234!",
    role: "FINANCE",
  },
  driver: {
    email: "kuriaj@fleetms.com",
    password: "12345678",
    role: "DRIVER",
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Perform a full login via the UI form and wait until the redirect
 * away from /login confirms auth succeeded.
 */
export async function loginAs(
  page: Page,
  user: { email: string; password: string }
): Promise<void> {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(user.email);
  await page.getByLabel(/password/i).fill(user.password);
  await page.getByRole("button", { name: /sign in|log in/i }).click();

  await page.waitForURL((url) => !url.pathname.includes("/login"), {
    timeout: 10_000,
  });
}

/**
 * Navigate to a protected route while logged out, assert the /login redirect,
 * then log in and assert the redirect back to the original URL.
 */
export async function assertAuthRedirect(
  page: Page,
  protectedPath: string,
  user: { email: string; password: string }
): Promise<void> {
  await page.goto(protectedPath);
  await page.waitForURL(/\/login/, { timeout: 8_000 });
  expect(page.url()).toContain("/login");

  await page.getByLabel(/email/i).fill(user.email);
  await page.getByLabel(/password/i).fill(user.password);
  await page.getByRole("button", { name: /sign in|log in/i }).click();

  await page.waitForURL((url) => url.pathname.includes(protectedPath), {
    timeout: 10_000,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// FIXTURE TYPES
// ─────────────────────────────────────────────────────────────────────────────

type FleetFixtures = {
  adminPage: Page;
  mechanicPage: Page;
  dispatcherPage: Page;
  financePage: Page;
  driverPage: Page;
};

async function createLoggedInPage(
  browser: Browser,
  baseURL: string | undefined,
  user: { email: string; password: string }
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  await loginAs(page, user);
  return { context, page };
}

// ─────────────────────────────────────────────────────────────────────────────
// FIXTURES
// ─────────────────────────────────────────────────────────────────────────────

export const test = base.extend<FleetFixtures>({
  adminPage: async ({ browser, baseURL }, use) => {
    const { context, page } = await createLoggedInPage(browser, baseURL, USERS.admin);
    await use(page);
    await context.close();
  },

  mechanicPage: async ({ browser, baseURL }, use) => {
    const { context, page } = await createLoggedInPage(browser, baseURL, USERS.mechanic);
    await use(page);
    await context.close();
  },

  dispatcherPage: async ({ browser, baseURL }, use) => {
    const { context, page } = await createLoggedInPage(browser, baseURL, USERS.dispatcher);
    await use(page);
    await context.close();
  },

  financePage: async ({ browser, baseURL }, use) => {
    const { context, page } = await createLoggedInPage(browser, baseURL, USERS.finance);
    await use(page);
    await context.close();
  },

  driverPage: async ({ browser, baseURL }, use) => {
    const { context, page } = await createLoggedInPage(browser, baseURL, USERS.driver);
    await use(page);
    await context.close();
  },
});

export { expect };
