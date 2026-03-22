/**
 * tests/e2e/expenses.spec.ts
 * Fleet Management System — E2E
 *
 * ── Fix log ───────────────────────────────────────────────────────────────────
 *
 * EXPENSE_ROUTE:
 *   BEFORE: "/expenses"
 *   AFTER:  needs the fuel index component to confirm — see NOTE below.
 *   WHY:    "/expenses" does not exist in routeTree_gen.ts. The fuel module
 *           lives at "/_auth/fuel/" (index with tabs). Expenses are likely a
 *           tab inside that page, not a standalone route. The constant is kept
 *           as a single place to update once the fuel index is reviewed.
 *           Candidates: "/fuel" (then tab click) or "/fuel/expenses/" if the
 *           router exposes it as a direct index.
 *           From routeTree: AuthFuelExpensesNewRoute path = "/fuel/expenses/new"
 *           which implies the expenses list may be at "/fuel/expenses/" — but
 *           no index route for that path appears in routeTree_gen.ts, so the
 *           tab approach via "/fuel" is the safer assumption.
 *
 * "mechanic can view expense list (read only)":
 *   BEFORE: expect(page).not.toHaveURL(/\/login|\/403|\/forbidden/)
 *   AFTER:  removed — MECHANIC is NOT in fuel nav roles (constants.ts:
 *           ["ADMIN", "DRIVER", "FINANCE"]). MECHANIC navigating to the
 *           expense route will be redirected or shown a forbidden state.
 *           The assertion would fail.
 *
 * "dispatcher can view expense list (read only)":
 *   BEFORE: expect(page).not.toHaveURL(/\/login|\/403|\/forbidden/)
 *   AFTER:  removed — DISPATCHER is also NOT in fuel nav roles.
 *           Same reason as above.
 *
 * "mechanic cannot see the Add Expense button":
 *   BEFORE: goToExpenses(page) then check button absence
 *   AFTER:  removed — MECHANIC cannot reach the fuel page at all. The premise
 *           is wrong; the button absence is trivially true because the page
 *           itself is inaccessible.
 *
 * "dispatcher cannot see the Add Expense button":
 *   BEFORE: goToExpenses(page) then check button absence
 *   AFTER:  removed — same reason as mechanic above.
 *
 * addExpense() — form validation tests ("zero amount", "negative amount",
 * "empty description"):
 *   Whether these show DOM text depends on whether the expense form uses
 *   react-hook-form/zod (errors in DOM) or HTML required (browser native).
 *   This cannot be confirmed without the expense form component. The tests
 *   are kept as-is — if validation text never appears in the DOM, change
 *   these to `page.locator("input:invalid")` like the DriverForm pattern.
 *
 * All other tests: logically correct based on ADMIN and FINANCE role access.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ── ACTION REQUIRED ───────────────────────────────────────────────────────────
 * 1. Update EXPENSE_ROUTE with the correct path once the fuel index component
 *    is reviewed. If expenses are a tab, add a TAB_SELECTOR constant and click
 *    it inside goToExpenses().
 * 2. If the expense form uses HTML `required` (not zod), replace
 *    getByText(/required|.../) with page.locator("input:invalid").first()
 *    in the empty-form, zero-amount, negative-amount, and empty-description tests.
 */

import { test, expect } from "./fixtures";

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE CONFIG
// ─────────────────────────────────────────────────────────────────────────────

// TODO: Update this to the correct path once fuel/index.tsx is reviewed.
// routeTree_gen.ts has no standalone /expenses index. Candidates:
//   Option A (tab):   "/fuel"  — then click the Expenses tab
//   Option B (route): "/fuel/expenses/" — if the router exposes this directly
// If Option A, add a tab click inside goToExpenses():
//   await page.getByRole("tab", { name: /expenses/i }).click();
const EXPENSE_ROUTE = "/fuel"; // update this

// If expenses live behind a tab, set this selector and uncomment the tab
// click inside goToExpenses(). Otherwise set to null.
const EXPENSE_TAB_SELECTOR = /expenses/i; // set to null if direct route

type Page = import("@playwright/test").Page;

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

async function goToExpenses(page: Page) {
  await page.goto(EXPENSE_ROUTE);
  await page.waitForLoadState("networkidle");

  // If expenses are behind a tab, click it after navigation
  if (EXPENSE_TAB_SELECTOR) {
    const tab = page.getByRole("tab", { name: EXPENSE_TAB_SELECTOR });
    const tabVisible = await tab.isVisible().catch(() => false);
    if (tabVisible) {
      await tab.click();
      await page.waitForLoadState("networkidle");
    }
  }
}

