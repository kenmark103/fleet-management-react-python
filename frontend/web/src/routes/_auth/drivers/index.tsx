/**
 * routes/_auth/drivers/index.tsx
 * Fleet Management System — Phase 4 (revised Phase 8)
 *
 * Fixes:
 *   - "Add Driver" button moved from PageHeader actions → inline with filters (ml-auto)
 *   - Pagination guard changed from `totalPages > 1` → always show when meta exists
 *     (matches maintenance pattern — Previous/Next are disabled, not hidden)
 */

import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useDrivers, useDriverSummary, useDeleteDriver } from "../../../hooks/useDrivers";
import { usePermission } from "../../../hooks/usePermission";
import { ConfirmDialog } from "../../../components/atoms/ConfirmDialog";
import { PageHeader } from "../../../components/molecules/PageHeader";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Badge } from "../../../components/ui/badge";
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
import {
  Users,
  UserCheck,
  UserX,
  AlertTriangle,
  Plus,
  Search,
  Trash2,
  Eye,
  Pencil,
} from "lucide-react";
import {
  formatDate,
  isExpired as checkExpired,
  isExpiringSoon as checkExpiringSoon,
  getStaticUrl,
} from "../../../lib/utils";
import type { Driver } from "../../../types/driver";

export const Route = createFileRoute("/_auth/drivers/")({
  component: DriversPage,
});

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY CARDS
// ─────────────────────────────────────────────────────────────────────────────

