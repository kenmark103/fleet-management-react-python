/**
 
 * Shared create / edit form for Driver.
 * Used by:
 *   - DriversPage  (create — no driverId)
 *   - DriverDetailPage (edit  — driverId + defaultValues)
 *
 * Props
 * ─────
 * mode:          "create" | "edit"
 * defaultValues: Partial<DriverCreate> pre-filled for edit
 * onSuccess:     called after mutation succeeds (close sheet / navigate)
 * driverId?:     required for edit mode
 */

import { useState } from "react";
import { useCreateDriver, useUpdateDriver } from "../../hooks/useDrivers";
import type { DriverCreate } from "../../types/driver";
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
import { Textarea } from "../ui/textarea";
import { Separator } from "../ui/separator";

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Convert ISO datetime string → HTML date input value (YYYY-MM-DD) */
const toDateInput = (iso?: string): string =>
  iso ? iso.split("T")[0] : "";

/** Convert HTML date input value → ISO string (midnight UTC) */
const fromDateInput = (val: string): string =>
  val ? new Date(val).toISOString() : "";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface DriverFormProps {
  mode:           "create" | "edit";
  defaultValues?: Partial<DriverCreate>;
  driverId?:      string;
  onSuccess:      () => void;
}

type FormState = Omit<DriverCreate, "licenseExpiryDate" | "hireDate" | "dateOfBirth"> & {
  licenseExpiryDate: string;  // date input value
  hireDate:          string;
  dateOfBirth:       string;
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function DriverForm({
  mode,
  defaultValues = {},
  driverId,
  onSuccess,
}: DriverFormProps) {
  const createDriver = useCreateDriver();
  const updateDriver = useUpdateDriver(driverId ?? "");

  const mutation = mode === "create" ? createDriver : updateDriver;

  const [form, setForm] = useState<FormState>({
    userId:                defaultValues.userId                ?? "",
    firstName:             defaultValues.firstName             ?? "",
    lastName:              defaultValues.lastName              ?? "",
    email:                 defaultValues.email                 ?? "",
    phone:                 defaultValues.phone                 ?? "",
    status:                defaultValues.status                ?? "active",
    licenseNumber:         defaultValues.licenseNumber         ?? "",
    licenseClass:          defaultValues.licenseClass          ?? "",
    licenseExpiryDate:     toDateInput(defaultValues.licenseExpiryDate),
    hireDate:              toDateInput(defaultValues.hireDate),
    dateOfBirth:           toDateInput(defaultValues.dateOfBirth),
    nationalId:            defaultValues.nationalId            ?? "",
    address:               defaultValues.address               ?? "",
    emergencyContactName:  defaultValues.emergencyContactName  ?? "",
    emergencyContactPhone: defaultValues.emergencyContactPhone ?? "",
    notes:                 defaultValues.notes                 ?? "",
  });

  const [error, setError] = useState<string | null>(null);

  // ── Field helpers ─────────────────────────────────────────────────────────

  const set = (field: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const setSelect = (field: keyof FormState) => (value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const payload: DriverCreate = {
      ...form,
      licenseExpiryDate: fromDateInput(form.licenseExpiryDate),
      hireDate:          fromDateInput(form.hireDate),
      dateOfBirth:       form.dateOfBirth ? fromDateInput(form.dateOfBirth) : undefined,
      // Strip empty optional strings → undefined
      nationalId:             form.nationalId             || undefined,
      address:                form.address                || undefined,
      emergencyContactName:   form.emergencyContactName   || undefined,
      emergencyContactPhone:  form.emergencyContactPhone  || undefined,
      notes:                  form.notes                  || undefined,
    };

    try {
      await mutation.mutateAsync(payload as any);
      onSuccess();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* ── Personal Info ─────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Personal Information
        </h3>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="firstName">First Name *</Label>
            <Input
              id="firstName"
              value={form.firstName}
              onChange={set("firstName")}
              required
              placeholder="John"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lastName">Last Name *</Label>
            <Input
              id="lastName"
              value={form.lastName}
              onChange={set("lastName")}
              required
              placeholder="Doe"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={set("email")}
              required
              placeholder="john@example.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone *</Label>
            <Input
              id="phone"
              value={form.phone}
              onChange={set("phone")}
              required
              placeholder="+1 555 000 0000"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="dateOfBirth">Date of Birth</Label>
            <Input
              id="dateOfBirth"
              type="date"
              value={form.dateOfBirth}
              onChange={set("dateOfBirth")}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nationalId">National ID</Label>
            <Input
              id="nationalId"
              value={form.nationalId}
              onChange={set("nationalId")}
              placeholder="ID number"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="address">Address</Label>
          <Textarea
            id="address"
            value={form.address}
            onChange={set("address")}
            rows={2}
            placeholder="Street, City, Country"
          />
        </div>
      </section>

      <Separator />

      {/* ── License & Employment ──────────────────────────────────────── */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          License & Employment
        </h3>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="licenseNumber">License Number *</Label>
            <Input
              id="licenseNumber"
              value={form.licenseNumber}
              onChange={set("licenseNumber")}
              required
              placeholder="DL-0000000"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="licenseClass">License Class *</Label>
            <Input
              id="licenseClass"
              value={form.licenseClass}
              onChange={set("licenseClass")}
              required
              placeholder="Class A"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="licenseExpiryDate">License Expiry *</Label>
            <Input
              id="licenseExpiryDate"
              type="date"
              value={form.licenseExpiryDate}
              onChange={set("licenseExpiryDate")}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hireDate">Hire Date *</Label>
            <Input
              id="hireDate"
              type="date"
              value={form.hireDate}
              onChange={set("hireDate")}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="status">Status *</Label>
            <Select value={form.status} onValueChange={setSelect("status")}>
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="on-leave">On leave</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {mode === "create" && (
            <div className="space-y-1.5">
              <Label htmlFor="userId">User Account ID *</Label>
              <Input
                id="userId"
                value={form.userId}
                onChange={set("userId")}
                required
                placeholder="Linked user UUID"
              />
            </div>
          )}
        </div>
      </section>

      <Separator />

      {/* ── Emergency Contact ─────────────────────────────────────────── */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Emergency Contact
        </h3>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="emergencyContactName">Name</Label>
            <Input
              id="emergencyContactName"
              value={form.emergencyContactName}
              onChange={set("emergencyContactName")}
              placeholder="Jane Doe"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="emergencyContactPhone">Phone</Label>
            <Input
              id="emergencyContactPhone"
              value={form.emergencyContactPhone}
              onChange={set("emergencyContactPhone")}
              placeholder="+1 555 000 0001"
            />
          </div>
        </div>
      </section>

      <Separator />

      {/* ── Notes ────────────────────────────────────────────────────── */}
      <section className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={form.notes}
          onChange={set("notes")}
          rows={3}
          placeholder="Optional remarks…"
        />
      </section>

      {/* ── Error ────────────────────────────────────────────────────── */}
      {error && (
        <p className="text-sm text-destructive rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
          {error}
        </p>
      )}

      {/* ── Actions ──────────────────────────────────────────────────── */}
      <div className="flex justify-end gap-3 pt-2">
        <Button
          type="submit"
          disabled={mutation.isPending}
          className="min-w-[120px]"
        >
          {mutation.isPending
            ? mode === "create" ? "Creating…" : "Saving…"
            : mode === "create" ? "Create Driver" : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}