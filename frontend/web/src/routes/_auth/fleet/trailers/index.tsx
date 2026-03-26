/**
 * routes/_auth/fleet/trailers/index.tsx
 * Route: /fleet/trailers
 *
 * Fixes:
 *   - "Add Trailer" button moved from PageHeader actions → inline with search (ml-auto)
 *   - Refresh button stays in PageHeader actions (utility action)
 *   - Search extracted from DataTable → manual Input so button can sit alongside it
 *   - Pagination always visible when meta exists
 */

import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Plus, Container, RefreshCw, Search } from "lucide-react";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { PageHeader } from "../../../../components/molecules/PageHeader";
import { StatCard } from "../../../../components/molecules/StatCard";
import { DataTable, type Column } from "../../../../components/molecules/DataTable";
import { TrailerStatusBadge } from "../../../../components/fleet/StatusBadge";
import { ConfirmDialog } from "../../../../components/atoms/ConfirmDialog";
import { usePermission } from "../../../../hooks/usePermission";
import { useTrailers, useFleetSummary, useDeleteTrailer } from "../../../../hooks/useFleet";
import type { TrailerListParams } from "../../../../hooks/useFleet";
import { formatDate, toTitleCase } from "../../../../lib/utils";
import type { Trailer } from "../../../../types/fleet";

export const Route = createFileRoute("/_auth/fleet/trailers/")({
  component: TrailersIndex,
});

function TrailersIndex() {
  const { can } = usePermission();
  const navigate = useNavigate();

  const [params, setParams] = useState<TrailerListParams>({ page: 1, pageSize: 20 });
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; plate: string } | null>(null);

  const { data, isLoading, refetch } = useTrailers(params);
  const { data: summary } = useFleetSummary();
  const deleteTrailer = useDeleteTrailer();

  const trailers = data?.data ?? [];
  const meta     = data?.meta;

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
            <Button
              variant="ghost" size="sm"
              onClick={(e) => {
                e.stopPropagation();
                navigate({ to: "/fleet/trailers/$trailerId/edit", params: { trailerId: row.id } });
              }}
            >
              Edit
            </Button>
          )}
          {can("trailers:delete") && (
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
    } satisfies Column<Trailer>] : []),
  ];

  return (
    <div className="space-y-6">

      {/* ── Header — refresh button stays here as a utility action ─────── */}
      <PageHeader
        title="Trailers"
        subtitle="Manage and track your trailer fleet"
        icon={<Container className="h-6 w-6" />}
        actions={
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        }
      />

      {summary && (
        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard title="Total Trailers"  value={summary.totalTrailers}  icon={Container} color="blue" />
          <StatCard title="Active Trailers" value={summary.activeTrailers} icon={Container} color="green" />
        </div>
      )}

      {/* ── Search + Add Trailer button inline ──────────────────────────── */}
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

        {can("trailers:create") && (
          <Button className="ml-auto" onClick={() => navigate({ to: "/fleet/trailers/new" })}>
            <Plus className="mr-2 h-4 w-4" />Add Trailer
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={trailers}
        loading={isLoading}
        emptyTitle="No trailers found"
        emptyDescription="Add your first trailer to get started."
      />

      {/* ── Pagination — always visible when meta exists ─────────────────── */}
      {meta && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{meta.totalItems} trailer{meta.totalItems !== 1 ? "s" : ""}</span>
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
        title={`Delete trailer ${deleteTarget?.plate}?`}
        description="This action cannot be undone."
        onConfirm={async () => {
          if (deleteTarget) {
            await deleteTrailer.mutateAsync(deleteTarget.id);
            setDeleteTarget(null);
          }
        }}
        isLoading={deleteTrailer.isPending}
        destructive
      />
    </div>
  );
}