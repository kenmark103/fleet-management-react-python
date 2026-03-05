/**
 * types/settings.ts
 * System configuration types — mirrors backend schemas
 */

export type DateFormat = "ISO" | "US" | "EU";
export type Currency = "USD" | "EUR" | "GBP" | "CAD" | "AUD" | "KES" | "NGN";
export type FuelUnit = "gallons" | "liters";
export type DistanceUnit = "miles" | "km";
export type Theme = "light" | "dark" | "system";

export interface SystemSettings {
  orgName: string | null;
  orgTimezone: string;
  dateFormat: DateFormat;
  
  currency: Currency;
  fuelUnit: FuelUnit;
  distanceUnit: DistanceUnit;
  
  maintenanceWarningDays: number;
  licenseExpiryWarningDays: number;
  documentExpiryWarningDays: number;
  
  emailAlertsEnabled: boolean;
  maintenanceAlerts: boolean;
  tripStatusAlerts: boolean;
  
  theme: Theme;
  defaultLanguage: string;
  
  updatedAt: string;
  updatedBy: string | null;
}

export type SystemSettingsUpdate = Partial<Omit<SystemSettings, "updatedAt" | "updatedBy">>;