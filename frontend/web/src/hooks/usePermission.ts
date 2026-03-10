/**
 * hooks/usePermission.ts
 * Fleet Management System — Phase 2
 *
 * Permission hook — the single source of truth for what each role
 * can do in the UI. Mirrors the permission matrix in §2.
 *
 * Usage:
 *   const { can, role } = usePermission();
 *   if (can("trucks:create")) { ... }
 *
 * Pure function also exported for use outside React:
 *   hasPermission("DISPATCHER", "trips:create") → true
 */

import { useAuth } from "../lib/auth-context";
import type { UserRole } from "../lib/constants";

// ─────────────────────────────────────────────────────────────────────────────
// ACTION DEFINITIONS  (§2 Permission Matrix)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All permission action keys in the system.
 * Format: "<module>:<action>"
 */
export type PermissionAction =
  // ── Dashboard §2.1 ─────────────────────────────────────────────────────
  | "dashboard:view-kpi"
  | "dashboard:view-my-trips"
  | "dashboard:view-maintenance-alerts"
  | "dashboard:view-cost-summary"
  | "dashboard:view-activity-feed"
  | "dashboard:view-expiry-alerts"
  // ── Trucks §2.2 ────────────────────────────────────────────────────────
  | "trucks:view-list"
  | "trucks:view-detail"
  | "trucks:create"
  | "trucks:edit"
  | "trucks:delete"
  | "trucks:view-service-history"
  | "trucks:view-documents"
  | "trucks:upload-documents"
  // ── Trailers §2.3 ──────────────────────────────────────────────────────
  | "trailers:view-list"
  | "trailers:view-detail"
  | "trailers:create"
  | "trailers:edit"
  | "trailers:delete"
  | "trailers:assign-to-trip"
  | "trailers:view-documents"
  // ── Drivers / HR §2.4 ──────────────────────────────────────────────────
  | "drivers:view-list"
  | "drivers:view-any-profile"
  | "drivers:view-own-profile"
  | "drivers:create"
  | "drivers:edit"
  | "drivers:view-documents"
  | "drivers:upload-documents"
  | "drivers:view-trip-history"
  // ── Trips §2.5 ─────────────────────────────────────────────────────────
  | "trips:view-all"
  | "trips:view-own"
  | "trips:create"
  | "trips:assign-truck"
  | "trips:assign-driver"
  | "trips:edit"
  | "trips:update-status"
  | "trips:cancel"
  | "trips:view-map"
  // ── Fuel & Costs §2.6 ──────────────────────────────────────────────────
  | "fuel:view-all"
  | "fuel:log-own"
  | "fuel:edit"
  | "fuel:view-cost-reports"
  | "fuel:export-reports"
  | "fuel:view-expenses"
  | "fuel:add-expense"
  // ── Maintenance §2.7 ───────────────────────────────────────────────────
  | "maintenance:view-all"
  | "maintenance:create-work-order"
  | "maintenance:update-work-order"
  | "maintenance:close-work-order"
  | "maintenance:view-schedule"
  | "maintenance:set-reminders"
  | "maintenance:view-parts-costs"
  // ── Settings / Admin §2.8 ──────────────────────────────────────────────
  | "settings:view-users"
  | "settings:create-user"
  | "settings:edit-user"
  | "settings:deactivate-user"
  | "settings:system-config"
  | "settings:view-audit-logs";

// ─────────────────────────────────────────────────────────────────────────────
// PERMISSION MAP  — keyed by action, value is the set of allowed roles
// ─────────────────────────────────────────────────────────────────────────────

