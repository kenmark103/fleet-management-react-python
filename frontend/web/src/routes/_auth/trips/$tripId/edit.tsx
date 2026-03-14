/**
 * routes/_auth/trips/$tripId/edit.tsx
 * Fleet Management System — Phase 5
 */

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useTrip, useUpdateTrip } from "../../../../hooks/useTrips";
import { TripForm } from "../../../../components/forms/TripForm";
import { PageHeader } from "../../../../components/molecules/PageHeader";
import { Button } from "../../../../components/ui/button";
import { toast } from "sonner";
import type { TripFormPayload } from "../../../../components/forms/TripForm";

export const Route = createFileRoute("/_auth/trips/$tripId/edit")({
  component: EditTripPage,
});

function EditTripPage() {
  const { tripId } = Route.useParams();
  const navigate   = useNavigate();

  const { data: trip, isLoading: tripLoading } = useTrip(tripId);
  const updateTrip = useUpdateTrip(tripId);

  const handleSubmit = async (data: TripFormPayload) => {
    try {
      await updateTrip.mutateAsync(data);
      toast.success("Trip updated successfully");
      navigate({ to: "/trips/$tripId", params: { tripId } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update trip");
    }
  };

  if (tripLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!trip) {
    return <div className="p-8 text-sm text-destructive">Trip not found.</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Edit Trip ${trip.tripNumber}`}
        subtitle="Update trip details and assignments"
        actions={
          <Button
            variant="outline"
            onClick={() => navigate({ to: "/trips/$tripId", params: { tripId } })}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Trip
          </Button>
        }
      />
      <TripForm
        initial={trip}
        onSubmit={handleSubmit}
        isLoading={updateTrip.isPending}
        onCancel={() => navigate({ to: "/trips/$tripId", params: { tripId } })}
      />
    </div>
  );
}