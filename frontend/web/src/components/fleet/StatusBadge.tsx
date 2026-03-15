/**
 * components/fleet/StatusBadge.tsx
 *
 * Thin type-narrowing wrappers around the generic StatusBadge atom.
 * All colour/label logic lives in lib/constants.ts — add new statuses
 * there and they automatically appear here and everywhere else.
 */

import { StatusBadge } from "../atoms/StatusBadge";
import type { TruckStatus, TrailerStatus } from "../../types/fleet";
import type { DriverStatus } from "../../types/driver";

export function TruckStatusBadge({ status, className }: { status: TruckStatus; className?: string }) {
  return <StatusBadge status={status} className={className} />;
}

export function TrailerStatusBadge({ status, className }: { status: TrailerStatus; className?: string }) {
  return <StatusBadge status={status} className={className} />;
}

export function DriverStatusBadge({ status, className }: { status: DriverStatus; className?: string }) {
  return <StatusBadge status={status} className={className} />;
}