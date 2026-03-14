/**
 * components/forms/TripForm.tsx
 * Fleet Management System — Phase 5
 *
 * Changes (availability refactor):
 *   - Replaced useTrucks / useTrailers / useDrivers with useAvailability.
 *     One endpoint returns all active resources + availability status for
 *     the selected date range — no separate fleet hooks needed.
 *   - Dropdowns show ALL resources always.  Unavailable ones are visually
 *     dimmed and append "· Booked TRP-XXXXX" so the dispatcher knows why.
 *   - Selecting a booked resource shows a soft amber inline warning but
 *     does NOT block submission — the backend 409 is the hard stop.
 *   - Availability re-fetches automatically whenever departure or arrival
 *     changes (React Query handles deduplication/caching).
 *   - In edit mode, the current trip's ID is passed as excludeTripId so
 *     the trip doesn't conflict with itself.
 *   - 409 conflict error is still surfaced inline from the axios response
 *     (err.response.data.detail) at the Assignments section.
 */

import { useState, useEffect } from "react";
import { AlertCircle, AlertTriangle, Check, MapPin, Loader2, X } from "lucide-react";
import { Button }    from "../ui/button";
import { Input }     from "../ui/input";
import { Label }     from "../ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../ui/select";
import { Textarea }    from "../ui/textarea";
import { FormSection } from "../molecules/FormSection";
import { useAvailability } from "../../hooks/useAvailability";
import type {
  TruckAvailability,
  TrailerAvailability,
  DriverAvailability,
} from "../../hooks/useAvailability";
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
    if (data?.[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch (e) {
    console.error("Geocoding error:", e);
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type GeocodeStatus = "idle" | "loading" | "success" | "error";

export type TripFormPayload = TripCreateRequest & TripUpdateRequest;

interface TripFormProps {
  initial?:  Trip;
  onSubmit:  (data: TripFormPayload) => Promise<void>;
  isLoading: boolean;
  onCancel:  () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Convert "YYYY-MM-DDTHH:MM" (datetime-local value) to ISO string or null. */
function toISO(value: string): string | null {
  if (!value) return null;
  try { return new Date(value).toISOString(); } catch { return null; }
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
    scheduledDeparture: initial?.scheduledDeparture ? initial.scheduledDeparture.slice(0, 16) : "",
    scheduledArrival:   initial?.scheduledArrival   ? initial.scheduledArrival.slice(0, 16)   : "",
    distanceKm:         initial?.distanceKm?.toString()     ?? "",
    cargoDescription:   initial?.cargoDescription            ?? "",
    cargoWeightTons:    initial?.cargoWeightTons?.toString() ?? "",
    assignedTruckId:    initial?.assignedTruckId             ?? "",
    assignedTrailerId:  initial?.assignedTrailerId           ?? "none",
    assignedDriverId:   initial?.assignedDriverId            ?? "",
    notes:              initial?.notes                       ?? "",
  });

  const [geocodeStatus, setGeocodeStatus] = useState<{
    origin: GeocodeStatus; destination: GeocodeStatus;
  }>({
    origin:      isEditMode && initial?.originLat      ? "success" : "idle",
    destination: isEditMode && initial?.destinationLat ? "success" : "idle",
  });

  const [conflictError, setConflictError] = useState<string | null>(null);

  // Re-initialise when editing and trip data loads async
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

  // Clear conflict error when any assignment field changes
  const setField = (patch: Partial<typeof formData>) => {
    if (
      "assignedTruckId"   in patch ||
      "assignedTrailerId" in patch ||
      "assignedDriverId"  in patch
    ) {
      setConflictError(null);
    }
    setFormData((d) => ({ ...d, ...patch }));
  };

  // ── Availability ──────────────────────────────────────────────────────────
  // Converts datetime-local strings to ISO for the hook.
  // The hook fires automatically when either date changes.
  const departureISO = toISO(formData.scheduledDeparture);
  const arrivalISO   = toISO(formData.scheduledArrival);

  const {
    data:      availability,
    isLoading: availabilityLoading,
  } = useAvailability({
    departure:     departureISO,
    arrival:       arrivalISO,
    excludeTripId: initial?.id,   // edit mode: don't conflict with self
  });

  const trucks   = availability?.trucks   ?? [];
  const trailers = availability?.trailers ?? [];
  const drivers  = availability?.drivers  ?? [];

  // Look up selected resources for inline booking warnings
  const selectedTruck   = trucks.find((t: TruckAvailability)    => t.id === formData.assignedTruckId);
  const selectedTrailer = trailers.find((t: TrailerAvailability) => t.id === formData.assignedTrailerId);
  const selectedDriver  = drivers.find((d: DriverAvailability)   => d.id === formData.assignedDriverId);

  // Only show booking warnings when both dates are entered
  const datesSet = !!(departureISO && arrivalISO);

  // ── Geocoding ─────────────────────────────────────────────────────────────
  const handleGeocode = async (field: "origin" | "destination") => {
    const address = formData[field];
    if (!address) return;
    setGeocodeStatus((s) => ({ ...s, [field]: "loading" }));
    const result = await geocodeClientSide(address);
    if (result) {
      setFormData((d) => ({ ...d, [`${field}Lat`]: result.lat, [`${field}Lng`]: result.lng }));
      setGeocodeStatus((s) => ({ ...s, [field]: "success" }));
    } else {
      setGeocodeStatus((s) => ({ ...s, [field]: "error" }));
    }
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setConflictError(null);
    try {
      await onSubmit({
        origin:             formData.origin,
        destination:        formData.destination,
        originLat:          formData.originLat      ?? undefined,
        originLng:          formData.originLng      ?? undefined,
        destinationLat:     formData.destinationLat ?? undefined,
        destinationLng:     formData.destinationLng ?? undefined,
        scheduledDeparture: new Date(formData.scheduledDeparture).toISOString(),
        scheduledArrival:   new Date(formData.scheduledArrival).toISOString(),
        distanceKm:         formData.distanceKm     ? parseFloat(formData.distanceKm)     : undefined,
        cargoDescription:   formData.cargoDescription                                     || undefined,
        cargoWeightTons:    formData.cargoWeightTons ? parseFloat(formData.cargoWeightTons) : undefined,
        assignedTruckId:    formData.assignedTruckId                                      || undefined,
        assignedTrailerId:  formData.assignedTrailerId === "none"
          ? undefined : formData.assignedTrailerId || undefined,
        assignedDriverId:   formData.assignedDriverId                                     || undefined,
        notes:              formData.notes                                                 || undefined,
      });
    } catch (err) {
      // Axios wraps HTTP errors — FastAPI's detail string lives at
      // err.response.data.detail, not err.message
      const axiosDetail = (err as any)?.response?.data?.detail as string | undefined;
      const httpStatus  = (err as any)?.response?.status  as number | undefined;
      if (httpStatus === 409 && axiosDetail) {
        setConflictError(axiosDetail);
      }
      throw err;
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* ── Route ─────────────────────────────────────────────────────────── */}
      <FormSection title="Route" description="Origin, destination, and schedule">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Origin */}
          <div className="space-y-2">
            <Label htmlFor="origin">Origin <span className="text-destructive">*</span></Label>
            <div className="relative">
              <Input
                id="origin" required value={formData.origin}
                onChange={(e) => setField({ origin: e.target.value })}
                onBlur={() => handleGeocode("origin")}
                placeholder="e.g. Nairobi, Kenya"
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
          </div>

          {/* Destination */}
          <div className="space-y-2">
            <Label htmlFor="destination">Destination <span className="text-destructive">*</span></Label>
            <div className="relative">
              <Input
                id="destination" required value={formData.destination}
                onChange={(e) => setField({ destination: e.target.value })}
                onBlur={() => handleGeocode("destination")}
                placeholder="e.g. Mombasa, Kenya"
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
          </div>

          {/* Departure */}
          <div className="space-y-2">
            <Label htmlFor="departure">
              Scheduled Departure <span className="text-destructive">*</span>
            </Label>
            <Input
              id="departure" type="datetime-local" required
              value={formData.scheduledDeparture}
              onChange={(e) => setField({ scheduledDeparture: e.target.value })}
            />
          </div>

          {/* Arrival */}
          <div className="space-y-2">
            <Label htmlFor="arrival">
              Scheduled Arrival <span className="text-destructive">*</span>
            </Label>
            <Input
              id="arrival" type="datetime-local" required
              value={formData.scheduledArrival}
              onChange={(e) => setField({ scheduledArrival: e.target.value })}
            />
          </div>

          {/* Distance */}
          <div className="space-y-2">
            <Label htmlFor="distance">
              Distance (km) <span className="text-muted-foreground text-xs">(optional)</span>
            </Label>
            <Input
              id="distance" type="number" step="0.1" min={0}
              value={formData.distanceKm}
              onChange={(e) => setField({ distanceKm: e.target.value })}
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
              id="cargo" value={formData.cargoDescription}
              onChange={(e) => setField({ cargoDescription: e.target.value })}
              placeholder="e.g. Electronics, Furniture"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="weight">
              Weight (tons) <span className="text-muted-foreground text-xs">(optional)</span>
            </Label>
            <Input
              id="weight" type="number" step="0.1" min={0}
              value={formData.cargoWeightTons}
              onChange={(e) => setField({ cargoWeightTons: e.target.value })}
              placeholder="e.g. 12.5"
            />
          </div>
        </div>
      </FormSection>

      {/* ── Assignments ───────────────────────────────────────────────────── */}
      <FormSection
        title="Assignments"
        description={
          datesSet
            ? availabilityLoading
              ? "Checking availability…"
              : "Available resources shown in full · booked ones are dimmed"
            : "Enter departure and arrival dates above to see real-time availability"
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* Truck */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              Truck <span className="text-destructive">*</span>
              {availabilityLoading && datesSet && (
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
              )}
            </Label>
            <Select
              value={formData.assignedTruckId}
              onValueChange={(v) => setField({ assignedTruckId: v })}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Select truck…" />
              </SelectTrigger>
              <SelectContent>
                {trucks.map((t: TruckAvailability) => (
                  <SelectItem
                    key={t.id}
                    value={t.id}
                    className={!t.available && datesSet ? "opacity-50" : ""}
                  >
                    {t.plateNumber} — {t.make} {t.model}
                    {!t.available && datesSet && t.conflictTripNumber
                      ? ` · Booked ${t.conflictTripNumber}`
                      : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {datesSet && selectedTruck && !selectedTruck.available && (
              <p className="text-xs text-amber-600 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                Booked on {selectedTruck.conflictTripNumber} during these dates
              </p>
            )}
          </div>

          {/* Trailer */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              Trailer <span className="text-muted-foreground text-xs">(optional)</span>
              {availabilityLoading && datesSet && (
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
              )}
            </Label>
            <Select
              value={formData.assignedTrailerId}
              onValueChange={(v) => setField({ assignedTrailerId: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="No trailer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No trailer</SelectItem>
                {trailers.map((t: TrailerAvailability) => (
                  <SelectItem
                    key={t.id}
                    value={t.id}
                    className={!t.available && datesSet ? "opacity-50" : ""}
                  >
                    {t.plateNumber} — {t.type}
                    {!t.available && datesSet && t.conflictTripNumber
                      ? ` · Booked ${t.conflictTripNumber}`
                      : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {datesSet && selectedTrailer && !selectedTrailer.available && (
              <p className="text-xs text-amber-600 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                Booked on {selectedTrailer.conflictTripNumber} during these dates
              </p>
            )}
          </div>

          {/* Driver */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              Driver <span className="text-destructive">*</span>
              {availabilityLoading && datesSet && (
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
              )}
            </Label>
            <Select
              value={formData.assignedDriverId}
              onValueChange={(v) => setField({ assignedDriverId: v })}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Select driver…" />
              </SelectTrigger>
              <SelectContent>
                {drivers.map((d: DriverAvailability) => (
                  <SelectItem
                    key={d.id}
                    value={d.id}
                    className={!d.available && datesSet ? "opacity-50" : ""}
                  >
                    {d.firstName} {d.lastName}
                    {!d.available && datesSet && d.conflictTripNumber
                      ? ` · Booked ${d.conflictTripNumber}`
                      : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {datesSet && selectedDriver && !selectedDriver.available && (
              <p className="text-xs text-amber-600 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                Booked on {selectedDriver.conflictTripNumber} during these dates
              </p>
            )}
          </div>
        </div>

        {/* ── Hard 409 conflict error from backend ──────────────────────── */}
        {conflictError && (
          <div className="mt-3 flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm">
            <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <p className="flex-1 text-destructive leading-snug">{conflictError}</p>
            <Button
              type="button"
              onClick={() => setConflictError(null)}
              className="text-destructive/70 hover:text-destructive transition-colors"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
      </FormSection>

      {/* ── Notes ─────────────────────────────────────────────────────────── */}
      <FormSection title="Additional Notes" description="Any special instructions for the driver">
        <Textarea
          value={formData.notes}
          onChange={(e) => setField({ notes: e.target.value })}
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