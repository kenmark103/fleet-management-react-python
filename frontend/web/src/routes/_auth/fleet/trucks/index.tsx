/**
 * routes/_auth/fleet/trucks/index.tsx
 * Route: /fleet/trucks
 * Trucks list with stat cards, searchable DataTable, delete confirm dialog.
 */

import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Plus, Truck, RefreshCw } from "lucide-react";
import { Button } from "../../../../components/ui/button";
import { PageHeader } from "../../../../components/molecules/PageHeader";
import { StatCard } from "../../../../components/molecules/StatCard";
import { DataTable, type Column } from "../../../../components/molecules/DataTable";
import { TruckStatusBadge } from "../../../../components/fleet/StatusBadge";
import { ConfirmDialog } from "../../../../components/atoms/ConfirmDialog";
import { usePermission } from "../../../../hooks/usePermission";
import { useTrucks, useFleetSummary, useDeleteTruck } from "../../../../hooks/useFleet";
import { formatDate, formatNumber } from "../../../../lib/utils";
import type { Truck as TruckType } from "../../../../types/fleet";

export const Route = createFileRoute("/_auth/fleet/trucks/")({
  component: TrucksIndex,
});

function TrucksIndex() {
  const { can } = usePermission();
  const navigate = useNavigate();
  const { data: trucks, isLoading, refetch } = useTrucks();
  const { data: summary } = useFleetSummary();
  const deleteTruck = useDeleteTruck();
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; plate: string } | null>(null);

  // Client-side search filter
  const filtered = (trucks ?? []).filter((t) =>
    `${t.plateNumber} ${t.make} ${t.model}`.toLowerCase().includes(search.toLowerCase())
  );

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
      <PageHeader
        title="Trucks"
        subtitle={`${trucks?.length ?? 0} vehicles registered`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            {can("trucks:create") && (
              <Button onClick={() => navigate({ to: "/fleet/trucks/new" })}>
                <Plus className="mr-2 h-4 w-4" />Add Truck
              </Button>
            )}
          </div>
        }
      />

      {/* Stat cards — only shown when summary loads */}
      {summary && (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            title="Total Trucks"
            value={summary.totalTrucks}
            icon={Truck}
            color="blue"
          />
          <StatCard
            title="Active"
            value={summary.activeTrucks}
            icon={Truck}
            color="green"
          />
          <StatCard
            title="In Progress"
            value={summary.inProgressTrucks}
            icon={Truck}
            color="amber"
          />
        </div>
      )}

      <DataTable
        columns={columns}
        data={filtered}
        loading={isLoading}
        searchable
        searchPlaceholder="Search by plate, make, model…"
        onSearchChange={setSearch}
        emptyTitle="No trucks found"
        emptyDescription="Add your first truck to get started."
      />

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