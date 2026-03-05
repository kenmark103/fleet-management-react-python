/**
 * routes/_auth/trips/new.tsx
 * Fleet Management System — Phase 5
 *
 * /trips/new — Create new trip with geocoding UX
 */

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Check, MapPin, Loader2 } from "lucide-react";
import { useCreateTrip } from "../../../hooks/useTrips";
import { useTrucks } from "../../../hooks/useFleet";
import { useTrailers } from "../../../hooks/useFleet";
import { useDrivers } from "../../../hooks/useDrivers";
import { PageHeader } from "../../../components/molecules/PageHeader";
import { FormSection } from "../../../components/molecules/FormSection";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import { Textarea } from "../../../components/ui/textarea";
import { toast } from "sonner";

// Client-side geocoding for UX feedback
async function geocodeClientSide(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
      { headers: { "User-Agent": "FleetMS/1.0" } }
    );
    const data = await res.json();
    if (data && data[0]) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
  } catch (e) {
    console.error("Geocoding error:", e);
  }
  return null;
}

export const Route = createFileRoute("/_auth/trips/new")({
  component: NewTripPage,
});

function NewTripPage() {
  const navigate = useNavigate();
  const createTrip = useCreateTrip();

  const [formData, setFormData] = useState({
    origin: "",
    destination: "",
    originLat: null as number | null,
    originLng: null as number | null,
    destinationLat: null as number | null,
    destinationLng: null as number | null,
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

  const [geocodeStatus, setGeocodeStatus] = useState({
    origin: "idle" as "idle" | "loading" | "success" | "error",
    destination: "idle" as "idle" | "loading" | "success" | "error",
  });

  // Fetch dropdown data using your hooks
  const { data: trucksData, isLoading: trucksLoading } = useTrucks("active");
  const { data: trailersData, isLoading: trailersLoading } = useTrailers("active");
  const { data: driversData, isLoading: driversLoading } = useDrivers({ status: "active" });

  const trucks = trucksData ?? [];
  const trailers = trailersData ?? [];
  const drivers = driversData?.data ?? [];

  const handleGeocode = async (field: "origin" | "destination") => {
    const address = formData[field];
    if (!address) return;

    setGeocodeStatus((s) => ({ ...s, [field]: "loading" }));
    const result = await geocodeClientSide(address);
    
    if (result) {
      setFormData((d) => ({
        ...d,
        [`${field}Lat`]: result.lat,
        [`${field}Lng`]: result.lng,
      }));
      setGeocodeStatus((s) => ({ ...s, [field]: "success" }));
    } else {
      setGeocodeStatus((s) => ({ ...s, [field]: "error" }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await createTrip.mutateAsync({
        origin: formData.origin,
        destination: formData.destination,
        originLat: formData.originLat ?? undefined,
        originLng: formData.originLng ?? undefined,
        destinationLat: formData.destinationLat ?? undefined,
        destinationLng: formData.destinationLng ?? undefined,
        scheduledDeparture: new Date(formData.scheduledDeparture).toISOString(),
        scheduledArrival: new Date(formData.scheduledArrival).toISOString(),
        distanceKm: formData.distanceKm ? parseFloat(formData.distanceKm) : undefined,
        cargoDescription: formData.cargoDescription || undefined,
        cargoWeightTons: formData.cargoWeightTons ? parseFloat(formData.cargoWeightTons) : undefined,
        assignedTruckId: formData.assignedTruckId || undefined,
        assignedTrailerId: formData.assignedTrailerId === "none" ? undefined : formData.assignedTrailerId,
        assignedDriverId: formData.assignedDriverId || undefined,
        notes: formData.notes || undefined,
      });

      toast.success("Trip created successfully");
      navigate({ to: "/trips" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create trip");
    }
  };

  const isLoading = trucksLoading || trailersLoading || driversLoading;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create New Trip"
        subtitle="Plan a new fleet trip with route and assignments"
        actions={
          <Button
            variant="outline"
            onClick={() => navigate({ to: "/trips" })}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Trips
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
          <FormSection title="Route Details" description="Origin and destination with geocoding">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="origin">Origin</Label>
                <div className="relative">
                  <Input
                    id="origin"
                    required
                    value={formData.origin}
                    onChange={(e) => setFormData((d) => ({ ...d, origin: e.target.value }))}
                    onBlur={() => handleGeocode("origin")}
                    placeholder="e.g., Nairobi, Kenya"
                  />
                  {geocodeStatus.origin === "success" && (
                    <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                  )}
                </div>
                {geocodeStatus.origin === "success" && formData.originLat && (
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    Located: {formData.originLat.toFixed(4)}, {formData.originLng?.toFixed(4)}
                  </p>
                )}
                {geocodeStatus.origin === "error" && (
                  <p className="text-xs text-amber-600">
                    Could not geocode — will retry on save
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="destination">Destination</Label>
                <div className="relative">
                  <Input
                    id="destination"
                    required
                    value={formData.destination}
                    onChange={(e) => setFormData((d) => ({ ...d, destination: e.target.value }))}
                    onBlur={() => handleGeocode("destination")}
                    placeholder="e.g., Mombasa, Kenya"
                  />
                  {geocodeStatus.destination === "success" && (
                    <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                  )}
                </div>
                {geocodeStatus.destination === "success" && formData.destinationLat && (
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    Located: {formData.destinationLat.toFixed(4)}, {formData.destinationLng?.toFixed(4)}
                  </p>
                )}
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
                  placeholder="Optional"
                />
              </div>
            </div>
          </FormSection>

          <FormSection title="Cargo Details" description="What is being transported">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cargo">Cargo Description</Label>
                <Input
                  id="cargo"
                  value={formData.cargoDescription}
                  onChange={(e) => setFormData((d) => ({ ...d, cargoDescription: e.target.value }))}
                  placeholder="e.g., Electronics, Furniture"
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
                  placeholder="Optional"
                />
              </div>
            </div>
          </FormSection>

          <FormSection title="Assignments" description="Assign truck, trailer, and driver">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Truck - Required */}
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

                {/* Trailer - Optional */}
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

                {/* Driver - Required */}
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

          <FormSection title="Additional Notes" description="Any special instructions">
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
              onClick={() => navigate({ to: "/trips" })}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createTrip.isPending}>
              {createTrip.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Trip
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}