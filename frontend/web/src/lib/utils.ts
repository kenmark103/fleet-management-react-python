/**
 * lib/utils.ts
 * Fleet Management System — Phase 2
 *
 * Shared utility functions:
 *   - cn()              Tailwind class merging (shadcn standard)
 *   - formatDate()      Date formatting helpers
 *   - formatCurrency()  Currency display for Finance module
 *   - formatDistance()  km/miles for trip distances
 *   - truncate()        Truncate long strings in table cells
 */

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// ─────────────────────────────────────────────────────────────────────────────
// CLASS MERGING  (shadcn standard — used everywhere)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Merges Tailwind classes safely, resolving conflicts.
 * Usage: cn("px-4 py-2", isActive && "bg-blue-500", className)
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

// ─────────────────────────────────────────────────────────────────────────────
// DATE FORMATTING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Formats a date to a readable string.
 * @param date  - ISO string, Date object, or timestamp
 * @param format - "short" | "long" | "datetime" | "relative" | "time"
 *
 * Examples:
 *   formatDate("2026-03-01")              → "Mar 1, 2026"
 *   formatDate("2026-03-01", "long")      → "March 1, 2026"
 *   formatDate("2026-03-01", "datetime")  → "Mar 1, 2026, 10:30 AM"
 *   formatDate("2026-03-01", "relative")  → "2 days ago"
 *   formatDate("2026-03-01", "time")      → "10:30 AM"
 */
export function formatDate(
  date: string | Date | number | null | undefined,
  format: "short" | "long" | "datetime" | "relative" | "time" = "short"
): string {
  if (!date) return "—";

  const d = new Date(date);
  if (isNaN(d.getTime())) return "Invalid date";

  if (format === "relative") {
    return formatRelativeDate(d);
  }

  if (format === "time") {
    return d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  if (format === "long") {
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  if (format === "datetime") {
    return d.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  // default: "short"
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Internal helper — returns human-readable relative time string */
function formatRelativeDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  if (diffSecs < 60) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffWeeks < 5) return `${diffWeeks} week${diffWeeks > 1 ? "s" : ""} ago`;
  if (diffMonths < 12)
    return `${diffMonths} month${diffMonths > 1 ? "s" : ""} ago`;
  return formatDate(date, "short");
}

/**
 * Returns true if the given date is in the past.
 * Used for expiry alerts (licences, insurance).
 */
export function isExpired(date: string | Date | null | undefined): boolean {
  if (!date) return false;
  return new Date(date).getTime() < Date.now();
}

/**
 * Returns true if the given date is within `days` days from now.
 * Used for expiry warnings in the dashboard Expiry Alerts widget.
 */
export function isExpiringSoon(
  date: string | Date | null | undefined,
  days = 30
): boolean {
  if (!date) return false;
  const d = new Date(date).getTime();
  const now = Date.now();
  const threshold = now + days * 24 * 60 * 60 * 1000;
  return d > now && d <= threshold;
}

// ─────────────────────────────────────────────────────────────────────────────
// CURRENCY FORMATTING  (Finance module — §2.6)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Formats a number as a currency string.
 * @param amount    - numeric value
 * @param currency  - ISO 4217 code, defaults to "USD"
 * @param compact   - use compact notation for large numbers (e.g. $1.2K)
 *
 * Examples:
 *   formatCurrency(1234.5)              → "$1,234.50"
 *   formatCurrency(1234.5, "KES")       → "KSh 1,234.50"
 *   formatCurrency(1234567, "USD", true) → "$1.2M"
 */
export function formatCurrency(
  amount: number | null | undefined,
  currency = "USD",
  compact = false
): string {
  if (amount == null || isNaN(amount)) return "—";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 2,
    minimumFractionDigits: compact ? 0 : 2,
  }).format(amount);
}

/**
 * Formats a raw number with thousand separators.
 * Used for odometer readings, quantities, etc.
 */
export function formatNumber(
  value: number | null | undefined,
  decimals = 0
): string {
  if (value == null || isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

// ─────────────────────────────────────────────────────────────────────────────
// DISTANCE / FUEL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Formats a distance value.
 * @param km   - distance in kilometres
 * @param unit - "km" | "mi"
 */
export function formatDistance(
  km: number | null | undefined,
  unit: "km" | "mi" = "km"
): string {
  if (km == null || isNaN(km)) return "—";
  const value = unit === "mi" ? km * 0.621371 : km;
  return `${formatNumber(value, 0)} ${unit}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// STRING HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Truncates a string to `maxLength` characters, appending "…" if cut.
 * Used in table cells to prevent layout overflow.
 */
export function truncate(str: string | null | undefined, maxLength = 40): string {
  if (!str) return "—";
  return str.length > maxLength ? `${str.slice(0, maxLength)}…` : str;
}

/**
 * Converts a string to Title Case.
 * Used to display enum values cleanly.
 */
export function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Generates a user's display initials (up to 2 characters).
 * Used in avatar fallbacks.
 */
export function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return parts
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");
}

export function getStaticUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const base = import.meta.env.VITE_API_URL ?? "";
  // Avoid double-slashing if base already has no trailing slash
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}