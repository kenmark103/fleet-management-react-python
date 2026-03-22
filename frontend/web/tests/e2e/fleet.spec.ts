/**
 * tests/e2e/fleet.spec.ts
 * Fleet Management System — E2E
 *
 * ── Fix log ───────────────────────────────────────────────────────────────────
 *
 * addTruck() helper — Make / Model fields:
 *   BEFORE: getByLabel(/make/i).fill("Ford")
 *   AFTER:  click "Enter manually →" toggle, then fill
 *   WHY:    TruckForm renders Make and Model as catalog <Select> dropdowns by
 *           default. Playwright's .fill() targets a plain <Input> — it finds
 *           the SelectTrigger but cannot type into it. The toggle button
 *           ("Enter manually →") switches the field to a plain <Input>.
 *
 * addTruck() helper — Fuel Type field:
 *   BEFORE: fuelSelect.selectOption("diesel")
 *   AFTER:  click trigger → click option
 *   WHY:    Fuel Type is a shadcn <Select> (always — no manual toggle).
 *           Playwright's selectOption() only works on native <select> elements.
 *
 * addTruck() helper — submit button:
 *   BEFORE: getByRole("button", { name: /save|submit|create/i })
 *   AFTER:  same regex — "Save Truck" matches ✓  (no change needed)
 *
 * "submitting empty form shows required field errors":
 *   UNCHANGED — TruckForm uses react-hook-form + zod. Errors ARE written to
 *   the DOM via <FormMessage>. Zod error: "Plate number is required" matches
 *   /required/ ✓. No change needed for this test.
 *
 * Trailer "admin adds a trailer" — Type field:
 *   BEFORE: typeSelect.selectOption("flatbed")
 *   AFTER:  click trigger → click option
 *   WHY:    Trailer Type is a shadcn <Select>. Same reason as Fuel Type above.
 *
 * Trailer Make / Model — same manual-mode toggle fix as trucks.
 *
 * "mechanic cannot edit truck details":
 *   UNCHANGED in intent — MECHANIC can reach /fleet/trucks (it IS in their
 *   nav roles from constants.ts). The edit button on the list or detail is
 *   gated by can("trucks:edit") which is ADMIN only. Assertion is correct.
 *   Adjusted to not rely on a truck row existing in the list.
 */

import { test, expect } from "./fixtures";

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

type Page = import("@playwright/test").Page;

async function goToTrucks(page: Page) {
  await page.goto("/fleet/trucks");
  await page.waitForLoadState("networkidle");
}

async function goToTrailers(page: Page) {
  await page.goto("/fleet/trailers");
  await page.waitForLoadState("networkidle");
}

/**
 * Fill and submit the Add Truck form.
 *
 * Make / Model toggle:
 *   TruckForm renders Make and Model as catalog Select dropdowns by default.
 *   Each field has a small toggle button ("Enter manually →") that switches it
 *   to a plain text Input. We click both toggles before filling, so .fill()
 *   works reliably regardless of whether the catalog has pre-loaded options.
 *
 * Fuel Type:
 *   Always a shadcn Select (no manual toggle). Click the trigger to open it,
 *   then click the matching option.
 */
async function addTruck(
  page: Page,
  overrides: Partial<{
    plate: string;
    make: string;
    model: string;
    year: string;
    fuelType: string;
  }> = {}
): Promise<string> {
  const plate = overrides.plate ?? `E2E-${Date.now()}`;

  await page
    .getByRole("button", { name: /add truck|new truck/i })
    .or(page.getByTestId("add-truck-btn"))
    .click();

  // Plate Number — plain Input, no toggle needed
  await page.getByLabel(/plate number/i).fill(plate);

  // Year — plain Input
  await page.getByLabel(/^year$/i).fill(overrides.year ?? "2023");

  // FIX: Make — click "Enter manually →" to switch from catalog Select to Input
  await page
    .getByRole("button", { name: /enter manually/i })
    .first()
    .click();
  await page.getByLabel(/^make$/i).fill(overrides.make ?? "Ford");

  // FIX: Model — click "Enter manually →" for the second toggle (model field)
  await page
    .getByRole("button", { name: /enter manually/i })
    .first()
    .click();
  await page.getByLabel(/^model$/i).fill(overrides.model ?? "Transit");

  // FIX: Fuel Type — shadcn Select, click trigger then option
  // Original: fuelSelect.selectOption("diesel") → fails on shadcn Select
  await page.getByLabel(/fuel type/i).click();
  await page
    .getByRole("option", {
      name: new RegExp(overrides.fuelType ?? "diesel", "i"),
    })
    .click();

  await page.getByRole("button", { name: /save truck/i }).click();
  await page.waitForSelector('[role="dialog"]', {
    state: "hidden",
    timeout: 8_000,
  });

  return plate;
}