function SummaryCards() {
  const { data, isLoading } = useDriverSummary();
  const summary = data?.data;

  const cards = [
    { label: "Total Drivers",          value: summary?.totalDrivers        ?? 0, icon: Users,          color: "text-blue-600",   bg: "bg-blue-50" },
    { label: "Active",                  value: summary?.activeDrivers       ?? 0, icon: UserCheck,      color: "text-green-600",  bg: "bg-green-50" },
    { label: "Inactive",                value: summary?.inactiveDrivers     ?? 0, icon: UserX,          color: "text-gray-500",   bg: "bg-gray-50" },
    { label: "Licenses Expiring (30d)", value: summary?.expiringLicenses30d ?? 0, icon: AlertTriangle,  color: "text-yellow-600", bg: "bg-yellow-50" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map(({ label, value, icon: Icon, color, bg }) => (
        <div key={label} className="rounded-xl border bg-card p-4 flex items-center gap-3">
          <div className={`rounded-lg p-2.5 ${bg} shrink-0`}>
            <Icon className={`h-5 w-5 ${color}`} />
          </div>
          <div className="min-w-0">
            <p className="text-2xl font-bold tracking-tight">{isLoading ? "—" : value}</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function DriverStatusBadge({ status }: { status: Driver["status"] }) {
  return (
    <Badge
      variant="outline"
      className={
        status === "active"
          ? "bg-green-100 text-green-700 border-green-200"
          : "bg-gray-100 text-gray-600 border-gray-200"
      }
    >
      {status === "active" ? "Active" : "Inactive"}
    </Badge>
  );
}

function LicenseExpiryCell({ date }: { date: string }) {
  const isExpired      = checkExpired(date);
  const isExpiringSoon = checkExpiringSoon(date, 30);
  return (
    <span className={
      isExpired      ? "text-destructive font-medium"
      : isExpiringSoon ? "text-yellow-600 font-medium"
      : "text-foreground"
    }>
      {formatDate(new Date(date), "short")}
      {(isExpired || isExpiringSoon) && " ⚠"}
    </span>
  );
}

function DriverAvatar({ driver }: { driver: Driver }) {
  return (
    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0 text-xs font-semibold text-muted-foreground overflow-hidden">
      {driver.avatarUrl ? (
        <img src={getStaticUrl(driver.avatarUrl) ?? undefined} alt="" className="h-full w-full object-cover" />
      ) : (
        `${driver.firstName[0]}${driver.lastName[0]}`
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MOBILE CARD
// ─────────────────────────────────────────────────────────────────────────────

function DriverCard({
  driver,
  onDelete,
}: {
  driver:   Driver;
  onDelete: (driver: Driver) => void;
}) {
  const { can } = usePermission();

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-center gap-3">
        <DriverAvatar driver={driver} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">
            {driver.firstName} {driver.lastName}
          </p>
          {driver.currentTruckId && (
            <p className="text-xs text-muted-foreground">On truck</p>
          )}
        </div>
        <DriverStatusBadge status={driver.status} />
      </div>

      <div className="text-sm text-muted-foreground space-y-0.5">
        <p className="truncate">{driver.email}</p>
        <p>{driver.phone}</p>
      </div>

      <div className="flex items-center justify-between text-sm">
        <div>
          <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
            {driver.licenseNumber}
          </span>
          <span className="ml-2 text-xs text-muted-foreground">{driver.licenseClass}</span>
        </div>
        <LicenseExpiryCell date={driver.licenseExpiryDate} />
      </div>

      <div className="flex items-center justify-between pt-1 border-t">
        <p className="text-xs text-muted-foreground">
          Hired {formatDate(new Date(driver.hireDate), "short")}
        </p>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
            <Link to="/drivers/$driverId" params={{ driverId: driver.id }}>
              <Eye className="h-4 w-4" />
            </Link>
          </Button>
          {can("drivers:edit") && (
            <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
              <Link to="/drivers/$driverId/edit" params={{ driverId: driver.id }}>
                <Pencil className="h-4 w-4" />
              </Link>
            </Button>
          )}
          {can("drivers:edit") && (
            <Button
              variant="ghost" size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => onDelete(driver)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────

function DriversPage() {
  const { can } = usePermission();

  const [page,         setPage]         = useState(1);
  const [search,       setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deleteTarget, setDeleteTarget] = useState<Driver | null>(null);

  const pageSize = 20;

  const { data, isLoading, isError } = useDrivers({
    page,
    pageSize,
    search:  search || undefined,
    status:  statusFilter !== "all" ? statusFilter : undefined,
  });

  const deleteDriver = useDeleteDriver();

  const drivers = data?.data ?? [];
  const meta    = data?.meta;

  const handleSearch = (val: string) => { setSearch(val); setPage(1); };
  const handleStatus = (val: string) => { setStatusFilter(val); setPage(1); };

  return (
    <div className="space-y-6">

      {/* ── Header — no actions prop, button moved below ─────────────────── */}
      <PageHeader
        title="Drivers"
        subtitle="Manage driver profiles, licenses, and documents."
        icon={<Users className="h-6 w-6" />}
      />

      <SummaryCards />

      {/* ── Filters + Add Driver button ──────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search name, email, license…"
            className="pl-9"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={handleStatus}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>

        {/* ── Add Driver button — right-aligned, matches maintenance pattern ── */}
        {can("drivers:create") && (
          <Button asChild size="sm" className="ml-auto">
            <Link to="/drivers/new">
              <Plus className="h-4 w-4 mr-2" />Add Driver
            </Link>
          </Button>
        )}
      </div>

      {/* ── Mobile: card list ────────────────────────────────────────────── */}
      <div className="space-y-3 sm:hidden">
        {isLoading && <p className="text-center py-12 text-muted-foreground text-sm">Loading drivers…</p>}
        {isError   && <p className="text-center py-12 text-destructive text-sm">Failed to load drivers.</p>}
        {!isLoading && !isError && drivers.length === 0 && (
          <p className="text-center py-12 text-muted-foreground text-sm">No drivers found.</p>
        )}
        {drivers.map((driver) => (
          <DriverCard key={driver.id} driver={driver} onDelete={setDeleteTarget} />
        ))}
      </div>

      {/* ── Desktop: table ───────────────────────────────────────────────── */}
      <div className="hidden sm:block rounded-xl border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Driver</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>License</TableHead>
              <TableHead>Expiry</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Hired</TableHead>
              <TableHead className="w-28">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground text-sm">Loading drivers…</TableCell></TableRow>
            )}
            {isError && (
              <TableRow><TableCell colSpan={7} className="text-center py-12 text-destructive text-sm">Failed to load drivers.</TableCell></TableRow>
            )}
            {!isLoading && !isError && drivers.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground text-sm">No drivers found.</TableCell></TableRow>
            )}
            {drivers.map((driver) => (
              <TableRow key={driver.id} className="hover:bg-muted/30 transition-colors">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <DriverAvatar driver={driver} />
                    <div>
                      <p className="font-medium text-sm">{driver.firstName} {driver.lastName}</p>
                      {driver.currentTruckId && <p className="text-xs text-muted-foreground">On truck</p>}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <p className="text-sm">{driver.email}</p>
                  <p className="text-xs text-muted-foreground">{driver.phone}</p>
                </TableCell>
                <TableCell>
                  <span className="text-sm font-mono">{driver.licenseNumber}</span>
                  <p className="text-xs text-muted-foreground">{driver.licenseClass}</p>
                </TableCell>
                <TableCell><LicenseExpiryCell date={driver.licenseExpiryDate} /></TableCell>
                <TableCell><DriverStatusBadge status={driver.status} /></TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDate(new Date(driver.hireDate), "short")}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                      <Link to="/drivers/$driverId" params={{ driverId: driver.id }}>
                        <Eye className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                    {can("drivers:edit") && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                        <Link to="/drivers/$driverId/edit" params={{ driverId: driver.id }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    )}
                    {can("drivers:edit") && (
                      <Button
                        variant="ghost" size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(driver)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* ── Pagination — always visible when meta exists (matches maintenance) ─ */}
      {meta && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{meta.totalItems} driver{meta.totalItems !== 1 ? "s" : ""}</span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline" size="sm"
              disabled={!meta.hasPreviousPage}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <span className="px-2 hidden sm:inline">Page {meta.page} of {meta.totalPages}</span>
            <Button
              variant="outline" size="sm"
              disabled={!meta.hasNextPage}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Remove ${deleteTarget?.firstName} ${deleteTarget?.lastName}?`}
        description="This will delete the driver profile and deactivate their login account. Trip history and fuel records are preserved."
        confirmLabel="Remove Driver"
        destructive
        isLoading={deleteDriver.isPending}
        onConfirm={async () => {
          if (!deleteTarget) return;
          await deleteDriver.mutateAsync(deleteTarget.id);
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}