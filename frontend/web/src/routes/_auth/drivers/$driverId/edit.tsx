/**
 * routes/_auth/drivers/$driverId/edit.tsx
 * Fleet Management System
 *
 * REVISED: now uses useDriver (load) + useUpdateDriver (save) hooks
 * instead of raw fetch() calls. Everything else — form layout,
 * validation, field structure — is identical to the previous version.
 */

import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Save, Loader2, ShieldAlert } from "lucide-react";
import { Button }   from "../../../../components/ui/button";
import { Input }    from "../../../../components/ui/input";
import { Textarea } from "../../../../components/ui/textarea";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "../../../../components/ui/select";
import { usePermission }   from "../../../../hooks/usePermission";
import { useDriver, useUpdateDriver } from "../../../../hooks/useDrivers";
import type { Driver }     from "../../../../types/driver";
import type { DriverUpdate } from "../../../../types/driver";

export const Route = createFileRoute("/_auth/drivers/$driverId/edit")({
  component: EditDriverPage,
});

// ─────────────────────────────────────────────────────────────────────────────
// UI HELPERS  (unchanged from previous version)
// ─────────────────────────────────────────────────────────────────────────────

function Field({
  label, error, hint, children,
}: {
  label: string; error?: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-foreground">{label}</label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function SectionHeading({ title }: { title: string }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground pt-2">
      {title}
    </h2>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FORM STATE
// ─────────────────────────────────────────────────────────────────────────────

interface FormState {
  firstName:             string;
  lastName:              string;
  email:                 string;
  phone:                 string;
  status:                string;
  hireDate:              string;
  licenseNumber:         string;
  licenseClass:          string;
  licenseExpiryDate:     string;
  dateOfBirth:           string;
  nationalId:            string;
  address:               string;
  emergencyContactName:  string;
  emergencyContactPhone: string;
  notes:                 string;
}

function toDateInput(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso.split("T")[0];
}

function driverToForm(d: Driver): FormState {
  return {
    firstName:             d.firstName,
    lastName:              d.lastName,
    email:                 d.email,
    phone:                 d.phone,
    status:                d.status,
    hireDate:              toDateInput(d.hireDate),
    licenseNumber:         d.licenseNumber,
    licenseClass:          d.licenseClass,
    licenseExpiryDate:     toDateInput(d.licenseExpiryDate),
    dateOfBirth:           toDateInput(d.dateOfBirth),
    nationalId:            d.nationalId            ?? "",
    address:               d.address               ?? "",
    emergencyContactName:  d.emergencyContactName  ?? "",
    emergencyContactPhone: d.emergencyContactPhone ?? "",
    notes:                 d.notes                 ?? "",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────

function EditDriverPage() {
  const { driverId } = Route.useParams();
  const { can }      = usePermission();
  const navigate     = useNavigate();

  // ── Data hooks ─────────────────────────────────────────────────────────────
  // useDriver returns ApiResponse<Driver> — unwrap .data
  const { data: driverResponse, isLoading: loadingDriver, error: loadError } = useDriver(driverId);
  const updateDriver = useUpdateDriver(driverId);

  const driver = driverResponse?.data ?? null;

  // ── Local form state ───────────────────────────────────────────────────────
  const [form,   setForm]   = useState<FormState | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  // Populate form once driver loads (or re-loads after invalidation)
  useEffect(() => {
    if (driver) setForm(driverToForm(driver));
  }, [driver]);

  // ── Guards ─────────────────────────────────────────────────────────────────

  if (!can("drivers:edit")) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-muted-foreground">
        <ShieldAlert className="h-8 w-8" />
        <p className="font-medium">Admin access required</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="p-6 text-sm text-destructive">
        {(loadError as Error).message ?? "Driver not found"}
      </div>
    );
  }

  if (loadingDriver || !form || !driver) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── Field helpers ──────────────────────────────────────────────────────────

  const set =
    (field: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(f => f ? { ...f, [field]: e.target.value } : f);

  const setSelect =
    (field: keyof FormState) => (val: string) =>
      setForm(f => f ? { ...f, [field]: val } : f);

  const inputCls = (field: keyof FormState) =>
    errors[field] ? "border-destructive focus-visible:ring-destructive" : "";

  // ── Validation ─────────────────────────────────────────────────────────────

  const validate = (): boolean => {
    const e: Partial<Record<keyof FormState, string>> = {};
    if (!form.firstName.trim())         e.firstName         = "Required";
    if (!form.lastName.trim())          e.lastName          = "Required";
    if (!form.email.trim())             e.email             = "Required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
                                        e.email             = "Enter a valid email";
    if (!form.phone.trim())             e.phone             = "Required";
    if (!form.hireDate)                 e.hireDate          = "Required";
    if (!form.licenseNumber.trim())     e.licenseNumber     = "Required";
    if (!form.licenseClass.trim())      e.licenseClass      = "Required";
    if (!form.licenseExpiryDate)        e.licenseExpiryDate = "Required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Submit — uses useUpdateDriver, NOT raw fetch ───────────────────────────

  const handleSubmit = async () => {
    if (!validate()) return;

    const payload: DriverUpdate = {
      firstName:         form.firstName.trim(),
      lastName:          form.lastName.trim(),
      email:             form.email.trim(),
      phone:             form.phone.trim(),
      status:            form.status as Driver["status"],
      hireDate:          new Date(form.hireDate).toISOString(),
      licenseNumber:     form.licenseNumber.trim(),
      licenseClass:      form.licenseClass.trim(),
      licenseExpiryDate: new Date(form.licenseExpiryDate).toISOString(),
      // Optional fields — only include if non-empty
      ...(form.dateOfBirth           && { dateOfBirth:           new Date(form.dateOfBirth).toISOString() }),
      ...(form.nationalId.trim()     && { nationalId:            form.nationalId.trim() }),
      ...(form.address.trim()        && { address:               form.address.trim() }),
      ...(form.emergencyContactName.trim()  && { emergencyContactName:  form.emergencyContactName.trim() }),
      ...(form.emergencyContactPhone.trim() && { emergencyContactPhone: form.emergencyContactPhone.trim() }),
      ...(form.notes.trim()          && { notes:                 form.notes.trim() }),
    };

    try {
      // useUpdateDriver handles toast.success + cache invalidation
      await updateDriver.mutateAsync(payload);
      navigate({ to: "/drivers/$driverId", params: { driverId } });
    } catch {
      // useUpdateDriver also handles toast.error — nothing extra needed
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" asChild>
          <Link to="/drivers/$driverId" params={{ driverId }}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Edit Driver</h1>
          <p className="text-sm text-muted-foreground">
            {driver.firstName} {driver.lastName} · {driver.email}
          </p>
        </div>
      </div>

      {/* Form card */}
      <div className="rounded-xl border bg-card divide-y">

        {/* ── Identity ──────────────────────────────────────────────────── */}
        <div className="p-6 space-y-4">
          <SectionHeading title="Identity" />
          <p className="text-xs text-muted-foreground">
            Name and email changes are automatically synced to the driver's login account.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <Field label="First Name" error={errors.firstName}>
              <Input value={form.firstName} onChange={set("firstName")} className={inputCls("firstName")} />
            </Field>
            <Field label="Last Name" error={errors.lastName}>
              <Input value={form.lastName} onChange={set("lastName")} className={inputCls("lastName")} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Email Address" error={errors.email}>
              <Input type="email" value={form.email} onChange={set("email")} className={inputCls("email")} />
            </Field>
            <Field label="Phone" error={errors.phone}>
              <Input value={form.phone} onChange={set("phone")} className={inputCls("phone")} />
            </Field>
          </div>
        </div>

        {/* ── Employment ────────────────────────────────────────────────── */}
        <div className="p-6 space-y-4">
          <SectionHeading title="Employment" />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Status">
              <Select value={form.status} onValueChange={setSelect("status")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="on-leave">On Leave</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Hire Date" error={errors.hireDate}>
              <Input type="date" value={form.hireDate} onChange={set("hireDate")} className={inputCls("hireDate")} />
            </Field>
          </div>
        </div>

        {/* ── License ───────────────────────────────────────────────────── */}
        <div className="p-6 space-y-4">
          <SectionHeading title="License" />
          <div className="grid grid-cols-2 gap-4">
            <Field label="License Number" error={errors.licenseNumber}>
              <Input value={form.licenseNumber} onChange={set("licenseNumber")} className={inputCls("licenseNumber")} />
            </Field>
            <Field label="License Class" error={errors.licenseClass}>
              <Input value={form.licenseClass} onChange={set("licenseClass")} className={inputCls("licenseClass")} />
            </Field>
          </div>
          <Field label="Expiry Date" error={errors.licenseExpiryDate}>
            <Input type="date" value={form.licenseExpiryDate} onChange={set("licenseExpiryDate")}
              className={`max-w-xs ${inputCls("licenseExpiryDate")}`} />
          </Field>
        </div>

        {/* ── Personal ──────────────────────────────────────────────────── */}
        <div className="p-6 space-y-4">
          <SectionHeading title="Personal" />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Date of Birth">
              <Input type="date" value={form.dateOfBirth} onChange={set("dateOfBirth")} />
            </Field>
            <Field label="National ID">
              <Input value={form.nationalId} onChange={set("nationalId")} />
            </Field>
          </div>
          <Field label="Address">
            <Input value={form.address} onChange={set("address")} />
          </Field>
        </div>

        {/* ── Emergency Contact ─────────────────────────────────────────── */}
        <div className="p-6 space-y-4">
          <SectionHeading title="Emergency Contact" />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Contact Name">
              <Input value={form.emergencyContactName} onChange={set("emergencyContactName")} />
            </Field>
            <Field label="Contact Phone">
              <Input value={form.emergencyContactPhone} onChange={set("emergencyContactPhone")} />
            </Field>
          </div>
        </div>

        {/* ── Notes ─────────────────────────────────────────────────────── */}
        <div className="p-6 space-y-4">
          <SectionHeading title="Notes" />
          <Textarea
            value={form.notes}
            onChange={set("notes")}
            rows={3}
            placeholder="Optional remarks…"
          />
        </div>
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-end gap-3">
        <Button variant="outline" asChild>
          <Link to="/drivers/$driverId" params={{ driverId }}>Cancel</Link>
        </Button>
        <Button onClick={handleSubmit} disabled={updateDriver.isPending}>
          {updateDriver.isPending
            ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</>
            : <><Save className="h-4 w-4 mr-2" />Save Changes</>}
        </Button>
      </div>
    </div>
  );
}