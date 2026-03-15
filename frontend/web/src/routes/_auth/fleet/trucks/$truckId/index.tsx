/**
 * routes/_auth/fleet/trucks/$truckId/index.tsx
 * Route: /fleet/trucks/:truckId
 *
 * Changes (Stage 4):
 *   - Hero card shows vehicle photo (imageUrl) when available
 */

import { useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Pencil, Trash2, ArrowLeft, Truck, Gauge, Droplets, Calendar } from "lucide-react";
import { Button } from "../../../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../../../components/ui/tabs";
import { LoadingSpinner } from "../../../../../components/atoms/LoadingSpinner";
import { ConfirmDialog } from "../../../../../components/atoms/ConfirmDialog";
import { TruckStatusBadge } from "../../../../../components/fleet/StatusBadge";
import { DataTable, type Column } from "../../../../../components/molecules/DataTable";
import { useTruck, useDeleteTruck } from "../../../../../hooks/useFleet";
import { useTrips } from "../../../../../hooks/useTrips";
import type { Trip } from "../../../../../types/trips";
import { usePermission } from "../../../../../hooks/usePermission";
import { formatDate, formatNumber, toTitleCase, isExpired, isExpiringSoon, getStaticUrl } from "../../../../../lib/utils";
import { cn } from "../../../../../lib/utils";
import { STATUS_COLORS, STATUS_LABELS } from "../../../../../lib/constants";

export const Route = createFileRoute("/_auth/fleet/trucks/$truckId/")({
  component: TruckDetail,
});

