/**
 * routes/_auth/fleet/trucks/index.tsx
 * Route: /fleet/trucks
 *
 * Fixes:
 *   - "Add Truck" button moved from PageHeader actions → inline with search (ml-auto)
 *   - Refresh button stays in PageHeader actions (utility action, not a primary CTA)
 *   - Search extracted from DataTable → manual Input so button can sit alongside it
 *   - Pagination always visible when meta exists
 */

import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Plus, Truck, RefreshCw, Search } from "lucide-react";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { PageHeader } from "../../../../components/molecules/PageHeader";
import { StatCard } from "../../../../components/molecules/StatCard";
import { DataTable, type Column } from "../../../../components/molecules/DataTable";
import { TruckStatusBadge } from "../../../../components/fleet/StatusBadge";
import { ConfirmDialog } from "../../../../components/atoms/ConfirmDialog";
import { usePermission } from "../../../../hooks/usePermission";
import { useTrucks, useFleetSummary, useDeleteTruck } from "../../../../hooks/useFleet";
import type { TruckListParams } from "../../../../hooks/useFleet";
import { formatDate, formatNumber } from "../../../../lib/utils";
import type { Truck as TruckType } from "../../../../types/fleet";

export const Route = createFileRoute("/_auth/fleet/trucks/")({
  component: TrucksIndex,
});

function TrucksIndex() {
  const { can } = usePermission();
  const navigate = useNavigate();

  const [params, setParams] = useState<TruckListParams>({ page: 1, pageSize: 20 });
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; plate: string } | null>(null);

  const { data, isLoading, refetch } = useTrucks(params);
  const { data: summary } = useFleetSummary();
  const deleteTruck = useDeleteTruck();

  const trucks = data?.data ?? [];
  const meta   = data?.meta;

  const columns: Column<TruckType>[] = [
    {
      key: "plateNumber",
      header: "Plate",
      cell: (row) => (
        <button
          onClick={() => navigate({ to: "/fleet/trucks/$truckId", params: { truckId: row.id } })}
          className="font-mono font-semibold text-primary hover:underline"
        >
          {row.plateNumber}
        </button>
      ),
    },
    {
      key: "vehicle",
      header: "Vehicle",
      cell: (row) => `${row.year} ${row.make} ${row.model}`,
    },
    {
      key: "fuelType",
      header: "Fuel",
      cell: (row) => <span className="capitalize">{row.fuelType}</span>,
    },
    {
      key: "odometerKm",
      header: "Odometer",
      cell: (row) => `${formatNumber(row.odometerKm)} km`,
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => <TruckStatusBadge status={row.status} />,
    },
    {
      key: "insuranceExpiryDate",
      header: "Insurance Expiry",
      cell: (row) => formatDate(row.insuranceExpiryDate),
    },
    ...(can("trucks:edit") || can("trucks:delete") ? [{
      key: "actions",
      header: "",
      cell: (row: TruckType) => (
        <div className="flex items-center justify-end gap-1">
          {can("trucks:edit") && (
            <Button
              variant="ghost" size="sm"
              onClick={(e) => {
                e.stopPropagation();
                navigate({ to: "/fleet/trucks/$truckId/edit", params: { truckId: row.id } });
              }}
            >
              Edit
            </Button>
          )}
          {can("trucks:delete") && (
            <Button
              variant="ghost" size="sm"
              className="text-destructive hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                setDeleteTarget({ id: row.id, plate: row.plateNumber });
              }}
            >
              Delete
            </Button>
          )}
        </div>
      ),
    } satisfies Column<TruckType>] : []),
  ];

  return (
    <div className="space-y-6">

      {/* ── Header — refresh button stays here as a utility action ─────── */}
      <PageHeader
        title="Trucks"
        subtitle="Manage and monitor your fleet vehicles"
        icon={<Truck className="h-6 w-6" />}
        actions={
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        }
      />

      {summary && (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard title="Total Trucks"  value={summary.totalTrucks}      icon={Truck} color="blue" />
          <StatCard title="Active"        value={summary.activeTrucks}     icon={Truck} color="green" />
          <StatCard title="In Progress"   value={summary.inProgressTrucks} icon={Truck} color="amber" />
        </div>
      )}

      {/* ── Search + Add Truck button inline ────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by plate, make, model…"
            className="pl-9"
            onChange={(e) =>
              setParams((p) => ({ ...p, page: 1, search: e.target.value || undefined }))
            }
          />
        </div>

        {can("trucks:create") && (
          <Button className="ml-auto" onClick={() => navigate({ to: "/fleet/trucks/new" })}>
            <Plus className="mr-2 h-4 w-4" />Add Truck
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={trucks}
        loading={isLoading}
        emptyTitle="No trucks found"
        emptyDescription="Add your first truck to get started."
      />

      {/* ── Pagination — always visible when meta exists ─────────────────── */}
      {meta && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{meta.totalItems} truck{meta.totalItems !== 1 ? "s" : ""}</span>
          <div className="flex gap-2">
            <Button
              variant="outline" size="sm"
              disabled={!meta.hasPreviousPage}
              onClick={() => setParams((p) => ({ ...p, page: (p.page ?? 1) - 1 }))}
            >
              Previous
            </Button>
            <span className="self-center px-2 hidden sm:inline">
              Page {meta.page} of {meta.totalPages}
            </span>
            <Button
              variant="outline" size="sm"
              disabled={!meta.hasNextPage}
              onClick={() => setParams((p) => ({ ...p, page: (p.page ?? 1) + 1 }))}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={`Delete truck ${deleteTarget?.plate}?`}
        description="This action cannot be undone. The truck record will be permanently removed."
        onConfirm={async () => {
          if (deleteTarget) {
            await deleteTruck.mutateAsync(deleteTarget.id);
            setDeleteTarget(null);
          }
        }}
        isLoading={deleteTruck.isPending}
        destructive
      />
    </div>
  );
}