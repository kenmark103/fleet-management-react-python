/**
 * routes/_auth/fleet/trucks/new.tsx
 * Route: /fleet/trucks/new
 */

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Truck, ArrowLeft } from "lucide-react";
import { Button } from "../../../../components/ui/button";
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
        icon={<Truck className="h-6 w-6" />}
        actions={
          <Link to="/fleet/trucks">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />Back
            </Button>
          </Link>
        }
      />
      <TruckForm
        isLoading={createTruck.isPending}
        onCancel={() => navigate({ to: "/fleet/trucks" })}
        onSubmit={async (values) => {
          const result = await createTruck.mutateAsync(values);
          // Redirect to edit so user can immediately upload a vehicle photo
          navigate({
            to: "/fleet/trucks/$truckId/edit",
            params: { truckId: result.id },
          });
        }}
      />
    </div>
  );
}