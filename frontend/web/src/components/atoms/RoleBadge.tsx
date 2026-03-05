/**
 * components/atoms/RoleBadge.tsx
 * Coloured pill badge for a user's role.
 * §4.1 Atoms — used in User list, Topbar, Profile
 */

import { cn } from "../../lib/utils";
import {
  ROLE_COLORS,
  ROLE_SHORT_LABELS,
  type UserRole,
} from "../../lib/constants";

interface RoleBadgeProps {
  role: UserRole;
  /** Show full title instead of short label */
  full?: boolean;
  className?: string;
}

export function RoleBadge({ role, full = false, className }: RoleBadgeProps) {
  const label = full
    ? { ADMIN: "System Administrator", DISPATCHER: "Fleet Dispatcher", DRIVER: "Vehicle Driver", MECHANIC: "Fleet Mechanic", FINANCE: "Finance Officer" }[role]
    : ROLE_SHORT_LABELS[role];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        ROLE_COLORS[role],
        className
      )}
    >
      {label}
    </span>
  );
}