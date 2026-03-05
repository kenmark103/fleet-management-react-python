/**
 * routes/_auth/fleet/trucks/$truckId.edit.tsx
 * Route: /fleet/trucks/:truckId/edit
 *
 * Note: The underscore in the filename ($truckId_.edit) is TanStack Router's
 * flat-route convention to prevent nesting under $truckId's layout.
 * Rename to $truckId_.edit.tsx if your project uses that pattern.
 */

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHeader } from "../../../../components/molecules/PageHeader";
import { TruckForm } from "../../../../components/fleet/TruckForm";
import { LoadingSpinner } from "../../../../components/atoms/LoadingSpinner";
import { useTruck, useUpdateTruck } from "../../../../hooks/useFleet";
import { usePermission } from "../../../../hooks/usePermission";

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
      />
      <TruckForm
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