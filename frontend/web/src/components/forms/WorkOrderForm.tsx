/**
 * components/forms/WorkOrderForm.tsx
 * Fleet Management System — Phase 7
 *
 * Shared form used by both:
 *   /maintenance/work-orders/new
 *   /maintenance/work-orders/$workOrderId/edit
 */

import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../ui/select";
import { API_BASE_URL } from "../../lib/constants";
import type { WorkOrder, WorkOrderCreate, WorkOrderUpdate, WorkOrderPriority } from "../../types/maintenance";

interface WorkOrderFormProps {
  initial?:   WorkOrder;
  onSubmit:   (data: WorkOrderCreate | WorkOrderUpdate) => Promise<void>;
  isLoading:  boolean;
}

export function WorkOrderForm({ initial, onSubmit, isLoading }: WorkOrderFormProps) {
  const navigate   = useNavigate();
  const isEditMode = Boolean(initial);

  const [truckId,       setTruckId]       = useState(initial?.truckId            ?? "");
  const [mechanicId,    setMechanicId]    = useState(initial?.assignedMechanicId ?? "");
  const [priority,      setPriority]      = useState<WorkOrderPriority>(initial?.priority ?? "medium");
  const [title,         setTitle]         = useState(initial?.title              ?? "");
  const [description,   setDescription]   = useState(initial?.description        ?? "");
  const [scheduledDate, setScheduledDate] = useState(
    initial?.scheduledDate ? initial.scheduledDate.slice(0, 16) : ""
  );
  const [estimatedCost, setEstimatedCost] = useState<string | number>(initial?.estimatedCost ?? "");
  const [odometer,      setOdometer]      = useState<string | number>(initial?.odometerAtService ?? "");
  const [notes,         setNotes]         = useState(initial?.notes ?? "");

  const { data: trucks } = useQuery({
    queryKey: ["trucks-select"],
    queryFn:  () =>
      fetch(`${API_BASE_URL}/fleet/trucks?limit=200&status=active`, { credentials: "include" })
        .then((r) => r.json()),
    select: (r) => r as { id: string; plateNumber: string }[],
  });

  const { data: mechanics } = useQuery({
    queryKey: ["mechanics-select"],
    queryFn:  () =>
      fetch(`${API_BASE_URL}/settings/users?role=MECHANIC&limit=200`, { credentials: "include" })
        .then((r) => r.json()),
    select: (r) => r.data as { id: string; firstName: string; lastName: string }[],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({
      truckId,
      assignedMechanicId: mechanicId,
      priority,
      title:              title.trim(),
      description:        description.trim(),
      scheduledDate:      new Date(scheduledDate).toISOString(),
      estimatedCost:      estimatedCost !== "" ? Number(estimatedCost) : undefined,
      odometerAtService:  odometer      !== "" ? Number(odometer)      : undefined,
      notes:              notes.trim() || undefined,
    });
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
          <Label>Mechanic <span className="text-destructive">*</span></Label>
          <Select value={mechanicId} onValueChange={setMechanicId}>
            <SelectTrigger><SelectValue placeholder="Select mechanic…" /></SelectTrigger>
            <SelectContent>
              {mechanics?.map((m) => (
                <SelectItem key={m.id} value={m.id}>{m.firstName} {m.lastName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="md:col-span-2 space-y-1.5">
          <Label>Title <span className="text-destructive">*</span></Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Engine oil change and filter replacement"
            required
          />
        </div>

        <div className="md:col-span-2 space-y-1.5">
          <Label>Description <span className="text-destructive">*</span></Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the work to be done…"
            rows={3}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label>Priority <span className="text-destructive">*</span></Label>
          <Select value={priority} onValueChange={(v) => setPriority(v as WorkOrderPriority)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {(["low", "medium", "high", "critical"] as WorkOrderPriority[]).map((p) => (
                <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Scheduled Date <span className="text-destructive">*</span></Label>
          <Input
            type="datetime-local"
            value={scheduledDate}
            onChange={(e) => setScheduledDate(e.target.value)}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label>Estimated Cost <span className="text-muted-foreground text-xs">(optional)</span></Label>
          <Input
            type="number"
            min={0}
            step={0.01}
            value={estimatedCost}
            onChange={(e) => setEstimatedCost(e.target.value)}
            placeholder="0.00"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Odometer at Service (km) <span className="text-muted-foreground text-xs">(optional)</span></Label>
          <Input
            type="number"
            min={0}
            value={odometer}
            onChange={(e) => setOdometer(e.target.value)}
            placeholder="e.g. 125400"
          />
        </div>

        <div className="md:col-span-2 space-y-1.5">
          <Label>Notes <span className="text-muted-foreground text-xs">(optional)</span></Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any additional notes…"
            rows={2}
          />
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
          disabled={isLoading || !truckId || !mechanicId || !title.trim() || !scheduledDate}
        >
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEditMode ? "Save Changes" : "Create Work Order"}
        </Button>
      </div>
    </form>
  );
}