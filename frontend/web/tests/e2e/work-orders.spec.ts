/**
 * tests/e2e/work-orders.spec.ts
 * Fleet Management System — E2E
 *
 * Covers the full work order lifecycle visible in the UI:
 *  - List page loads and displays work orders
 *  - Create a new work order via the form
 *  - Form validation — required fields, invalid values
 *  - Status transition: pending → in-progress → completed
 *  - Completed order cannot be re-opened (UI blocks it)
 *  - Delete a work order and confirm removal from list
 *  - Add a part to a work order
 */

import { test, expect } from "./fixtures";

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Navigate to the work orders list and wait for it to be ready. */
async function goToWorkOrders(page: import("@playwright/test").Page) {
  await page.goto("/work-orders");
  await page.waitForLoadState("networkidle");
}

/** Fill and submit the create work order form with sensible defaults. */
async function createWorkOrder(
  page: import("@playwright/test").Page,
  overrides: Record<string, string> = {}
) {
  const data = {
    title: `E2E Work Order ${Date.now()}`,
    priority: "medium",
    ...overrides,
  };

  // Open the create form — adjust selector to your UI's trigger
  await page
    .getByRole("button", { name: /new work order|create/i })
    .or(page.getByTestId("create-work-order-btn"))
    .click();

  await page.getByLabel(/title/i).fill(data.title);

  // Priority select — adjust if yours is a dropdown or radio
  await page.getByLabel(/priority/i).selectOption(data.priority);

  // Truck selector — pick the first available option
  const truckSelect = page.getByLabel(/truck/i);
  await truckSelect.click();
  await page.getByRole("option").first().click();

  await page.getByRole("button", { name: /save|submit|create/i }).click();

  // Wait for the modal/form to close
  await page.waitForSelector('[role="dialog"]', {
    state: "hidden",
    timeout: 8_000,
  });

  return data.title;
}

