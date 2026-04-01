/**
 * components/organisms/AppShell.tsx
 * Root layout wrapper for all protected pages.
 * §4.3 Organisms — §7.1 Layout
 *
 * Renders:
 *   Topbar (fixed, full width)
 *   Sidebar (fixed left, below topbar)
 *   Main content area (children render here)
 *
 * The only place Topbar and Sidebar logic lives. Pages never import them directly.
 */

import { useState } from "react";
import { AssistantDrawer } from "./AssistantDrawer";
import { Topbar } from "./Topbar";
import { Sidebar } from "./Sidebar";
import { cn } from "../../lib/utils";
import type { User } from "../../types/auth";
import { Toaster } from "sonner";

interface AppShellProps {
  user: User;
  onLogout: () => void;
  children: React.ReactNode;
  className?: string;
}

export function AppShell({ user, onLogout, children, className }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* ── Toaster — global toast notifications */}
      <Toaster position="bottom-right" richColors />
      {/* ── Topbar (fixed, z-40) */}
      <Topbar
        user={user}
        onLogout={onLogout}
        onMenuToggle={() => setMobileOpen((o) => !o)}
      />

      {/* ── Sidebar (fixed left, z-30) */}
      <Sidebar
        role={user.role}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      {/* ── Main content area
           pt-14  = clear the fixed Topbar (h-14)
           md:pl-56 = clear the fixed Sidebar (w-56) on desktop
      */}
      <main
        className={cn(
          "pt-14 md:pl-56 min-h-screen",
          className
        )}
      >
        <div className="p-6">
          {children}
        </div>
      </main>
      <AssistantDrawer />
    </div>
  );
}
