/**
 * routes/_auth/trips/index.tsx
 * Fleet Management System — Phase 5
 *
 * UI improvements:
 *   - PageHeader with Navigation icon (matches app pattern)
 *   - Consolidated params state (page, search, status in one object)
 *   - Mobile card layout (replaces 6-col table on small screens)
 *   - Table styled consistently: rounded-xl, muted header, hover rows
 *   - Pagination matches maintenance: justify-between, count left, buttons right
 *   - Search + status filter reset page to 1 on change
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Search, MapPin, Truck, User, Navigation } from "lucide-react";
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
import type { Trip } from "../../../types/trips";

export const Route = createFileRoute("/_auth/trips/")({
  component: TripsListPage,
});

// ─────────────────────────────────────────────────────────────────────────────
// PARAMS STATE
// ─────────────────────────────────────────────────────────────────────────────

interface TripsParams {
  page:     number
  pageSize: number
  search?:  string
  status?:  TripStatus
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE CELL — origin → destination (shared between card + table)
// ─────────────────────────────────────────────────────────────────────────────

function RouteCell({ origin, destination }: { origin: string; destination: string }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <MapPin className="h-3.5 w-3.5 text-green-500 shrink-0" />
      <span className="truncate max-w-[90px] text-sm">{origin}</span>
      <span className="text-muted-foreground text-xs">→</span>
      <MapPin className="h-3.5 w-3.5 text-red-500 shrink-0" />
      <span className="truncate max-w-[90px] text-sm">{destination}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MOBILE CARD
// ─────────────────────────────────────────────────────────────────────────────

function TripCard({ trip }: { trip: Trip }) {
  return (
    <Link to="/trips/$tripId" params={{ tripId: trip.id }}>
      <div className="rounded-xl border bg-card p-4 space-y-3 hover:bg-muted/30 transition-colors">

        {/* Row 1: trip number + status */}
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold text-sm text-primary">
            {trip.tripNumber}
          </span>
          <StatusBadge status={trip.status} />
        </div>

        {/* Row 2: route */}
        <RouteCell origin={trip.origin} destination={trip.destination} />

        {/* Row 3: driver + truck */}
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 shrink-0" />
            <span>{trip.assignedDriverName || "—"}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Truck className="h-3.5 w-3.5 shrink-0" />
            <span>{trip.assignedTruckPlate || "—"}</span>
          </div>
        </div>

        {/* Row 4: departure */}
        <p className="text-xs text-muted-foreground border-t pt-2">
          Departure: {formatDate(trip.scheduledDeparture)}
        </p>
      </div>
    </Link>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────

function TripsListPage() {
  const { can } = usePermission();

  const [params, setParams] = useState<TripsParams>({ page: 1, pageSize: 20 });

  const { data, isLoading } = useTrips({
    status:   params.status,
    search:   params.search,
    page:     params.page,
    pageSize: params.pageSize,
  });

  const trips = data?.data ?? [];
  const meta  = data?.meta;

  const handleSearch = (val: string) =>
    setParams((p) => ({ ...p, page: 1, search: val || undefined }));

  const handleStatus = (val: string) =>
    setParams((p) => ({ ...p, page: 1, status: val === "all" ? undefined : val as TripStatus }));

  return (
    <div className="space-y-6">

      {/* Header */}
      <PageHeader
        title="Trips & Dispatch"
        subtitle="Manage fleet trips and monitor progress"
        icon={<Navigation className="h-6 w-6" />}
        actions={
          can("trips:create") && (
            <Link to="/trips/new">
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Create Trip
              </Button>
            </Link>
          )
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search trips…"
            value={params.search ?? ""}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={params.status ?? "all"}
          onValueChange={handleStatus}
        >
          <SelectTrigger className="w-40">
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

      {/* ── Mobile: card list (hidden on sm+) ── */}
      <div className="space-y-3 sm:hidden">
        {isLoading && (
          <p className="text-center py-12 text-muted-foreground text-sm">Loading trips…</p>
        )}
        {!isLoading && trips.length === 0 && (
          <p className="text-center py-12 text-muted-foreground text-sm">No trips found.</p>
        )}
        {trips.map((trip) => (
          <TripCard key={trip.id} trip={trip} />
        ))}
      </div>

      {/* ── Desktop: table (hidden on mobile) ── */}
      <div className="hidden sm:block rounded-xl border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
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
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground text-sm">
                  Loading trips…
                </TableCell>
              </TableRow>
            ) : trips.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground text-sm">
                  No trips found.
                </TableCell>
              </TableRow>
            ) : (
              trips.map((trip) => (
                <TableRow key={trip.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell>
                    <Link
                      to="/trips/$tripId"
                      params={{ tripId: trip.id }}
                      className="font-medium text-primary hover:underline font-mono text-sm"
                    >
                      {trip.tripNumber}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <RouteCell origin={trip.origin} destination={trip.destination} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={trip.status} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-sm">
                      <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span>{trip.assignedDriverName || "—"}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-sm">
                      <Truck className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                        {trip.assignedTruckPlate || "—"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(trip.scheduledDeparture)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination — matches maintenance pattern exactly */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {meta.totalItems} trip{meta.totalItems !== 1 ? "s" : ""}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline" size="sm"
              disabled={!meta.hasPreviousPage}
              onClick={() => setParams((p) => ({ ...p, page: p.page - 1 }))}
            >
              Previous
            </Button>
            <span className="self-center px-2 hidden sm:inline">
              Page {meta.page} of {meta.totalPages}
            </span>
            <Button
              variant="outline" size="sm"
              disabled={!meta.hasNextPage}
              onClick={() => setParams((p) => ({ ...p, page: p.page + 1 }))}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}