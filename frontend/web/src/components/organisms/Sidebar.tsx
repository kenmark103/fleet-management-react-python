/**
 * components/organisms/Sidebar.tsx
 * Fleet Management System — Phase 9
 *
 * Improvements over Phase 2:
 *   - Org name displayed at top (from settings context)
 *   - Section group labels ("Fleet Operations", "Management", "Config")
 *   - Stronger active state with left accent bar
 *   - Smooth expand/collapse animation
 *   - Bottom: version/build info
 */

import { useState } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { ChevronDown, ChevronRight, Circle } from "lucide-react";
import { cn } from "../../lib/utils";
import { getNavItemsForRole, APP_NAME, type NavItem, type UserRole } from "../../lib/constants";
import { useAppSettings } from "../../lib/settings-context";

interface SidebarProps {
  role:             UserRole;
  mobileOpen?:      boolean;
  onMobileClose?:   () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION GROUPS — adds visual grouping labels
// ─────────────────────────────────────────────────────────────────────────────

// Map a nav item's href to a section label
const SECTION_BREAKS: Record<string, string> = {
  "/fleet":        "Fleet Operations",
  "/trips":        "Operations",       // fleet already started the group
  "/maintenance":  "Operations",
  "/fuel":         "Operations",
  "/drivers":      "Operations",
  "/settings":     "Account",
};

// Determine if we should show a section header before this item
// We show it only when the section NAME changes (first item in new section)
function getSectionLabel(item: NavItem, prevItem: NavItem | null): string | null {
  const curr = SECTION_BREAKS[item.href] ?? null;
  const prev = prevItem ? (SECTION_BREAKS[prevItem.href] ?? null) : null;
  if (curr && curr !== prev) return curr;
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// SIDEBAR
// ─────────────────────────────────────────────────────────────────────────────

export function Sidebar({ role, mobileOpen = false, onMobileClose }: SidebarProps) {
  const { pathname } = useLocation();
  const { settings } = useAppSettings();
  const navItems     = getNavItemsForRole(role);
  const orgName      = settings.orgName ?? APP_NAME;

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={onMobileClose}
          aria-hidden
        />
      )}

      {/* Panel */}
      <aside
        className={cn(
          "fixed left-0 top-14 z-30 flex h-[calc(100vh-3.5rem)] w-56 flex-col",
          "border-r bg-background transition-transform duration-200",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        {/* Org name / logo area */}
        <div className="flex items-center gap-2.5 border-b px-4 py-3">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Circle className="h-3 w-3 fill-current" />
          </div>
          <p className="truncate text-sm font-semibold text-foreground">
            {orgName}
          </p>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-3">
          {navItems.map((item, i) => {
            const prev       = i > 0 ? navItems[i - 1] : null;
            const sectionLabel = getSectionLabel(item, prev);

            return (
              <div key={item.href}>
                {/* Section divider */}
                {sectionLabel && (
                  <div className="mb-1 mt-3 px-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                      {sectionLabel}
                    </p>
                  </div>
                )}

                {item.children ? (
                  <ExpandableNavItem
                    item={item}
                    pathname={pathname}
                    onNavigate={onMobileClose}
                  />
                ) : (
                  <NavLink
                    item={item}
                    active={pathname === item.href || pathname.startsWith(item.href + "/")}
                    onNavigate={onMobileClose}
                  />
                )}
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t px-4 py-2.5">
          <p className="text-[10px] text-muted-foreground/50">
            FleetMS v9 · {role}
          </p>
        </div>
      </aside>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NAV LINK
// ─────────────────────────────────────────────────────────────────────────────

function NavLink({
  item,
  active,
  indent = false,
  onNavigate,
}: {
  item:        NavItem;
  active:      boolean;
  indent?:     boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;

  return (
    <Link
      to={item.href}
      onClick={onNavigate}
      className={cn(
        "group relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-all duration-150",
        indent && "pl-9",
        active
          ? "bg-primary/8 font-medium text-primary"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      )}
    >
      {/* Left accent bar for active state */}
      {active && (
        <span className="absolute left-0 top-1 h-[calc(100%-8px)] w-0.5 rounded-r-full bg-primary" />
      )}
      <Icon className={cn(
        "h-4 w-4 shrink-0 transition-colors",
        active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
      )} />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPANDABLE NAV ITEM
// ─────────────────────────────────────────────────────────────────────────────

function ExpandableNavItem({
  item,
  pathname,
  onNavigate,
}: {
  item:        NavItem;
  pathname:    string;
  onNavigate?: () => void;
}) {
  const isChildActive = item.children?.some(
    (c) => pathname === c.href || pathname.startsWith(c.href + "/")
  ) ?? false;
  const [open, setOpen] = useState(isChildActive);
  const Icon = item.icon;

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-all duration-150",
          isChildActive
            ? "font-medium text-foreground"
            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
        )}
      >
        <Icon className={cn(
          "h-4 w-4 shrink-0",
          isChildActive ? "text-foreground" : "text-muted-foreground"
        )} />
        <span className="flex-1 truncate text-left">{item.label}</span>
        <span className="text-muted-foreground transition-transform duration-200"
          style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}>
          <ChevronDown className="h-3.5 w-3.5" />
        </span>
      </button>

      {/* Animated children */}
      <div
        className="overflow-hidden transition-all duration-200"
        style={{ maxHeight: open ? "500px" : "0px", opacity: open ? 1 : 0 }}
      >
        <div className="mt-0.5 space-y-0.5 pb-0.5">
          {item.children?.map((child) => (
            <NavLink
              key={child.href}
              item={child}
              active={pathname === child.href || pathname.startsWith(child.href + "/")}
              indent
              onNavigate={onNavigate}
            />
          ))}
        </div>
      </div>
    </div>
  );
}