/**
 * components/forms/TripForm.tsx
 * Fleet Management System — Phase 5
 *
 * Shared form used by:
 *   /trips/new
 *   /trips/$tripId/edit
 *
 * Features:
 *   - Client-side geocoding on blur with visual feedback
 *   - Edit mode pre-fills all fields and shows existing coords as hint
 *   - Fetches active trucks, trailers, and drivers internally
 */

import { useState, useEffect } from "react";
import { Check, MapPin, Loader2 } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Textarea } from "../ui/textarea";
import { FormSection } from "../molecules/FormSection";
import { useTrucks, useTrailers } from "../../hooks/useFleet";
import { useDrivers } from "../../hooks/useDrivers";
import type { Trip, TripCreateRequest, TripUpdateRequest } from "../../types/trips";

// ─────────────────────────────────────────────────────────────────────────────
// GEOCODING
// ─────────────────────────────────────────────────────────────────────────────

async function geocodeClientSide(
  address: string,
): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
      { headers: { "User-Agent": "FleetMS/1.0" } },
    );
    const data = await res.json();
    if (data?.[0]) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
  } catch (e) {
    console.error("Geocoding error:", e);
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────


type GeocodeStatus = "idle" | "loading" | "success" | "error";

export type TripFormPayload = TripCreateRequest & TripUpdateRequest

interface TripFormProps {
  initial?:  Trip;
  onSubmit:  (data: TripFormPayload) => Promise<void>;
  isLoading: boolean;
  onCancel:  () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// FORM
// ─────────────────────────────────────────────────────────────────────────────

export function TripForm({ initial, onSubmit, isLoading, onCancel }: TripFormProps) {
  const isEditMode = Boolean(initial);

  const [formData, setFormData] = useState({
    origin:             initial?.origin             ?? "",
    destination:        initial?.destination        ?? "",
    originLat:          initial?.originLat          ?? null as number | null,
    originLng:          initial?.originLng          ?? null as number | null,
    destinationLat:     initial?.destinationLat     ?? null as number | null,
    destinationLng:     initial?.destinationLng     ?? null as number | null,
    scheduledDeparture: initial?.scheduledDeparture
      ? initial.scheduledDeparture.slice(0, 16)
      : "",
    scheduledArrival:   initial?.scheduledArrival
      ? initial.scheduledArrival.slice(0, 16)
      : "",
    distanceKm:         initial?.distanceKm?.toString()      ?? "",
    cargoDescription:   initial?.cargoDescription             ?? "",
    cargoWeightTons:    initial?.cargoWeightTons?.toString()  ?? "",
    assignedTruckId:    initial?.assignedTruckId              ?? "",
    assignedTrailerId:  initial?.assignedTrailerId            ?? "none",
    assignedDriverId:   initial?.assignedDriverId             ?? "",
    notes:              initial?.notes                        ?? "",
  });

  const [geocodeStatus, setGeocodeStatus] = useState<{
    origin: GeocodeStatus;
    destination: GeocodeStatus;
  }>({
    origin:      isEditMode && initial?.originLat      ? "success" : "idle",
    destination: isEditMode && initial?.destinationLat ? "success" : "idle",
  });

  // Re-initialise if initial changes (edit page loads trip async)
  useEffect(() => {
    if (!initial) return;
    setFormData({
      origin:             initial.origin,
      destination:        initial.destination,
      originLat:          initial.originLat          ?? null,
      originLng:          initial.originLng          ?? null,
      destinationLat:     initial.destinationLat     ?? null,
      destinationLng:     initial.destinationLng     ?? null,
      scheduledDeparture: initial.scheduledDeparture.slice(0, 16),
      scheduledArrival:   initial.scheduledArrival.slice(0, 16),
      distanceKm:         initial.distanceKm?.toString()     ?? "",
      cargoDescription:   initial.cargoDescription            ?? "",
      cargoWeightTons:    initial.cargoWeightTons?.toString() ?? "",
      assignedTruckId:    initial.assignedTruckId             ?? "",
      assignedTrailerId:  initial.assignedTrailerId           ?? "none",
      assignedDriverId:   initial.assignedDriverId            ?? "",
      notes:              initial.notes                       ?? "",
    });
    setGeocodeStatus({
      origin:      initial.originLat      ? "success" : "idle",
      destination: initial.destinationLat ? "success" : "idle",
    });
  }, [initial]);

  // ── Dropdowns ──────────────────────────────────────────────────────────────
  const { data: trucksData,   isLoading: trucksLoading   } = useTrucks({ status: "active" });
  const { data: trailersData, isLoading: trailersLoading } = useTrailers({ status: "active" });
  const { data: driversData,  isLoading: driversLoading  } = useDrivers({ status: "active" });

  const trucks   = trucksData?.data   ?? [];
  const trailers = trailersData?.data ?? [];
  const drivers  = driversData?.data  ?? [];

  const dropdownsLoading = trucksLoading || trailersLoading || driversLoading;

  // ── Geocoding ──────────────────────────────────────────────────────────────
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

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({
      origin:             formData.origin,
      destination:        formData.destination,
      originLat:          formData.originLat      ?? undefined,
      originLng:          formData.originLng      ?? undefined,
      destinationLat:     formData.destinationLat ?? undefined,
      destinationLng:     formData.destinationLng ?? undefined,
      scheduledDeparture: new Date(formData.scheduledDeparture).toISOString(),
      scheduledArrival:   new Date(formData.scheduledArrival).toISOString(),
      distanceKm:         formData.distanceKm     ? parseFloat(formData.distanceKm)    : undefined,
      cargoDescription:   formData.cargoDescription                                    || undefined,
      cargoWeightTons:    formData.cargoWeightTons ? parseFloat(formData.cargoWeightTons) : undefined,
      assignedTruckId:    formData.assignedTruckId                                     || undefined,
      assignedTrailerId:  formData.assignedTrailerId === "none"
        ? undefined
        : formData.assignedTrailerId || undefined,
      assignedDriverId:   formData.assignedDriverId                                    || undefined,
      notes:              formData.notes                                                || undefined,
    });
  };

  if (dropdownsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">

      {/* ── Route ─────────────────────────────────────────────────────────── */}
      <FormSection
        title="Route Details"
        description={isEditMode ? "Update origin and destination" : "Origin and destination with geocoding"}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Origin */}
          <div className="space-y-2">
            <Label htmlFor="origin">Origin <span className="text-destructive">*</span></Label>
            <div className="relative">
              <Input
                id="origin"
                required
                value={formData.origin}
                placeholder="e.g., Nairobi, Kenya"
                onChange={(e) => {
                  setFormData((d) => ({ ...d, origin: e.target.value }));
                  setGeocodeStatus((s) => ({ ...s, origin: "idle" }));
                }}
                onBlur={() => handleGeocode("origin")}
              />
              {geocodeStatus.origin === "loading" && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
              {geocodeStatus.origin === "success" && (
                <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
              )}
            </div>
            {geocodeStatus.origin === "success" && formData.originLat && (
              <p className="text-xs text-green-600 flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {formData.originLat.toFixed(4)}, {formData.originLng?.toFixed(4)}
              </p>
            )}
            {geocodeStatus.origin === "error" && (
              <p className="text-xs text-amber-600">Could not geocode — will retry on save</p>
            )}
            {isEditMode && geocodeStatus.origin === "idle" && initial?.originLat && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                Current: {initial.originLat.toFixed(4)}, {initial.originLng?.toFixed(4)}
              </p>
            )}
          </div>

          {/* Destination */}
          <div className="space-y-2">
            <Label htmlFor="destination">Destination <span className="text-destructive">*</span></Label>
            <div className="relative">
              <Input
                id="destination"
                required
                value={formData.destination}
                placeholder="e.g., Mombasa, Kenya"
                onChange={(e) => {
                  setFormData((d) => ({ ...d, destination: e.target.value }));
                  setGeocodeStatus((s) => ({ ...s, destination: "idle" }));
                }}
                onBlur={() => handleGeocode("destination")}
              />
              {geocodeStatus.destination === "loading" && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
              {geocodeStatus.destination === "success" && (
                <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
              )}
            </div>
            {geocodeStatus.destination === "success" && formData.destinationLat && (
              <p className="text-xs text-green-600 flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {formData.destinationLat.toFixed(4)}, {formData.destinationLng?.toFixed(4)}
              </p>
            )}
            {geocodeStatus.destination === "error" && (
              <p className="text-xs text-amber-600">Could not geocode — will retry on save</p>
            )}
            {isEditMode && geocodeStatus.destination === "idle" && initial?.destinationLat && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                Current: {initial.destinationLat.toFixed(4)}, {initial.destinationLng?.toFixed(4)}
              </p>
            )}
          </div>

          {/* Departure */}
          <div className="space-y-2">
            <Label htmlFor="departure">Scheduled Departure <span className="text-destructive">*</span></Label>
            <Input
              id="departure"
              type="datetime-local"
              required
              value={formData.scheduledDeparture}
              onChange={(e) => setFormData((d) => ({ ...d, scheduledDeparture: e.target.value }))}
            />
          </div>

          {/* Arrival */}
          <div className="space-y-2">
            <Label htmlFor="arrival">Scheduled Arrival <span className="text-destructive">*</span></Label>
            <Input
              id="arrival"
              type="datetime-local"
              required
              value={formData.scheduledArrival}
              onChange={(e) => setFormData((d) => ({ ...d, scheduledArrival: e.target.value }))}
            />
          </div>

          {/* Distance */}
          <div className="space-y-2">
            <Label htmlFor="distance">
              Distance (km) <span className="text-muted-foreground text-xs">(optional)</span>
            </Label>
            <Input
              id="distance"
              type="number"
              step="0.1"
              min={0}
              value={formData.distanceKm}
              onChange={(e) => setFormData((d) => ({ ...d, distanceKm: e.target.value }))}
              placeholder="e.g. 480"
            />
          </div>
        </div>
      </FormSection>

      {/* ── Cargo ─────────────────────────────────────────────────────────── */}
      <FormSection title="Cargo Details" description="What is being transported">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="cargo">
              Cargo Description <span className="text-muted-foreground text-xs">(optional)</span>
            </Label>
            <Input
              id="cargo"
              value={formData.cargoDescription}
              onChange={(e) => setFormData((d) => ({ ...d, cargoDescription: e.target.value }))}
              placeholder="e.g., Electronics, Furniture"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="weight">
              Weight (tons) <span className="text-muted-foreground text-xs">(optional)</span>
            </Label>
            <Input
              id="weight"
              type="number"
              step="0.1"
              min={0}
              value={formData.cargoWeightTons}
              onChange={(e) => setFormData((d) => ({ ...d, cargoWeightTons: e.target.value }))}
              placeholder="e.g. 12.5"
            />
          </div>
        </div>
      </FormSection>

      {/* ── Assignments ───────────────────────────────────────────────────── */}
      <FormSection title="Assignments" description="Assign truck, trailer, and driver">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* Truck */}
          <div className="space-y-2">
            <Label>Truck <span className="text-destructive">*</span></Label>
            <Select
              value={formData.assignedTruckId}
              onValueChange={(v) => setFormData((d) => ({ ...d, assignedTruckId: v }))}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Select truck…" />
              </SelectTrigger>
              <SelectContent>
                {trucks.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.plateNumber} — {t.make} {t.model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Trailer */}
          <div className="space-y-2">
            <Label>
              Trailer <span className="text-muted-foreground text-xs">(optional)</span>
            </Label>
            <Select
              value={formData.assignedTrailerId}
              onValueChange={(v) => setFormData((d) => ({ ...d, assignedTrailerId: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="No trailer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No trailer</SelectItem>
                {trailers.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.plateNumber} — {t.type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Driver */}
          <div className="space-y-2">
            <Label>Driver <span className="text-destructive">*</span></Label>
            <Select
              value={formData.assignedDriverId}
              onValueChange={(v) => setFormData((d) => ({ ...d, assignedDriverId: v }))}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Select driver…" />
              </SelectTrigger>
              <SelectContent>
                {drivers.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.firstName} {d.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </FormSection>

      {/* ── Notes ─────────────────────────────────────────────────────────── */}
      <FormSection title="Additional Notes" description="Any special instructions for the driver">
        <Textarea
          value={formData.notes}
          onChange={(e) => setFormData((d) => ({ ...d, notes: e.target.value }))}
          placeholder="Optional notes for the driver…"
          rows={3}
        />
      </FormSection>

      {/* ── Actions ───────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-end gap-3 pt-2 border-t">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={
            isLoading ||
            !formData.origin.trim() ||
            !formData.destination.trim() ||
            !formData.scheduledDeparture ||
            !formData.scheduledArrival
          }
        >
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEditMode ? "Save Changes" : "Create Trip"}
        </Button>
      </div>
    </form>
  );
}