// ─────────────────────────────────────────────────────────────────────────────
// TRUCKS — LIST
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Fleet — Trucks list", () => {
  test("list page loads with truck rows @smoke", async ({
    adminPage: page,
  }) => {
    await goToTrucks(page);

    await expect(
      page.getByTestId("trucks-list").or(page.getByRole("table"))
    ).toBeVisible({ timeout: 8_000 });
  });

  test("filtering by status 'active' shows only active trucks", async ({
    adminPage: page,
  }) => {
    await goToTrucks(page);

    await page
      .getByLabel(/status/i)
      .or(page.getByTestId("status-filter"))
      .selectOption("active");
    await page.waitForLoadState("networkidle");

    const badges = page.getByTestId("truck-status-badge");
    const count = await badges.count();
    for (let i = 0; i < count; i++) {
      await expect(badges.nth(i)).toHaveText(/active/i);
    }
  });

  test("search by plate number filters the list", async ({
    adminPage: page,
  }) => {
    await goToTrucks(page);
    const plate = await addTruck(page);
    await goToTrucks(page);

    await page
      .getByPlaceholder(/search/i)
      .or(page.getByLabel(/search/i))
      .fill(plate);
    await page.waitForLoadState("networkidle");

    await expect(page.getByText(plate)).toBeVisible({ timeout: 6_000 });
  });

  test("dispatcher can view truck list but not add trucks", async ({
    dispatcherPage: page,
  }) => {
    await goToTrucks(page);
    await expect(page).not.toHaveURL(/\/login|\/403/);

    await expect(
      page.getByRole("button", { name: /add truck|new truck/i })
    ).not.toBeVisible();
  });

  test("mechanic can view truck list", async ({ mechanicPage: page }) => {
    await goToTrucks(page);
    await expect(page).not.toHaveURL(/\/login|\/403|\/forbidden/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TRUCKS — ADD
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Fleet — Add truck", () => {
  test("admin adds a truck and it appears in the list @smoke", async ({
    adminPage: page,
  }) => {
    await goToTrucks(page);
    const plate = await addTruck(page);

    await expect(page.getByText(plate)).toBeVisible({ timeout: 8_000 });
  });

  test("submitting empty form shows required field errors", async ({
    adminPage: page,
  }) => {
    await goToTrucks(page);

    await page
      .getByRole("button", { name: /add truck|new truck/i })
      .or(page.getByTestId("add-truck-btn"))
      .click();

    await page.getByRole("button", { name: /save truck/i }).click();

    // TruckForm uses react-hook-form + zod. Errors ARE in the DOM via
    // <FormMessage>. Zod message: "Plate number is required" → matches /required/
    await expect(
      page.getByText(/required/i).first()
    ).toBeVisible({ timeout: 4_000 });
  });

  test("duplicate plate shows error", async ({ adminPage: page }) => {
    await goToTrucks(page);
    const plate = `DUP-${Date.now()}`;

    await addTruck(page, { plate });
    await goToTrucks(page);

    await page
      .getByRole("button", { name: /add truck|new truck/i })
      .or(page.getByTestId("add-truck-btn"))
      .click();

    await page.getByLabel(/plate number/i).fill(plate);
    await page.getByLabel(/^year$/i).fill("2022");

    // Toggle make to manual and fill
    await page.getByRole("button", { name: /enter manually/i }).first().click();
    await page.getByLabel(/^make$/i).fill("Toyota");

    // Toggle model to manual and fill
    await page.getByRole("button", { name: /enter manually/i }).first().click();
    await page.getByLabel(/^model$/i).fill("Hilux");

    await page.getByRole("button", { name: /save truck/i }).click();

    await expect(
      page.getByText(/duplicate|already exists|plate.*taken/i)
    ).toBeVisible({ timeout: 6_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TRUCKS — EDIT
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Fleet — Edit truck", () => {
  test("admin can edit truck notes and save @smoke", async ({
    adminPage: page,
  }) => {
    await goToTrucks(page);
    const plate = await addTruck(page);

    await page.getByText(plate).click();
    await page.waitForLoadState("networkidle");

    await page
      .getByRole("button", { name: /edit/i })
      .or(page.getByTestId("edit-truck-btn"))
      .click();

    const notes = `Edited at ${Date.now()}`;
    await page.getByLabel(/notes/i).fill(notes);
    await page.getByRole("button", { name: /save truck/i }).click();

    await expect(page.getByText(notes)).toBeVisible({ timeout: 6_000 });
  });

  test("changing truck status to under-maintenance updates the badge", async ({
    adminPage: page,
  }) => {
    await goToTrucks(page);
    const plate = await addTruck(page);

    await page.getByText(plate).click();
    await page.waitForLoadState("networkidle");

    await page
      .getByRole("button", { name: /edit/i })
      .or(page.getByTestId("edit-truck-btn"))
      .click();

    // FIX: Status is a shadcn Select in TruckForm — click trigger, then option
    await page.getByLabel(/^status$/i).click();
    await page.getByRole("option", { name: /under.?maintenance/i }).click();

    await page.getByRole("button", { name: /save truck/i }).click();

    await expect(
      page.getByTestId("truck-status-badge").or(page.getByText(/under.?maintenance/i))
    ).toBeVisible({ timeout: 6_000 });
  });

  test("mechanic cannot edit truck details", async ({
    mechanicPage: page,
  }) => {
    await goToTrucks(page);
    await page.waitForLoadState("networkidle");

    // MECHANIC can reach /fleet/trucks (in their nav roles).
    // The edit button is gated by can("trucks:edit") — ADMIN only.
    // Check on the list page first (no truck click needed).
    await expect(
      page.getByRole("button", { name: /^edit$/i })
        .or(page.getByTestId("edit-truck-btn"))
    ).not.toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TRUCKS — DELETE
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Fleet — Delete truck", () => {
  test("admin can delete a truck and it disappears from the list", async ({
    adminPage: page,
  }) => {
    await goToTrucks(page);
    const plate = await addTruck(page);

    await expect(page.getByText(plate)).toBeVisible();

    await page.getByText(plate).click();
    await page.waitForLoadState("networkidle");

    await page
      .getByRole("button", { name: /delete|remove/i })
      .or(page.getByTestId("delete-truck-btn"))
      .click();

    await page
      .getByRole("button", { name: /confirm|yes|delete/i })
      .or(page.getByTestId("confirm-delete-btn"))
      .click();

    await page.waitForURL(/\/fleet\/trucks/, { timeout: 8_000 });
    await expect(page.getByText(plate)).not.toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TRAILERS — LIST & ADD
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Fleet — Trailers", () => {
  test("trailer list page loads @smoke", async ({ adminPage: page }) => {
    await goToTrailers(page);
    await expect(page).not.toHaveURL(/\/login|\/403|\/forbidden/);
    await expect(
      page.getByTestId("trailers-list").or(page.getByRole("table"))
    ).toBeVisible({ timeout: 8_000 });
  });

  test("admin adds a trailer and it appears in the list", async ({
    adminPage: page,
  }) => {
    await goToTrailers(page);

    const plate = `TRL-${Date.now()}`;

    await page
      .getByRole("button", { name: /add trailer|new trailer/i })
      .or(page.getByTestId("add-trailer-btn"))
      .click();

    await page.getByLabel(/plate number/i).fill(plate);
    await page.getByLabel(/^year$/i).fill("2021");

    // FIX: Make — toggle to manual input mode
    await page.getByRole("button", { name: /enter manually/i }).first().click();
    await page.getByLabel(/^make$/i).fill("Schmitz");

    // FIX: Model — toggle to manual input mode
    await page.getByRole("button", { name: /enter manually/i }).first().click();
    await page.getByLabel(/^model$/i).fill("S.CS");

    // FIX: Trailer Type — shadcn Select, click trigger then option
    // TrailerForm label: "Trailer Type" (SF name="type" label="Trailer Type")
    // Original: typeSelect.selectOption("flatbed") → fails on shadcn Select
    await page.getByLabel(/trailer type/i).click();
    await page.getByRole("option", { name: /flatbed/i }).click();

    await page.getByRole("button", { name: /save trailer/i }).click();
    await page.waitForSelector('[role="dialog"]', {
      state: "hidden",
      timeout: 8_000,
    });

    await expect(page.getByText(plate)).toBeVisible({ timeout: 8_000 });
  });

  test("filtering trailers by status works", async ({ adminPage: page }) => {
    await goToTrailers(page);

    await page
      .getByLabel(/status/i)
      .or(page.getByTestId("status-filter"))
      .selectOption("active");
    await page.waitForLoadState("networkidle");

    await expect(page).not.toHaveURL(/\/login|\/403/);
  });

  test("mechanic can view trailers but not add", async ({
    mechanicPage: page,
  }) => {
    await goToTrailers(page);
    await expect(page).not.toHaveURL(/\/login|\/403/);

    await expect(
      page.getByRole("button", { name: /add trailer|new trailer/i })
    ).not.toBeVisible();
  });
});