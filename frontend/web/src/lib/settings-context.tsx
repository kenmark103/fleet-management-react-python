/**
 * lib/settings-context.tsx
 * Fleet Management System — Phase 8
 *
 * Global settings context. Wraps the _auth layout so every authenticated
 * page can access system settings without prop-drilling or extra fetches.
 *
 * Provides:
 *   - Raw settings object
 *   - formatCurrency(amount)  — honours settings.currency
 *   - formatDist(km)          — honours settings.distanceUnit
 *   - formatAppDate(date)     — honours settings.dateFormat
 *   - theme                   — applied to <html> class automatically
 */

import {
  createContext,
  useContext,
  useEffect,
  type ReactNode,
} from "react";
import { useSettings } from "../hooks/useSettings";
import type { SystemSettings, Currency, DistanceUnit, DateFormat } from "../types/settings";

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULTS  (used while loading or if fetch fails)
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: SystemSettings = {
  orgName: null,
  orgTimezone: "UTC",
  dateFormat: "ISO",
  currency: "USD",
  fuelUnit: "liters",
  distanceUnit: "km",
  maintenanceWarningDays: 14,
  licenseExpiryWarningDays: 30,
  documentExpiryWarningDays: 30,
  emailAlertsEnabled: false,
  maintenanceAlerts: true,
  tripStatusAlerts: true,
  theme: "system",
  defaultLanguage: "en",
  updatedAt: "",
  updatedBy: null,
};

// ─────────────────────────────────────────────────────────────────────────────
// CONTEXT SHAPE
// ─────────────────────────────────────────────────────────────────────────────

interface SettingsContextValue {
  settings: SystemSettings;
  isLoading: boolean;
  /** Format a number as currency using the system currency setting */
  formatCurrency: (amount: number | null | undefined, compact?: boolean) => string;
  /** Format a distance in km using the system distance unit */
  formatDist: (km: number | null | undefined) => string;
  /** Format a date string using the system date format setting */
  formatAppDate: (date: string | Date | null | undefined) => string;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

// ─────────────────────────────────────────────────────────────────────────────
// FORMATTING HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function makeCurrencyFormatter(currency: Currency) {
  return (amount: number | null | undefined, compact = false): string => {
    if (amount == null || isNaN(amount)) return "—";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      notation: compact ? "compact" : "standard",
      maximumFractionDigits: compact ? 1 : 2,
      minimumFractionDigits: compact ? 0 : 2,
    }).format(amount);
  };
}

function makeDistFormatter(unit: DistanceUnit) {
  return (km: number | null | undefined): string => {
    if (km == null || isNaN(km)) return "—";
    const value = unit === "mi" ? km * 0.621371 : km;
    const rounded = Math.round(value).toLocaleString("en-US");
    return `${rounded} ${unit}`;
  };
}

function makeDateFormatter(format: DateFormat) {
  return (date: string | Date | null | undefined): string => {
    if (!date) return "—";
    const d = new Date(date);
    if (isNaN(d.getTime())) return "Invalid date";

    if (format === "US") {
      // MM/DD/YYYY
      return d.toLocaleDateString("en-US", {
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
      });
    }
    if (format === "EU") {
      // DD.MM.YYYY
      return d.toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    }
    // ISO: YYYY-MM-DD
    return d.toISOString().slice(0, 10);
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// THEME APPLICATION
// ─────────────────────────────────────────────────────────────────────────────

function applyTheme(theme: SystemSettings["theme"]) {
  const root = document.documentElement;
  root.classList.remove("light", "dark");

  if (theme === "system") {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.classList.add(prefersDark ? "dark" : "light");
  } else {
    root.classList.add(theme);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PROVIDER
// ─────────────────────────────────────────────────────────────────────────────

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { data: settings, isLoading } = useSettings();
  const resolved = settings ?? DEFAULT_SETTINGS;

  // Apply theme to <html> whenever it changes
  useEffect(() => {
    applyTheme(resolved.theme);

    if (resolved.theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => applyTheme("system");
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, [resolved.theme]);

  const value: SettingsContextValue = {
    settings: resolved,
    isLoading,
    formatCurrency: makeCurrencyFormatter(resolved.currency),
    formatDist:     makeDistFormatter(resolved.distanceUnit),
    formatAppDate:  makeDateFormatter(resolved.dateFormat),
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────

export function useAppSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error("useAppSettings must be used within <SettingsProvider>");
  }
  return ctx;
}