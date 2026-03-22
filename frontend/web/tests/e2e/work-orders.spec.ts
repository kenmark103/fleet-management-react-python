/**
 * tests/e2e/work-orders.spec.ts
 * Fleet Management System — E2E
 *
 * ── Fix log ───────────────────────────────────────────────────────────────────
 *
 * goToWorkOrders: "/work-orders" → "/maintenance"
 *   WorkOrderForm cancel navigates to "/maintenance".
 *   routeTree has /_auth/maintenance/ — "/work-orders" does not exist.
 *
 * createWorkOrder — form is a full PAGE, not a dialog:
 *   BEFORE: waitForSelector('[role="dialog"]', { state: "hidden" })
 *   AFTER:  waitForURL(/\/maintenance/, { timeout: 8_000 })
 *   WHY:    WorkOrderForm is rendered at /maintenance/work-orders/new (a route),
 *           not inside a dialog. On submit it navigates back to /maintenance.
 *           waitForSelector('[role="dialog"]') would time out immediately.
 *
 * createWorkOrder — all Labels lack htmlFor:
 *   WorkOrderForm uses <Label> WITHOUT htmlFor on every field.
 *   getByLabel() links via htmlFor — it will NOT reliably find unlabelled inputs.
 *   AFTER: placeholder-based selectors for all fields.
 *     Title:       placeholder="e.g. Engine oil change and filter replacement"
 *     Description: placeholder="Describe the work to be done…"
 *     Scheduled Date: type="datetime-local" with no placeholder — locate by type
 *   Selects (Truck, Mechanic, Priority): shadcn Select with no htmlFor/id.
 *     Located by the text that precedes them in the label.
 *
 * createWorkOrder — submit button is disabled until truck+mechanic+title+date filled:
 *   Can't click-to-validate on an empty form. Empty form test restructured.
 *
 * createWorkOrder — submit button text: "Create Work Order" (not save|submit|create).
 *
 * Status transitions — every change goes through ConfirmDialog:
 *   BEFORE: click the transition button directly
 *   AFTER:  click button → ConfirmDialog appears → click "Confirm"
 *   Button labels from source: "Start Work", "Mark Complete", "Mark Overdue"
 *
 * Parts form — Labels lack htmlFor:
 *   Label text: "Part Name *", "Part Number", "Qty *", "Unit Cost *"
 *   Labels use className="text-xs" but NO htmlFor. Selectors use placeholder.
 *     Part Name:   placeholder="e.g. Oil Filter"
 *     Part Number: placeholder="e.g. OF-1234"
 *     Qty:         type="number" min=1 (no placeholder)
 *     Unit Cost:   placeholder="0.00"
 *
 * Delete:
 *   BEFORE: waitForURL(/\/work-orders$/)
 *   AFTER:  waitForURL(/\/maintenance/)
 *   WHY:    handleDelete navigates to "/maintenance" not "/work-orders".
 *   ConfirmDialog confirmLabel="Delete" — getByRole("button", { name: /^delete$/i }) ✓
 *
 * "invalid priority" test:
 *   Priority is a shadcn Select — cannot type an invalid value. Test correctly
 *   skips but the tagName check is now unnecessary. Removed entirely since
 *   shadcn Selects prevent invalid values by design; keeping it would always skip.
 *
 * MECHANIC role is correct for creating work orders:
 *   constants.ts maintenance roles include MECHANIC. No change needed.
 */

import { test, expect } from "./fixtures";

type Page = import("@playwright/test").Page;

async function goToWorkOrders(page: Page) {
  // FIX: route is /maintenance, not /work-orders
  await page.goto("/maintenance");
  await page.waitForLoadState("networkidle");
}

/**
 * Navigate to the new work order page and fill the form.
 * WorkOrderForm is a full-page form at /maintenance/work-orders/new.
 * All Labels lack htmlFor — selectors use placeholder text.
 * Submit is disabled until truck + mechanic + title + scheduledDate are set.
 */
