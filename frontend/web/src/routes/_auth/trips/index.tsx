/**
 * routes/_auth/trips/index.tsx
 * Fleet Management System
 *
 * Fixes:
 *   - Stat cards added: Total, Pending, En-Route, Completed, Cancelled
 *   - "Create Trip" button moved from PageHeader actions → inline with filters (ml-auto)
 *   - Pagination now shows even on page 1 (matches maintenance pattern, removed `> 1` guard)
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Plus, Search, MapPin, Truck, User, Navigation,
  Clock, CheckCircle2, XCircle, BarChart3,
} from "lucide-react";
import { useTrips } from "../../../hooks/useTrips";
import { usePermission } from "../../../hooks/usePermission";
import { StatusBadge } from "../../../components/atoms/StatusBadge";
import { StatCard } from "../../../components/molecules/StatCard";
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

interface TripsParams {
  page:     number;
  pageSize: number;
  search?:  string;
  status?:  TripStatus;
}

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

function TripCard({ trip }: { trip: Trip }) {
  return (
    <Link to="/trips/$tripId" params={{ tripId: trip.id }}>
      <div className="rounded-xl border bg-card p-4 space-y-3 hover:bg-muted/30 transition-colors">
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold text-sm text-primary">{trip.tripNumber}</span>
          <StatusBadge status={trip.status} />
        </div>
        <RouteCell origin={trip.origin} destination={trip.destination} />
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
        <p className="text-xs text-muted-foreground border-t pt-2">
          Departure: {formatDate(trip.scheduledDeparture)}
        </p>
      </div>
    </Link>
  );
}

function TripsListPage() {
  const { can } = usePermission();
  const [params, setParams] = useState<TripsParams>({ page: 1, pageSize: 20 });

  // Main list query
  const { data, isLoading } = useTrips({
    status:   params.status,
    search:   params.search,
    page:     params.page,
    pageSize: params.pageSize,
  });

  // ── Status count queries (pageSize:1 — we only need meta.totalItems) ──────
  const { data: pendingData }   = useTrips({ status: "pending",   pageSize: 1 });
  const { data: enRouteData }   = useTrips({ status: "en-route",  pageSize: 1 });
  const { data: completedData } = useTrips({ status: "completed", pageSize: 1 });
  const { data: cancelledData } = useTrips({ status: "cancelled", pageSize: 1 });

  const trips = data?.data ?? [];
  const meta  = data?.meta;

  const handleSearch = (val: string) =>
    setParams((p) => ({ ...p, page: 1, search: val || undefined }));

  const handleStatus = (val: string) =>
    setParams((p) => ({ ...p, page: 1, status: val === "all" ? undefined : (val as TripStatus) }));

  return (
    <div className="space-y-6">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <PageHeader
        title="Trips & Dispatch"
        subtitle="Manage fleet trips and monitor progress"
        icon={<Navigation className="h-6 w-6" />}
      />

      {/* ── Stat cards ──────────────────────────────────────────────────────── */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-5">
        <StatCard
          title="Total Trips"
          value={meta?.totalItems ?? 0}
          icon={BarChart3}
          color="blue"
        />
        <StatCard
          title="Pending"
          value={pendingData?.meta?.totalItems ?? 0}
          icon={Clock}
          color="amber"
        />
        <StatCard
          title="En Route"
          value={enRouteData?.meta?.totalItems ?? 0}
          icon={Navigation}
          color="indigo"
        />
        <StatCard
          title="Completed"
          value={completedData?.meta?.totalItems ?? 0}
          icon={CheckCircle2}
          color="green"
        />
        <StatCard
          title="Cancelled"
          value={cancelledData?.meta?.totalItems ?? 0}
          icon={XCircle}
          color="red"
        />
      </div>

      {/* ── Filters + Create button ─────────────────────────────────────────── */}
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
        <Select value={params.status ?? "all"} onValueChange={handleStatus}>
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

        {/* ── Create Trip button moved here, aligned right ── */}
        {can("trips:create") && (
          <Link to="/trips/new" className="ml-auto">
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Create Trip
            </Button>
          </Link>
        )}
      </div>

      {/* ── Mobile: card list ───────────────────────────────────────────────── */}
      <div className="space-y-3 sm:hidden">
        {isLoading && (
          <p className="text-center py-12 text-muted-foreground text-sm">Loading trips…</p>
        )}
        {!isLoading && trips.length === 0 && (
          <p className="text-center py-12 text-muted-foreground text-sm">No trips found.</p>
        )}
        {trips.map((trip) => <TripCard key={trip.id} trip={trip} />)}
      </div>

      {/* ── Desktop: table ──────────────────────────────────────────────────── */}
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

      {/* ── Pagination — always visible when meta exists (matches maintenance) ─ */}
      {meta && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{meta.totalItems} trip{meta.totalItems !== 1 ? "s" : ""}</span>
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