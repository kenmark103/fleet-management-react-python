/**
 * routes/_auth.tsx
 * Fleet Management System — Phase 2
 *
 * Protected layout route — TanStack Router convention.
 * Every route nested under _auth/ goes through this layout.
 *
 * Responsibilities:
 *   1. Auth guard — redirects unauthenticated users to /login
 *   2. Renders AppShell (Topbar + Sidebar) around child pages
 *
 * ── Why no beforeLoad guard ──
 * The project uses createRootRoute (not createRootRouteWithContext), and
 * AuthProvider lives inside the React tree in RootLayout. This means the
 * router's `context` object is always `{}` — auth state is not on it.
 * The guard must live in the component using useAuth() + useNavigate().
 */

import { useEffect } from "react";
import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/organisms/AppShell";
import { LoadingSpinner } from "@/components/atoms/LoadingSpinner";
import { SettingsProvider } from "../lib/settings-context";

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE DEFINITION
// ─────────────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/_auth")({
  component: AuthLayout,
});

// ─────────────────────────────────────────────────────────────────────────────
// LAYOUT COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

function AuthLayout() {
  const { user, isLoading, logout } = useAuth();
  const navigate = useNavigate();

  // ── Auth guard — runs after isLoading settles.
  // While loading we show the spinner; once resolved, if there's no user
  // we redirect to /login. The replace: true prevents the protected route
  // from appearing in browser history.
  useEffect(() => {
    if (!isLoading && !user) {
      navigate({ to: "/login", replace: true });
    }
  }, [isLoading, user, navigate]);

  if (isLoading) {
    return <LoadingSpinner fullscreen />;
  }

  // TypeScript narrowing — after the loading check above, if we're still
  // rendering this means user is non-null (redirect would have fired otherwise).
  if (!user) {
    return null;
  }

  return (
    <SettingsProvider>
      <AppShell user={user} onLogout={logout}>
        <Outlet />
      </AppShell>
    </SettingsProvider>
  );
}