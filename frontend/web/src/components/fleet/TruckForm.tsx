/**
 * components/fleet/TruckForm.tsx
 * Reusable create/edit form for Truck records.
 *
 * Changes (Stage 2):
 *   Catalog spec values (wheelConfig, grossWeightTons, axleLoadTons) are now
 *   tracked in local state and included in the submitted payload so the
 *   backend can persist them to the new DB columns.
 */

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Info } from "lucide-react";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "../ui/form";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../ui/select";
import { Button } from "../ui/button";
import { Separator } from "../ui/separator";
import type { Truck } from "../../types/fleet";
import type { TruckPayload } from "../../lib/fleet-api";
import type { Path } from "react-hook-form";
import {
  getTruckMakeNames,
  getTruckModels,
  getTruckModelSpec,
  isKnownTruckMake,
  isKnownTruckModel,
  type CatalogTruckModel,
} from "../../lib/vehicle-data";

// ── Schema ────────────────────────────────────────────────────────────────────

const truckSchema = z.object({
  plateNumber:           z.string().min(1, "Plate number is required"),
  make:                  z.string().min(1, "Make is required"),
  model:                 z.string().min(1, "Model is required"),
  year:                  z.coerce.number().int().min(1980).max(new Date().getFullYear() + 1),
  status:                z.enum(["active", "inactive", "in-progress", "under-maintenance"] as const),
  odometerKm:            z.coerce.number().min(0).default(0),
  fuelType:              z.enum(["diesel", "petrol", "electric", "hybrid"] as const),
  vin:                   z.string().optional(),
  color:                 z.string().optional(),
  insuranceExpiryDate:   z.string().optional(),
  inspectionExpiryDate:  z.string().optional(),
  notes:                 z.string().optional(),
});

type TruckFormValues = z.input<typeof truckSchema>;

interface TruckFormProps {
  defaultValues?: Partial<Truck>;
  onSubmit: (values: TruckPayload) => void;
  isLoading?: boolean;
  onCancel: () => void;
}

const CATALOG_MAKES = getTruckMakeNames();

