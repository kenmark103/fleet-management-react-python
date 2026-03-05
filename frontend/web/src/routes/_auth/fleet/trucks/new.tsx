/**
 * routes/_auth/fleet/trucks/new.tsx
 * Route: /fleet/trucks/new
 */

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHeader } from "../../../../components/molecules/PageHeader";
import { TruckForm } from "../../../../components/fleet/TruckForm";
import { useCreateTruck } from "../../../../hooks/useFleet";
import { usePermission } from "../../../../hooks/usePermission";

export const Route = createFileRoute("/_auth/fleet/trucks/new")({
  component: NewTruck,
});

function NewTruck() {
  const { can } = usePermission();
  const navigate = useNavigate();
  const createTruck = useCreateTruck();

  if (!can("trucks:create")) {
    return <p className="p-8 text-muted-foreground">You don't have permission to add trucks.</p>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Add Truck"
        subtitle="Register a new truck in the fleet"
      />
      <TruckForm
        isLoading={createTruck.isPending}
        onCancel={() => navigate({ to: "/fleet/trucks" })}
        onSubmit={async (values) => {
          await createTruck.mutateAsync(values);
          navigate({ to: "/fleet/trucks" });
        }}
      />
    </div>
  );
}