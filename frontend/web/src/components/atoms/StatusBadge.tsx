/**
 * components/atoms/StatusBadge.tsx
 * Displays a coloured pill badge for any system status value.
 * §4.1 Atoms — used in Trucks, Drivers, Trips, Work Orders
 */

import { cn } from "../../lib/utils";
import { STATUS_COLORS, STATUS_LABELS, type StatusValue } from "../../lib/constants";

interface StatusBadgeProps {
  status: StatusValue;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        STATUS_COLORS[status],
        className
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}