/**
 * tests/e2e/auth.spec.ts
 * Fleet Management System — E2E
 *
 * Covers:
 *  - Successful login → dashboard redirect
 *  - Wrong password → inline error, no redirect
 *  - Empty form submission → field validation messages
 *  - Logout → session cleared, redirect to /login
 *  - Route guard → unauthenticated access redirects to /login
 *  - Post-login redirect → lands back on originally requested URL
 *  - Token persistence → page refresh keeps user logged in
 */

import { test, expect, loginAs, assertAuthRedirect, USERS } from "./fixtures";

// ─────────────────────────────────────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Login", () => {
  test("valid credentials → redirects to dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(USERS.admin.email);
    await page.getByLabel(/password/i).fill(USERS.admin.password);
    await page.getByRole("button", { name: /sign in|log in/i }).click();

    // Should leave /login and land somewhere meaningful
    await page.waitForURL((url) => !url.pathname.includes("/login"));
    await expect(page).not.toHaveURL(/\/login/);

    // Dashboard landmark should be visible — adjust selector to your app
    await expect(
      page.getByRole("navigation").or(page.getByTestId("dashboard"))
    ).toBeVisible();
  });

  test("wrong password → error message shown, stays on /login", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(USERS.mechanic.email);
    await page.getByLabel(/password/i).fill("definitely-wrong");
    await page.getByRole("button", { name: /sign in|log in/i }).click();

    // Error text — adjust to match your UI copy
    await expect(
      page.getByText(/incorrect|invalid|wrong|failed/i)
    ).toBeVisible({ timeout: 6_000 });

    // Must not have navigated away
    expect(page.url()).toContain("/login");
  });

  test("empty form → required field messages appear", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /sign in|log in/i }).click();

    // Expect at least one validation message
    const errors = page.getByText(/required|this field|please enter/i);
    await expect(errors.first()).toBeVisible({ timeout: 4_000 });
  });

  test("unknown email → error message shown", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill("ghost@fleetapp.com");
    await page.getByLabel(/password/i).fill("doesntmatter");
    await page.getByRole("button", { name: /sign in|log in/i }).click();

    await expect(
      page.getByText(/incorrect|invalid|not found/i)
    ).toBeVisible({ timeout: 6_000 });
    expect(page.url()).toContain("/login");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// LOGOUT
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Logout", () => {
  test("clicking logout clears session and redirects to /login", async ({
    adminPage: page,
  }) => {
    // Find and click the logout trigger — adjust selector to your UI
    await page
      .getByRole("button", { name: /logout|sign out/i })
      .or(page.getByTestId("logout-btn"))
      .click();

    await page.waitForURL(/\/login/, { timeout: 8_000 });
    expect(page.url()).toContain("/login");
  });

  test("after logout, navigating to a protected route stays on /login", async ({
    adminPage: page,
  }) => {
    // Logout
    await page
      .getByRole("button", { name: /logout|sign out/i })
      .or(page.getByTestId("logout-btn"))
      .click();
    await page.waitForURL(/\/login/);

    // Try to navigate directly to a protected page
    await page.goto("/work-orders");
    await expect(page).toHaveURL(/\/login/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE GUARDS
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Route guards", () => {
  test("unauthenticated /work-orders → redirect to /login", async ({
    page,
  }) => {
    await page.goto("/work-orders");
    await page.waitForURL(/\/login/, { timeout: 8_000 });
    expect(page.url()).toContain("/login");
  });

  test("unauthenticated /settings → redirect to /login", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForURL(/\/login/, { timeout: 8_000 });
    expect(page.url()).toContain("/login");
  });

  test("unauthenticated /drivers → redirect to /login", async ({ page }) => {
    await page.goto("/drivers");
    await page.waitForURL(/\/login/, { timeout: 8_000 });
    expect(page.url()).toContain("/login");
  });

  test("deep link preserved → after login redirects to original URL", async ({
    page,
  }) => {
    await assertAuthRedirect(page, "/work-orders", USERS.mechanic);
    expect(page.url()).toContain("/work-orders");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SESSION PERSISTENCE
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Session persistence", () => {
  test("page refresh keeps user logged in", async ({ adminPage: page }) => {
    const urlBeforeRefresh = page.url();

    await page.reload();

    // Should still be on the same page, not redirected to /login
    await expect(page).not.toHaveURL(/\/login/);
    expect(page.url()).toBe(urlBeforeRefresh);
  });

  test("opening a new tab while logged in stays authenticated", async ({
    adminPage: page,
    context,
  }) => {
    const newTab = await context.newPage();
    await newTab.goto("/work-orders");

    // Should load the work orders page, not redirect to login
    await expect(newTab).not.toHaveURL(/\/login/);
    await newTab.close();
  });
});