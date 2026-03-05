/**
 * components/forms/FuelLogForm.tsx
 * Fleet Management System — Phase 6
 *
 * Shared form used by:
 *   /fuel/logs/new
 *   /fuel/logs/$logId/edit
 *
 * Features:
 *  - Auto-calculates total cost inline as litres / price change
 *  - Trip selector loads only active trips for the selected truck
 *  - DRIVER role: truck + driver fields pre-filled and locked
 */

import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Calculator } from "lucide-react";
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
import { formatCurrency } from "../../lib/utils";
import { API_BASE_URL } from "../../lib/constants";
import { usePermission } from "../../hooks/usePermission";
import { useAuth } from "../../lib/auth-context";
import type { FuelLog, FuelLogCreate, FuelLogUpdate } from "../../types/fuel";

interface FuelLogFormProps {
  initial?:    FuelLog;
  onSubmit:    (data: FuelLogCreate | FuelLogUpdate) => Promise<void>;
  isLoading:   boolean;
}

export function FuelLogForm({ initial, onSubmit, isLoading }: FuelLogFormProps) {
  const navigate   = useNavigate();
  const { role }   = usePermission();
  const { user }   = useAuth();
  const isDriver   = role === "DRIVER";
  const isEditMode = Boolean(initial);

  // ── Form state ────────────────────────────────────────────────────────────
  const [truckId,         setTruckId]         = useState(initial?.truckId         ?? "");
  const [driverId,        setDriverId]        = useState(initial?.driverId        ?? "");
  const [tripId,          setTripId]          = useState(initial?.tripId          ?? "");
  const [litres,          setLitres]          = useState(initial?.litres          ?? 0);
  const [pricePerLitre,   setPricePerLitre]   = useState(initial?.pricePerLitre   ?? 0);
  const [odometerAtFuel,  setOdometerAtFuel]  = useState(initial?.odometerAtFuel  ?? 0);
  const [stationName,     setStationName]     = useState(initial?.stationName     ?? "");
  const [stationLocation, setStationLocation] = useState(initial?.stationLocation ?? "");
  const [loggedAt,        setLoggedAt]        = useState(
    initial?.loggedAt
      ? initial.loggedAt.slice(0, 16)   // trim to "YYYY-MM-DDTHH:MM" for datetime-local input
      : new Date().toISOString().slice(0, 16)
  );

  // ── Derived: auto-calculated total cost ──────────────────────────────────
  const totalCost = litres > 0 && pricePerLitre > 0
    ? Math.round(litres * pricePerLitre * 100) / 100
    : 0;

  // ── Fetch trucks ──────────────────────────────────────────────────────────
  const { data: trucksData } = useQuery({
    queryKey: ["trucks-select"],
    queryFn:  () =>
      fetch(`${API_BASE_URL}/fleet/trucks?limit=200&status=active`, {
        credentials: "include",
      }).then((r) => r.json()),
    select: (r) => r as { id: string; plateNumber: string }[],
  });

  // ── Fetch drivers (ADMIN/FINANCE only) ───────────────────────────────────
  const { data: driversData } = useQuery({
    queryKey: ["drivers-select"],
    queryFn:  () =>
      fetch(`${API_BASE_URL}/drivers?limit=200&status=active`, {
        credentials: "include",
      }).then((r) => r.json()),
    select: (r) => r.data as { id: string; firstName: string; lastName: string }[],
    enabled: !isDriver,
  });

  // ── Fetch driver profile for DRIVER role (to pre-fill driverId) ──────────
  const { data: myDriverProfile } = useQuery({
    queryKey: ["my-driver-profile"],
    queryFn:  () =>
      fetch(`${API_BASE_URL}/drivers/me`, { credentials: "include" }).then((r) => r.json()),
    select: (r) => r.data as { id: string },
    enabled: isDriver,
  });

  useEffect(() => {
    if (isDriver && myDriverProfile) {
      setDriverId(myDriverProfile.id);
    }
  }, [isDriver, myDriverProfile]);

  // ── Fetch active trips for selected truck (optional linkage) ─────────────
  const { data: tripsData } = useQuery({
    queryKey: ["trips-select", truckId],
    queryFn:  () =>
      fetch(
        `${API_BASE_URL}/trips?assignedTruckId=${truckId}&status=pending&status=en-route&limit=50`,
        { credentials: "include" }
      ).then((r) => r.json()),
    select: (r) => r.data as { id: string; tripNumber: string; origin: string; destination: string }[],
    enabled: Boolean(truckId),
  });

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      truckId,
      driverId,
      tripId:          tripId || undefined,
      litres,
      pricePerLitre,
      odometerAtFuel,
      stationName:     stationName     || undefined,
      stationLocation: stationLocation || undefined,
      loggedAt:        new Date(loggedAt).toISOString(),
    };
    await onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Truck */}
        <div className="space-y-1.5">
          <Label htmlFor="truck">Truck <span className="text-destructive">*</span></Label>
          <Select
            value={truckId}
            onValueChange={(v) => { setTruckId(v); setTripId(""); }}
            disabled={isDriver && Boolean(initial?.truckId)}
            required
          >
            <SelectTrigger id="truck">
              <SelectValue placeholder="Select truck…" />
            </SelectTrigger>
            <SelectContent>
              {trucksData?.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.plateNumber}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Driver */}
        <div className="space-y-1.5">
          <Label htmlFor="driver">Driver <span className="text-destructive">*</span></Label>
          {isDriver ? (
            <Input
              value={user ? `${user.firstName} ${user.lastName}` : "You"}
              disabled
              className="bg-muted"
            />
          ) : (
            <Select value={driverId} onValueChange={setDriverId} required>
              <SelectTrigger id="driver">
                <SelectValue placeholder="Select driver…" />
              </SelectTrigger>
              <SelectContent>
                {driversData?.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.firstName} {d.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Trip (optional) */}
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="trip">
            Trip <span className="text-muted-foreground text-xs">(optional)</span>
          </Label>
          <Select
            value={tripId || "none"}
            onValueChange={(v) => setTripId(v === "none" ? "" : v)}
            disabled={!truckId}
          >
            <SelectTrigger id="trip">
              <SelectValue placeholder={truckId ? "Select trip…" : "Select a truck first"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No trip linked</SelectItem>
              {tripsData?.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.tripNumber} — {t.origin} → {t.destination}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Litres */}
        <div className="space-y-1.5">
          <Label htmlFor="litres">Litres <span className="text-destructive">*</span></Label>
          <Input
            id="litres"
            type="number"
            min={0.1}
            step={0.1}
            value={litres || ""}
            onChange={(e) => setLitres(parseFloat(e.target.value) || 0)}
            placeholder="e.g. 85.5"
            required
          />
        </div>

        {/* Price per litre */}
        <div className="space-y-1.5">
          <Label htmlFor="price">Price per Litre <span className="text-destructive">*</span></Label>
          <Input
            id="price"
            type="number"
            min={0.01}
            step={0.01}
            value={pricePerLitre || ""}
            onChange={(e) => setPricePerLitre(parseFloat(e.target.value) || 0)}
            placeholder="e.g. 1.85"
            required
          />
        </div>

        {/* Total cost — read-only, auto-computed */}
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5">
            <Calculator className="h-3.5 w-3.5 text-muted-foreground" />
            Total Cost
            <span className="text-muted-foreground text-xs">(auto)</span>
          </Label>
          <div className="flex h-10 items-center rounded-md border bg-muted px-3 font-mono text-sm font-medium">
            {totalCost > 0 ? formatCurrency(totalCost) : "—"}
          </div>
        </div>

        {/* Odometer */}
        <div className="space-y-1.5">
          <Label htmlFor="odometer">
            Odometer at Fill-up (km) <span className="text-destructive">*</span>
          </Label>
          <Input
            id="odometer"
            type="number"
            min={0}
            step={1}
            value={odometerAtFuel || ""}
            onChange={(e) => setOdometerAtFuel(parseFloat(e.target.value) || 0)}
            placeholder="e.g. 125400"
            required
          />
        </div>

        {/* Date/time */}
        <div className="space-y-1.5">
          <Label htmlFor="loggedAt">Date & Time <span className="text-destructive">*</span></Label>
          <Input
            id="loggedAt"
            type="datetime-local"
            value={loggedAt}
            onChange={(e) => setLoggedAt(e.target.value)}
            required
          />
        </div>

        {/* Station name */}
        <div className="space-y-1.5">
          <Label htmlFor="station">Station Name</Label>
          <Input
            id="station"
            value={stationName}
            onChange={(e) => setStationName(e.target.value)}
            placeholder="e.g. Total Energies Westlands"
          />
        </div>

        {/* Station location */}
        <div className="space-y-1.5">
          <Label htmlFor="stationLoc">Station Location</Label>
          <Input
            id="stationLoc"
            value={stationLocation}
            onChange={(e) => setStationLocation(e.target.value)}
            placeholder="e.g. Westlands, Nairobi"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={() => navigate({ to: "/fuel" })}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading || !truckId || !driverId || litres <= 0 || pricePerLitre <= 0}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEditMode ? "Save Changes" : "Log Fuel"}
        </Button>
      </div>
    </form>
  );
}