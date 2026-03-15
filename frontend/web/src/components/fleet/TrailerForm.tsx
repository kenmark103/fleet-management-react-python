/**
 * components/fleet/TrailerForm.tsx
 * Reusable create/edit form for Trailer records.
 *
 * Changes (Stage 2):
 *   Catalog `axles` is now tracked in local state and included in the
 *   submitted payload so the backend can persist it to the new DB column.
 */

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Info, Camera, Loader2 } from "lucide-react";
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
import type { Path } from "react-hook-form";
import {
  getTrailerMakeNames,
  getTrailerModels,
  getTrailerModelSpec,
  isKnownTrailerMake,
  isKnownTrailerModel,
  type CatalogTrailerModel,
} from "../../lib/vehicle-data";
import { getStaticUrl } from "../../lib/utils";

// ── Schema ────────────────────────────────────────────────────────────────────

const trailerSchema = z.object({
  plateNumber:          z.string().min(1, "Plate number is required"),
  make:                 z.string().min(1, "Make is required"),
  model:                z.string().min(1, "Model is required"),
  year:                 z.coerce.number().int().min(1980).max(new Date().getFullYear() + 1),
  status:               z.enum(["active", "inactive", "under-maintenance"] as const),
  type:                 z.enum(["flatbed", "refrigerated", "tanker", "box", "other"] as const),
  capacityTons:         z
    .union([z.coerce.number().min(0), z.literal("")])
    .optional()
    .transform((v) => (v === "" || v === undefined ? undefined : Number(v))),
  insuranceExpiryDate:  z.string().optional(),
  inspectionExpiryDate: z.string().optional(),
  notes:                z.string().optional(),
});

type TrailerFormValues = z.input<typeof trailerSchema>;

interface TrailerFormProps {
  defaultValues?: Partial<Trailer>;
  onSubmit: (values: TrailerPayload) => void;
  isLoading?: boolean;
  onCancel: () => void;
  onImageUploaded?: (imageUrl: string) => void;
  trailerId?: string;
}

const CATALOG_MAKES = getTrailerMakeNames();

