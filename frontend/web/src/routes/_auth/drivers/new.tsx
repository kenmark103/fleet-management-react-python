/**
 * routes/_auth/drivers/new.tsx
 * Fleet Management System
 *
 * This route immediately redirects to /settings/users/new?role=DRIVER.
 *
 * Why: The "Add Driver" button on the drivers list page used to have its
 * own invite form. That was duplication — /settings/users/new already
 * handles invites for all roles. Passing ?role=DRIVER just pre-selects
 * the role dropdown so the admin doesn't have to change it.
 *
 * This file exists so that any existing links/bookmarks to /drivers/new
 * still work, and so the route is formally defined for TanStack Router.
 */

import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth/drivers/new")({
  // beforeLoad fires before the component renders — redirect immediately.
  // The user never sees a flash of this page.
  beforeLoad: () => {
    throw redirect({
      to:     "/settings/users/new",
      search: { role: "DRIVER" },
    });
  },
  // Component is never rendered but TypeScript requires it
  component: () => null,
});