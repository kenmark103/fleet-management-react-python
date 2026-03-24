/**
 * routes/_auth.tsx
 * Fleet Management System
 *
 * Changes from previous version:
 *   - Added driver profile completion redirect.
 *     When a DRIVER user logs in and has no linked driver_profile yet,
 *     they are sent to /drivers/setup to complete their license details.
 *     This fires only once — after setup, driverProfileId is populated
 *     and the redirect never triggers again.
 *
 * Note: user.driverProfileId must be included in UserResponse from the
 * backend (see schemas/users.py — add driver_profile_id: Optional[str]).
 * The /auth/me endpoint already returns the full User object.
 */

import { useEffect } from "react";
import { createFileRoute, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/organisms/AppShell";
import { LoadingSpinner } from "@/components/atoms/LoadingSpinner";
import { SettingsProvider } from "../lib/settings-context";

export const Route = createFileRoute("/_auth")({
  component: AuthLayout,
});

function AuthLayout() {
  const { user, isLoading, logout } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();

  useEffect(() => {
    if (isLoading) return;

    // Not logged in → send to login
    if (!user) {
      navigate({
        to: "/login",
        search: { redirect: location.pathname },
        replace: true,
      });
      return;
    }

    // Logged in but incomplete DRIVER → send to driver setup
    const needsDriverSetup =
      user.role === "DRIVER" &&
      !user.driverProfileId &&      
      location.pathname !== "/drivers/setup";

    if (needsDriverSetup) {
      navigate({ to: "/drivers/setup", replace: true });
    }
  }, [isLoading, user, navigate, location.pathname]);

  if (isLoading) return <LoadingSpinner fullscreen />;
  if (!user)     return null;

  return (
    <SettingsProvider>
      <AppShell user={user} onLogout={logout}>
        <Outlet />
      </AppShell>
    </SettingsProvider>
  );
}