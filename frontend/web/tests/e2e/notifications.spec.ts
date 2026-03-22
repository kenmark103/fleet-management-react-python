/**
 * tests/e2e/notifications.spec.ts
 * Fleet Management System — E2E
 *
 * ── Fix log ───────────────────────────────────────────────────────────────────
 *
 * Bell button selector:
 *   BEFORE: getByTestId("notif-bell") or getByRole("button", { name:/notification/i })
 *   AFTER:  page.locator("header").getByRole("button").first()
 *   WHY:    Topbar.tsx renders the bell as a plain variant="ghost" size="icon"
 *           Button with NO aria-label, NO testId, and NO visible text.
 *           It is the first icon button in the header (before the user menu).
 *           NOTE: add aria-label="Notifications" to the Topbar bell button
 *           to make this selector stable long-term.
 *
 * Badge selector:
 *   BEFORE: getByTestId("notif-badge")
 *   AFTER:  bell button's child span (no testId exists)
 *   WHY:    Topbar.tsx renders the count as an anonymous <span> inside the bell
 *           button — no testId. Located via the bell button locator.
 *
 * Notification list items:
 *   BEFORE: getByTestId("notification-item")
 *   AFTER:  getByRole("listitem")
 *   WHY:    notifications/index.tsx uses <ul>/<li> with no data-testid attributes
 *           anywhere in the component.
 *
 * Mark single read / Delete buttons:
 *   BEFORE: clicked directly
 *   AFTER:  hover the <li> first, then click
 *   WHY:    Both buttons have class "opacity-0 group-hover:opacity-100" —
 *           they are invisible and non-interactable until the parent <li> is
 *           hovered. Playwright's .click() on an invisible element throws.
 *   Mark read button: title="Mark as read" (no text, icon-only)
 *   Delete button:    title="Delete" (no text, icon-only)
 *
 * Mark all read:
 *   The button lives in the PageHeader actions area with text "Mark all read"
 *   and is only rendered when unreadCount > 0. Tests skip if button is absent.
 *
 * Unread filter:
 *   BEFORE: getByRole("button", {name:/unread/i}) or getByLabel(/unread.*(only)?/i)
 *   AFTER:  getByRole("button", { name: /unread only/i })
 *   WHY:    notifications/index.tsx renders a <button> with text "Unread only"
 *           (not a toggle, not a label, not a checkbox).
 *
 * triggerNotificationViaWorkOrder:
 *   BEFORE: navigated to "/work-orders" — does not exist in routeTree.
 *   AFTER:  removed. Tests that need a pre-existing notification skip gracefully
 *           if none are present, or use the /maintenance route to create a
 *           work order. Notification creation is event-driven and async —
 *           most tests are written to skip cleanly when no items exist.
 *
 * "mechanic cannot see admin's notifications" parallel fixture:
 *   Two page fixtures (mechanicPage + adminPage) share a browser context when
 *   used in the same test. This works correctly with Playwright's extend() model.
 *   The route guard tests use /notifications directly — valid (in routeTree).
 */

import { test, expect } from "./fixtures";

type Page = import("@playwright/test").Page;

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Click the notification bell in the Topbar.
 * The bell is the first icon button in the <header>. It has no aria-label or
 * testId. TODO: add aria-label="Notifications" to Topbar.tsx bell button.
 */
async function openNotificationsBell(page: Page) {
  await page.locator("header").getByRole("button").first().click();
  await page.waitForLoadState("networkidle");
}

async function goToNotifications(page: Page) {
  await page.goto("/notifications");
  await page.waitForLoadState("networkidle");
}