async function createWorkOrder(
  page: Page,
  overrides: Partial<{
    title: string;
    priority: string;
  }> = {}
): Promise<string> {
  const title = overrides.title ?? `E2E Work Order ${Date.now()}`;

  await page
    .getByRole("button", { name: /new work order|create/i })
    .or(page.getByTestId("create-work-order-btn"))
    .click();

  await page.waitForLoadState("networkidle");

  // FIX: Title — no htmlFor, use placeholder
  await page.getByPlaceholder(/engine oil change/i).fill(title);

  // FIX: Description — no htmlFor, use placeholder
  await page.getByPlaceholder(/describe the work/i).fill("E2E test work order description");

  // FIX: Truck — shadcn Select with no htmlFor. Locate the SelectTrigger
  // following the "Truck" label text.
  const truckLabel = page.getByText("Truck", { exact: true });
  await truckLabel.locator("~ div button[role='combobox']")
    .or(page.getByRole("combobox").nth(0))
    .click();
  await page.getByRole("option").first().click();

  // FIX: Mechanic — shadcn Select with no htmlFor
  const mechanicLabel = page.getByText("Mechanic", { exact: true });
  await mechanicLabel.locator("~ div button[role='combobox']")
    .or(page.getByRole("combobox").nth(1))
    .click();
  await page.getByRole("option").first().click();

  // Scheduled Date — datetime-local input with no placeholder or htmlFor
  // Locate by type="datetime-local"
  await page.locator("input[type='datetime-local']").first().fill(
    new Date(Date.now() + 86_400_000).toISOString().slice(0, 16)
  );

  // FIX: submit text is "Create Work Order"
  await page.getByRole("button", { name: /create work order/i }).click();

  // FIX: form navigates to /maintenance on success — not a dialog
  await page.waitForURL(/\/maintenance/, { timeout: 8_000 });

  return title;
}

