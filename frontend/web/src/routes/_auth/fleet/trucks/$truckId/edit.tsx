/**
 * routes/_auth/fleet/trucks/$truckId.edit.tsx
 * Route: /fleet/trucks/:truckId/edit
 *
 * UI fixes:
 *   - PageHeader has Truck icon + Back button (matches app pattern)
 */

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Truck, ArrowLeft } from "lucide-react";
import { Button } from "../../../../../components/ui/button";
import { PageHeader } from "../../../../../components/molecules/PageHeader";
import { TruckForm } from "../../../../../components/fleet/TruckForm";
import { LoadingSpinner } from "../../../../../components/atoms/LoadingSpinner";
import { useTruck, useUpdateTruck } from "../../../../../hooks/useFleet";
import { usePermission } from "../../../../../hooks/usePermission";

export const Route = createFileRoute("/_auth/fleet/trucks/$truckId/edit")({
  component: EditTruck,
});

function EditTruck() {
  const { truckId } = Route.useParams();
  const { can } = usePermission();
  const navigate = useNavigate();
  const { data: truck, isLoading } = useTruck(truckId);
  const updateTruck = useUpdateTruck();

  if (!can("trucks:edit")) {
    return <p className="p-8 text-muted-foreground">You don't have permission to edit trucks.</p>;
  }
  if (isLoading) return <LoadingSpinner className="mt-24" />;
  if (!truck) return <p className="p-8 text-muted-foreground">Truck not found.</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title={`Edit ${truck.plateNumber}`}
        subtitle={`${truck.year} ${truck.make} ${truck.model}`}
        icon={<Truck className="h-6 w-6" />}
        actions={
          <Link to="/fleet/trucks/$truckId" params={{ truckId }}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />Back
            </Button>
          </Link>
        }
      />
      <TruckForm
        truckId={truckId}
        defaultValues={truck}
        isLoading={updateTruck.isPending}
        onCancel={() => navigate({ to: "/fleet/trucks/$truckId", params: { truckId } })}
        onSubmit={async (values) => {
          await updateTruck.mutateAsync({ id: truckId, ...values });
          navigate({ to: "/fleet/trucks/$truckId", params: { truckId } });
        }}
      />
    </div>
  );
}