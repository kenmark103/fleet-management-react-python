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

    // Wait until we leave /login — use a generous timeout here because the
    // very first run incurs a cold-start penalty: _auth.tsx shows a
    // <LoadingSpinner> while the /me auth check resolves, which adds latency
    // before AppShell (and therefore <main>) renders. Subsequent runs are fast
    // because the token is already cached.
    await page.waitForURL((url) => !url.pathname.includes("/login"), {
      timeout: 15_000,
    });
    await expect(page).not.toHaveURL(/\/login/);

    // AppShell renders a <main> element for all authenticated pages.
    // Waiting explicitly for it handles the _auth.tsx spinner delay.
    await expect(page.getByRole("main")).toBeVisible({ timeout: 10_000 });
  });

  test("wrong password → error message shown, stays on /login", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(USERS.mechanic.email);
    await page.getByLabel(/password/i).fill("definitely-wrong");
    await page.getByRole("button", { name: /sign in|log in/i }).click();

    await expect(
      page.getByText(/incorrect|invalid|wrong|failed/i)
    ).toBeVisible({ timeout: 6_000 });

    expect(page.url()).toContain("/login");
  });

  test("empty form → required field messages appear", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /sign in|log in/i }).click();

    // Both inputs carry HTML `required`. The browser fires native constraint
    // validation — no error text is written into the DOM — so getByText() finds
    // nothing. Assert the CSS :invalid pseudo-class instead.
    await expect(page.locator("input:invalid").first()).toBeVisible({
      timeout: 4_000,
    });
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
    // "Log out" is inside the user DropdownMenu — the trigger must be opened
    // first. It is the last <button> in the <header>:
    //   [mobile-menu (md:hidden)] · [bell] · [user avatar ← this one]
    //
    // The item text is "Log out" (two words with a space). The shadcn
    // DropdownMenuItem renders with role="menuitem", not "button".
    await page.locator("header").getByRole("button").last().click();
    await page.getByRole("menuitem", { name: /log out/i }).click();

    await page.waitForURL(/\/login/, { timeout: 8_000 });
    expect(page.url()).toContain("/login");
  });

  test("after logout, navigating to a protected route stays on /login", async ({
    adminPage: page,
  }) => {
    await page.locator("header").getByRole("button").last().click();
    await page.getByRole("menuitem", { name: /log out/i }).click();
    await page.waitForURL(/\/login/);

    // /trips is a real _auth-guarded index route (routeTree: /_auth/trips/)
    await page.goto("/trips");
    await expect(page).toHaveURL(/\/login/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE GUARDS
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Route guards", () => {
  // /drivers has a clean index route (/_auth/drivers/) and is guarded by _auth
  test("unauthenticated /drivers → redirect to /login", async ({ page }) => {
    await page.goto("/drivers");
    await page.waitForURL(/\/login/, { timeout: 8_000 });
    expect(page.url()).toContain("/login");
  });

  // /trips has a clean index route (/_auth/trips/) and is guarded by _auth
  test("unauthenticated /trips → redirect to /login", async ({ page }) => {
    await page.goto("/trips");
    await page.waitForURL(/\/login/, { timeout: 8_000 });
    expect(page.url()).toContain("/login");
  });

  test("unauthenticated /settings/profile → redirect to /login", async ({
    page,
  }) => {
    await page.goto("/settings/profile");
    await page.waitForURL(/\/login/, { timeout: 8_000 });
    expect(page.url()).toContain("/login");
  });

  // Deep link — use /fleet/trucks because:
  //   1. It is a real index route (/_auth/fleet/trucks/)
  //   2. MECHANIC has access to it (constants.ts NAV_ITEMS Fleet section)
  //   3. After login the app can actually land there without a secondary redirect
  //
  // NOTE: this test requires _auth.tsx to pass a ?redirect= param when
  // bouncing to /login, and LoginPage to read it after a successful login.
  // Current _auth.tsx calls navigate({ to: "/login", replace: true }) with no
  // search params — the deep-link round-trip won't work until that is fixed.
  //
  // Fix in _auth.tsx:
  //   const location = useLocation();
  //   navigate({ to: "/login", search: { redirect: location.pathname }, replace: true });
  //
  // Fix in login.tsx (inside handleSubmit, replace the navigate call):
  //   const search = Route.useSearch<{ redirect?: string }>();
  //   navigate({ to: search.redirect ?? "/dashboard" });
  test("deep link preserved → after login redirects to original URL", async ({
    page,
  }) => {
    await assertAuthRedirect(page, "/fleet/trucks", USERS.admin);
    expect(page.url()).toContain("/fleet/trucks");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SESSION PERSISTENCE
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Session persistence", () => {
  test("page refresh keeps user logged in", async ({ adminPage: page }) => {
    const urlBeforeRefresh = page.url();

    await page.reload();

    // _auth.tsx shows <LoadingSpinner> while the auth check re-runs after
    // reload. Wait for <main> to confirm the app shell has re-mounted.
    await expect(page.getByRole("main")).toBeVisible({ timeout: 10_000 });
    await expect(page).not.toHaveURL(/\/login/);
    expect(page.url()).toBe(urlBeforeRefresh);
  });

  test("opening a new tab while logged in stays authenticated", async ({
    adminPage: page,
    context,
  }) => {
    const newTab = await context.newPage();
    // /drivers is a real index route and ADMIN has access
    await newTab.goto("/drivers");

    await expect(newTab.getByRole("main")).toBeVisible({ timeout: 10_000 });
    await expect(newTab).not.toHaveURL(/\/login/);
    await newTab.close();
  });
});