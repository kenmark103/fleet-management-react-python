/**
 * components/forms/DriverForm.tsx
 * Fleet Management System
 *
 * REVISED:
 *   - Edit mode only. Create mode removed — driver creation now goes
 *     through the invite flow (drivers/new.tsx → accept-invite → drivers/setup.tsx).
 *   - Removed: userId, tempPassword, confirmPassword fields.
 *   - Removed: useCreateDriver import (no longer used here).
 *   - The form is used by edit.tsx as a shared component when needed,
 *     but edit.tsx currently has its own inline form (see edit.tsx).
 *     This file is kept for any other place that needs a reusable edit form.
 *
 * Props:
 *   defaultValues  — Driver fields pre-filled from the loaded driver
 *   driverId       — required (always edit mode)
 *   onSuccess      — called after mutation succeeds (navigate away, close sheet, etc.)
 */

import { useState } from "react";
import { useUpdateDriver } from "../../hooks/useDrivers";
import type { DriverUpdate } from "../../types/driver";
import { Button }   from "../ui/button";
import { Input }    from "../ui/input";
import { Label }    from "../ui/label";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "../ui/select";
import { Textarea }   from "../ui/textarea";
import { Separator }  from "../ui/separator";

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const toDateInput = (iso?: string): string =>
  iso ? iso.split("T")[0] : "";

const fromDateInput = (val: string): string =>
  val ? new Date(val).toISOString() : "";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface DriverFormProps {
  defaultValues?: Partial<DriverUpdate & {
    licenseExpiryDate?: string;
    hireDate?:          string;
    dateOfBirth?:       string;
  }>;
  driverId:  string;
  onSuccess: () => void;
}

type FormState = {
  firstName:             string;
  lastName:              string;
  email:                 string;
  phone:                 string;
  status:                string;
  licenseNumber:         string;
  licenseClass:          string;
  licenseExpiryDate:     string;
  hireDate:              string;
  dateOfBirth:           string;
  nationalId:            string;
  address:               string;
  emergencyContactName:  string;
  emergencyContactPhone: string;
  notes:                 string;
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function DriverForm({ defaultValues = {}, driverId, onSuccess }: DriverFormProps) {
  const updateDriver = useUpdateDriver(driverId);

  const [form, setForm] = useState<FormState>({
    firstName:             (defaultValues as any).firstName             ?? "",
    lastName:              (defaultValues as any).lastName              ?? "",
    email:                 (defaultValues as any).email                 ?? "",
    phone:                 (defaultValues as any).phone                 ?? "",
    status:                (defaultValues as any).status                ?? "active",
    licenseNumber:         (defaultValues as any).licenseNumber         ?? "",
    licenseClass:          (defaultValues as any).licenseClass          ?? "",
    licenseExpiryDate:     toDateInput((defaultValues as any).licenseExpiryDate),
    hireDate:              toDateInput((defaultValues as any).hireDate),
    dateOfBirth:           toDateInput((defaultValues as any).dateOfBirth),
    nationalId:            (defaultValues as any).nationalId            ?? "",
    address:               (defaultValues as any).address               ?? "",
    emergencyContactName:  (defaultValues as any).emergencyContactName  ?? "",
    emergencyContactPhone: (defaultValues as any).emergencyContactPhone ?? "",
    notes:                 (defaultValues as any).notes                 ?? "",
  });

  const [error, setError] = useState<string | null>(null);

  const set = (field: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }));

  const setSelect = (field: keyof FormState) => (value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const payload: DriverUpdate = {
      firstName:         form.firstName.trim()  || undefined,
      lastName:          form.lastName.trim()   || undefined,
      email:             form.email.trim()      || undefined,
      phone:             form.phone.trim()      || undefined,
      status:            form.status as any,
      licenseNumber:     form.licenseNumber.trim()     || undefined,
      licenseClass:      form.licenseClass.trim()      || undefined,
      licenseExpiryDate: form.licenseExpiryDate ? fromDateInput(form.licenseExpiryDate) : undefined,
      hireDate:          form.hireDate          ? fromDateInput(form.hireDate)          : undefined,
      dateOfBirth:       form.dateOfBirth       ? fromDateInput(form.dateOfBirth)       : undefined,
      nationalId:            form.nationalId.trim()             || undefined,
      address:               form.address.trim()                || undefined,
      emergencyContactName:  form.emergencyContactName.trim()   || undefined,
      emergencyContactPhone: form.emergencyContactPhone.trim()  || undefined,
      notes:                 form.notes.trim()                  || undefined,
    };

    try {
      await updateDriver.mutateAsync(payload);
      onSuccess();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* ── Personal Info ─────────────────────────────────────────── */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Personal Information
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>First Name</Label>
            <Input value={form.firstName} onChange={set("firstName")} />
          </div>
          <div className="space-y-1.5">
            <Label>Last Name</Label>
            <Input value={form.lastName} onChange={set("lastName")} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={set("email")} />
          </div>
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input value={form.phone} onChange={set("phone")} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Date of Birth</Label>
            <Input type="date" value={form.dateOfBirth} onChange={set("dateOfBirth")} />
          </div>
          <div className="space-y-1.5">
            <Label>National ID</Label>
            <Input value={form.nationalId} onChange={set("nationalId")} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Address</Label>
          <Textarea value={form.address} onChange={set("address")} rows={2} />
        </div>
      </section>

      <Separator />

      {/* ── License & Employment ──────────────────────────────────── */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          License & Employment
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>License Number</Label>
            <Input value={form.licenseNumber} onChange={set("licenseNumber")} />
          </div>
          <div className="space-y-1.5">
            <Label>License Class</Label>
            <Input value={form.licenseClass} onChange={set("licenseClass")} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>License Expiry</Label>
            <Input type="date" value={form.licenseExpiryDate} onChange={set("licenseExpiryDate")} />
          </div>
          <div className="space-y-1.5">
            <Label>Hire Date</Label>
            <Input type="date" value={form.hireDate} onChange={set("hireDate")} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={form.status} onValueChange={setSelect("status")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="on-leave">On Leave</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </section>

      <Separator />

      {/* ── Emergency Contact ─────────────────────────────────────── */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Emergency Contact
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={form.emergencyContactName} onChange={set("emergencyContactName")} />
          </div>
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input value={form.emergencyContactPhone} onChange={set("emergencyContactPhone")} />
          </div>
        </div>
      </section>

      <Separator />

      {/* ── Notes ────────────────────────────────────────────────── */}
      <section className="space-y-2">
        <Label>Notes</Label>
        <Textarea value={form.notes} onChange={set("notes")} rows={3}
          placeholder="Optional remarks…" />
      </section>

      {error && (
        <p className="text-sm text-destructive rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <Button type="submit" disabled={updateDriver.isPending} className="min-w-[120px]">
          {updateDriver.isPending ? "Saving…" : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}