export function TrailerForm({ defaultValues, onSubmit, isLoading, onCancel, onImageUploaded, trailerId }: TrailerFormProps) {
  const defaultMake  = defaultValues?.make  ?? "";
  const defaultModel = defaultValues?.model ?? "";

  const [customMakeMode, setCustomMakeMode] = useState(
    () => !!defaultMake && !isKnownTrailerMake(defaultMake),
  );
  const [customModelMode, setCustomModelMode] = useState(
    () => !!defaultModel && isKnownTrailerMake(defaultMake) && !isKnownTrailerModel(defaultMake, defaultModel),
  );
  const [catalogSpec, setCatalogSpec] = useState<CatalogTrailerModel | null>(
    () => getTrailerModelSpec(defaultMake, defaultModel) ?? null,
  );

  // Image upload state
  const imgInputRef    = useRef<HTMLInputElement>(null);
  const [imgPreview,   setImgPreview]   = useState<string | null>(getStaticUrl(defaultValues?.imageUrl) ?? null);
  const [imgUploading, setImgUploading] = useState(false);
  const [imgError,     setImgError]     = useState<string | null>(null);

  async function handleImageFile(file: File) {
    if (!trailerId) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setImgError("Only JPEG, PNG, or WebP images are allowed."); return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setImgError("File must be under 5 MB."); return;
    }
    setImgError(null);
    const reader = new FileReader();
    reader.onload = (e) => setImgPreview(e.target?.result as string);
    reader.readAsDataURL(file);
    setImgUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/v1/fleet/trailers/${trailerId}/image`, {
        method: "POST", body: fd, credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? "Upload failed");
      }
      const data = await res.json();
      const url: string = data.imageUrl ?? data.image_url ?? "";
      setImgPreview(url);
      onImageUploaded?.(url);
    } catch (e: any) {
      setImgError(e.message ?? "Upload failed");
      setImgPreview(getStaticUrl(defaultValues?.imageUrl) ?? null);
    } finally {
      setImgUploading(false);
    }
  }

  const form = useForm<TrailerFormValues>({
    resolver: zodResolver(trailerSchema),
    defaultValues: {
      plateNumber:          defaultValues?.plateNumber         ?? "",
      make:                 defaultMake,
      model:                defaultModel,
      year:                 defaultValues?.year                ?? new Date().getFullYear(),
      status:               defaultValues?.status              ?? "active",
      type:                 defaultValues?.type                ?? "flatbed",
      capacityTons:         defaultValues?.capacityTons        ?? undefined,
      insuranceExpiryDate:  defaultValues?.insuranceExpiryDate  ? defaultValues.insuranceExpiryDate.split("T")[0] : "",
      inspectionExpiryDate: defaultValues?.inspectionExpiryDate ? defaultValues.inspectionExpiryDate.split("T")[0] : "",
      notes:                defaultValues?.notes               ?? "",
    },
  });

  const watchedMake  = form.watch("make");
  const watchedModel = form.watch("model");
  const catalogModels = customMakeMode ? [] : getTrailerModels(watchedMake);

  // Reset model when make changes
  const prevMake = useRef(watchedMake);
  useEffect(() => {
    if (prevMake.current === watchedMake) return;
    prevMake.current = watchedMake;
    form.setValue("model", "");
    setCustomModelMode(false);
    setCatalogSpec(null);
  }, [watchedMake, form]);

  // Auto-fill type + capacity + track spec when model changes
  const didMount = useRef(false);
  useEffect(() => {
    if (!didMount.current) { didMount.current = true; return; }
    const spec = getTrailerModelSpec(watchedMake, watchedModel) ?? null;
    setCatalogSpec(spec);
    if (spec && !customModelMode) {
      form.setValue("type", spec.type);
      if (spec.capacityTons != null) {
        form.setValue("capacityTons", spec.capacityTons as unknown as "");
      }
    }
  }, [watchedModel]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSwitchToCustomMake() {
    setCustomMakeMode(true); setCustomModelMode(true);
    form.setValue("make", ""); form.setValue("model", ""); setCatalogSpec(null);
  }
  function handleSwitchToCatalogMake() {
    setCustomMakeMode(false); setCustomModelMode(false);
    form.setValue("make", ""); form.setValue("model", ""); setCatalogSpec(null);
  }

  function handleSubmit(values: TrailerFormValues) {
    onSubmit({
      plateNumber:          values.plateNumber,
      make:                 values.make,
      model:                values.model,
      year:                 Number(values.year),
      status:               values.status,
      type:                 values.type,
      capacityTons:
        values.capacityTons === "" || values.capacityTons === undefined
          ? undefined
          : Number(values.capacityTons),
      insuranceExpiryDate:  values.insuranceExpiryDate  || undefined,
      inspectionExpiryDate: values.inspectionExpiryDate || undefined,
      notes:                values.notes                || undefined,
      // Catalog spec — only included when a known model was selected
      ...(catalogSpec && { axles: catalogSpec.axles }),
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">

        {/* ── Vehicle Image (edit mode only) ───────────────────────────────── */}
        {trailerId && (
          <>
            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Vehicle Photo</h3>
              <div className="flex items-center gap-5">
                <div className="relative cursor-pointer shrink-0" onClick={() => imgInputRef.current?.click()}>
                  {imgPreview ? (
                    <img src={imgPreview} alt="Trailer" className="h-24 w-36 rounded-lg object-cover ring-2 ring-muted" />
                  ) : (
                    <div className="flex h-24 w-36 items-center justify-center rounded-lg bg-muted ring-2 ring-muted/50">
                      <Camera className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="absolute bottom-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-foreground ring-1 ring-background shadow">
                    {imgUploading
                      ? <Loader2 className="h-3 w-3 animate-spin text-background" />
                      : <Camera className="h-3 w-3 text-background" />}
                  </div>
                  <Input ref={imgInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageFile(f); e.target.value = ""; }} />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Trailer Photo</p>
                  <p className="text-xs text-muted-foreground">Click to upload · JPEG, PNG, WebP · max 5 MB</p>
                  {imgError && <p className="text-xs text-destructive">{imgError}</p>}
                </div>
              </div>
            </section>
            <Separator />
          </>
        )}

        <section className="space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Identity</h3>
          <div className="grid gap-4 sm:grid-cols-2">

            <TF name="plateNumber" label="Plate Number" placeholder="KBZ 456B" form={form} />
            <TF name="year"        label="Year"         placeholder="2021"     form={form} type="number" />

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
                    ? <Input placeholder="e.g. Montracon" {...field} value={field.value ?? ""} />
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
                    ? <Input placeholder="e.g. Flatdeck 45ft" {...field} value={field.value ?? ""} />
                    : (
                      <Select value={field.value ?? ""} onValueChange={field.onChange} disabled={!watchedMake}>
                        <SelectTrigger>
                          <SelectValue placeholder={watchedMake ? "Select model…" : "Select make first…"} />
                        </SelectTrigger>
                        <SelectContent>
                          {catalogModels.map((m: CatalogTrailerModel) => <SelectItem key={m.model} value={m.model}>{m.model}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {/* Catalog specs bar */}
            {catalogSpec && (
              <div className="sm:col-span-2 flex items-start gap-2 rounded-md border bg-muted/40 px-4 py-3 text-sm">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="grid flex-1 grid-cols-3 gap-x-6 gap-y-1">
                  <span className="col-span-3 text-xs font-medium text-muted-foreground mb-1">
                    Catalog specs — type and capacity auto-filled below
                  </span>
                  <CStat label="Body type" value={catalogSpec.type} />
                  <CStat label="Capacity"  value={`${catalogSpec.capacityTons} t`} />
                  <CStat label="Axles"     value={String(catalogSpec.axles)} />
                </div>
              </div>
            )}
          </div>
        </section>

        <Separator />

        <section className="space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Specs</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <SF name="status" label="Status" form={form} options={[
              { value: "active",   label: "Active" },
              { value: "inactive", label: "Inactive" },
              { value: "under-maintenance", label: "Under Maintenance" },
            ]} />
            <SF name="type" label="Trailer Type" form={form} options={[
              { value: "flatbed",      label: "Flatbed" },
              { value: "refrigerated", label: "Refrigerated" },
              { value: "tanker",       label: "Tanker" },
              { value: "box",          label: "Box" },
              { value: "other",        label: "Other" },
            ]} />
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
          <Button type="submit" disabled={isLoading}>{isLoading ? "Saving…" : "Save Trailer"}</Button>
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
      <p className="font-medium capitalize">{value}</p>
    </div>
  );
}