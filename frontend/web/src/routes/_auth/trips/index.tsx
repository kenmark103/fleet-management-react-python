/**
 * routes/_auth/trips/index.tsx
 * Fleet Management System — Phase 5
 *
 * /trips — Trip list with filters, role-aware actions
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Search, MapPin, Truck, User } from "lucide-react";
import { useTrips } from "../../../hooks/useTrips";
import { usePermission } from "../../../hooks/usePermission";
import { StatusBadge } from "../../../components/atoms/StatusBadge";
import { PageHeader } from "../../../components/molecules/PageHeader";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";
import { formatDate } from "../../../lib/utils";
import { TRIP_STATUSES, type TripStatus } from "../../../lib/constants";

export const Route = createFileRoute("/_auth/trips/")({
  component: TripsListPage,
});

function TripsListPage() {
  const { can } = usePermission();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<TripStatus | "all">("all");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useTrips({
    status: status === "all" ? undefined : status,
    search: search || undefined,
    page,
    pageSize: 20,
  });

  const trips = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Trips & Dispatch"
        subtitle="Manage fleet trips and monitor progress"
        actions={
          can("trips:create") && (
            <Link to="/trips/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Trip
              </Button>
            </Link>
          )
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search trips..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={status}
          onValueChange={(v) => setStatus(v as TripStatus | "all")}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {TRIP_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1).replace("-", " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Trip #</TableHead>
              <TableHead>Route</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Driver</TableHead>
              <TableHead>Truck</TableHead>
              <TableHead>Departure</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  Loading trips...
                </TableCell>
              </TableRow>
            ) : trips.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No trips found
                </TableCell>
              </TableRow>
            ) : (
              trips.map((trip) => (
                <TableRow key={trip.id}>
                  <TableCell>
                    <Link
                      to="/trips/$tripId"
                      params={{ tripId: trip.id }}
                      className="font-medium text-primary hover:underline"
                    >
                      {trip.tripNumber}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-green-500" />
                      <span className="truncate max-w-[100px]">{trip.origin}</span>
                      <span className="text-muted-foreground">→</span>
                      <MapPin className="h-3.5 w-3.5 text-red-500" />
                      <span className="truncate max-w-[100px]">{trip.destination}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={trip.status} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{trip.assignedDriverName || "—"}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{trip.assignedTruckPlate || "—"}</span>
                    </div>
                  </TableCell>
                  <TableCell>{formatDate(trip.scheduledDeparture)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={!meta.hasPreviousPage}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {meta.page} of {meta.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p + 1)}
            disabled={!meta.hasNextPage}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}