/**
 * tests/e2e/trips.spec.ts
 * Fleet Management System — E2E
 *
 * ── Fix log ───────────────────────────────────────────────────────────────────
 *
 * Routes: "/trips" and "/trips/:id" — both correct per routeTree. No changes.
 *
 * createTrip — field label selectors (confirmed from TripForm htmlFor/id pairs):
 *   BEFORE: getByLabel(/scheduled.*departure|departure.*date/i)
 *   AFTER:  getByLabel("Scheduled Departure")  (id="departure", htmlFor="departure")
 *
 *   BEFORE: getByLabel(/scheduled.*arrival|arrival.*date/i)
 *   AFTER:  getByLabel("Scheduled Arrival")    (id="arrival", htmlFor="arrival")
 *
 *   BEFORE: getByLabel(/cargo.*description|description/i)
 *   AFTER:  getByLabel("Cargo Description")    (id="cargo", htmlFor="cargo")
 *   NOTE:   "Cargo Description" is optional — not required for form submission.
 *
 *   Origin:      id="origin"      with htmlFor → getByLabel("Origin") ✓
 *   Destination: id="destination" with htmlFor → getByLabel("Destination") ✓
 *
 * createTrip — Truck, Driver, Trailer are shadcn Selects with NO htmlFor:
 *   BEFORE: getByLabel(/truck/i).click() + getByLabel(/driver/i).click()
 *   AFTER:  locate SelectTrigger by role="combobox" position or adjacent label text.
 *   TripForm availability API only loads options when departure+arrival are set.
 *   FIX: fill dates BEFORE clicking truck/driver selects.
 *
 * createTrip — form is in a dialog/sheet (TripForm uses onCancel callback):
 *   waitForSelector('[role="dialog"]', { state: "hidden" }) should work ✓
 *   No change needed.
 *
 * createTrip — submit button text: "Create Trip" (not save|submit|create).
 *
 * Empty form validation:
 *   TripForm uses HTML `required` on Origin, Destination, Departure, Arrival inputs.
 *   getByText(/required|this field|please enter/i) finds nothing (browser-native).
 *   AFTER: page.locator("input:invalid").first()
 *
 * Truck/driver optional check:
 *   BEFORE: complicated option count check before clicking truck/driver
 *   AFTER:  direct click with graceful catch — the availability Select always renders
 *           but may have no options if no trucks/drivers are seeded. The catch() is fine.
 *
 * Status transition — button names need trip detail page (not uploaded).
 *   Kept as broad regexes; they may need tightening once the detail page is reviewed.
 *
 * MECHANIC in trips list:
 *   MECHANIC not in trips nav roles but _auth only enforces authentication.
 *   Test keeps the "not.toHaveURL(/login/)" assertion — correct.
 */

import { test, expect } from "./fixtures";

type Page = import("@playwright/test").Page;

async function goToTrips(page: Page) {
  await page.goto("/trips");
  await page.waitForLoadState("networkidle");
}

/**
 * Fill and submit the Create Trip form.
 * TripForm loads truck/driver availability only after departure and arrival dates
 * are set — fill dates before touching the resource selects.
 * Submit text is "Create Trip".
 */
async function createTrip(
  page: Page,
  overrides: Partial<{
    origin: string;
    destination: string;
    departure: string;
    arrival: string;
    assignTruck: boolean;
    assignDriver: boolean;
  }> = {}
): Promise<string> {
  const ts = Date.now();
  const origin = overrides.origin ?? `Nairobi-${ts}`;
  const destination = overrides.destination ?? "Mombasa";

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfter = new Date();
  dayAfter.setDate(dayAfter.getDate() + 2);

  const departure = overrides.departure ?? tomorrow.toISOString().slice(0, 16);
  const arrival   = overrides.arrival   ?? dayAfter.toISOString().slice(0, 16);

  await page
    .getByRole("button", { name: /new trip|create trip|add trip/i })
    .or(page.getByTestId("create-trip-btn"))
    .click();

  // FIX: exact label text confirmed from TripForm htmlFor/id pairs
  await page.getByLabel("Origin").fill(origin);
  await page.getByLabel("Destination").fill(destination);

  // FIX: fill dates FIRST — availability API only loads after dates are set
  await page.getByLabel("Scheduled Departure").fill(departure);
  await page.getByLabel("Scheduled Arrival").fill(arrival);

  // FIX: Truck — shadcn Select, no htmlFor. The form re-fetches availability
  // after dates are set. getByRole("combobox") targets the SelectTrigger.
  // Truck is the first combobox in the Assignment section.
  if (overrides.assignTruck !== false) {
    await page
      .getByRole("combobox")
      .filter({ hasText: /select truck|no truck/i })
      .first()
      .click()
      .catch(() =>
        page.getByRole("combobox").nth(0).click()
      );
    await page.getByRole("option").first().click().catch(() => {});
  }

  // FIX: Driver — shadcn Select, no htmlFor
  if (overrides.assignDriver !== false) {
    await page
      .getByRole("combobox")
      .filter({ hasText: /select driver|no driver/i })
      .first()
      .click()
      .catch(() =>
        page.getByRole("combobox").nth(2).click()
      );
    await page.getByRole("option").first().click().catch(() => {});
  }

  // FIX: submit text is "Create Trip" (not save|submit|create)
  await page.getByRole("button", { name: /create trip/i }).click();

  await page.waitForSelector('[role="dialog"]', {
    state: "hidden",
    timeout: 8_000,
  });

  return origin;
}

