/**
 * routes/_auth/trips/$tripId/edit.tsx
 * Fleet Management System — Phase 5
 *
 * /trips/:tripId/edit — Edit trip details
 */

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useTrip, useUpdateTrip } from "../../../../hooks/useTrips";
import { useTrucks } from "../../../../hooks/useFleet";
import { useTrailers } from "../../../../hooks/useFleet";
import { useDrivers } from "../../../../hooks/useDrivers";
import { PageHeader } from "../../../../components/molecules/PageHeader";
import { FormSection } from "../../../../components/molecules/FormSection";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../../components/ui/select";
import { Textarea } from "../../../../components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/_auth/trips/$tripId/edit")({
  component: EditTripPage,
});

function EditTripPage() {
  const { tripId } = Route.useParams();
  const navigate = useNavigate();
  const { data: tripResponse, isLoading: tripLoading } = useTrip(tripId);
  const updateTrip = useUpdateTrip(tripId);

  const [formData, setFormData] = useState({
    origin: "",
    destination: "",
    scheduledDeparture: "",
    scheduledArrival: "",
    distanceKm: "",
    cargoDescription: "",
    cargoWeightTons: "",
    assignedTruckId: "",
    assignedTrailerId: "none",
    assignedDriverId: "",
    notes: "",
  });

  const { data: trucksData, isLoading: trucksLoading } = useTrucks("active");
  const { data: trailersData, isLoading: trailersLoading } = useTrailers("active");
  const { data: driversData, isLoading: driversLoading } = useDrivers({ status: "active" });

  const trucks = trucksData ?? [];
  const trailers = trailersData ?? [];
  const drivers = driversData?.data ?? [];

  const trip = tripResponse;

  useEffect(() => {
    if (trip) {
      setFormData({
        origin: trip.origin,
        destination: trip.destination,
        scheduledDeparture: trip.scheduledDeparture.slice(0, 16),
        scheduledArrival: trip.scheduledArrival.slice(0, 16),
        distanceKm: trip.distanceKm?.toString() || "",
        cargoDescription: trip.cargoDescription || "",
        cargoWeightTons: trip.cargoWeightTons?.toString() || "",
        assignedTruckId: trip.assignedTruckId || "",
        assignedTrailerId: trip.assignedTrailerId || "",
        assignedDriverId: trip.assignedDriverId || "",
        notes: trip.notes || "",
      });
    }
  }, [trip]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await updateTrip.mutateAsync({
        origin: formData.origin,
        destination: formData.destination,
        scheduledDeparture: new Date(formData.scheduledDeparture).toISOString(),
        scheduledArrival: new Date(formData.scheduledArrival).toISOString(),
        distanceKm: formData.distanceKm ? parseFloat(formData.distanceKm) : undefined,
        cargoDescription: formData.cargoDescription || undefined,
        cargoWeightTons: formData.cargoWeightTons ? parseFloat(formData.cargoWeightTons) : undefined,
        assignedTruckId: formData.assignedTruckId || undefined,
        assignedTrailerId: formData.assignedTrailerId || undefined,
        assignedDriverId: formData.assignedDriverId || undefined,
        notes: formData.notes || undefined,
      });

      toast.success("Trip updated successfully");
      navigate({ to: "/trips/$tripId", params: { tripId } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update trip");
    }
  };

  const isLoading = tripLoading || trucksLoading || trailersLoading || driversLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!trip) {
    return <div className="p-8">Trip not found</div>;
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

      <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
        <FormSection title="Route Details" description="Update origin and destination">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="origin">Origin</Label>
              <Input
                id="origin"
                required
                value={formData.origin}
                onChange={(e) => setFormData((d) => ({ ...d, origin: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Current coords: {trip.originLat?.toFixed(4)}, {trip.originLng?.toFixed(4)}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="destination">Destination</Label>
              <Input
                id="destination"
                required
                value={formData.destination}
                onChange={(e) => setFormData((d) => ({ ...d, destination: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Current coords: {trip.destinationLat?.toFixed(4)}, {trip.destinationLng?.toFixed(4)}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="departure">Scheduled Departure</Label>
              <Input
                id="departure"
                type="datetime-local"
                required
                value={formData.scheduledDeparture}
                onChange={(e) => setFormData((d) => ({ ...d, scheduledDeparture: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="arrival">Scheduled Arrival</Label>
              <Input
                id="arrival"
                type="datetime-local"
                required
                value={formData.scheduledArrival}
                onChange={(e) => setFormData((d) => ({ ...d, scheduledArrival: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="distance">Distance (km)</Label>
              <Input
                id="distance"
                type="number"
                step="0.1"
                value={formData.distanceKm}
                onChange={(e) => setFormData((d) => ({ ...d, distanceKm: e.target.value }))}
              />
            </div>
          </div>
        </FormSection>

        <FormSection title="Cargo Details" description="Update cargo information">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cargo">Cargo Description</Label>
              <Input
                id="cargo"
                value={formData.cargoDescription}
                onChange={(e) => setFormData((d) => ({ ...d, cargoDescription: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="weight">Weight (tons)</Label>
              <Input
                id="weight"
                type="number"
                step="0.1"
                value={formData.cargoWeightTons}
                onChange={(e) => setFormData((d) => ({ ...d, cargoWeightTons: e.target.value }))}
              />
            </div>
          </div>
        </FormSection>

        <FormSection title="Assignments" description="Update vehicle and driver assignments">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Truck</Label>
              <Select
                value={formData.assignedTruckId}
                onValueChange={(v) => setFormData((d) => ({ ...d, assignedTruckId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select truck..." />
                </SelectTrigger>
                <SelectContent>
                  {trucks.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.plateNumber} — {t.make} {t.model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Trailer (Optional)</Label>
              <Select
                value={formData.assignedTrailerId}
                onValueChange={(v) => setFormData((d) => ({ ...d, assignedTrailerId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="No trailer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No trailer</SelectItem>
                  {trailers.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.plateNumber} — {t.type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Driver</Label>
              <Select
                value={formData.assignedDriverId}
                onValueChange={(v) => setFormData((d) => ({ ...d, assignedDriverId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select driver..." />
                </SelectTrigger>
                <SelectContent>
                  {drivers.map((d: any) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.firstName} {d.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </FormSection>

        <FormSection title="Notes" description="Additional instructions">
          <Textarea
            value={formData.notes}
            onChange={(e) => setFormData((d) => ({ ...d, notes: e.target.value }))}
            placeholder="Optional notes for the driver..."
            rows={3}
          />
        </FormSection>

        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate({ to: "/trips/$tripId", params: { tripId } })}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={updateTrip.isPending}>
            {updateTrip.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  );
}