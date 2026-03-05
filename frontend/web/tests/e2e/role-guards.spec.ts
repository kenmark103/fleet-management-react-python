/**
 * tests/e2e/role-guards.spec.ts
 * Fleet Management System — E2E
 *
 * Verifies that UI elements and routes are shown or hidden correctly
 * depending on the logged-in user's role.
 *
 * This is the test layer that integration tests can't cover — it confirms
 * the frontend actually respects role-based rendering, not just the API.
 *
 * Roles tested:
 *   ADMIN    — full access to all nav items and pages
 *   MECHANIC — access to maintenance, not to finance/settings/user-management
 *   DRIVER   — access to trips and fuel logs only
 */

import { test, expect } from "./fixtures";

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — should see everything
// ─────────────────────────────────────────────────────────────────────────────

test.describe("ADMIN role", () => {
  test("nav shows all top-level sections", async ({ adminPage: page }) => {
    // These nav items should all be visible for an admin
    await expect(page.getByRole("link", { name: /fleet|trucks/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /drivers/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /trips/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /maintenance|work.orders/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /fuel|costs|expenses/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /settings/i })).toBeVisible();
  });

  test("can access user management page", async ({ adminPage: page }) => {
    await page.goto("/settings/users");
    await expect(page).not.toHaveURL(/\/login|\/403|\/forbidden/);
    await expect(
      page.getByRole("heading", { name: /users|user management/i })
    ).toBeVisible({ timeout: 6_000 });
  });

  test("can access system settings page", async ({ adminPage: page }) => {
    await page.goto("/settings/system");
    await expect(page).not.toHaveURL(/\/login|\/403|\/forbidden/);
  });

  test("can see the reports/analytics section", async ({
    adminPage: page,
  }) => {
    await page.goto("/reports");
    await expect(page).not.toHaveURL(/\/login|\/403|\/forbidden/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// MECHANIC role — maintenance yes, finance/user-management no
// ─────────────────────────────────────────────────────────────────────────────

test.describe("MECHANIC role", () => {
  test("nav shows maintenance but not user management", async ({
    mechanicPage: page,
  }) => {
    await expect(
      page.getByRole("link", { name: /maintenance|work.orders/i })
    ).toBeVisible();

    // User management should NOT appear in nav
    await expect(
      page.getByRole("link", { name: /user management|manage users/i })
    ).not.toBeVisible();
  });

  test("can access work orders page", async ({ mechanicPage: page }) => {
    await page.goto("/work-orders");
    await expect(page).not.toHaveURL(/\/login|\/403|\/forbidden/);
    await expect(
      page.getByRole("heading", { name: /work.orders/i })
    ).toBeVisible({ timeout: 6_000 });
  });

  test("cannot access system settings — redirected or forbidden", async ({
    mechanicPage: page,
  }) => {
    await page.goto("/settings/system");

    // Acceptable outcomes: redirect to login, 403 page, or dashboard
    // The key invariant is: not on the settings page
    await expect(page).not.toHaveURL("/settings/system");
  });

  test("cannot access user management — redirected or forbidden", async ({
    mechanicPage: page,
  }) => {
    await page.goto("/settings/users");
    await expect(page).not.toHaveURL("/settings/users");
  });

  test("finance/expenses nav item is not visible", async ({
    mechanicPage: page,
  }) => {
    await expect(
      page.getByRole("link", { name: /finance|expenses|costs/i })
    ).not.toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DRIVER role — trips and fuel logs only
// ─────────────────────────────────────────────────────────────────────────────

test.describe("DRIVER role", () => {
  test("nav shows trips but not work orders or settings", async ({
    driverPage: page,
  }) => {
    await expect(
      page.getByRole("link", { name: /trips|my trips/i })
    ).toBeVisible();

    await expect(
      page.getByRole("link", { name: /work.orders|maintenance/i })
    ).not.toBeVisible();

    await expect(
      page.getByRole("link", { name: /settings/i })
    ).not.toBeVisible();
  });

  test("can access trips page", async ({ driverPage: page }) => {
    await page.goto("/trips");
    await expect(page).not.toHaveURL(/\/login|\/403|\/forbidden/);
    await expect(
      page.getByRole("heading", { name: /trips/i })
    ).toBeVisible({ timeout: 6_000 });
  });

  test("can access fuel log page", async ({ driverPage: page }) => {
    await page.goto("/fuel-logs");
    await expect(page).not.toHaveURL(/\/login|\/403|\/forbidden/);
  });

  test("cannot access work orders — redirected or forbidden", async ({
    driverPage: page,
  }) => {
    await page.goto("/work-orders");
    await expect(page).not.toHaveURL("/work-orders");
  });

  test("cannot access drivers admin page — redirected or forbidden", async ({
    driverPage: page,
  }) => {
    await page.goto("/drivers");

    // A driver can view their own profile but should not reach the
    // admin drivers list. Acceptable: redirect or 403.
    const url = page.url();
    const isAdminDriversList =
      url.endsWith("/drivers") && !url.includes("/drivers/me");

    expect(isAdminDriversList).toBe(false);
  });

  test("cannot access reports page", async ({ driverPage: page }) => {
    await page.goto("/reports");
    await expect(page).not.toHaveURL("/reports");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CROSS-ROLE: verify no privilege escalation via direct URL
// ─────────────────────────────────────────────────────────────────────────────

test.describe("No privilege escalation via direct URL", () => {
  const restrictedRoutes = [
    { path: "/settings/users", allowedRole: "ADMIN" },
    { path: "/settings/system", allowedRole: "ADMIN" },
    { path: "/reports", allowedRole: "ADMIN" },
  ];

  for (const { path, allowedRole } of restrictedRoutes) {
    test(`MECHANIC cannot reach ${path} (requires ${allowedRole})`, async ({
      mechanicPage: page,
    }) => {
      await page.goto(path);
      await expect(page).not.toHaveURL(path);
    });

    test(`DRIVER cannot reach ${path} (requires ${allowedRole})`, async ({
      driverPage: page,
    }) => {
      await page.goto(path);
      await expect(page).not.toHaveURL(path);
    });
  }
});