/**
 * components/fleet/TruckForm.tsx
 * Reusable create/edit form for Truck records.
 * Used by: /fleet/trucks/new  and  /fleet/trucks/$truckId/edit
 */

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import type { Path } from "react-hook-form"

// ── Schema ────────────────────────────────────────────────────────────────────

const truckSchema = z.object({
  plateNumber:           z.string().min(1, "Plate number is required"),
  make:                  z.string().min(1, "Make is required"),
  model:                 z.string().min(1, "Model is required"),
  year:                  z.coerce.number().int().min(1980).max(new Date().getFullYear() + 1),
  status:                z.enum(["active", "inactive", "in-progress"] as const),
  odometerKm:            z.coerce.number().min(0).default(0),
  fuelType:              z.enum(["diesel", "petrol", "electric", "hybrid"] as const),
  vin:                   z.string().optional(),
  color:                 z.string().optional(),
  insuranceExpiryDate:   z.string().optional(),
  inspectionExpiryDate:  z.string().optional(),
  notes:                 z.string().optional(),
});

type TruckFormValues = z.input<typeof truckSchema>;

// ── Props ─────────────────────────────────────────────────────────────────────

interface TruckFormProps {
  defaultValues?: Partial<Truck>;
  onSubmit: (values: TruckPayload) => void;
  isLoading?: boolean;
  onCancel: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TruckForm({ defaultValues, onSubmit, isLoading, onCancel }: TruckFormProps) {
  const form = useForm<TruckFormValues>({
    resolver: zodResolver(truckSchema),
    defaultValues: {
      plateNumber:           defaultValues?.plateNumber          ?? "",
      make:                  defaultValues?.make                 ?? "",
      model:                 defaultValues?.model                ?? "",
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

  function handleSubmit(values: TruckFormValues) {
  const payload: TruckPayload = {
    plateNumber:          values.plateNumber,
    make:                 values.make,
    model:                values.model,
    year:                 Number(values.year),
    status:               values.status,
    odometerKm:           Number(values.odometerKm ?? 0),
    fuelType:             values.fuelType,
    vin:                  values.vin       || undefined,
    color:                values.color     || undefined,
    insuranceExpiryDate:  values.insuranceExpiryDate  || undefined,
    inspectionExpiryDate: values.inspectionExpiryDate || undefined,
    notes:                values.notes     || undefined,
  };
  onSubmit(payload);
}

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">

        {/* ── Identity ──────────────────────────────────────────────────── */}
        <section className="space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Identity
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField name="plateNumber" label="Plate Number" placeholder="KCA 123A" form={form} />
            <TextField name="make"        label="Make"         placeholder="Freightliner" form={form} />
            <TextField name="model"       label="Model"        placeholder="Cascadia"     form={form} />
            <TextField name="year"        label="Year"         placeholder="2022"         form={form} type="number" />
            <TextField name="vin"         label="VIN"          placeholder="Optional"     form={form} />
            <TextField name="color"       label="Color"        placeholder="White"        form={form} />
          </div>
        </section>

        <Separator />

        {/* ── Status & Fuel ─────────────────────────────────────────────── */}
        <section className="space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Status & Fuel
          </h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <SelectField
              name="status"
              label="Status"
              form={form}
              options={[
                { value: "active",       label: "Active" },
                { value: "inactive",     label: "Inactive" },
                { value: "in-progress",  label: "In Progress" },
              ]}
            />
            <SelectField
              name="fuelType"
              label="Fuel Type"
              form={form}
              options={[
                { value: "diesel",   label: "Diesel" },
                { value: "petrol",   label: "Petrol" },
                { value: "electric", label: "Electric" },
                { value: "hybrid",   label: "Hybrid" },
              ]}
            />
            <TextField name="odometerKm" label="Odometer (km)" placeholder="0" form={form} type="number" />
          </div>
        </section>

        <Separator />

        {/* ── Compliance Dates ──────────────────────────────────────────── */}
        <section className="space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Compliance
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField name="insuranceExpiryDate"   label="Insurance Expiry"   form={form} type="date" />
            <TextField name="inspectionExpiryDate"  label="Inspection Expiry"  form={form} type="date" />
          </div>
        </section>

        <Separator />

        {/* ── Notes ─────────────────────────────────────────────────────── */}
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea rows={3} placeholder="Optional notes…" {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Saving…" : "Save Truck"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

// ── Shared field sub-components ───────────────────────────────────────────────

function TextField<T extends Record<string, unknown>, N extends Path<T>>({
  name, label, form, placeholder, type = "text",
}: {
  name: N;
  label: string;
  form: ReturnType<typeof useForm<T>>;
  placeholder?: string;
  type?: string;
}) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input type={type} placeholder={placeholder} {...field} value={field.value as string ?? ""} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function SelectField<T extends Record<string, unknown>, N extends Path<T>>({
  name, label, form, options,
}: {
  name: N;
  label: string;
  form: ReturnType<typeof useForm<T>>;
  options: { value: string; label: string }[];
}) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <Select value={field.value as string} onValueChange={field.onChange}>
            <FormControl>
              <SelectTrigger><SelectValue /></SelectTrigger>
            </FormControl>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}