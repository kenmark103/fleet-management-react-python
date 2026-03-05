/**
 * routes/_auth/drivers/index.tsx
 * Fleet Management System — Phase 4 (revised Phase 8)
 *
 * Changes from original:
 *   - Removed Sheet / DriverForm dialog for creating drivers
 *   - "Add Driver" now links to /drivers/new (file-based route)
 *   - Added Edit (Pencil) icon per row linking to /drivers/$driverId/edit
 *   - Delete wording updated to reflect soft-deactivation of login
 */

import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useDrivers, useDriverSummary, useDeleteDriver } from "../../../hooks/useDrivers";
import { usePermission } from "../../../hooks/usePermission";
import { ConfirmDialog } from "../../../components/atoms/ConfirmDialog";
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
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { formatDate, isExpired as checkExpired, isExpiringSoon as checkExpiringSoon } from "../../../lib/utils";
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
    {
      label: "Total Drivers",
      value: summary?.totalDrivers ?? 0,
      icon: Users,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Active",
      value: summary?.activeDrivers ?? 0,
      icon: UserCheck,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      label: "Inactive",
      value: summary?.inactiveDrivers ?? 0,
      icon: UserX,
      color: "text-gray-500",
      bg: "bg-gray-50",
    },
    {
      label: "Licenses Expiring (30d)",
      value: summary?.expiringLicenses30d ?? 0,
      icon: AlertTriangle,
      color: "text-yellow-600",
      bg: "bg-yellow-50",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {cards.map(({ label, value, icon: Icon, color, bg }) => (
        <div
          key={label}
          className="rounded-xl border bg-card p-4 flex items-center gap-4"
        >
          <div className={`rounded-lg p-2.5 ${bg}`}>
            <Icon className={`h-5 w-5 ${color}`} />
          </div>
          <div>
            <p className="text-2xl font-bold tracking-tight">
              {isLoading ? "—" : value}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
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
    <span
      className={
        isExpired
          ? "text-destructive font-medium"
          : isExpiringSoon
          ? "text-yellow-600 font-medium"
          : "text-foreground"
      }
    >
      {formatDate(new Date(date), "short")}
      {(isExpired || isExpiringSoon) && " ⚠"}
    </span>
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

  const drivers    = data?.data ?? [];
  const meta       = data?.meta;
  const totalPages = meta?.totalPages ?? 1;

  const handleSearch = (val: string) => { setSearch(val); setPage(1); };
  const handleStatus = (val: string) => { setStatusFilter(val); setPage(1); };

  return (
    <div className="space-y-6 p-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Drivers</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage driver profiles, licenses, and documents.
          </p>
        </div>
        {can("drivers:create") && (
          <Button asChild>
            <Link to="/drivers/new">
              <Plus className="h-4 w-4 mr-2" />
              Add Driver
            </Link>
          </Button>
        )}
      </div>

      {/* Summary cards */}
      <SummaryCards />

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
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
      </div>

      {/* Table */}
      <div className="rounded-xl border overflow-hidden">
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
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground text-sm">
                  Loading drivers…
                </TableCell>
              </TableRow>
            )}
            {isError && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-destructive text-sm">
                  Failed to load drivers.
                </TableCell>
              </TableRow>
            )}
            {!isLoading && !isError && drivers.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground text-sm">
                  No drivers found.
                </TableCell>
              </TableRow>
            )}
            {drivers.map((driver) => (
              <TableRow key={driver.id} className="hover:bg-muted/30 transition-colors">
                {/* Name + avatar */}
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0 text-xs font-semibold text-muted-foreground overflow-hidden">
                      {driver.avatarUrl ? (
                        <img src={driver.avatarUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        `${driver.firstName[0]}${driver.lastName[0]}`
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-sm">
                        {driver.firstName} {driver.lastName}
                      </p>
                      {driver.currentTruckId && (
                        <p className="text-xs text-muted-foreground">On truck</p>
                      )}
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

                <TableCell>
                  <LicenseExpiryCell date={driver.licenseExpiryDate} />
                </TableCell>

                <TableCell>
                  <DriverStatusBadge status={driver.status} />
                </TableCell>

                <TableCell className="text-sm text-muted-foreground">
                  {formatDate(new Date(driver.hireDate), "short")}
                </TableCell>

                {/* Actions */}
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" asChild>
                      <Link to="/drivers/$driverId" params={{ driverId: driver.id }}>
                        <Eye className="h-4 w-4" />
                      </Link>
                    </Button>
                    {can("drivers:edit") && (
                      <Button variant="ghost" size="icon" asChild>
                        <Link to="/drivers/$driverId/edit" params={{ driverId: driver.id }}>
                          <Pencil className="h-4 w-4" />
                        </Link>
                      </Button>
                    )}
                    {can("drivers:edit") && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(driver)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {meta && totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {meta.totalItems} driver{meta.totalItems !== 1 ? "s" : ""} · page {meta.page} of {meta.totalPages}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              disabled={!meta.hasPreviousPage}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              disabled={!meta.hasNextPage}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Delete confirm */}
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