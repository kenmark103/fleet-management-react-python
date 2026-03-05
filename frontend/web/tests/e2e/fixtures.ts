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
 *   adminPage   — browser page already logged in as admin@fleetapp.com
 *   mechanicPage — browser page already logged in as mechanic@fleetapp.com
 *   driverPage  — browser page already logged in as driver@fleetapp.com
 */

import { test as base, expect, type Page } from "@playwright/test";

// ─────────────────────────────────────────────────────────────────────────────
// CREDENTIALS — match seed_users in conftest.py
// Never commit real credentials; these are test-only accounts.
// ─────────────────────────────────────────────────────────────────────────────

export const USERS = {
  admin: {
    email: "admin@fleetms.com",
    password: "Admin1234!",
    role: "ADMIN",
  },
  mechanic: {
    email: "	rashida@fleetms.com",
    password: "12345678",
    role: "MECHANIC",
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
 * Perform a full login via the UI and wait until the dashboard is visible.
 * Returns the page so callers can chain further actions.
 */
export async function loginAs(
  page: Page,
  user: { email: string; password: string }
): Promise<void> {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(user.email);
  await page.getByLabel(/password/i).fill(user.password);
  await page.getByRole("button", { name: /sign in|log in/i }).click();

  // Wait until redirected away from /login — confirms auth succeeded
  await page.waitForURL((url) => !url.pathname.includes("/login"), {
    timeout: 10_000,
  });
}

/**
 * Navigate to a protected route while logged out and assert the redirect
 * back to /login, then assert the redirect back to the original URL after
 * logging in.
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

  // Should redirect back to the originally requested route
  await page.waitForURL((url) => url.pathname.includes(protectedPath), {
    timeout: 10_000,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// FIXTURES
// ─────────────────────────────────────────────────────────────────────────────

type FleetFixtures = {
  adminPage: Page;
  mechanicPage: Page;
  driverPage: Page;
};

export const test = base.extend<FleetFixtures>({
  adminPage: async ({ page }, use) => {
    await loginAs(page, USERS.admin);
    await use(page);
  },

  mechanicPage: async ({ page }, use) => {
    await loginAs(page, USERS.mechanic);
    await use(page);
  },

  driverPage: async ({ page }, use) => {
    await loginAs(page, USERS.driver);
    await use(page);
  },
});

export { expect };