const PERMISSIONS: Record<PermissionAction, UserRole[]> = {
  // Dashboard §2.1
  "dashboard:view-kpi":                ["ADMIN", "DISPATCHER", "MECHANIC", "FINANCE"],
  "dashboard:view-my-trips":           ["ADMIN", "DISPATCHER", "DRIVER"],
  "dashboard:view-maintenance-alerts": ["ADMIN", "MECHANIC"],
  "dashboard:view-cost-summary":       ["ADMIN", "FINANCE"],
  "dashboard:view-activity-feed":      ["ADMIN", "DISPATCHER", "DRIVER", "MECHANIC", "FINANCE"],
  "dashboard:view-expiry-alerts":      ["ADMIN", "DISPATCHER"],

  // Trucks §2.2
  "trucks:view-list":          ["ADMIN", "DISPATCHER", "MECHANIC", "FINANCE", "DRIVER"],
  "trucks:view-detail":        ["ADMIN", "DISPATCHER", "MECHANIC", "FINANCE", "DRIVER"],
  "trucks:create":             ["ADMIN"],
  "trucks:edit":               ["ADMIN"],
  "trucks:delete":             ["ADMIN"],
  "trucks:view-service-history": ["ADMIN", "DISPATCHER", "MECHANIC"],
  "trucks:view-documents":     ["ADMIN", "DISPATCHER", "FINANCE"],
  "trucks:upload-documents":   ["ADMIN"],

  // Trailers §2.3
  "trailers:view-list":        ["ADMIN", "DISPATCHER", "MECHANIC", "FINANCE", "DRIVER"],
  "trailers:view-detail":      ["ADMIN", "DISPATCHER", "MECHANIC", "FINANCE", "DRIVER"],
  "trailers:create":           ["ADMIN"],
  "trailers:edit":             ["ADMIN"],
  "trailers:delete":           ["ADMIN"],
  "trailers:assign-to-trip":   ["ADMIN", "DISPATCHER"],
  "trailers:view-documents":   ["ADMIN", "DISPATCHER", "FINANCE"],

  // Drivers / HR §2.4
  "drivers:view-list":          ["ADMIN", "DISPATCHER"],
  "drivers:view-any-profile":   ["ADMIN", "DISPATCHER"],
  "drivers:view-own-profile":   ["ADMIN", "DISPATCHER", "DRIVER"],
  "drivers:create":             ["ADMIN"],
  "drivers:edit":               ["ADMIN"],
  "drivers:view-documents":     ["ADMIN", "DISPATCHER", "DRIVER"],
  "drivers:upload-documents":   ["ADMIN"],
  "drivers:view-trip-history":  ["ADMIN", "DISPATCHER", "DRIVER"],

  // Trips §2.5
  "trips:view-all":        ["ADMIN", "DISPATCHER", "FINANCE"],
  "trips:view-own":        ["ADMIN", "DISPATCHER", "DRIVER"],
  "trips:create":          ["ADMIN", "DISPATCHER"],
  "trips:assign-truck":    ["ADMIN", "DISPATCHER"],
  "trips:assign-driver":   ["ADMIN", "DISPATCHER"],
  "trips:edit":            ["ADMIN", "DISPATCHER"],
  "trips:update-status":   ["ADMIN", "DISPATCHER", "DRIVER"],
  "trips:cancel":          ["ADMIN", "DISPATCHER"],
  "trips:view-map":        ["ADMIN", "DISPATCHER", "DRIVER"],

  // Fuel & Costs §2.6
  "fuel:view-all":          ["ADMIN", "FINANCE"],
  "fuel:log-own":           ["ADMIN", "DRIVER"],
  "fuel:edit":              ["ADMIN", "FINANCE"],
  "fuel:view-cost-reports": ["ADMIN", "FINANCE"],
  "fuel:export-reports":    ["ADMIN", "FINANCE"],
  "fuel:view-expenses":     ["ADMIN", "FINANCE"],
  "fuel:add-expense":       ["ADMIN", "FINANCE"],

  // Maintenance §2.7
  "maintenance:view-all":          ["ADMIN", "DISPATCHER", "MECHANIC"],
  "maintenance:create-work-order": ["ADMIN", "MECHANIC"],
  "maintenance:update-work-order": ["ADMIN", "MECHANIC"],
  "maintenance:close-work-order":  ["ADMIN", "MECHANIC"],
  "maintenance:view-schedule":     ["ADMIN", "DISPATCHER", "MECHANIC"],
  "maintenance:set-reminders":     ["ADMIN", "MECHANIC"],
  "maintenance:view-parts-costs":  ["ADMIN", "MECHANIC", "FINANCE"],

  // Settings §2.8
  "settings:view-users":     ["ADMIN"],
  "settings:create-user":    ["ADMIN"],
  "settings:edit-user":      ["ADMIN"],
  "settings:deactivate-user":["ADMIN"],
  "settings:system-config":  ["ADMIN"],
  "settings:view-audit-logs":["ADMIN"],
};

// ─────────────────────────────────────────────────────────────────────────────
// PURE HELPER  (usable outside React — e.g. server-side guards, route loaders)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true if the given role is allowed to perform the action.
 *
 * @example
 *   hasPermission("DISPATCHER", "trips:create")  // true
 *   hasPermission("DRIVER",     "trucks:delete") // false
 */
export function hasPermission(
  role: UserRole | null | undefined,
  action: PermissionAction
): boolean {
  if (!role) return false;
  return PERMISSIONS[action].includes(role);
}

/**
 * Returns true if the role has ALL of the provided actions.
 */
export function hasAllPermissions(
  role: UserRole | null | undefined,
  actions: PermissionAction[]
): boolean {
  return actions.every((action) => hasPermission(role, action));
}

/**
 * Returns true if the role has ANY of the provided actions.
 */
export function hasAnyPermission(
  role: UserRole | null | undefined,
  actions: PermissionAction[]
): boolean {
  return actions.some((action) => hasPermission(role, action));
}

// ─────────────────────────────────────────────────────────────────────────────
// REACT HOOK
// ─────────────────────────────────────────────────────────────────────────────

/**
 * usePermission — hook for permission checks inside React components.
 *
 * @example
 *   const { can, canAny, canAll, role } = usePermission();
 *
 *   can("trucks:create")                          // boolean
 *   canAny(["trips:view-all", "trips:view-own"])  // boolean
 *   canAll(["maintenance:create-work-order", ...]) // boolean
 */
export function usePermission() {
  const { user } = useAuth();
  const role = user?.role ?? null;

  return {
    role,
    /** True if the current user's role can perform this action */
    can: (action: PermissionAction) => hasPermission(role, action),
    /** True if the current user's role can perform ALL of these actions */
    canAll: (actions: PermissionAction[]) => hasAllPermissions(role, actions),
    /** True if the current user's role can perform ANY of these actions */
    canAny: (actions: PermissionAction[]) => hasAnyPermission(role, actions),
  };
}