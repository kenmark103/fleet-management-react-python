import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Plus, Container, RefreshCw } from "lucide-react";
import { Button } from "../../../../components/ui/button";
import { PageHeader } from "../../../../components/molecules/PageHeader";
import { StatCard } from "../../../../components/molecules/StatCard";
import { DataTable, type Column } from "../../../../components/molecules/DataTable";
import { TrailerStatusBadge } from "../../../../components/fleet/StatusBadge";
import { ConfirmDialog } from "../../../../components/atoms/ConfirmDialog";
import { usePermission } from "../../../../hooks/usePermission";
import { useTrailers, useFleetSummary, useDeleteTrailer } from "../../../../hooks/useFleet";
import { formatDate, toTitleCase } from "../../../../lib/utils";
import type { Trailer } from "../../../../types/fleet";

export const Route = createFileRoute("/_auth/fleet/trailers/")({
  component: TrailersIndex,
});

function TrailersIndex() {
  const { can } = usePermission();
  const navigate = useNavigate();
  const { data: trailers, isLoading, refetch } = useTrailers();
  const { data: summary } = useFleetSummary();
  const deleteTrailer = useDeleteTrailer();
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; plate: string } | null>(null);

  const filtered = (trailers ?? []).filter((t) =>
    `${t.plateNumber} ${t.make} ${t.model}`.toLowerCase().includes(search.toLowerCase())
  );

  const columns: Column<Trailer>[] = [
    {
      key: "plateNumber",
      header: "Plate",
      cell: (row) => (
        <button
          onClick={() => navigate({ to: "/fleet/trailers/$trailerId", params: { trailerId: row.id } })}
          className="font-mono font-semibold text-primary hover:underline"
        >
          {row.plateNumber}
        </button>
      ),
    },
    {
      key: "vehicle",
      header: "Trailer",
      cell: (row) => `${row.year} ${row.make} ${row.model}`,
    },
    {
      key: "type",
      header: "Type",
      cell: (row) => toTitleCase(row.type),
    },
    {
      key: "capacityTons",
      header: "Capacity",
      cell: (row) => row.capacityTons ? `${row.capacityTons} t` : "—",
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => <TrailerStatusBadge status={row.status} />,
    },
    {
      key: "insuranceExpiryDate",
      header: "Insurance Expiry",
      cell: (row) => formatDate(row.insuranceExpiryDate),
    },
    ...(can("trailers:edit") || can("trailers:delete") ? [{
      key: "actions",
      header: "",
      cell: (row: Trailer) => (
        <div className="flex items-center justify-end gap-1">
          {can("trailers:edit") && (
            <Button variant="ghost" size="sm"
              onClick={(e) => { e.stopPropagation(); navigate({ to: "/fleet/trailers/$trailerId/edit", params: { trailerId: row.id } }); }}>
              Edit
            </Button>
          )}
          {can("trailers:delete") && (
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive"
              onClick={(e) => { e.stopPropagation(); setDeleteTarget({ id: row.id, plate: row.plateNumber }); }}>
              Delete
            </Button>
          )}
        </div>
      ),
    } satisfies Column<Trailer>] : []),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Trailers"
        subtitle={`${trailers?.length ?? 0} trailers registered`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            {can("trailers:create") && (
              <Button onClick={() => navigate({ to: "/fleet/trailers/new" })}>
                <Plus className="mr-2 h-4 w-4" />Add Trailer
              </Button>
            )}
          </div>
        }
      />

      {summary && (
        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard title="Total Trailers"  value={summary.totalTrailers}   icon={Container} color="blue" />
          <StatCard title="Active Trailers" value={summary.activeTrailers}  icon={Container} color="green" />
        </div>
      )}

      <DataTable
        columns={columns}
        data={filtered}
        loading={isLoading}
        searchable
        searchPlaceholder="Search by plate, make, model…"
        onSearchChange={setSearch}
        emptyTitle="No trailers found"
        emptyDescription="Add your first trailer to get started."
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={`Delete trailer ${deleteTarget?.plate}?`}
        description="This action cannot be undone."
        onConfirm={async () => {
          if (deleteTarget) { await deleteTrailer.mutateAsync(deleteTarget.id); setDeleteTarget(null); }
        }}
        isLoading={deleteTrailer.isPending}
        destructive
      />
    </div>
  );
}