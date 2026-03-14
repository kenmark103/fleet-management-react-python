/**
 * routes/_auth/trips/new.tsx
 * Fleet Management System — Phase 5
 */

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useCreateTrip } from "../../../hooks/useTrips";
import { TripForm } from "../../../components/forms/TripForm";
import { PageHeader } from "../../../components/molecules/PageHeader";
import { Button } from "../../../components/ui/button";
import { toast } from "sonner";
import type { TripFormPayload } from "../../../components/forms/TripForm";

export const Route = createFileRoute("/_auth/trips/new")({
  component: NewTripPage,
});

function NewTripPage() {
  const navigate   = useNavigate();
  const createTrip = useCreateTrip();

  const handleSubmit = async (data: TripFormPayload) => {
    try {
      await createTrip.mutateAsync(data);
      toast.success("Trip created successfully");
      navigate({ to: "/trips" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create trip");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create New Trip"
        subtitle="Plan a new fleet trip with route and assignments"
        actions={
          <Button variant="outline" onClick={() => navigate({ to: "/trips" })}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Trips
          </Button>
        }
      />
      <TripForm
        onSubmit={handleSubmit}
        isLoading={createTrip.isPending}
        onCancel={() => navigate({ to: "/trips" })}
      />
    </div>
  );
}