function TruckDetail() {
  const { truckId } = Route.useParams();
  const { can } = usePermission();
  const navigate = useNavigate();

  const { data: truck, isLoading } = useTruck(truckId);
  const deleteTruck = useDeleteTruck();
  const [showDelete, setShowDelete] = useState(false);

  const [tripPage, setTripPage] = useState(1);
  const { data: tripsData, isLoading: tripsLoading } = useTrips({
    truckId,
    page:     tripPage,
    pageSize: 10,
  });
  const trips    = tripsData?.data ?? [];
  const tripMeta = tripsData?.meta;

  if (isLoading) return <LoadingSpinner className="mt-24" />;
  if (!truck)    return <p className="p-8 text-muted-foreground">Truck not found.</p>;

  const handleDelete = async () => {
    await deleteTruck.mutateAsync(truckId);
    navigate({ to: "/fleet/trucks" });
  };

  const tripColumns: Column<Trip>[] = [
    {
      key: "tripNumber",
      header: "Trip",
      cell: (row) => (
        <Link to="/trips/$tripId" params={{ tripId: row.id }}
          className="font-mono font-semibold text-primary hover:underline">
          {row.tripNumber}
        </Link>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => (
        <span className={cn(
          "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
          STATUS_COLORS[row.status] ?? "bg-gray-100 text-gray-600 border-gray-200",
        )}>
          {STATUS_LABELS[row.status] ?? row.status}
        </span>
      ),
    },
    {
      key: "route",
      header: "Route",
      cell: (row) => <span className="text-sm">{row.origin} → {row.destination}</span>,
    },
    {
      key: "assignedDriverName",
      header: "Driver",
      cell: (row) => row.assignedDriverName ?? "—",
    },
    {
      key: "scheduledDeparture",
      header: "Departure",
      cell: (row) => formatDate(row.scheduledDeparture),
    },
    {
      key: "scheduledArrival",
      header: "Arrival",
      cell: (row) => formatDate(row.scheduledArrival),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/fleet/trucks"><ArrowLeft className="mr-2 h-4 w-4" />Back to Trucks</Link>
        </Button>
        <div className="flex gap-2">
          {can("trucks:edit") && (
            <Button variant="outline" size="sm" asChild>
              <Link to="/fleet/trucks/$truckId/edit" params={{ truckId }}>
                <Pencil className="mr-2 h-4 w-4" />Edit
              </Link>
            </Button>
          )}
          {can("trucks:delete") && (
            <Button variant="destructive" size="sm" onClick={() => setShowDelete(true)}>
              <Trash2 className="mr-2 h-4 w-4" />Delete
            </Button>
          )}
        </div>
      </div>

      {/* Hero card — shows vehicle photo when available */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              {truck.imageUrl ? (
                <img
                  src={getStaticUrl(truck.imageUrl) ?? undefined}
                  alt={truck.plateNumber}
                  className="h-16 w-24 rounded-xl object-cover ring-2 ring-muted shrink-0"
                />
              ) : (
                <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-xl bg-primary/10 shrink-0">
                  <Truck className="h-6 w-6 sm:h-7 sm:w-7 text-primary" />
                </div>
              )}
              <div>
                <h1 className="text-xl sm:text-2xl font-bold font-mono">{truck.plateNumber}</h1>
                <p className="text-muted-foreground text-sm">{truck.year} {truck.make} {truck.model}</p>
                {truck.color && <p className="text-sm text-muted-foreground">{truck.color}</p>}
              </div>
            </div>
            <TruckStatusBadge status={truck.status} />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="trips">
            Trip History
            {tripMeta && tripMeta.totalItems > 0 && (
              <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium">
                {tripMeta.totalItems}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-sm">Operational</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Row icon={Gauge}    label="Odometer"  value={`${formatNumber(truck.odometerKm)} km`} />
                <Row icon={Droplets} label="Fuel Type" value={toTitleCase(truck.fuelType)} />
                {truck.vin && <Row icon={Truck} label="VIN" value={truck.vin} mono />}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Compliance</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <ExpiryRow label="Insurance"  date={truck.insuranceExpiryDate} />
                <ExpiryRow label="Inspection" date={truck.inspectionExpiryDate} />
              </CardContent>
            </Card>
          </div>

          {(truck.wheelConfig || truck.grossWeightTons || truck.axleLoadTons) && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Catalog Specs</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-3 gap-4 text-sm">
                {truck.wheelConfig     && <SpecStat label="Wheel config"  value={truck.wheelConfig} />}
                {truck.grossWeightTons && <SpecStat label="Gross weight"  value={`${truck.grossWeightTons} t`} />}
                {truck.axleLoadTons    && <SpecStat label="Axle load"     value={`${truck.axleLoadTons} t`} />}
              </CardContent>
            </Card>
          )}

          {truck.notes && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Notes</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{truck.notes}</p>
              </CardContent>
            </Card>
          )}

          <p className="text-xs text-muted-foreground">
            Added {formatDate(truck.createdAt)} · Updated {formatDate(truck.updatedAt)}
          </p>
        </TabsContent>

        <TabsContent value="trips" className="mt-4 space-y-4">
          <DataTable
            columns={tripColumns}
            data={trips}
            loading={tripsLoading}
            emptyTitle="No trips yet"
            emptyDescription="Trips assigned to this truck will appear here."
          />
          {tripMeta && tripMeta.totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{tripMeta.totalItems} trip{tripMeta.totalItems !== 1 ? "s" : ""}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={!tripMeta.hasPreviousPage}
                  onClick={() => setTripPage((p) => p - 1)}>Previous</Button>
                <span className="self-center px-2 hidden sm:inline">
                  Page {tripMeta.page} of {tripMeta.totalPages}
                </span>
                <Button variant="outline" size="sm" disabled={!tripMeta.hasNextPage}
                  onClick={() => setTripPage((p) => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={showDelete} onOpenChange={setShowDelete}
        title="Delete this truck?"
        description="This cannot be undone. All associated records will remain but the truck will be removed."
        onConfirm={handleDelete} isLoading={deleteTruck.isPending} destructive
      />
    </div>
  );
}

function Row({ icon: Icon, label, value, mono = false }: {
  icon: React.ElementType; label: string; value: string; mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <div className="flex items-center gap-2 text-muted-foreground"><Icon className="h-4 w-4" />{label}</div>
      <span className={cn("font-medium", mono && "font-mono text-xs")}>{value}</span>
    </div>
  );
}

function ExpiryRow({ label, date }: { label: string; date?: string }) {
  const expired = isExpired(date);
  const soon    = isExpiringSoon(date, 30);
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <div className="flex items-center gap-2 text-muted-foreground"><Calendar className="h-4 w-4" />{label}</div>
      <span className={cn("font-medium", expired && "text-red-600", !expired && soon && "text-amber-600")}>
        {date ? formatDate(date) : "—"}
        {expired && " (Expired)"}
        {!expired && soon && " (Expiring soon)"}
      </span>
    </div>
  );
}

function SpecStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium text-sm">{value}</p>
    </div>
  );
}