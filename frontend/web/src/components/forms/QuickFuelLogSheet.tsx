/**
 * components/fleet/QuickFuelLogSheet.tsx
 * Fleet Management System
 *
 * Compact fuel-log entry sheet launched from the trip detail page.
 * Pre-fills and locks: truckId, tripId, driverId (from session).
 * User only enters: litres, price, odometer, datetime, station (optional).
 *
 * Posts to POST /api/v1/fuel/logs — same endpoint as the full form.
 */

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Calculator, Fuel, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../ui/sheet";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import { Separator } from "../ui/separator";
import { formatCurrency } from "../../lib/utils";
import apiClient from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import type { FuelLogCreate } from "../../types/fuel";

// ─────────────────────────────────────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────────────────────────────────────

interface QuickFuelLogSheetProps {
  open:           boolean;
  onOpenChange:   (open: boolean) => void;
  tripId:         string;
  tripNumber:     string;
  truckId?:       string;
  truckPlate?:    string;
  /** Current truck odometer so we can pre-fill as a hint */
  truckOdometer?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function QuickFuelLogSheet({
  open,
  onOpenChange,
  tripId,
  tripNumber,
  truckId,
  truckPlate,
  truckOdometer,
}: QuickFuelLogSheetProps) {
  const { user } = useAuth();
  const qc = useQueryClient();

  // ── Fetch driver profile for current user (needed for driverId) ──────────
  const { data: driverProfile } = useQuery({
    queryKey: ["my-driver-profile"],
    queryFn:  () =>
      apiClient
        .get<{ data: { id: string } }>("/api/v1/drivers/me")
        .then((r) => r.data.data),
    staleTime: 30 * 60 * 1000,
    enabled:   open,
  });

  // ── Form state ────────────────────────────────────────────────────────────
  const [litres,          setLitres]          = useState("");
  const [pricePerLitre,   setPricePerLitre]   = useState("");
  const [odometerAtFuel,  setOdometerAtFuel]  = useState(
    truckOdometer ? String(truckOdometer) : "",
  );
  const [stationName,     setStationName]     = useState("");
  const [stationLocation, setStationLocation] = useState("");
  const [loggedAt,        setLoggedAt]        = useState(
    () => new Date().toISOString().slice(0, 16),
  );

  // Re-seed odometer hint if prop changes (e.g. sheet closed and reopened)
  useEffect(() => {
    if (truckOdometer && !odometerAtFuel) {
      setOdometerAtFuel(String(truckOdometer));
    }
  }, [truckOdometer]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset form when sheet closes
  useEffect(() => {
    if (!open) {
      setLitres("");
      setPricePerLitre("");
      setOdometerAtFuel(truckOdometer ? String(truckOdometer) : "");
      setStationName("");
      setStationLocation("");
      setLoggedAt(new Date().toISOString().slice(0, 16));
    }
  }, [open, truckOdometer]);

  const litresNum       = parseFloat(litres)       || 0;
  const priceNum        = parseFloat(pricePerLitre) || 0;
  const totalCost       = litresNum > 0 && priceNum > 0
    ? Math.round(litresNum * priceNum * 100) / 100
    : 0;
  const odometerNum     = parseFloat(odometerAtFuel) || 0;

  // ── Mutation ──────────────────────────────────────────────────────────────
  const mutation = useMutation({
    mutationFn: (payload: FuelLogCreate) =>
      apiClient.post("/api/v1/fuel/logs", payload).then((r) => r.data),
    onSuccess: () => {
      toast.success("Fuel log saved");
      qc.invalidateQueries({ queryKey: ["fuel-logs"] });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to save fuel log");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!truckId || !driverProfile?.id) return;

    mutation.mutate({
      truckId,
      driverId:        driverProfile.id,
      tripId,
      litres:          litresNum,
      pricePerLitre:   priceNum,
      odometerAtFuel:  odometerNum,
      stationName:     stationName     || undefined,
      stationLocation: stationLocation || undefined,
      loggedAt:        new Date(loggedAt).toISOString(),
    });
  };

  const isValid =
    !!truckId &&
    !!driverProfile?.id &&
    litresNum > 0 &&
    priceNum  > 0 &&
    odometerNum > 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md flex flex-col gap-0 p-0 overflow-hidden">

        {/* ── Header ────────────────────────────────────────────────────── */}
        <SheetHeader className="px-6 py-5 border-b bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <Fuel className="h-4 w-4 text-primary" />
            </div>
            <div>
              <SheetTitle className="text-base">Log Fuel</SheetTitle>
              <SheetDescription className="text-xs mt-0.5">
                Recording for trip {tripNumber}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {/* ── Context badges ────────────────────────────────────────────── */}
        <div className="px-6 py-3 border-b bg-muted/10 flex flex-wrap gap-2">
          <LockedBadge label="Trip"  value={tripNumber} />
          {truckPlate && <LockedBadge label="Truck" value={truckPlate} />}
          {user && (
            <LockedBadge
              label="Driver"
              value={`${user.firstName} ${user.lastName}`}
            />
          )}
        </div>

        {/* ── Form ──────────────────────────────────────────────────────── */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-6 py-5 space-y-5"
        >
          {/* Litres + Price — side by side */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Litres" required>
              <Input
                type="number"
                min={0.1}
                step={0.1}
                value={litres}
                onChange={(e) => setLitres(e.target.value)}
                placeholder="e.g. 85.5"
                required
              />
            </Field>
            <Field label="Price / Litre" required>
              <Input
                type="number"
                min={0.01}
                step={0.01}
                value={pricePerLitre}
                onChange={(e) => setPricePerLitre(e.target.value)}
                placeholder="e.g. 1.85"
                required
              />
            </Field>
          </div>

          {/* Total cost — auto-computed read-only */}
          <div className="flex items-center gap-3 rounded-lg border bg-muted/40 px-4 py-3">
            <Calculator className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Total Cost</p>
              <p className="font-semibold font-mono">
                {totalCost > 0 ? formatCurrency(totalCost) : "—"}
              </p>
            </div>
          </div>

          {/* Odometer */}
          <Field label="Odometer at Fill-up (km)" required>
            <Input
              type="number"
              min={0}
              step={1}
              value={odometerAtFuel}
              onChange={(e) => setOdometerAtFuel(e.target.value)}
              placeholder="e.g. 125 400"
              required
            />
            {truckOdometer && (
              <p className="text-xs text-muted-foreground mt-1">
                Last recorded: {truckOdometer.toLocaleString()} km
              </p>
            )}
          </Field>

          {/* Date & Time */}
          <Field label="Date & Time" required>
            <Input
              type="datetime-local"
              value={loggedAt}
              onChange={(e) => setLoggedAt(e.target.value)}
              required
            />
          </Field>

          <Separator />

          {/* Station (optional) */}
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Station (optional)
          </p>

          <Field label="Station Name">
            <Input
              value={stationName}
              onChange={(e) => setStationName(e.target.value)}
              placeholder="e.g. Total Energies Westlands"
            />
          </Field>

          <Field label="Station Location">
            <Input
              value={stationLocation}
              onChange={(e) => setStationLocation(e.target.value)}
              placeholder="e.g. Westlands, Nairobi"
            />
          </Field>
        </form>

        {/* ── Footer ────────────────────────────────────────────────────── */}
        <div className="px-6 py-4 border-t bg-background flex gap-3 justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValid || mutation.isPending}
          >
            {mutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Save Fuel Log
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function Field({
  label,
  required,
  children,
}: {
  label:     string;
  required?: boolean;
  children:  React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
    </div>
  );
}

function LockedBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1 text-xs">
      <Lock className="h-3 w-3 text-muted-foreground" />
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}