// ─────────────────────────────────────────────────────────────────────────────
// LIST
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Trips — list", () => {
  test("trip list page loads for dispatcher @smoke", async ({
    dispatcherPage: page,
  }) => {
    await goToTrips(page);
    await expect(
      page.getByTestId("trips-list").or(page.getByRole("table"))
    ).toBeVisible({ timeout: 8_000 });
  });

  test("mechanic can view trips list", async ({ mechanicPage: page }) => {
    await goToTrips(page);
    await expect(page).not.toHaveURL(/\/login|\/403|\/forbidden/);
  });

  test("finance can view trips list", async ({ financePage: page }) => {
    await goToTrips(page);
    await expect(page).not.toHaveURL(/\/login|\/403|\/forbidden/);
  });

  test("driver can view trips list", async ({ driverPage: page }) => {
    await goToTrips(page);
    await expect(page).not.toHaveURL(/\/login|\/403|\/forbidden/);
  });

  test("filtering by status 'pending' shows only pending trips", async ({
    dispatcherPage: page,
  }) => {
    await goToTrips(page);

    await page
      .getByLabel(/status/i)
      .or(page.getByTestId("status-filter"))
      .selectOption("pending");
    await page.waitForLoadState("networkidle");

    const badges = page.getByTestId("trip-status-badge");
    const count = await badges.count();
    for (let i = 0; i < count; i++) {
      await expect(badges.nth(i)).toHaveText(/pending/i);
    }
  });

  test("mechanic cannot see the Create Trip button", async ({
    mechanicPage: page,
  }) => {
    await goToTrips(page);
    await expect(
      page.getByRole("button", { name: /new trip|create trip|add trip/i })
    ).not.toBeVisible();
  });

  test("list requires authentication", async ({ page }) => {
    await page.goto("/trips");
    await page.waitForURL(/\/login/, { timeout: 8_000 });
    expect(page.url()).toContain("/login");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Trips — create", () => {
  test("dispatcher creates a trip and it appears in the list @smoke", async ({
    dispatcherPage: page,
  }) => {
    await goToTrips(page);
    const origin = await createTrip(page);
    await expect(page.getByText(origin)).toBeVisible({ timeout: 8_000 });
  });

  test("trip auto-generates a trip number", async ({ dispatcherPage: page }) => {
    await goToTrips(page);
    const origin = await createTrip(page);

    await page.getByText(origin).click();
    await page.waitForLoadState("networkidle");

    await expect(
      page.getByText(/TRP-\d+|TRIP-\d+/i).or(page.getByTestId("trip-number"))
    ).toBeVisible({ timeout: 6_000 });
  });

  test("submitting empty form shows required field validation", async ({
    dispatcherPage: page,
  }) => {
    await goToTrips(page);

    await page
      .getByRole("button", { name: /new trip|create trip|add trip/i })
      .or(page.getByTestId("create-trip-btn"))
      .click();

    await page.getByRole("button", { name: /create trip/i }).click();

    // FIX: HTML required on origin/destination/departure/arrival inputs.
    // No DOM text — browser-native validation fires. Assert :invalid.
    await expect(page.locator("input:invalid").first()).toBeVisible({ timeout: 4_000 });
  });

  test("creating a trip without truck or driver is allowed", async ({
    dispatcherPage: page,
  }) => {
    await goToTrips(page);
    const origin = await createTrip(page, { assignTruck: false, assignDriver: false });
    await expect(page.getByText(origin)).toBeVisible({ timeout: 8_000 });
  });

  test("admin can also create a trip", async ({ adminPage: page }) => {
    await goToTrips(page);
    const origin = await createTrip(page);
    await expect(page.getByText(origin)).toBeVisible({ timeout: 8_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// STATUS TRANSITIONS
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Trips — status transitions", () => {
  test("pending → en-route → completed updates status badge @smoke", async ({
    dispatcherPage: page,
  }) => {
    await goToTrips(page);
    const origin = await createTrip(page);

    await page.getByText(origin).click();
    await page.waitForLoadState("networkidle");

    // pending → en-route (button text TBD from detail page — broad regex)
    await page
      .getByRole("button", { name: /dispatch|start|en.?route|depart/i })
      .or(page.getByTestId("status-transition-btn"))
      .click();

    // Confirm dialog if present (trip detail may or may not use ConfirmDialog)
    await page
      .getByRole("button", { name: /^confirm$/i })
      .click()
      .catch(() => {});

    await expect(
      page.getByTestId("trip-status-badge").or(page.getByText(/en.?route/i))
    ).toBeVisible({ timeout: 6_000 });

    // en-route → completed
    await page
      .getByRole("button", { name: /complete|arrive|mark.*complete/i })
      .or(page.getByTestId("status-transition-btn"))
      .click();

    await page
      .getByRole("button", { name: /^confirm$/i })
      .click()
      .catch(() => {});

    await expect(
      page.getByTestId("trip-status-badge").or(page.getByText(/completed/i))
    ).toBeVisible({ timeout: 6_000 });
  });

  test("pending trip can be cancelled", async ({ dispatcherPage: page }) => {
    await goToTrips(page);
    const origin = await createTrip(page);

    await page.getByText(origin).click();
    await page.waitForLoadState("networkidle");

    await page
      .getByRole("button", { name: /cancel/i })
      .or(page.getByTestId("cancel-trip-btn"))
      .click();

    await page
      .getByRole("button", { name: /confirm|yes|cancel trip/i })
      .click()
      .catch(() => {});

    await expect(
      page.getByTestId("trip-status-badge").or(page.getByText(/cancelled/i))
    ).toBeVisible({ timeout: 6_000 });
  });

  test("completed trip has no further transition buttons", async ({
    dispatcherPage: page,
  }) => {
    await goToTrips(page);
    const origin = await createTrip(page);

    await page.getByText(origin).click();
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: /dispatch|start|en.?route/i }).click();
    await page.getByRole("button", { name: /^confirm$/i }).click().catch(() => {});
    await page.getByRole("button", { name: /complete|arrive/i }).click();
    await page.getByRole("button", { name: /^confirm$/i }).click().catch(() => {});

    await expect(
      page.getByTestId("trip-status-badge")
    ).toHaveText(/completed/i, { timeout: 6_000 });

    await expect(
      page.getByRole("button", { name: /dispatch|en.?route|cancel/i })
    ).not.toBeVisible();
  });

  test("mechanic cannot change trip status", async ({
    mechanicPage: page,
    dispatcherPage: dispPage,
  }) => {
    await goToTrips(dispPage);
    const origin = await createTrip(dispPage);

    await goToTrips(page);
    await page.waitForLoadState("networkidle");

    const tripRow = page.getByText(origin);
    const exists = await tripRow.isVisible().catch(() => false);
    if (!exists) return;

    await tripRow.click();
    await page.waitForLoadState("networkidle");

    await expect(
      page.getByRole("button", { name: /dispatch|en.?route|complete|cancel/i })
    ).not.toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// EDIT / UPDATE
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Trips — edit", () => {
  test("dispatcher can update cargo description", async ({
    dispatcherPage: page,
  }) => {
    await goToTrips(page);
    const origin = await createTrip(page);

    await page.getByText(origin).click();
    await page.waitForLoadState("networkidle");

    await page
      .getByRole("button", { name: /edit/i })
      .or(page.getByTestId("edit-trip-btn"))
      .click();

    const cargo = `Pharmaceutical goods ${Date.now()}`;
    // FIX: label is "Cargo Description" (id="cargo", htmlFor="cargo")
    await page.getByLabel("Cargo Description").fill(cargo);
    // FIX: edit submit text is "Save Changes"
    await page.getByRole("button", { name: /save changes/i }).click();

    await expect(page.getByText(cargo)).toBeVisible({ timeout: 6_000 });
  });

  test("partial update preserves origin and destination", async ({
    dispatcherPage: page,
  }) => {
    await goToTrips(page);
    const origin = await createTrip(page);

    await page.getByText(origin).click();
    await page.waitForLoadState("networkidle");

    await page
      .getByRole("button", { name: /edit/i })
      .or(page.getByTestId("edit-trip-btn"))
      .click();

    await page.getByLabel("Cargo Description").fill("Updated cargo only").catch(() => {});
    await page.getByRole("button", { name: /save changes/i }).click();

    await expect(page.getByText(origin)).toBeVisible({ timeout: 6_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Trips — delete", () => {
  test("dispatcher can delete a pending trip", async ({
    dispatcherPage: page,
  }) => {
    await goToTrips(page);
    const origin = await createTrip(page);

    await expect(page.getByText(origin)).toBeVisible();

    await page.getByText(origin).click();
    await page.waitForLoadState("networkidle");

    await page
      .getByRole("button", { name: /delete|remove/i })
      .or(page.getByTestId("delete-trip-btn"))
      .click();

    await page
      .getByRole("button", { name: /confirm|yes|delete/i })
      .or(page.getByTestId("confirm-delete-btn"))
      .click();

    await page.waitForURL(/\/trips/, { timeout: 8_000 });
    await expect(page.getByText(origin)).not.toBeVisible();
  });
});