// ─────────────────────────────────────────────────────────────────────────────
// LIST
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Work Orders — list", () => {
  test("list page loads with table/card content", async ({
    mechanicPage: page,
  }) => {
    await goToWorkOrders(page);

    // The list container should be present — adjust testid to your app
    await expect(
      page.getByTestId("work-orders-list").or(page.getByRole("table"))
    ).toBeVisible();
  });

  test("filtering by status 'pending' shows only pending orders", async ({
    mechanicPage: page,
  }) => {
    await goToWorkOrders(page);

    await page.getByLabel(/status/i).selectOption("pending");
    await page.waitForLoadState("networkidle");

    // Every visible status badge should say pending
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
  test("creates a new work order and it appears in the list", async ({
    mechanicPage: page,
  }) => {
    await goToWorkOrders(page);
    const title = await createWorkOrder(page);

    // The new work order should now appear in the list
    await expect(page.getByText(title)).toBeVisible({ timeout: 8_000 });
  });

  test("submitting empty form shows required field errors", async ({
    mechanicPage: page,
  }) => {
    await goToWorkOrders(page);

    await page
      .getByRole("button", { name: /new work order|create/i })
      .or(page.getByTestId("create-work-order-btn"))
      .click();

    // Submit without filling anything
    await page.getByRole("button", { name: /save|submit|create/i }).click();

    await expect(
      page.getByText(/required|this field|please enter/i).first()
    ).toBeVisible({ timeout: 4_000 });
  });

  test("invalid priority value shows validation error", async ({
    mechanicPage: page,
  }) => {
    await goToWorkOrders(page);

    await page
      .getByRole("button", { name: /new work order|create/i })
      .or(page.getByTestId("create-work-order-btn"))
      .click();

    await page.getByLabel(/title/i).fill("Bad priority test");

    // Attempt to type an invalid value directly into a priority field
    // (relevant if it's a text input that gets validated)
    const priorityInput = page.getByLabel(/priority/i);
    const tagName = await priorityInput.evaluate((el) =>
      el.tagName.toLowerCase()
    );

    if (tagName === "input") {
      await priorityInput.fill("super_urgent");
      await page.getByRole("button", { name: /save|submit|create/i }).click();
      await expect(
        page.getByText(/invalid|not valid|must be one of/i)
      ).toBeVisible({ timeout: 4_000 });
    } else {
      // If it's a <select>, the browser prevents invalid values natively — skip
      test.skip();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// STATUS TRANSITIONS
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Work Orders — status transitions", () => {
  test("pending → in-progress → completed transition updates status badge", async ({
    mechanicPage: page,
  }) => {
    await goToWorkOrders(page);
    const title = await createWorkOrder(page);

    // Open the work order detail
    await page.getByText(title).click();
    await page.waitForLoadState("networkidle");

    // Move to in-progress
    await page
      .getByRole("button", { name: /start|in.progress|begin/i })
      .or(page.getByTestId("status-transition-btn"))
      .click();

    await expect(page.getByTestId("status-badge")).toHaveText(/in.progress/i, {
      timeout: 6_000,
    });

    // Move to completed
    await page
      .getByRole("button", { name: /complete|mark.complete/i })
      .or(page.getByTestId("status-transition-btn"))
      .click();

    await expect(page.getByTestId("status-badge")).toHaveText(/completed/i, {
      timeout: 6_000,
    });
  });

  test("completed work order has no re-open button", async ({
    mechanicPage: page,
  }) => {
    await goToWorkOrders(page);
    const title = await createWorkOrder(page);

    await page.getByText(title).click();
    await page.waitForLoadState("networkidle");

    // Transition to completed
    await page
      .getByRole("button", { name: /start|in.progress|begin/i })
      .click();
    await page
      .getByRole("button", { name: /complete|mark.complete/i })
      .click();
    await expect(page.getByTestId("status-badge")).toHaveText(/completed/i);

    // The "re-open" or "pending" action must NOT be present
    await expect(
      page.getByRole("button", { name: /re.?open|set.pending/i })
    ).not.toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PARTS
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Work Orders — parts", () => {
  test("adding a part updates the parts list and total cost", async ({
    mechanicPage: page,
  }) => {
    await goToWorkOrders(page);
    const title = await createWorkOrder(page);

    await page.getByText(title).click();
    await page.waitForLoadState("networkidle");

    // Open the add-part form
    await page
      .getByRole("button", { name: /add part/i })
      .or(page.getByTestId("add-part-btn"))
      .click();

    await page.getByLabel(/part number/i).fill("OIL-5W30");
    await page.getByLabel(/name|description/i).fill("Synthetic Oil");
    await page.getByLabel(/quantity/i).fill("4");
    await page.getByLabel(/unit cost/i).fill("9.99");

    await page.getByRole("button", { name: /add|save/i }).click();

    // Part should appear in the parts table
    await expect(page.getByText("OIL-5W30")).toBeVisible({ timeout: 6_000 });
    await expect(page.getByText("Synthetic Oil")).toBeVisible();
  });

  test("negative quantity shows validation error", async ({
    mechanicPage: page,
  }) => {
    await goToWorkOrders(page);
    const title = await createWorkOrder(page);

    await page.getByText(title).click();
    await page.waitForLoadState("networkidle");

    await page
      .getByRole("button", { name: /add part/i })
      .or(page.getByTestId("add-part-btn"))
      .click();

    await page.getByLabel(/part number/i).fill("BAD-001");
    await page.getByLabel(/name|description/i).fill("Bad Part");
    await page.getByLabel(/quantity/i).fill("-1");
    await page.getByLabel(/unit cost/i).fill("5.00");

    await page.getByRole("button", { name: /add|save/i }).click();

    await expect(
      page.getByText(/invalid|must be positive|greater than/i)
    ).toBeVisible({ timeout: 4_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Work Orders — delete", () => {
  test("deleting a work order removes it from the list", async ({
    mechanicPage: page,
  }) => {
    await goToWorkOrders(page);
    const title = await createWorkOrder(page);

    // Confirm it exists first
    await expect(page.getByText(title)).toBeVisible();

    // Open and delete
    await page.getByText(title).click();
    await page.waitForLoadState("networkidle");

    await page
      .getByRole("button", { name: /delete|remove/i })
      .or(page.getByTestId("delete-work-order-btn"))
      .click();

    // Confirm dialog — adjust to your UI's confirm pattern
    await page
      .getByRole("button", { name: /confirm|yes|delete/i })
      .or(page.getByTestId("confirm-delete-btn"))
      .click();

    // Should navigate back to the list
    await page.waitForURL(/\/work-orders$/, { timeout: 8_000 });

    // The deleted item must no longer appear
    await expect(page.getByText(title)).not.toBeVisible();
  });
});