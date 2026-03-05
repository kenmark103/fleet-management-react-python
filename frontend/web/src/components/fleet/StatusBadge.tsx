
import { Badge } from "../ui/badge";
import { cn } from "../../lib/utils";
import type { TruckStatus, TrailerStatus } from "../../types/fleet";

const TRUCK_CONFIG: Record<TruckStatus, { label: string; className: string }> = {
  active:       { label: "Active",       className: "bg-green-100 text-green-700 border-green-200" },
  inactive:     { label: "Inactive",     className: "bg-gray-100  text-gray-600  border-gray-200"  },
  "in-progress":{ label: "In Progress",  className: "bg-blue-100  text-blue-700  border-blue-200"  },
};

const TRAILER_CONFIG: Record<TrailerStatus, { label: string; className: string }> = {
  active:   { label: "Active",   className: "bg-green-100 text-green-700 border-green-200" },
  inactive: { label: "Inactive", className: "bg-gray-100  text-gray-600  border-gray-200"  },
};

export function TruckStatusBadge({ status }: { status: TruckStatus }) {
  const { label, className } = TRUCK_CONFIG[status] ?? TRUCK_CONFIG.inactive;
  return (
    <Badge variant="outline" className={cn("font-medium", className)}>
      {label}
    </Badge>
  );
}

export function TrailerStatusBadge({ status }: { status: TrailerStatus }) {
  const { label, className } = TRAILER_CONFIG[status] ?? TRAILER_CONFIG.inactive;
  return (
    <Badge variant="outline" className={cn("font-medium", className)}>
      {label}
    </Badge>
  );
}