export function TruckForm({ defaultValues, onSubmit, isLoading, onCancel }: TruckFormProps) {
  const defaultMake  = defaultValues?.make  ?? "";
  const defaultModel = defaultValues?.model ?? "";

  const [customMakeMode, setCustomMakeMode] = useState(
    () => !!defaultMake && !isKnownTruckMake(defaultMake),
  );
  const [customModelMode, setCustomModelMode] = useState(
    () => !!defaultModel && isKnownTruckMake(defaultMake) && !isKnownTruckModel(defaultMake, defaultModel),
  );

  // Catalog spec tracked in state — not in the form schema
  const [catalogSpec, setCatalogSpec] = useState<CatalogTruckModel | null>(
    () => getTruckModelSpec(defaultMake, defaultModel) ?? null,
  );

  const form = useForm<TruckFormValues>({
    resolver: zodResolver(truckSchema),
    defaultValues: {
      plateNumber:           defaultValues?.plateNumber          ?? "",
      make:                  defaultMake,
      model:                 defaultModel,
      year:                  defaultValues?.year                 ?? new Date().getFullYear(),
      status:                defaultValues?.status               ?? "active",
      odometerKm:            defaultValues?.odometerKm           ?? 0,
      fuelType:              defaultValues?.fuelType             ?? "diesel",
      vin:                   defaultValues?.vin                  ?? "",
      color:                 defaultValues?.color                ?? "",
      insuranceExpiryDate:   defaultValues?.insuranceExpiryDate  ? defaultValues.insuranceExpiryDate.split("T")[0] : "",
      inspectionExpiryDate:  defaultValues?.inspectionExpiryDate ? defaultValues.inspectionExpiryDate.split("T")[0] : "",
      notes:                 defaultValues?.notes                ?? "",
    },
  });

  const watchedMake  = form.watch("make");
  const watchedModel = form.watch("model");
  const catalogModels = customMakeMode ? [] : getTruckModels(watchedMake);

  // Reset model when make changes
  const prevMake = useRef(watchedMake);
  useEffect(() => {
    if (prevMake.current === watchedMake) return;
    prevMake.current = watchedMake;
    form.setValue("model", "");
    setCustomModelMode(false);
    setCatalogSpec(null);
  }, [watchedMake, form]);

  // Sync spec state when model changes (skip initial mount)
  const didMount = useRef(false);
  useEffect(() => {
    if (!didMount.current) { didMount.current = true; return; }
    setCatalogSpec(getTruckModelSpec(watchedMake, watchedModel) ?? null);
  }, [watchedModel, watchedMake]);

  function handleSwitchToCustomMake() {
    setCustomMakeMode(true); setCustomModelMode(true);
    form.setValue("make", ""); form.setValue("model", ""); setCatalogSpec(null);
  }
  function handleSwitchToCatalogMake() {
    setCustomMakeMode(false); setCustomModelMode(false);
    form.setValue("make", ""); form.setValue("model", ""); setCatalogSpec(null);
  }

  function handleSubmit(values: TruckFormValues) {
    onSubmit({
      plateNumber:          values.plateNumber,
      make:                 values.make,
      model:                values.model,
      year:                 Number(values.year),
      status:               values.status,
      odometerKm:           Number(values.odometerKm ?? 0),
      fuelType:             values.fuelType,
      vin:                  values.vin                  || undefined,
      color:                values.color                || undefined,
      insuranceExpiryDate:  values.insuranceExpiryDate  || undefined,
      inspectionExpiryDate: values.inspectionExpiryDate || undefined,
      notes:                values.notes                || undefined,
      // Catalog spec — only included when a known model was selected
      ...(catalogSpec && {
        wheelConfig:     catalogSpec.wheelConfig,
        grossWeightTons: catalogSpec.grossWeightTons,
        axleLoadTons:    catalogSpec.axleLoadTons,
      }),
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">

        <section className="space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Identity</h3>
          <div className="grid gap-4 sm:grid-cols-2">

            <TF name="plateNumber" label="Plate Number" placeholder="KCA 123A" form={form} />
            <TF name="vin"         label="VIN"          placeholder="Optional"  form={form} />
            <TF name="color"       label="Color"        placeholder="White"     form={form} />
            <TF name="year"        label="Year"         placeholder="2022"      form={form} type="number" />

            {/* Make */}
            <FormField control={form.control} name="make" render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <div className="flex items-center justify-between">
                  <FormLabel>Make</FormLabel>
                  <button type="button" className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    onClick={customMakeMode ? handleSwitchToCatalogMake : handleSwitchToCustomMake}>
                    {customMakeMode ? "← Select from catalog" : "Enter manually →"}
                  </button>
                </div>
                <FormControl>
                  {customMakeMode
                    ? <Input placeholder="e.g. Freightliner" {...field} value={field.value ?? ""} />
                    : (
                      <Select value={field.value ?? ""} onValueChange={field.onChange}>
                        <SelectTrigger><SelectValue placeholder="Select make…" /></SelectTrigger>
                        <SelectContent>
                          {CATALOG_MAKES.map((m: string) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {/* Model */}
            <FormField control={form.control} name="model" render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <div className="flex items-center justify-between">
                  <FormLabel>Model</FormLabel>
                  {!customMakeMode && catalogModels.length > 0 && (
                    <button type="button" className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => { setCustomModelMode((p: boolean) => !p); form.setValue("model", ""); setCatalogSpec(null); }}>
                      {customModelMode ? "← Select from catalog" : "Enter manually →"}
                    </button>
                  )}
                </div>
                <FormControl>
                  {customMakeMode || customModelMode || catalogModels.length === 0
                    ? <Input placeholder="e.g. Cascadia" {...field} value={field.value ?? ""} />
                    : (
                      <Select value={field.value ?? ""} onValueChange={field.onChange} disabled={!watchedMake}>
                        <SelectTrigger>
                          <SelectValue placeholder={watchedMake ? "Select model…" : "Select make first…"} />
                        </SelectTrigger>
                        <SelectContent>
                          {catalogModels.map((m: CatalogTruckModel) => <SelectItem key={m.model} value={m.model}>{m.model}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {/* Read-only catalog specs bar */}
            {catalogSpec && (
              <div className="sm:col-span-2 flex items-start gap-2 rounded-md border bg-muted/40 px-4 py-3 text-sm">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="grid flex-1 grid-cols-3 gap-x-6 gap-y-1">
                  <span className="col-span-3 text-xs font-medium text-muted-foreground mb-1">
                    Catalog specs — saved automatically
                  </span>
                  <CStat label="Wheel config" value={catalogSpec.wheelConfig} />
                  <CStat label="Gross weight" value={`${catalogSpec.grossWeightTons} t`} />
                  <CStat label="Axle load"    value={`${catalogSpec.axleLoadTons} t`} />
                </div>
              </div>
            )}
          </div>
        </section>

        <Separator />

        <section className="space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status &amp; Fuel</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <SF name="status" label="Status" form={form} options={[
              { value: "active",             label: "Active" },
              { value: "inactive",           label: "Inactive" },
              { value: "in-progress",        label: "In Progress" },
              { value: "under-maintenance",  label: "Under Maintenance" },
            ]} />
            <SF name="fuelType" label="Fuel Type" form={form} options={[
              { value: "diesel",   label: "Diesel" },
              { value: "petrol",   label: "Petrol" },
              { value: "electric", label: "Electric" },
              { value: "hybrid",   label: "Hybrid" },
            ]} />
            <TF name="odometerKm" label="Odometer (km)" placeholder="0" form={form} type="number" />
          </div>
        </section>

        <Separator />

        <section className="space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Compliance</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <TF name="insuranceExpiryDate"  label="Insurance Expiry"  form={form} type="date" />
            <TF name="inspectionExpiryDate" label="Inspection Expiry" form={form} type="date" />
          </div>
        </section>

        <Separator />

        <FormField control={form.control} name="notes" render={({ field }) => (
          <FormItem>
            <FormLabel>Notes</FormLabel>
            <FormControl>
              <Textarea rows={3} placeholder="Optional notes…" {...field} value={field.value ?? ""} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
          <Button type="submit" disabled={isLoading}>{isLoading ? "Saving…" : "Save Truck"}</Button>
        </div>
      </form>
    </Form>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function TF<T extends Record<string, unknown>, N extends Path<T>>({
  name, label, form, placeholder, type = "text",
}: { name: N; label: string; form: ReturnType<typeof useForm<T>>; placeholder?: string; type?: string }) {
  return (
    <FormField control={form.control} name={name} render={({ field }) => (
      <FormItem>
        <FormLabel>{label}</FormLabel>
        <FormControl>
          <Input type={type} placeholder={placeholder} {...field} value={(field.value as string) ?? ""} />
        </FormControl>
        <FormMessage />
      </FormItem>
    )} />
  );
}

function SF<T extends Record<string, unknown>, N extends Path<T>>({
  name, label, form, options,
}: { name: N; label: string; form: ReturnType<typeof useForm<T>>; options: { value: string; label: string }[] }) {
  return (
    <FormField control={form.control} name={name} render={({ field }) => (
      <FormItem>
        <FormLabel>{label}</FormLabel>
        <Select value={field.value as string} onValueChange={field.onChange}>
          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
          <SelectContent>
            {options.map((o: { value: string; label: string }) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <FormMessage />
      </FormItem>
    )} />
  );
}

function CStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}