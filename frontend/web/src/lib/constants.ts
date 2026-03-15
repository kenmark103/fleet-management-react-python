/**
 * lib/constants.ts
 * Fleet Management System — Phase 2
 *
 * Single source of truth for:
 *   - Role definitions
 *   - Status options (trucks, drivers, trips, work orders, fuel)
 *   - Sidebar nav config (filtered by role in Sidebar component)
 *
 * Section refs: §1 Roles, §2 Permission Matrix, §3 Sidebar Nav, §7.2 NavItem type
 */

import {
  LayoutDashboard,
  Truck,
  Container,
  Users,
  MapPin,
  Fuel,
  Wrench,
  UserCog,
  Settings,
  UserCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ExpenseCategory } from "../types/fuel";

// ─────────────────────────────────────────────────────────────────────────────
// ROLES  §1.1
// ─────────────────────────────────────────────────────────────────────────────

export const USER_ROLES = [
  "ADMIN",
  "DISPATCHER",
  "DRIVER",
  "MECHANIC",
  "FINANCE",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

/** Human-readable title per role — used in RoleBadge, Topbar, User list */
export const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: "System Administrator",
  DISPATCHER: "Fleet Dispatcher",
  DRIVER: "Vehicle Driver",
  MECHANIC: "Fleet Mechanic",
  FINANCE: "Finance Officer",
};

/** Short label for compact displays (badges, table cells) */
export const ROLE_SHORT_LABELS: Record<UserRole, string> = {
  ADMIN: "Admin",
  DISPATCHER: "Dispatcher",
  DRIVER: "Driver",
  MECHANIC: "Mechanic",
  FINANCE: "Finance",
};

/** Tailwind color classes per role — used by RoleBadge */
export const ROLE_COLORS: Record<UserRole, string> = {
  ADMIN: "bg-red-100 text-red-700 border-red-200",
  DISPATCHER: "bg-blue-100 text-blue-700 border-blue-200",
  DRIVER: "bg-green-100 text-green-700 border-green-200",
  MECHANIC: "bg-orange-100 text-orange-700 border-orange-200",
  FINANCE: "bg-purple-100 text-purple-700 border-purple-200",
};

// ─────────────────────────────────────────────────────────────────────────────
// STATUS OPTIONS  §4.1 StatusBadge
// ─────────────────────────────────────────────────────────────────────────────

/** All possible status values across the system */
export const STATUS_VALUES = [
  "active",
  "inactive",
  "en-route",
  "completed",
  "pending",
  "overdue",
  "cancelled",
  "in-progress",
  "scheduled",
  "under-maintenance",
  "on-leave",
  "suspended",
] as const;

export type StatusValue = (typeof STATUS_VALUES)[number];

/** Human-readable labels for StatusBadge */
export const STATUS_LABELS: Record<StatusValue, string> = {
  active:              "Active",
  inactive:            "Inactive",
  "en-route":          "En Route",
  completed:           "Completed",
  pending:             "Pending",
  overdue:             "Overdue",
  cancelled:           "Cancelled",
  "in-progress":       "In Progress",
  scheduled:           "Scheduled",
  "under-maintenance": "Under Maintenance",
  "on-leave":          "On Leave",
  suspended:           "Suspended",
};

/** Tailwind color classes for StatusBadge */
export const STATUS_COLORS: Record<StatusValue, string> = {
  active:              "bg-green-100 text-green-700 border-green-200",
  inactive:            "bg-gray-100 text-gray-600 border-gray-200",
  "en-route":          "bg-blue-100 text-blue-700 border-blue-200",
  completed:           "bg-emerald-100 text-emerald-700 border-emerald-200",
  pending:             "bg-yellow-100 text-yellow-700 border-yellow-200",
  overdue:             "bg-red-100 text-red-700 border-red-200",
  cancelled:           "bg-red-50 text-red-500 border-red-100",
  "in-progress":       "bg-indigo-100 text-indigo-700 border-indigo-200",
  scheduled:           "bg-sky-100 text-sky-700 border-sky-200",
  "under-maintenance": "bg-orange-100 text-orange-700 border-orange-200",
  "on-leave":          "bg-purple-100 text-purple-700 border-purple-200",
  suspended:           "bg-red-100 text-red-800 border-red-300",
};


// ─────────────────────────────────────────────────────────────────────────────
// EXPENSE CATEGORIES  §2.6  — add to lib/constants.ts
// ─────────────────────────────────────────────────────────────────────────────


export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  fuel:        "Fuel",
  maintenance: "Maintenance",
  tolls:       "Tolls",
  tyres:       "Tyres",
  insurance:   "Insurance",
  licensing:   "Licensing",
  salary:      "Salary",
  other:       "Other",
};

export const EXPENSE_CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  fuel:        "bg-blue-100 text-blue-700 border-blue-200",
  maintenance: "bg-orange-100 text-orange-700 border-orange-200",
  tolls:       "bg-yellow-100 text-yellow-700 border-yellow-200",
  tyres:       "bg-red-100 text-red-700 border-red-200",
  insurance:   "bg-emerald-100 text-emerald-700 border-emerald-200",
  licensing:   "bg-purple-100 text-purple-700 border-purple-200",
  salary:      "bg-indigo-100 text-indigo-700 border-indigo-200",
  other:       "bg-gray-100 text-gray-600 border-gray-200",
};