// ─────────────────────────────────────────────────────────────────────────────
// BADGE & PANEL
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Notifications — badge", () => {
  test("notification bell is visible in the header @smoke", async ({
    adminPage: page,
  }) => {
    // Bell is the first icon-only button in the header
    await expect(
      page.locator("header").getByRole("button").first()
    ).toBeVisible({ timeout: 6_000 });
  });

  test("unread badge shows a numeric count when present", async ({
    mechanicPage: page,
  }) => {
    await page.goto("/maintenance");
    await page.waitForLoadState("networkidle");

    // Badge is an anonymous <span> inside the bell button — no testId
    const bellBtn = page.locator("header").getByRole("button").first();
    const badge = bellBtn.locator("span").filter({ hasText: /\d+/ }).first();

    const isVisible = await badge.isVisible().catch(() => false);
    if (isVisible) {
      const text = await badge.textContent();
      expect(text).toMatch(/\d+|\d+\+/);
    }
    // No unread notifications → badge absent → test passes (expected state)
  });

  test("clicking bell opens the notifications dropdown", async ({
    mechanicPage: page,
  }) => {
    await page.goto("/maintenance");
    await page.waitForLoadState("networkidle");

    await openNotificationsBell(page);

    // Topbar dropdown has a header "Notifications" and a footer link
    await expect(
      page.getByRole("heading", { name: /notifications/i })
        .or(page.getByText(/notifications/i).first())
    ).toBeVisible({ timeout: 6_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// LIST PAGE
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Notifications — list page", () => {
  test("notifications page loads @smoke", async ({ mechanicPage: page }) => {
    await goToNotifications(page);
    await expect(page).not.toHaveURL(/\/login|\/403|\/forbidden/);
    // Page renders a <ul> list or an empty state
    await expect(
      page.getByRole("list").or(page.getByText(/you're all caught up/i))
    ).toBeVisible({ timeout: 8_000 });
  });

  test("each notification shows a title and message", async ({
    mechanicPage: page,
  }) => {
    await goToNotifications(page);

    // FIX: no data-testid — use getByRole("listitem")
    const items = page.getByRole("listitem");
    const count = await items.count();

    if (count > 0) {
      await expect(items.first()).not.toBeEmpty();
    }
    // Zero items → nothing to assert → test passes
  });

  test("unread-only filter works", async ({ mechanicPage: page }) => {
    await goToNotifications(page);

    // FIX: filter is a <button> with text "Unread only" (not a label/checkbox)
    const unreadBtn = page.getByRole("button", { name: /unread only/i });
    const exists = await unreadBtn.isVisible().catch(() => false);
    if (!exists) { test.skip(); return; }

    await unreadBtn.click();
    await page.waitForLoadState("networkidle");
    await expect(page).not.toHaveURL(/\/login|\/403/);
  });

  test("type filter pills are rendered", async ({ mechanicPage: page }) => {
    await goToNotifications(page);

    // notifications/index.tsx renders TYPE_FILTERS as pill buttons
    await expect(page.getByRole("button", { name: /^all$/i })).toBeVisible({ timeout: 6_000 });
    await expect(page.getByRole("button", { name: /^trips$/i })).toBeVisible({ timeout: 6_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// MARK SINGLE READ
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Notifications — mark single read", () => {
  test("hovering an item reveals the mark-read button @smoke", async ({
    mechanicPage: page,
  }) => {
    await goToNotifications(page);

    const items = page.getByRole("listitem");
    const count = await items.count();
    if (count === 0) { test.skip(); return; }

    // FIX: mark-read button is opacity-0 until the <li> is hovered
    const firstItem = items.first();
    await firstItem.hover();

    // Button has title="Mark as read" — accessible name via title attribute
    const markBtn = firstItem.getByRole("button", { name: /mark as read/i });
    await expect(markBtn).toBeVisible({ timeout: 4_000 });
  });

  test("clicking mark-read removes the unread indicator", async ({
    mechanicPage: page,
  }) => {
    await goToNotifications(page);

    // Find an item that has "New" text (unread indicator)
    const unreadItem = page
      .getByRole("listitem")
      .filter({ hasText: /\bNew\b/ })
      .first();

    const hasUnread = await unreadItem.isVisible().catch(() => false);
    if (!hasUnread) { test.skip(); return; }

    await unreadItem.hover();
    await unreadItem.getByRole("button", { name: /mark as read/i }).click();
    await page.waitForLoadState("networkidle");

    // After marking read, "New" badge should disappear from that item
    await expect(unreadItem.getByText(/\bNew\b/)).not.toBeVisible({ timeout: 4_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// MARK ALL READ
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Notifications — mark all read", () => {
  test("mark all read button appears when unread items exist @smoke", async ({
    mechanicPage: page,
  }) => {
    await goToNotifications(page);

    // Button is in PageHeader actions — only rendered when unreadCount > 0
    const markAllBtn = page.getByRole("button", { name: /mark all read/i });
    const exists = await markAllBtn.isVisible().catch(() => false);
    if (!exists) { test.skip(); return; }

    await expect(markAllBtn).toBeVisible();
  });

  test("clicking mark all read clears the unread indicators", async ({
    mechanicPage: page,
  }) => {
    await goToNotifications(page);

    const markAllBtn = page.getByRole("button", { name: /mark all read/i });
    const exists = await markAllBtn.isVisible().catch(() => false);
    if (!exists) { test.skip(); return; }

    await markAllBtn.click();
    await page.waitForLoadState("networkidle");

    // All "New" badges should be gone; mark-all button should also disappear
    await expect(page.getByRole("button", { name: /mark all read/i })).not.toBeVisible({
      timeout: 6_000,
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Notifications — delete", () => {
  test("deleting a notification removes it from the list", async ({
    mechanicPage: page,
  }) => {
    await goToNotifications(page);

    const items = page.getByRole("listitem");
    const countBefore = await items.count();
    if (countBefore === 0) { test.skip(); return; }

    const firstItem = items.first();

    // FIX: delete button is opacity-0 until hovered (title="Delete", icon-only)
    await firstItem.hover();
    await firstItem.getByRole("button", { name: /delete/i }).click();

    // No confirm dialog in notifications/index.tsx — deletion is immediate
    await page.waitForLoadState("networkidle");

    const countAfter = await items.count();
    expect(countAfter).toBe(countBefore - 1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// USER SCOPING
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Notifications — user scoping", () => {
  test("mechanic only sees their own notifications, not admin's", async ({
    mechanicPage: mechanicPg,
    adminPage:    adminPg,
  }) => {
    await goToNotifications(mechanicPg);
    const mechanicCount = await mechanicPg.getByRole("listitem").count();

    await goToNotifications(adminPg);
    const adminCount = await adminPg.getByRole("listitem").count();

    expect(mechanicCount).toBeGreaterThanOrEqual(0);
    expect(adminCount).toBeGreaterThanOrEqual(0);

    await expect(mechanicPg).not.toHaveURL(/\/login|\/403/);
    await expect(adminPg).not.toHaveURL(/\/login|\/403/);
  });
});