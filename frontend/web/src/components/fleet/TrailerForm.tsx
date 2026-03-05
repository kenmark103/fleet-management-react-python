/**
 * components/fleet/TrailerForm.tsx
 * Reusable create/edit form for Trailer records.
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
import type { Trailer } from "../../types/fleet";
import type { TrailerPayload } from "../../lib/fleet-api";
import type { Path } from "react-hook-form"

// TrailerForm.tsx — replace the schema definition

const trailerSchema = z.object({
  plateNumber:           z.string().min(1, "Plate number is required"),
  make:                  z.string().min(1, "Make is required"),
  model:                 z.string().min(1, "Model is required"),
  year:                  z.coerce.number().int().min(1980).max(new Date().getFullYear() + 1),
  status:                z.enum(["active", "inactive"] as const),
  type:                  z.enum(["flatbed", "refrigerated", "tanker", "box", "other"] as const),
  // Fix: allow empty string from input, coerce to number or undefined
  capacityTons:          z.union([z.coerce.number().min(0), z.literal("")]).optional().transform(
                           (v) => v === "" || v === undefined ? undefined : Number(v)
                         ),
  insuranceExpiryDate:   z.string().optional(),
  inspectionExpiryDate:  z.string().optional(),
  notes:                 z.string().optional(),
});

type TrailerFormValues = z.input<typeof trailerSchema>;  // ← input not infer, accounts for transform

interface TrailerFormProps {
  defaultValues?: Partial<Trailer>;
  onSubmit: (values: TrailerPayload) => void;
  isLoading?: boolean;
  onCancel: () => void;
}

export function TrailerForm({ defaultValues, onSubmit, isLoading, onCancel }: TrailerFormProps) {
  const form = useForm<TrailerFormValues>({
    resolver: zodResolver(trailerSchema),
    defaultValues: {
      plateNumber:           defaultValues?.plateNumber          ?? "",
      make:                  defaultValues?.make                 ?? "",
      model:                 defaultValues?.model                ?? "",
      year:                  defaultValues?.year                 ?? new Date().getFullYear(),
      status:                defaultValues?.status               ?? "active",
      type:                  defaultValues?.type                 ?? "flatbed",
      capacityTons:          defaultValues?.capacityTons         ?? undefined,
      insuranceExpiryDate:   defaultValues?.insuranceExpiryDate  ? defaultValues.insuranceExpiryDate.split("T")[0] : "",
      inspectionExpiryDate:  defaultValues?.inspectionExpiryDate ? defaultValues.inspectionExpiryDate.split("T")[0] : "",
      notes:                 defaultValues?.notes                ?? "",
    },
  });

  function handleSubmit(values: TrailerFormValues) {
  const payload: TrailerPayload = {
    plateNumber:          values.plateNumber,
    make:                 values.make,
    model:                values.model,
    year:                 Number(values.year),
    status:               values.status,
    type:                 values.type,
    capacityTons:         values.capacityTons === "" || values.capacityTons === undefined
                            ? undefined
                            : Number(values.capacityTons),
    insuranceExpiryDate:  values.insuranceExpiryDate  || undefined,
    inspectionExpiryDate: values.inspectionExpiryDate || undefined,
    notes:                values.notes     || undefined,
  };
  onSubmit(payload);
}

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">

        <section className="space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Identity</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <TF name="plateNumber" label="Plate Number" placeholder="KBZ 456B" form={form} />
            <TF name="make"        label="Make"         placeholder="Schmitz"  form={form} />
            <TF name="model"       label="Model"        placeholder="S.KO"     form={form} />
            <TF name="year"        label="Year"         placeholder="2021"     form={form} type="number" />
          </div>
        </section>

        <Separator />

        <section className="space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Specs</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <SF
              name="status"
              label="Status"
              form={form}
              options={[
                { value: "active",   label: "Active" },
                { value: "inactive", label: "Inactive" },
              ]}
            />
            <SF
              name="type"
              label="Trailer Type"
              form={form}
              options={[
                { value: "flatbed",      label: "Flatbed" },
                { value: "refrigerated", label: "Refrigerated" },
                { value: "tanker",       label: "Tanker" },
                { value: "box",          label: "Box" },
                { value: "other",        label: "Other" },
              ]}
            />
            <TF name="capacityTons" label="Capacity (tons)" placeholder="30" form={form} type="number" />
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
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Saving…" : "Save Trailer"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

// ── Shared field sub-components ───────────────────────────────────────────────

function TF<T extends Record<string, unknown>, N extends Path<T>>({
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
            <Input
              type={type}
              placeholder={placeholder}
              {...field}
              value={(field.value as string) ?? ""}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function SF<T extends Record<string, unknown>, N extends Path<T>>({
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