// Scoped subsets — used by FilterBar dropdowns

/** §types/fleet.ts — TruckStatus values */
export const TRUCK_STATUSES = [
  "active",
  "inactive",
  "in-progress",
  "under-maintenance",
] as const satisfies StatusValue[];

/** §types/driver.ts — DriverStatus values */
export const DRIVER_STATUSES = [
  "active",
  "inactive",
  "on-leave",
  "suspended",
] as const satisfies StatusValue[];

export const TRAILER_STATUSES = [
  "active",
  "inactive",
  "under-maintenance",
] as const satisfies StatusValue[];

/** §types/trip.ts — TripStatus values */
export const TRIP_STATUSES = [
  "pending",
  "en-route",
  "completed",
  "cancelled",
] as const satisfies StatusValue[];

export type TripStatus = (typeof TRIP_STATUSES)[number];

/** §types/maintenance.ts — WorkOrder status values */
export const WORK_ORDER_STATUSES = [
  "pending",
  "in-progress",
  "completed",
  "overdue",
] as const satisfies StatusValue[];

// ─────────────────────────────────────────────────────────────────────────────
// SIDEBAR NAV CONFIG  §3, §7.2
// ─────────────────────────────────────────────────────────────────────────────

/**
 * NavItem shape defined in §7.2.
 * Sidebar component filters this array by the logged-in user's role.
 * Items not in a role's list are never rendered — not just hidden.
 */
export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  roles: UserRole[];
  children?: NavItem[];
};

export const NAV_ITEMS: NavItem[] = [
  // ── Dashboard — all roles ────────────────────────────────────────────────
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    roles: ["ADMIN", "DISPATCHER", "DRIVER", "MECHANIC", "FINANCE"],
  },

  // ── Fleet — no DRIVER ────────────────────────────────────────────────────
  {
    label: "Fleet",
    href: "/fleet",
    icon: Truck,
    roles: ["ADMIN", "DISPATCHER", "MECHANIC", "FINANCE"],
    children: [
      {
        label: "Trucks",
        href: "/fleet/trucks",
        icon: Truck,
        roles: ["ADMIN", "DISPATCHER", "MECHANIC", "FINANCE"],
      },
      {
        label: "Trailers",
        href: "/fleet/trailers",
        icon: Container,
        roles: ["ADMIN", "DISPATCHER", "MECHANIC", "FINANCE"],
      },
    ],
  },

  // ── Drivers — ADMIN, DISPATCHER, DRIVER (own profile) ───────────────────
  {
    label: "Drivers",
    href: "/drivers",
    icon: Users,
    roles: ["ADMIN", "DISPATCHER", "DRIVER"],
  },

  // ── Trips & Dispatch — ADMIN, DISPATCHER, DRIVER (own), FINANCE ─────────
  {
    label: "Trips & Dispatch",
    href: "/trips",
    icon: MapPin,
    roles: ["ADMIN", "DISPATCHER", "DRIVER", "FINANCE"],
  },

  // ── Fuel & Costs — ADMIN, DRIVER (log only), FINANCE ────────────────────
  {
    label: "Fuel & Costs",
    href: "/fuel",
    icon: Fuel,
    roles: ["ADMIN", "DRIVER", "FINANCE"],
  },

  // ── Maintenance — ADMIN, DISPATCHER (view only), MECHANIC ───────────────
  {
    label: "Maintenance",
    href: "/maintenance",
    icon: Wrench,
    roles: ["ADMIN", "DISPATCHER", "MECHANIC"],
  },

  // ── Settings — ADMIN only ────────────────────────────────────────────────
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
    roles: ["ADMIN", "DISPATCHER", "DRIVER", "MECHANIC", "FINANCE"],
    children: [
      {
        label: "Users",
        href: "/settings/users",
        icon: UserCog,
        roles: ["ADMIN"],
      },
      {
        label: "Profile",
        href: "/settings/profile",
        icon: UserCircle,
        roles: ["ADMIN", "DISPATCHER", "DRIVER", "MECHANIC", "FINANCE"],
      },
      {
        label: "System",
        href: "/settings/system",
        icon: Settings,
        roles: ["ADMIN"],
      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// NAV HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the flat list of nav items visible to a given role.
 * Used by Sidebar to render only what the role can access.
 * Children are also filtered — a parent is included only if
 * it has at least one visible child.
 */
export function getNavItemsForRole(role: UserRole): NavItem[] {
  return NAV_ITEMS.reduce<NavItem[]>((acc, item) => {
    if (!item.roles.includes(role)) return acc;

    if (item.children) {
      const visibleChildren = item.children.filter((child) =>
        child.roles.includes(role)
      );
      // Only include parent if it has visible children
      if (visibleChildren.length > 0) {
        acc.push({ ...item, children: visibleChildren });
      }
    } else {
      acc.push(item);
    }

    return acc;
  }, []);
}

// ─────────────────────────────────────────────────────────────────────────────
// MISC APP CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

export const APP_NAME = "FleetMS";

/** Default pagination page size for DataTable */
export const DEFAULT_PAGE_SIZE = 20;

/** Accepted file types for document uploads */
export const ACCEPTED_DOC_TYPES = {
  "application/pdf": [".pdf"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
};

/** Max file size for uploads in bytes (5 MB) */
export const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024;

/** API base path prefix */
export const API_BASE_URL = "/api/v1";