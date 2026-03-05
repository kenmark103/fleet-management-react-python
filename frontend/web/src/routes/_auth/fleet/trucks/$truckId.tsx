/**
 * routes/_auth/fleet/trucks/$truckId.tsx
 * Route: /fleet/trucks/:truckId
 * Truck detail view.
 */

import { useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Pencil, Trash2, ArrowLeft, Truck, Gauge, Droplets, Calendar } from "lucide-react";
import { Button } from "../../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../components/ui/card";
import { LoadingSpinner } from "../../../../components/atoms/LoadingSpinner";
import { ConfirmDialog } from "../../../../components/atoms/ConfirmDialog";
import { TruckStatusBadge } from "../../../../components/fleet/StatusBadge";
import { useTruck, useDeleteTruck } from "../../../../hooks/useFleet";
import { usePermission } from "../../../../hooks/usePermission";
import { formatDate, formatNumber, toTitleCase, isExpired, isExpiringSoon } from "../../../../lib/utils";
import { cn } from "../../../../lib/utils";

export const Route = createFileRoute("/_auth/fleet/trucks/$truckId")({
  component: TruckDetail,
});

function TruckDetail() {
  const { truckId } = Route.useParams();
  const { can } = usePermission();
  const navigate = useNavigate();
  const { data: truck, isLoading } = useTruck(truckId);
  const deleteTruck = useDeleteTruck();
  const [showDelete, setShowDelete] = useState(false);

  if (isLoading) return <LoadingSpinner className="mt-24" />;
  if (!truck) return <p className="p-8 text-muted-foreground">Truck not found.</p>;

  const handleDelete = async () => {
    await deleteTruck.mutateAsync(truckId);
    navigate({ to: "/fleet/trucks" });
  };

  return (
    <div className="space-y-6">
      {/* Nav + actions */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/fleet/trucks">
            <ArrowLeft className="mr-2 h-4 w-4" />Back to Trucks
          </Link>
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

      {/* Hero card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
                <Truck className="h-7 w-7 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold font-mono">{truck.plateNumber}</h1>
                <p className="text-muted-foreground">{truck.year} {truck.make} {truck.model}</p>
                {truck.color && <p className="text-sm text-muted-foreground">{truck.color}</p>}
              </div>
            </div>
            <TruckStatusBadge status={truck.status} />
          </div>
        </CardContent>
      </Card>

      {/* Detail grid */}
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
            <ExpiryRow
              label="Insurance"
              date={truck.insuranceExpiryDate}
            />
            <ExpiryRow
              label="Inspection"
              date={truck.inspectionExpiryDate}
            />
          </CardContent>
        </Card>
      </div>

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

      <ConfirmDialog
        open={showDelete}
        onOpenChange={setShowDelete}
        title="Delete this truck?"
        description="This cannot be undone. All associated records (fuel logs, service history) will remain but the truck will be removed."
        onConfirm={handleDelete}
        isLoading={deleteTruck.isPending}
        variant="destructive"
      />
    </div>
  );
}

function Row({ icon: Icon, label, value, mono = false }: {
  icon: React.ElementType; label: string; value: string; mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />{label}
      </div>
      <span className={cn("font-medium", mono && "font-mono text-xs")}>{value}</span>
    </div>
  );
}

function ExpiryRow({ label, date }: { label: string; date?: string }) {
  const expired = isExpired(date);
  const soon = isExpiringSoon(date, 30);
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Calendar className="h-4 w-4" />{label}
      </div>
      <span className={cn(
        "font-medium",
        expired && "text-red-600",
        !expired && soon && "text-amber-600",
      )}>
        {date ? formatDate(date) : "—"}
        {expired && " (Expired)"}
        {!expired && soon && " (Expiring soon)"}
      </span>
    </div>
  );
}