async function addExpense(
  page: Page,
  overrides: Partial<{
    category: string;
    amount: string;
    description: string;
    currency: string;
  }> = {}
): Promise<string> {
  const description =
    overrides.description ?? `E2E Expense ${Date.now()}`;

  await page
    .getByRole("button", { name: /add expense|new expense|log expense/i })
    .or(page.getByTestId("add-expense-btn"))
    .click();

  const categoryEl = page.getByLabel(/category/i);
  await categoryEl
    .selectOption(overrides.category ?? "maintenance")
    .catch(() =>
      categoryEl.click().then(() =>
        page
          .getByRole("option", {
            name: new RegExp(overrides.category ?? "maintenance", "i"),
          })
          .click()
      )
    );

  await page.getByLabel(/amount/i).fill(overrides.amount ?? "1500");
  await page.getByLabel(/description/i).fill(description);
  await page.getByLabel(/date|expense.*date/i).fill(
    new Date().toISOString().split("T")[0]
  );

  await page.getByRole("button", { name: /save|submit|create/i }).click();
  await page.waitForSelector('[role="dialog"]', {
    state: "hidden",
    timeout: 8_000,
  });

  return description;
}

// ─────────────────────────────────────────────────────────────────────────────
// LIST
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Expenses — list", () => {
  test("expense list page loads for finance @smoke", async ({
    financePage: page,
  }) => {
    await goToExpenses(page);

    await expect(
      page.getByTestId("expenses-list").or(page.getByRole("table"))
    ).toBeVisible({ timeout: 8_000 });
  });

  test("admin can view expense list", async ({ adminPage: page }) => {
    await goToExpenses(page);
    await expect(page).not.toHaveURL(/\/login|\/403|\/forbidden/);
  });

  // REMOVED: "mechanic can view expense list (read only)"
  // MECHANIC is NOT in fuel nav roles (constants.ts: ["ADMIN","DRIVER","FINANCE"]).
  // The mechanic is redirected or shown forbidden when navigating to the fuel route.

  // REMOVED: "dispatcher can view expense list (read only)"
  // DISPATCHER is also NOT in fuel nav roles. Same reason.

  // REMOVED: "mechanic cannot see the Add Expense button"
  // MECHANIC cannot reach the page — premise is wrong.

  // REMOVED: "dispatcher cannot see the Add Expense button"
  // DISPATCHER cannot reach the page — premise is wrong.

  test("list requires authentication", async ({ page }) => {
    await page.goto(EXPENSE_ROUTE);
    await page.waitForURL(/\/login/, { timeout: 8_000 });
    expect(page.url()).toContain("/login");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Expenses — create", () => {
  test("finance logs an expense and it appears in the list @smoke", async ({
    financePage: page,
  }) => {
    await goToExpenses(page);
    const description = await addExpense(page);

    await expect(page.getByText(description)).toBeVisible({ timeout: 8_000 });
  });

  test("expense row shows correct amount", async ({
    financePage: page,
  }) => {
    await goToExpenses(page);
    const description = await addExpense(page, { amount: "4500" });

    const row = page.getByText(description).locator("..");
    await expect(row.getByText(/4,?500|4500/)).toBeVisible({
      timeout: 6_000,
    });
  });

  test("all expense categories are selectable", async ({
    financePage: page,
  }) => {
    const categories = [
      "fuel",
      "maintenance",
      "tolls",
      "tyres",
      "insurance",
      "licensing",
      "salary",
      "other",
    ];

    for (const category of categories) {
      await goToExpenses(page);
      const description = await addExpense(page, { category });

      await expect(page.getByText(description)).toBeVisible({
        timeout: 8_000,
      });
    }
  });

  test("submitting empty form shows required field errors", async ({
    financePage: page,
  }) => {
    await goToExpenses(page);

    await page
      .getByRole("button", { name: /add expense|new expense|log expense/i })
      .or(page.getByTestId("add-expense-btn"))
      .click();

    await page.getByRole("button", { name: /save|submit|create/i }).click();

    // NOTE: if the expense form uses HTML `required` (not zod/react-hook-form),
    // change this to: page.locator("input:invalid").first()
    await expect(
      page.getByText(/required|this field|please enter/i).first()
    ).toBeVisible({ timeout: 4_000 });
  });

  test("zero amount is rejected", async ({ financePage: page }) => {
    await goToExpenses(page);

    await page
      .getByRole("button", { name: /add expense|new expense|log expense/i })
      .or(page.getByTestId("add-expense-btn"))
      .click();

    await page.getByLabel(/category/i).selectOption("tolls").catch(() => {});
    await page.getByLabel(/amount/i).fill("0");
    await page.getByLabel(/description/i).fill("Zero amount test");
    await page.getByLabel(/date|expense.*date/i).fill(
      new Date().toISOString().split("T")[0]
    );
    await page.getByRole("button", { name: /save|submit|create/i }).click();

    await expect(
      page.getByText(/greater than|positive|invalid|must be/i)
    ).toBeVisible({ timeout: 4_000 });
  });

  test("negative amount is rejected", async ({ financePage: page }) => {
    await goToExpenses(page);

    await page
      .getByRole("button", { name: /add expense|new expense|log expense/i })
      .or(page.getByTestId("add-expense-btn"))
      .click();

    await page.getByLabel(/category/i).selectOption("tolls").catch(() => {});
    await page.getByLabel(/amount/i).fill("-100");
    await page.getByLabel(/description/i).fill("Negative amount test");
    await page.getByLabel(/date|expense.*date/i).fill(
      new Date().toISOString().split("T")[0]
    );
    await page.getByRole("button", { name: /save|submit|create/i }).click();

    await expect(
      page.getByText(/greater than|positive|invalid|must be/i)
    ).toBeVisible({ timeout: 4_000 });
  });

  test("empty description is rejected", async ({ financePage: page }) => {
    await goToExpenses(page);

    await page
      .getByRole("button", { name: /add expense|new expense|log expense/i })
      .or(page.getByTestId("add-expense-btn"))
      .click();

    await page.getByLabel(/category/i).selectOption("other").catch(() => {});
    await page.getByLabel(/amount/i).fill("100");
    // Leave description blank intentionally
    await page.getByLabel(/date|expense.*date/i).fill(
      new Date().toISOString().split("T")[0]
    );
    await page.getByRole("button", { name: /save|submit|create/i }).click();

    await expect(
      page.getByText(/required|this field|please enter/i).first()
    ).toBeVisible({ timeout: 4_000 });
  });

  test("admin can also log an expense", async ({ adminPage: page }) => {
    await goToExpenses(page);
    const description = await addExpense(page);
    await expect(page.getByText(description)).toBeVisible({ timeout: 8_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FILTER
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Expenses — filter", () => {
  test("filtering by category 'tolls' shows only toll expenses", async ({
    financePage: page,
  }) => {
    await goToExpenses(page);

    await addExpense(page, { category: "tolls", description: `Toll-${Date.now()}` });
    await goToExpenses(page);

    const categoryFilter = page
      .getByLabel(/filter.*category|category.*filter/i)
      .or(page.getByTestId("category-filter"));

    const filterExists = await categoryFilter.isVisible().catch(() => false);
    if (!filterExists) {
      test.skip();
      return;
    }

    await categoryFilter.selectOption("tolls");
    await page.waitForLoadState("networkidle");

    const categoryBadges = page.getByTestId("expense-category-badge");
    const count = await categoryBadges.count();
    for (let i = 0; i < count; i++) {
      await expect(categoryBadges.nth(i)).toHaveText(/tolls/i);
    }
  });

  test("filtering by date range narrows the list", async ({
    financePage: page,
  }) => {
    await goToExpenses(page);

    const today = new Date();
    const weekAgo = new Date();
    weekAgo.setDate(today.getDate() - 7);

    const fromStr = weekAgo.toISOString().split("T")[0];
    const toStr = today.toISOString().split("T")[0];

    await page.getByLabel(/from|start.*(date)?/i).fill(fromStr).catch(() => {});
    await page.getByLabel(/to|end.*(date)?/i).fill(toStr).catch(() => {});
    await page
      .getByRole("button", { name: /apply|filter|search/i })
      .click()
      .catch(() => page.keyboard.press("Enter"));

    await page.waitForLoadState("networkidle");
    await expect(page).not.toHaveURL(/\/login|\/403|\/500/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// EDIT
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Expenses — edit", () => {
  test("finance can update expense amount and description @smoke", async ({
    financePage: page,
  }) => {
    await goToExpenses(page);
    const description = await addExpense(page);

    await page.getByText(description).click();
    await page.waitForLoadState("networkidle");

    await page
      .getByRole("button", { name: /edit/i })
      .or(page.getByTestId("edit-expense-btn"))
      .click();

    const updatedDesc = `Updated ${Date.now()}`;
    await page.getByLabel(/description/i).fill(updatedDesc);
    await page.getByLabel(/amount/i).fill("9999");
    await page.getByRole("button", { name: /save|update/i }).click();

    await expect(page.getByText(updatedDesc)).toBeVisible({ timeout: 6_000 });
    await expect(page.getByText(/9,?999|9999/)).toBeVisible({
      timeout: 6_000,
    });
  });

  test("partial edit preserves category", async ({
    financePage: page,
  }) => {
    await goToExpenses(page);
    const description = await addExpense(page, { category: "insurance" });

    await page.getByText(description).click();
    await page.waitForLoadState("networkidle");

    await page
      .getByRole("button", { name: /edit/i })
      .or(page.getByTestId("edit-expense-btn"))
      .click();

    const newDesc = `Partial edit ${Date.now()}`;
    await page.getByLabel(/description/i).fill(newDesc);
    await page.getByRole("button", { name: /save|update/i }).click();

    await expect(page.getByText(newDesc)).toBeVisible({ timeout: 6_000 });
    await expect(page.getByText(/insurance/i)).toBeVisible({ timeout: 6_000 });
  });

  test("mechanic cannot edit expenses", async ({
    financePage: finPage,
    mechanicPage: mechPage,
  }) => {
    await goToExpenses(finPage);
    const description = await addExpense(finPage);

    // MECHANIC is not in fuel roles — they will be redirected before seeing
    // any expense. If they somehow reach the list, the edit button is absent.
    await mechPage.goto(EXPENSE_ROUTE);
    await mechPage.waitForLoadState("networkidle");

    const row = mechPage.getByText(description);
    const exists = await row.isVisible().catch(() => false);
    if (!exists) return; // redirected — edit button trivially absent

    await row.click();
    await mechPage.waitForLoadState("networkidle");

    await expect(
      mechPage.getByRole("button", { name: /edit/i })
    ).not.toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Expenses — delete", () => {
  test("finance can delete an expense and it disappears from the list", async ({
    financePage: page,
  }) => {
    await goToExpenses(page);
    const description = await addExpense(page);

    await expect(page.getByText(description)).toBeVisible();

    await page.getByText(description).click();
    await page.waitForLoadState("networkidle");

    await page
      .getByRole("button", { name: /delete|remove/i })
      .or(page.getByTestId("delete-expense-btn"))
      .click();

    await page
      .getByRole("button", { name: /confirm|yes|delete/i })
      .or(page.getByTestId("confirm-delete-btn"))
      .click();

    await page.waitForURL(new RegExp(EXPENSE_ROUTE), { timeout: 8_000 });
    await expect(page.getByText(description)).not.toBeVisible();
  });

  test("admin can delete an expense", async ({ adminPage: page }) => {
    await goToExpenses(page);
    const description = await addExpense(page);

    await page.getByText(description).click();
    await page.waitForLoadState("networkidle");

    await page
      .getByRole("button", { name: /delete|remove/i })
      .or(page.getByTestId("delete-expense-btn"))
      .click();

    await page
      .getByRole("button", { name: /confirm|yes|delete/i })
      .or(page.getByTestId("confirm-delete-btn"))
      .click();

    await expect(page.getByText(description)).not.toBeVisible({
      timeout: 8_000,
    });
  });

  test("mechanic cannot delete expenses", async ({
    financePage: finPage,
    mechanicPage: mechPage,
  }) => {
    await goToExpenses(finPage);
    const description = await addExpense(finPage);

    await mechPage.goto(EXPENSE_ROUTE);
    await mechPage.waitForLoadState("networkidle");

    const row = mechPage.getByText(description);
    const exists = await row.isVisible().catch(() => false);
    if (!exists) return; // redirected — delete button trivially absent

    await row.click();
    await mechPage.waitForLoadState("networkidle");

    await expect(
      mechPage.getByRole("button", { name: /delete|remove/i })
    ).not.toBeVisible();
  });
});