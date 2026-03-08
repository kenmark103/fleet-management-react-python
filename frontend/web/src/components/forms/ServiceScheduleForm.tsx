/**
 * components/forms/ServiceScheduleForm.tsx
 * Fleet Management System — Phase 7
 *
 * Shared form used by both:
 *   /maintenance/schedules/new
 *   /maintenance/schedules/$scheduleId/edit
 */

import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2, RotateCcw } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../ui/select";
import apiClient from "../../lib/api";
import type {
  ServiceSchedule, ServiceScheduleCreate, ServiceScheduleUpdate, ServiceIntervalType,
} from "../../types/maintenance";

// ─────────────────────────────────────────────────────────────────────────────
// CLIENT-SIDE NEXT SERVICE PREVIEW  (mirrors server calculate_next_service)
// ─────────────────────────────────────────────────────────────────────────────

function previewNextService(
  intervalType:        ServiceIntervalType,
  intervalValue:       number,
  lastServiceDate:     string,
  lastServiceOdometer: string,
): { date: string | null; odometer: number | null } {
  const base = lastServiceDate ? new Date(lastServiceDate) : new Date();
  let date:     Date   | null = null;
  let odometer: number | null = null;

  if (intervalType === "days") {
    date = new Date(base.getTime() + intervalValue * 86_400_000);
  } else if (intervalType === "months") {
    date = new Date(base.getTime() + intervalValue * 30 * 86_400_000);
  } else if (intervalType === "km") {
    if (lastServiceOdometer) odometer = Number(lastServiceOdometer) + intervalValue;
    date = new Date(base.getTime() + (intervalValue / 200) * 86_400_000);
  }

  return {
    date:     date ? date.toISOString().slice(0, 10) : null,
    odometer: odometer,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// FORM
// ─────────────────────────────────────────────────────────────────────────────

interface ServiceScheduleFormProps {
  initial?:  ServiceSchedule;
  onSubmit:  (data: ServiceScheduleCreate | ServiceScheduleUpdate) => Promise<void>;
  isLoading: boolean;
}

export function ServiceScheduleForm({ initial, onSubmit, isLoading }: ServiceScheduleFormProps) {
  const navigate   = useNavigate();
  const isEditMode = Boolean(initial);

  const [truckId,         setTruckId]         = useState(initial?.truckId                       ?? "");
  const [serviceType,     setServiceType]     = useState(initial?.serviceType                   ?? "");
  const [intervalType,    setIntervalType]    = useState<ServiceIntervalType>(initial?.intervalType ?? "km");
  const [intervalValue,   setIntervalValue]   = useState(initial?.intervalValue                 ?? 5000);
  const [lastServiceDate, setLastServiceDate] = useState(initial?.lastServiceDate?.slice(0, 10) ?? "");
  const [lastOdometer,    setLastOdometer]    = useState(initial?.lastServiceOdometer?.toString() ?? "");
  const [reminderDays,    setReminderDays]    = useState(initial?.reminderDaysBefore             ?? 7);
  const [isActive,        setIsActive]        = useState(initial?.isActive                       ?? true);

  // Manual override toggles for next service fields
  const [overrideDate,         setOverrideDate]         = useState(false);
  const [overrideOdometer,     setOverrideOdometer]     = useState(false);
  const [nextDateOverride,     setNextDateOverride]     = useState(initial?.nextServiceDate?.slice(0, 10)     ?? "");
  const [nextOdometerOverride, setNextOdometerOverride] = useState(initial?.nextServiceOdometer?.toString()   ?? "");

  // Live preview — recalculates on every relevant field change
  const preview = intervalValue > 0
    ? previewNextService(intervalType, intervalValue, lastServiceDate, lastOdometer)
    : { date: null, odometer: null };

  const { data: trucks } = useQuery({
    queryKey: ["trucks-select"],
    queryFn:  () => apiClient.get<{ id: string; plateNumber: string }[]>("/api/v1/fleet/trucks?limit=200").then(r => r.data),
    staleTime: 5 * 60 * 1000,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: ServiceScheduleCreate = {
      truckId,
      serviceType:         serviceType.trim(),
      intervalType,
      intervalValue:       Number(intervalValue),
      lastServiceDate:     lastServiceDate ? new Date(lastServiceDate).toISOString() : undefined,
      lastServiceOdometer: lastOdometer    ? Number(lastOdometer)                    : undefined,
      nextServiceDate:     overrideDate     && nextDateOverride
                             ? new Date(nextDateOverride).toISOString()
                             : undefined,
      nextServiceOdometer: overrideOdometer && nextOdometerOverride
                             ? Number(nextOdometerOverride)
                             : undefined,
      reminderDaysBefore:  Number(reminderDays),
      isActive,
    };
    await onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        <div className="space-y-1.5">
          <Label>Truck <span className="text-destructive">*</span></Label>
          <Select value={truckId} onValueChange={setTruckId}>
            <SelectTrigger><SelectValue placeholder="Select truck…" /></SelectTrigger>
            <SelectContent>
              {trucks?.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.plateNumber}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Service Type <span className="text-destructive">*</span></Label>
          <Input
            value={serviceType}
            onChange={(e) => setServiceType(e.target.value)}
            placeholder="e.g. Oil Change, Tyre Rotation"
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label>Interval Type <span className="text-destructive">*</span></Label>
          <Select value={intervalType} onValueChange={(v) => setIntervalType(v as ServiceIntervalType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="km">Every X km</SelectItem>
              <SelectItem value="days">Every X days</SelectItem>
              <SelectItem value="months">Every X months</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Interval Value <span className="text-destructive">*</span></Label>
          <Input
            type="number"
            min={1}
            value={intervalValue}
            onChange={(e) => setIntervalValue(Number(e.target.value))}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label>Last Service Date <span className="text-muted-foreground text-xs">(optional)</span></Label>
          <Input type="date" value={lastServiceDate} onChange={(e) => setLastServiceDate(e.target.value)} />
        </div>

        {intervalType === "km" && (
          <div className="space-y-1.5">
            <Label>Last Service Odometer (km) <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input
              type="number"
              min={0}
              value={lastOdometer}
              onChange={(e) => setLastOdometer(e.target.value)}
              placeholder="e.g. 125400"
            />
          </div>
        )}

        <div className="space-y-1.5">
          <Label>Reminder (days before due)</Label>
          <Input
            type="number"
            min={0}
            value={reminderDays}
            onChange={(e) => setReminderDays(Number(e.target.value))}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Active</Label>
          <Select value={isActive ? "yes" : "no"} onValueChange={(v) => setIsActive(v === "yes")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="yes">Active</SelectItem>
              <SelectItem value="no">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* ── Next service preview + override ────────────────────────────── */}
        <div className="md:col-span-2">
          <div className="bg-muted/30 border rounded-lg p-4 space-y-4">
            <h4 className="text-sm font-medium text-muted-foreground">Next Service (auto-calculated)</h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {/* Next date */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Next Service Date</Label>
                  <button
                    type="button"
                    className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                    onClick={() => setOverrideDate((v) => !v)}
                  >
                    <RotateCcw className="h-3 w-3" />
                    {overrideDate ? "Use auto" : "Override"}
                  </button>
                </div>
                {overrideDate ? (
                  <Input
                    type="date"
                    value={nextDateOverride}
                    onChange={(e) => setNextDateOverride(e.target.value)}
                  />
                ) : (
                  <div className="flex h-10 items-center rounded-md border bg-background px-3 text-sm text-muted-foreground">
                    {preview.date ?? "—"}
                  </div>
                )}
              </div>

              {/* Next odometer — only shown for km-based intervals */}
              {intervalType === "km" && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs">Next Odometer (km)</Label>
                    <button
                      type="button"
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                      onClick={() => setOverrideOdometer((v) => !v)}
                    >
                      <RotateCcw className="h-3 w-3" />
                      {overrideOdometer ? "Use auto" : "Override"}
                    </button>
                  </div>
                  {overrideOdometer ? (
                    <Input
                      type="number"
                      min={0}
                      value={nextOdometerOverride}
                      onChange={(e) => setNextOdometerOverride(e.target.value)}
                    />
                  ) : (
                    <div className="flex h-10 items-center rounded-md border bg-background px-3 text-sm text-muted-foreground">
                      {preview.odometer != null ? `${preview.odometer.toLocaleString()} km` : "—"}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pt-2 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={() => navigate({ to: "/maintenance" })}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isLoading || !truckId || !serviceType.trim() || !intervalValue}
        >
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEditMode ? "Save Changes" : "Create Schedule"}
        </Button>
      </div>
    </form>
  );
}