// ─────────────────────────────────────────────────────────────────────────────
// LIST
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Work Orders — list", () => {
  test("list page loads with table/card content @smoke", async ({
    mechanicPage: page,
  }) => {
    await goToWorkOrders(page);
    await expect(
      page.getByTestId("work-orders-list").or(page.getByRole("table"))
    ).toBeVisible({ timeout: 8_000 });
  });

  test("filtering by status 'pending' shows only pending orders", async ({
    mechanicPage: page,
  }) => {
    await goToWorkOrders(page);

    await page
      .getByLabel(/status/i)
      .or(page.getByTestId("status-filter"))
      .selectOption("pending");
    await page.waitForLoadState("networkidle");

    const badges = page.getByTestId("status-badge");
    const count = await badges.count();
    for (let i = 0; i < count; i++) {
      await expect(badges.nth(i)).toHaveText(/pending/i);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Work Orders — create", () => {
  test("creates a new work order and it appears in the list @smoke", async ({
    mechanicPage: page,
  }) => {
    await goToWorkOrders(page);
    const title = await createWorkOrder(page);
    await expect(page.getByText(title)).toBeVisible({ timeout: 8_000 });
  });

  test("required field prevents submission when title is empty", async ({
    mechanicPage: page,
  }) => {
    await goToWorkOrders(page);

    await page
      .getByRole("button", { name: /new work order|create/i })
      .or(page.getByTestId("create-work-order-btn"))
      .click();

    await page.waitForLoadState("networkidle");

    // FIX: submit button disabled until truck + mechanic + title + date filled.
    // Fill truck, mechanic, and date — leave title empty to trigger :invalid.
    await page.getByRole("combobox").nth(0).click();
    await page.getByRole("option").first().click();
    await page.getByRole("combobox").nth(1).click();
    await page.getByRole("option").first().click();
    await page.locator("input[type='datetime-local']").first().fill(
      new Date(Date.now() + 86_400_000).toISOString().slice(0, 16)
    );

    // Title has HTML `required` — leave it empty and submit
    await page.getByPlaceholder(/describe the work/i).fill("Has description");
    await page.getByRole("button", { name: /create work order/i }).click();

    // FIX: HTML required → browser-native validation → input:invalid
    await expect(page.locator("input:invalid").first()).toBeVisible({ timeout: 4_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// STATUS TRANSITIONS
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Work Orders — status transitions", () => {
  test("pending → in-progress → completed updates status badge @smoke", async ({
    mechanicPage: page,
  }) => {
    await goToWorkOrders(page);
    const title = await createWorkOrder(page);

    await page.getByText(title).click();
    await page.waitForLoadState("networkidle");

    // FIX: "Start Work" button — every transition opens a ConfirmDialog first
    await page.getByRole("button", { name: /start work/i }).click();
    await page.getByRole("button", { name: /^confirm$/i }).click();

    await expect(
      page.getByTestId("status-badge").or(page.getByText(/in.?progress/i))
    ).toBeVisible({ timeout: 6_000 });

    // FIX: "Mark Complete" button → ConfirmDialog → "Confirm"
    await page.getByRole("button", { name: /mark complete/i }).click();
    await page.getByRole("button", { name: /^confirm$/i }).click();

    await expect(
      page.getByTestId("status-badge").or(page.getByText(/completed/i))
    ).toBeVisible({ timeout: 6_000 });
  });

  test("completed work order has no further transition buttons", async ({
    mechanicPage: page,
  }) => {
    await goToWorkOrders(page);
    const title = await createWorkOrder(page);

    await page.getByText(title).click();
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: /start work/i }).click();
    await page.getByRole("button", { name: /^confirm$/i }).click();
    await page.getByRole("button", { name: /mark complete/i }).click();
    await page.getByRole("button", { name: /^confirm$/i }).click();

    await expect(
      page.getByTestId("status-badge").or(page.getByText(/completed/i))
    ).toBeVisible({ timeout: 6_000 });

    // FIX: source shows statusActions is empty for completed status
    await expect(
      page.getByRole("button", { name: /start work|mark complete|mark overdue/i })
    ).not.toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PARTS
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Work Orders — parts", () => {
  test("adding a part updates the parts list @smoke", async ({
    mechanicPage: page,
  }) => {
    await goToWorkOrders(page);
    const title = await createWorkOrder(page);

    await page.getByText(title).click();
    await page.waitForLoadState("networkidle");

    // FIX: button text is "Add Part" (toggles to "Cancel" when open)
    await page.getByRole("button", { name: /^add part$/i }).click();

    // FIX: Labels lack htmlFor — use placeholder selectors
    // "Part Name *" → placeholder="e.g. Oil Filter"
    await page.getByPlaceholder(/oil filter/i).fill("Synthetic Oil");
    // "Part Number" → placeholder="e.g. OF-1234"
    await page.getByPlaceholder(/OF-1234/i).fill("OIL-5W30");
    // "Qty *" → type=number, no placeholder — use nth(0) among number inputs
    await page.locator("input[type='number']").nth(0).fill("4");
    // "Unit Cost *" → placeholder="0.00"
    await page.getByPlaceholder("0.00").fill("9.99");

    await page.getByRole("button", { name: /save/i }).click();

    await expect(page.getByText("OIL-5W30")).toBeVisible({ timeout: 6_000 });
    await expect(page.getByText("Synthetic Oil")).toBeVisible();
  });

  test("negative quantity is blocked by input min=1", async ({
    mechanicPage: page,
  }) => {
    await goToWorkOrders(page);
    const title = await createWorkOrder(page);

    await page.getByText(title).click();
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: /^add part$/i }).click();

    await page.getByPlaceholder(/oil filter/i).fill("Bad Part");
    await page.getByPlaceholder(/OF-1234/i).fill("BAD-001");
    // Input has min={1} — a value of -1 makes the input :invalid
    await page.locator("input[type='number']").nth(0).fill("-1");
    await page.getByPlaceholder("0.00").fill("5.00");

    await page.getByRole("button", { name: /save/i }).click();

    // HTML min constraint → browser-native validation → input:invalid
    await expect(page.locator("input:invalid").first()).toBeVisible({ timeout: 4_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Work Orders — delete", () => {
  test("deleting a work order navigates back to maintenance list", async ({
    mechanicPage: page,
  }) => {
    await goToWorkOrders(page);
    const title = await createWorkOrder(page);

    await expect(page.getByText(title)).toBeVisible();

    await page.getByText(title).click();
    await page.waitForLoadState("networkidle");

    await page
      .getByRole("button", { name: /delete/i })
      .or(page.getByTestId("delete-work-order-btn"))
      .click();

    // ConfirmDialog confirmLabel="Delete"
    await page.getByRole("button", { name: /^delete$/i }).click();

    // FIX: handleDelete navigates to "/maintenance", not "/work-orders"
    await page.waitForURL(/\/maintenance/, { timeout: 8_000 });
    await expect(page.getByText(title)).not.toBeVisible();
  });
});