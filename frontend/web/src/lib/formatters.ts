// Add to lib/utils.ts or create lib/formatters.ts

import { useSettings } from "../hooks/useSettings";
import { formatDistance, formatCurrency } from "./utils";

/**
 * Hook version of formatCurrency that uses system settings
 */
export function useFormatCurrency() {
  const { data: settings } = useSettings();
  
  return (amount: number | null | undefined, compact = false) => {
    return formatCurrency(amount, settings?.currency || "USD", compact);
  };
}

/**
 * Hook version of formatDistance that uses system settings
 */
export function useFormatDistance() {
  const { data: settings } = useSettings();
  
  return (km: number | null | undefined) => {
    return formatDistance(km, settings?.distanceUnit === "km" ? "km" : "mi");
  };
}